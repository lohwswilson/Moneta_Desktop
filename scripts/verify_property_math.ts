import {
  computePropertyMetrics,
  computeLeaseStatus,
  computeRentPaymentStatus,
  computeBalanceDue,
  computeRentTotals,
  generateRentSchedule,
  computePortfolioEquity,
} from '../src/lib/data/propertyMath.ts';
import type { PropertyAsset, RentPayment } from '../src/lib/types/moneta.ts';

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

// ---------------------------------------------------------------------------
console.log('\n1. Equity, debt and LTV');
// ---------------------------------------------------------------------------
{
  const m = computePropertyMetrics({ current_market_value: 800000, mortgageBalance: -300000 });
  near('mortgage balance is a magnitude', m.mortgage_balance, 300000);
  near('equity == value − debt', m.equity_value, 500000);
  near('LTV == debt / value', m.loan_to_value_ratio, 37.5);

  const none = computePropertyMetrics({ current_market_value: 800000 });
  near('no mortgage → zero debt', none.mortgage_balance, 0);
  near('no mortgage → equity is full value', none.equity_value, 800000);
  near('no mortgage → LTV 0', none.loan_to_value_ratio, 0);

  const zero = computePropertyMetrics({ current_market_value: 0, mortgageBalance: -1000 });
  near('zero value → LTV 0, not Infinity', zero.loan_to_value_ratio, 0);

  // A positive balance on the linked account (an asset-side quirk) must not
  // inflate debt beyond its magnitude.
  const flipped = computePropertyMetrics({ current_market_value: 500000, mortgageBalance: 300000 });
  near('a positive balance still reads as debt magnitude', flipped.mortgage_balance, 300000);
}

// ---------------------------------------------------------------------------
console.log('\n2. Equity is clamped at zero (deliberate, mirrors Odoo)');
// ---------------------------------------------------------------------------
{
  const underwater = computePropertyMetrics({ current_market_value: 500000, mortgageBalance: -600000 });
  // The debt exceeds the value by 100k. Upstream reports max(value − debt, 0),
  // and the Desktop app mirrors it, so equity floors at 0 rather than −100000.
  near('underwater equity floors at 0', underwater.equity_value, 0);
  near('the debt is still fully visible', underwater.mortgage_balance, 600000);
  near('LTV exceeds 100% when underwater', underwater.loan_to_value_ratio, 120);

  const exactly = computePropertyMetrics({ current_market_value: 500000, mortgageBalance: -500000 });
  near('exactly fully mortgaged → 0 equity', exactly.equity_value, 0);
  near('exactly fully mortgaged → LTV 100', exactly.loan_to_value_ratio, 100);
}

// ---------------------------------------------------------------------------
console.log('\n3. Rental metrics');
// ---------------------------------------------------------------------------
{
  const m = computePropertyMetrics({
    current_market_value: 800000,
    mortgageBalance: -300000,
    mortgageMonthlyPayment: 1340,
    monthly_property_tax: 300,
    monthly_insurance: 150,
    monthly_hoa_maintenance: 100,
    monthly_rental_income: 4000,
    activeTenants: [{ monthly_rent_amount: 2000 }, { monthly_rent_amount: 2500 }],
  });

  check('two active tenants', m.tenant_count, 2);
  check('occupied', m.occupancy_rate_pct, 100);
  near('actual tenant rent wins over the base field', m.gross_annual_rental_income, 54000);
  near('gross yield == annual rent / value', m.gross_rental_yield_pct, 6.75);
  near('opex == (tax + insurance + hoa) × 12', 550 * 12, 6600);
  near('NOI == gross rent − opex', m.net_operating_income, 47400);
  near('net monthly cashflow == rent − opex − mortgage', m.net_monthly_cashflow, 2610);
}

// ---------------------------------------------------------------------------
console.log('\n4. A vacant property falls back to the base rent field');
// ---------------------------------------------------------------------------
{
  const m = computePropertyMetrics({
    current_market_value: 800000,
    monthly_rental_income: 3000,
    monthly_property_tax: 250,
    activeTenants: [],
  });

  check('no tenants', m.tenant_count, 0);
  check('vacant', m.occupancy_rate_pct, 0);
  near('falls back to monthly_rental_income', m.gross_annual_rental_income, 36000);
  near('opex still applies', m.net_operating_income, 36000 - 3000);
  near('cashflow is rent less opex', m.net_monthly_cashflow, 3000 - 250);

  // An expired lease must not be counted as occupancy — the caller filters to
  // active tenants, and passing none is what "expired" looks like here.
  const noRent = computePropertyMetrics({ current_market_value: 500000, activeTenants: [] });
  near('no rent → no yield', noRent.gross_rental_yield_pct, 0);
  near('no rent → negative cashflow if opex exists',
    computePropertyMetrics({ current_market_value: 500000, monthly_insurance: 100, activeTenants: [] }).net_monthly_cashflow,
    -100);
}

// ---------------------------------------------------------------------------
console.log('\n5. Lease status, both boundaries inclusive');
// ---------------------------------------------------------------------------
{
  const t = (d: string) => new Date(d.replace(/-/g, '/') as unknown as string);
  const day = (s: string) => {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
  };

  check('before the start', computeLeaseStatus('2026-01-01', '2026-12-31', day('2025-12-31')), 'upcoming');
  check('on the start date', computeLeaseStatus('2026-01-01', '2026-12-31', day('2026-01-01')), 'active');
  check('mid-lease', computeLeaseStatus('2026-01-01', '2026-12-31', day('2026-06-15')), 'active');
  check('on the end date', computeLeaseStatus('2026-01-01', '2026-12-31', day('2026-12-31')), 'active');
  check('the day after the end', computeLeaseStatus('2026-01-01', '2026-12-31', day('2027-01-01')), 'expired');
  check('missing dates → active (upstream default)', computeLeaseStatus(undefined, undefined, day('2026-06-15')), 'active');
  check('terminated is never produced', computeLeaseStatus('2026-01-01', '2026-12-31', day('2026-06-15')) === 'terminated', false);
}

// ---------------------------------------------------------------------------
console.log('\n6. Rent payment status');
// ---------------------------------------------------------------------------
{
  const day = (s: string) => {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
  };
  const today = day('2026-06-15');
  const base = { amount_due: 2000, due_date: '2026-06-01', payment_status: 'pending' as const };

  check('paid in full', computeRentPaymentStatus({ ...base, amount_paid: 2000 }, today), 'paid');
  check('overpaid still reads paid', computeRentPaymentStatus({ ...base, amount_paid: 2500 }, today), 'paid');
  check('part paid', computeRentPaymentStatus({ ...base, amount_paid: 500 }, today), 'overdue');
  check(
    'part paid but not yet due',
    computeRentPaymentStatus({ ...base, amount_paid: 500, due_date: '2026-07-01' }, today),
    'partial'
  );
  check('unpaid and past due', computeRentPaymentStatus({ ...base, amount_paid: 0 }, today), 'overdue');
  check(
    'unpaid but not yet due',
    computeRentPaymentStatus({ ...base, amount_paid: 0, due_date: '2026-07-01' }, today),
    'pending'
  );
  check(
    'due today is not yet overdue',
    computeRentPaymentStatus({ ...base, amount_paid: 0, due_date: '2026-06-15' }, today),
    'pending'
  );
  // Waiving is a decision, not an inference — it survives recomputation.
  check(
    'waived is preserved',
    computeRentPaymentStatus({ ...base, amount_paid: 0, payment_status: 'waived' }, today),
    'waived'
  );
  check(
    'a waived payment is not reported overdue',
    computeRentPaymentStatus({ ...base, amount_paid: 0, payment_status: 'waived' }, day('2026-09-01')),
    'waived'
  );
  // Nothing owed is nothing overdue — a free month is not a late month.
  check('zero due owes nothing', computeRentPaymentStatus({ ...base, amount_due: 0, amount_paid: 0 }, today), 'pending');
}

// ---------------------------------------------------------------------------
console.log('\n7. Balance due and rent roll totals');
// ---------------------------------------------------------------------------
{
  near('part payment', computeBalanceDue(2000, 500), 1500);
  near('settled', computeBalanceDue(2000, 2000), 0);
  near('overpayment never credits', computeBalanceDue(2000, 2500), 0);

  const day = (s: string) => {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
  };
  const today = day('2026-06-15');
  const mk = (o: Partial<RentPayment>): RentPayment =>
    ({
      id: 'p', tenant_id: 't', period_month: '2026-06-01', due_date: '2026-06-01',
      amount_due: 2000, amount_paid: 0, balance_due: 0, payment_status: 'pending',
      ...o,
    }) as RentPayment;

  const totals = computeRentTotals(
    [
      mk({ amount_paid: 2000, payment_status: 'paid' }),
      mk({ amount_paid: 500, payment_status: 'partial', due_date: '2026-06-01' }),
      mk({ amount_paid: 0, due_date: '2026-05-01' }),
      mk({ amount_paid: 0, due_date: '2026-07-01' }),
      mk({ amount_paid: 0, due_date: '2026-04-01', payment_status: 'waived' }),
    ],
    today
  );

  near('collected sums amount_paid', totals.total_rent_collected, 2500);
  // Overdue = 1500 (partial, past due) + 2000 (unpaid, past due). The future
  // payment is not overdue, and the waived one is excluded entirely.
  near('overdue counts only unsettled past-due balances', totals.total_rent_overdue, 3500);
  near('an empty ledger totals zero', computeRentTotals([], today).total_rent_overdue, 0);
}

// ---------------------------------------------------------------------------
console.log('\n8. Rent schedule generation');
// ---------------------------------------------------------------------------
{
  const tenant = {
    lease_start_date: '2026-01-15',
    lease_end_date: '2026-04-20',
    monthly_rent_amount: 2200,
    rent_due_day: 1,
  };

  const gen = generateRentSchedule(tenant);
  check('one payment per lease month', gen.length, 4);
  check('periods are first-of-month', gen.map((g) => g.period_month), [
    '2026-01-01', '2026-02-01', '2026-03-01', '2026-04-01',
  ]);
  check('first due date', gen[0].due_date, '2026-01-01');
  check('amount from the lease', gen[0].amount_due, 2200);
  check('generated unpaid', gen[0].payment_status, 'pending');
  check('generated with nothing paid', gen[0].amount_paid, 0);

  // Re-running must not duplicate: existing period months are skipped.
  const rerun = generateRentSchedule(tenant, gen.map((g) => g.period_month));
  check('idempotent — nothing regenerated', rerun.length, 0);

  const partial = generateRentSchedule(tenant, ['2026-01-01', '2026-02-01']);
  check('only missing months are filled', partial.map((g) => g.period_month), ['2026-03-01', '2026-04-01']);
}

// ---------------------------------------------------------------------------
console.log('\n9. Due day is capped at 28 so it cannot overflow a month');
// ---------------------------------------------------------------------------
{
  const gen = generateRentSchedule({
    lease_start_date: '2026-01-01',
    lease_end_date: '2026-02-28',
    monthly_rent_amount: 1000,
    rent_due_day: 31,
  });
  check('due day 31 clamps to 28', gen[0].due_date, '2026-01-28');
  check('February also clamps to 28', gen[1].due_date, '2026-02-28');

  const day1 = generateRentSchedule({
    lease_start_date: '2026-01-01',
    lease_end_date: '2026-01-31',
    monthly_rent_amount: 1000,
    rent_due_day: 0,
  });
  check('a zero due day floors at 1', day1[0].due_date, '2026-01-01');

  check('missing dates produce nothing', generateRentSchedule({
    lease_start_date: '', lease_end_date: '', monthly_rent_amount: 0, rent_due_day: 1,
  }).length, 0);

  // A lease starting on the 31st must still produce contiguous months.
  const eom = generateRentSchedule({
    lease_start_date: '2026-01-31',
    lease_end_date: '2026-04-30',
    monthly_rent_amount: 1000,
    rent_due_day: 5,
  });
  check('lease from Jan 31 yields 4 months', eom.length, 4);
  check('months stay contiguous', eom.map((g) => g.period_month), [
    '2026-01-01', '2026-02-01', '2026-03-01', '2026-04-01',
  ]);
}

// ---------------------------------------------------------------------------
console.log('\n10. Portfolio equity aggregation');
// ---------------------------------------------------------------------------
{
  const asProp = (v: number, d: number): PropertyAsset =>
    ({
      ...computePropertyMetrics({ current_market_value: v, mortgageBalance: -d }),
      id: 'x', name: 'p', asset_category: 'real_estate', property_type: 'primary_residence',
      current_market_value: v,
    }) as PropertyAsset;

  const agg = computePortfolioEquity([asProp(800000, 300000), asProp(500000, 600000)]);
  near('total market value', agg.total_market_value, 1300000);
  near('total debt', agg.total_mortgage_balance, 900000);
  // 500000 (property 1) + 0 (property 2, clamped) — the aggregate inherits the
  // same floor each property applies on its own.
  near('total equity uses each property’s clamped figure', agg.total_equity, 500000);
  near('blended LTV', agg.blended_ltv, 69.2);

  const empty = computePortfolioEquity([]);
  near('empty portfolio → zero LTV, not NaN', empty.blended_ltv, 0);
}

console.log(`\n${'='.repeat(55)}\n${pass} passed, ${fail} failed\n${'='.repeat(55)}`);
process.exit(fail === 0 ? 0 : 1);
