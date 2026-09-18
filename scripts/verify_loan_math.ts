import {
  buildSchedule,
  simulatePrepayment,
  computeAnnuityPayment,
  detectRateChanges,
  addMonths,
  currencyRound,
  toDateOnlyString,
} from '../src/lib/data/loanMath.ts';

let pass = 0;
let fail = 0;

function check(label: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    pass++;
    console.log(`  ✅ ${label}: ${a}`);
  } else {
    fail++;
    console.log(`  ❌ ${label}: got ${a}, expected ${e}`);
  }
}

function near(label: string, actual: number, expected: number, tol = 0.01) {
  if (Math.abs(actual - expected) <= tol) {
    pass++;
    console.log(`  ✅ ${label}: ${actual}`);
  } else {
    fail++;
    console.log(`  ❌ ${label}: got ${actual}, expected ~${expected} (±${tol})`);
  }
}

const BASE = {
  principal: 300000,
  annualRatePct: 6,
  termMonths: 360,
  startDate: '2026-01-01',
};

// ---------------------------------------------------------------------------
console.log('\n1. The 360-vs-361 installment bug');
// ---------------------------------------------------------------------------
{
  const s = buildSchedule(BASE);
  // The whole point of building from the currency-rounded payment: a 30-year
  // loan must be 360 payments, not 361. With the full-precision annuity left
  // unrounded this is 361.
  check('installment count == term', s.lines.length, 360);
  check('ranPastTerm', s.ranPastTerm, false);
  check('final ending balance', s.lines[s.lines.length - 1].ending_balance, 0);
  check('payment numbers are 1..360', s.lines[0].payment_number, 1);
  check('last payment number', s.lines[s.lines.length - 1].payment_number, 360);

  // scheduledPayment is the 2dp figure the table is built from; monthlyPayment
  // keeps full precision for display. They must not be the same object.
  check('scheduledPayment is currency-rounded', s.scheduledPayment, currencyRound(s.monthlyPayment));
  check('monthlyPayment retains 4dp precision', s.monthlyPayment !== s.scheduledPayment, true);
  near('scheduledPayment ≈ 1798.65', s.scheduledPayment, 1798.65);
}

// ---------------------------------------------------------------------------
console.log('\n2. Payoff date is read from the loop, not derived');
// ---------------------------------------------------------------------------
{
  const s = buildSchedule(BASE);
  const last = s.lines[s.lines.length - 1];
  check('payoffDate == last line date', s.payoffDate, last.payment_date);
  // 360 payments advance 359 intervals from the first, not 360.
  check('first payment date', s.lines[0].payment_date, '2026-01-01');
  check('last payment date', s.payoffDate, '2055-12-01');
}

// ---------------------------------------------------------------------------
console.log('\n3. Principal is fully repaid and interest is consistent');
// ---------------------------------------------------------------------------
{
  const s = buildSchedule(BASE);
  const principalPaid = s.lines.reduce((sum, l) => sum + l.principal_amount, 0);
  near('principal repaid == principal', principalPaid, 300000, 0.05);

  const interestSum = s.lines.reduce((sum, l) => sum + l.interest_amount, 0);
  near('totalInterest == sum of line interest', s.totalInterest, interestSum, 0.05);
  near('totalPaid == principal + interest', s.totalPaid, 300000 + s.totalInterest, 0.05);

  // Interest on a 6% 30-year loan is a little over the principal.
  check('interest is in a sane range', s.totalInterest > 340000 && s.totalInterest < 360000, true);
}

// ---------------------------------------------------------------------------
console.log('\n4. Zero-rate loan is straight-line');
// ---------------------------------------------------------------------------
{
  const s = buildSchedule({ ...BASE, annualRatePct: 0 });
  check('installments == term', s.lines.length, 360);
  near('payment == P/n', s.scheduledPayment, 300000 / 360, 0.01);
  near('total interest == 0', s.totalInterest, 0, 0.0001);
}

// ---------------------------------------------------------------------------
console.log('\n5. A genuine shortfall keeps running past term (not truncated)');
// ---------------------------------------------------------------------------
{
  // A 6%-based payment cannot service a 30% rate: interest exceeds the payment,
  // the balance grows, and the schedule must run on rather than writing the
  // debt off at the term boundary.
  const s = buildSchedule({
    principal: 100000,
    annualRatePct: 6,
    termMonths: 60,
    startDate: '2026-01-01',
    rateChanges: [{ effective_date: '2026-02-01', annual_rate: 30 }],
  });
  check('ran past term', s.ranPastTerm, true);
  check('final balance still outstanding', s.lines[s.lines.length - 1].ending_balance > 0, true);
  check('hit the 1200-month safety cap', s.lines.length, 1200);
}

// ---------------------------------------------------------------------------
console.log('\n6. Prepayment saves interest and time');
// ---------------------------------------------------------------------------
{
  const sim = simulatePrepayment({ ...BASE, extraMonthly: 500 });

  check('baseline months', sim.baseline.months, 360);
  check('accelerated pays off sooner', sim.accelerated.months < 360, true);
  check('interest saved is positive', sim.interestSaved > 0, true);
  check(
    'monthsSaved == baseline − accelerated',
    sim.monthsSaved,
    sim.baseline.months - sim.accelerated.months
  );
  near('yearsSaved == monthsSaved / 12', sim.yearsSaved, Math.round((sim.monthsSaved / 12) * 10) / 10, 0.05);
  near(
    'interestSaved == baseline − accelerated interest',
    sim.interestSaved,
    sim.baseline.totalInterest - sim.accelerated.totalInterest,
    0.05
  );
  // Extra principal must actually retire the loan, so the accelerated run pays
  // more principal per month than the baseline.
  check('accelerated pays more principal', sim.accelerated.lines[0].extra_payment, 500);
}

// ---------------------------------------------------------------------------
console.log('\n7. A lump sum applies in its month only');
// ---------------------------------------------------------------------------
{
  const sim = simulatePrepayment({
    ...BASE,
    lumpSum: 20000,
    lumpSumDate: '2027-06-15',
  });
  const withLump = sim.accelerated.lines.filter((l) => l.extra_payment > 0);
  check('exactly one line carries the lump', withLump.length, 1);
  check('the lump lands in the right month', withLump[0].payment_date.slice(0, 7), '2027-06');
  check('the lump is the full amount', withLump[0].extra_payment, 20000);
  check('a lump sum shortens the loan', sim.accelerated.months < 360, true);
}

// ---------------------------------------------------------------------------
console.log('\n8. Step-rate mortgages apply from their effective date');
// ---------------------------------------------------------------------------
{
  const s = buildSchedule({
    ...BASE,
    rateChanges: [{ effective_date: '2028-01-01', annual_rate: 9 }],
  });
  const before = s.lines.find((l) => l.payment_date === '2027-12-01')!;
  const after = s.lines.find((l) => l.payment_date === '2028-01-01')!;
  // Same balance either side of the step, but a higher rate must charge more
  // interest on a similar balance.
  const ratioBefore = before.interest_amount / before.starting_balance;
  const ratioAfter = after.interest_amount / after.starting_balance;
  near('rate steps from 0.5%/mo to 0.75%/mo', Math.round((ratioAfter / ratioBefore) * 100) / 100, 1.5, 0.01);
  check('a higher rate extends the loan', s.months > 360, true);
}

// ---------------------------------------------------------------------------
console.log('\n9. Calendar arithmetic clamps like relativedelta');
// ---------------------------------------------------------------------------
{
  // Formatted with the module's own helper — `toISOString()` converts to UTC
  // and shifts a local midnight back a day outside UTC.
  const d = (date: Date) => toDateOnlyString(date);
  check('Jan 31 + 1 month', d(addMonths(new Date(2026, 0, 31), 1)), '2026-02-28');
  check('Jan 31 + 1 month (leap)', d(addMonths(new Date(2028, 0, 31), 1)), '2028-02-29');
  check('Dec 15 + 1 month crosses year', d(addMonths(new Date(2026, 11, 15), 1)), '2027-01-15');
  check('Mar 31 - 1 month', d(addMonths(new Date(2026, 2, 31), -1)), '2026-02-28');
  check('+12 months', d(addMonths(new Date(2026, 5, 10), 12)), '2027-06-10');
  // A loan starting on the 31st must not skip months as it walks forward.
  const s = buildSchedule({ ...BASE, startDate: '2026-01-31' });
  check('schedule from Jan 31 has 360 payments', s.lines.length, 360);
  check('second payment clamps to Feb 28', s.lines[1].payment_date, '2026-02-28');
}

// ---------------------------------------------------------------------------
console.log('\n10. Rate-change inference step detector');
// ---------------------------------------------------------------------------
{
  // Two stable plateaus 1.5pp apart should segment into exactly two groups.
  const obs = [
    ...Array.from({ length: 6 }, (_, i) => ({
      date: `2026-0${i + 1}-01`,
      rate: 2.6,
      interest: 650,
      balance: 300000,
    })),
    ...Array.from({ length: 6 }, (_, i) => ({
      date: `2026-${String(i + 7).padStart(2, '0')}-01`,
      rate: 4.1,
      interest: 1025,
      balance: 300000,
    })),
  ];
  const segs = detectRateChanges(obs);
  check('two segments detected', segs.length, 2);
  check('first segment rate', segs[0].annual_rate, 2.6);
  check('second segment rate', segs[1].annual_rate, 4.1);
  check('first segment starts at first observation', segs[0].effective_date, '2026-01-01');
  check('second segment starts where the step is', segs[1].effective_date, '2026-07-01');

  check('one observation is not enough', detectRateChanges([]).length, 0);
  check(
    'a single observation yields nothing',
    detectRateChanges([{ date: '2026-01-01', rate: 3, interest: 750, balance: 300000 }]).length,
    0
  );

  // Noise under the 15bp threshold must not fracture a plateau.
  const noisy = Array.from({ length: 8 }, (_, i) => ({
    date: `2026-${String(i + 1).padStart(2, '0')}-01`,
    rate: 3.0 + (i % 2 === 0 ? 0.05 : -0.05),
    interest: 750,
    balance: 300000,
  }));
  check('sub-threshold noise stays one segment', detectRateChanges(noisy).length, 1);
}

// ---------------------------------------------------------------------------
console.log('\n11. Degenerate inputs');
// ---------------------------------------------------------------------------
{
  check('zero principal', buildSchedule({ ...BASE, principal: 0 }).lines.length, 0);
  check('zero term', buildSchedule({ ...BASE, termMonths: 0 }).lines.length, 0);
  check('negative principal', buildSchedule({ ...BASE, principal: -5 }).lines.length, 0);
  const z = buildSchedule({ ...BASE, termMonths: 0 });
  check('empty schedule is inert', [z.totalInterest, z.totalPaid, z.months], [0, 0, 0]);
  near('annuity of zero principal', computeAnnuityPayment(0, 6, 360), 0, 0.0001);
  near('annuity at zero rate', computeAnnuityPayment(12000, 0, 12), 1000, 0.0001);
}

console.log(`\n${'='.repeat(55)}\n${pass} passed, ${fail} failed\n${'='.repeat(55)}`);
process.exit(fail === 0 ? 0 : 1);
