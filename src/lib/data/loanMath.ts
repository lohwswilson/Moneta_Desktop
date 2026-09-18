import type { AmortizationLine, LoanRateChange } from '../types/moneta';

/**
 * Single source of truth for loan and mortgage mathematics.
 *
 * Mirrors `moneta_finance/models/loan.py`. Both the SQLite and Mock adapters
 * call this rather than recomputing, per AGENTS.md Rule 7 (One Derivation, One
 * Place) — the same rule `goalMath.ts` and `portfolioMath.ts` follow.
 *
 * Four behaviours here are deliberate, and each is a bug that a naive
 * reimplementation gets wrong. They are mirrored from upstream, where the
 * comments record the same reasoning:
 *
 * 1. **The schedule is built from the currency-rounded payment, not the
 *    annuity.** `monthly_payment` is a Monetary, so Odoo rounds it to 2dp on
 *    write and the schedule reads that stored value. A payment a fraction of a
 *    cent smaller needs an extra installment to clear the balance — 361
 *    payments against 360 on a 300k / 6% / 30y loan. `monthlyPayment` is
 *    returned at full precision for display; `scheduledPayment` is the figure
 *    the table is actually built from.
 * 2. **The payoff date is read from the loop**, never computed as
 *    `start + months`. An N-payment schedule advances N−1 intervals from the
 *    first payment, so neither `start + N` nor `start + (N−1)` is right on its
 *    own once rounding adds a final installment.
 * 3. **A remainder smaller than one further payment is absorbed** into the
 *    final scheduled installment, so a 360-month loan is 360 payments. A
 *    genuine shortfall — more owed than one payment covers — still runs past
 *    the term rather than being silently truncated.
 * 4. **`monthsSaved` is measured against the computed baseline schedule**, not
 *    the nominal term. The two differ by one whenever a residue adds a payment.
 *
 * One deliberate divergence from upstream: `loan.py` applies the remainder
 * absorption in its *baseline* summary loop and in `action_generate_schedule`,
 * but **not** in its accelerated summary loop — so upstream's accelerated
 * totals and its own displayed table can disagree by one installment. Here a
 * single schedule builder serves both, and every summary figure is derived from
 * the schedule it describes. The figures therefore always match the table the
 * user is looking at.
 */

/** Rounds to the currency's 2dp precision, as Odoo's Monetary field does on write. */
export function currencyRound(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

/** Parses 'YYYY-MM-DD' as a local date — `new Date(str)` would parse as UTC and can shift a day. */
export function parseDateOnly(value: string): Date {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function toDateOnlyString(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${m}-${d}`;
}

/**
 * Calendar month arithmetic, equivalent to Python's
 * `relativedelta(months=n)`: the day-of-month is clamped to the target month's
 * length, so 2026-01-31 + 1 month is 2026-02-28 rather than overflowing into
 * March.
 */
export function addMonths(base: Date, months: number): Date {
  const total = base.getMonth() + months;
  const year = base.getFullYear() + Math.floor(total / 12);
  const month = ((total % 12) + 12) % 12;
  const lastDay = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(base.getDate(), lastDay));
}

/**
 * Standard annuity payment: PMT = P · [r(1+r)^n] / [(1+r)^n − 1].
 * Falls back to straight-line P/n when the rate is zero.
 */
export function computeAnnuityPayment(
  principal: number,
  annualRatePct: number,
  termMonths: number
): number {
  if (principal <= 0 || termMonths <= 0) return 0;
  const r = annualRatePct / 100 / 12;
  if (r <= 0) return principal / termMonths;
  const growth = (1 + r) ** termMonths;
  return (principal * (r * growth)) / (growth - 1);
}

/**
 * Resolves a scenario's term in months from its two stored fields.
 *
 * `loan_term_months` is **authoritative when set**; otherwise the term derives
 * from `loan_term_years`. The two are **never summed**.
 *
 * That is the whole point of this function. Three call sites previously
 * disagreed about what `loan_term_months` meant: both adapters summed it with
 * `years × 12` (treating it as a remainder), while `LoanHub` read it raw
 * (treating it as the total). The create form writes the *total* into
 * `loan_term_months` while also sending years — so the adapters double-counted,
 * and a 25-year loan became 600 months: the payment came out 34% too low and
 * total interest 118% too high. Meanwhile any scenario seeded with months
 * unset produced an empty schedule, because the hub read the raw zero.
 *
 * Mirrors `loan.py::_compute_term_months`, where months derive from years.
 * **Every call site must use this** rather than reading either field directly.
 */
export function resolveTermMonths(scenario: {
  loan_term_months?: number | null;
  loan_term_years?: number | null;
}): number {
  const explicit = Number(scenario.loan_term_months) || 0;
  if (explicit > 0) return explicit;
  return (Number(scenario.loan_term_years) || 0) * 12;
}

export interface ScheduleOptions {
  principal: number;
  /** Annual rate as a percentage, e.g. 5.5 for 5.5%. */
  annualRatePct: number;
  termMonths: number;
  startDate: string;
  extraMonthly?: number;
  lumpSum?: number;
  lumpSumDate?: string;
  rateChanges?: LoanRateChange[];
}

export interface AmortizationResult {
  /** Full-precision annuity, for display. */
  monthlyPayment: number;
  /** The currency-rounded payment the schedule is built from. */
  scheduledPayment: number;
  lines: AmortizationLine[];
  totalInterest: number;
  totalPaid: number;
  payoffDate: string;
  months: number;
  /** True when the schedule ran past its stated term because the balance could not be cleared. */
  ranPastTerm: boolean;
}

const MAX_MONTHS = 1200;
const ZERO_TOLERANCE = 0.0001;

/**
 * Builds a month-by-month amortization schedule.
 *
 * With no `extraMonthly` and no `lumpSum` this is the baseline schedule; supply
 * either and it is the accelerated one. Both go through this single function so
 * their summaries cannot drift from their own line tables.
 */
export function buildSchedule(opts: ScheduleOptions): AmortizationResult {
  const principal = Number(opts.principal) || 0;
  const annualRatePct = Number(opts.annualRatePct) || 0;
  const termMonths = Math.max(0, Math.floor(opts.termMonths) || 0);
  const start = parseDateOnly(opts.startDate);

  const empty: AmortizationResult = {
    monthlyPayment: 0,
    scheduledPayment: 0,
    lines: [],
    totalInterest: 0,
    totalPaid: 0,
    payoffDate: opts.startDate,
    months: 0,
    ranPastTerm: false,
  };

  if (principal <= 0 || termMonths <= 0) return empty;

  const r = annualRatePct / 100 / 12;
  const annuity = computeAnnuityPayment(principal, annualRatePct, termMonths);
  const monthlyPayment = round(annuity, 4);
  // The figure the table is built from — see note 1 in the module docstring.
  const scheduledPayment = currencyRound(monthlyPayment);

  if (scheduledPayment <= 0) return { ...empty, monthlyPayment, scheduledPayment };

  const extraMonthly = Number(opts.extraMonthly) || 0;
  const lumpSum = Number(opts.lumpSum) || 0;
  const lumpDate = opts.lumpSumDate ? parseDateOnly(opts.lumpSumDate) : null;
  const rateChanges = [...(opts.rateChanges || [])]
    .filter((rc) => rc.effective_date)
    .sort((a, b) => a.effective_date.localeCompare(b.effective_date));

  const lines: AmortizationLine[] = [];
  let balance = principal;
  let totalInterest = 0;
  let monthIdx = 0;

  while (balance > ZERO_TOLERANCE && monthIdx < MAX_MONTHS) {
    monthIdx += 1;
    const curDate = addMonths(start, monthIdx - 1);

    // The latest rate change effective on or before this date wins; the list is
    // ascending, so each match overwrites the previous.
    let curR = r;
    const curDateStr = toDateOnlyString(curDate);
    for (const rc of rateChanges) {
      if (curDateStr >= rc.effective_date) curR = Number(rc.annual_rate) / 100 / 12;
    }

    const interest = balance * curR;
    let schedPrincipal = Math.min(scheduledPayment - interest, balance);

    let lumpThisMonth = 0;
    if (lumpDate && lumpSum > 0 && curDate.getFullYear() === lumpDate.getFullYear() && curDate.getMonth() === lumpDate.getMonth()) {
      lumpThisMonth = lumpSum;
    }

    let extraTotal = extraMonthly + lumpThisMonth;
    if (schedPrincipal + extraTotal > balance) {
      extraTotal = Math.max(balance - schedPrincipal, 0);
    }

    let totalPrincipal = schedPrincipal + extraTotal;
    let endBalance = Math.max(balance - totalPrincipal, 0);

    // Note 3: absorb a remainder smaller than one further payment into the final
    // scheduled installment. A genuine shortfall (endBalance >= totalPrincipal)
    // is left alone so the schedule keeps running rather than truncating debt.
    if (monthIdx >= termMonths && endBalance > 0 && endBalance < totalPrincipal) {
      extraTotal = 0;
      schedPrincipal = balance;
      totalPrincipal = balance;
      endBalance = 0;
    }

    lines.push({
      payment_number: monthIdx,
      payment_date: curDateStr,
      starting_balance: round(balance, 4),
      scheduled_payment: round(schedPrincipal + interest, 4),
      principal_amount: round(schedPrincipal, 4),
      interest_amount: round(interest, 4),
      extra_payment: round(extraTotal, 4),
      total_payment: round(schedPrincipal + interest + extraTotal, 4),
      ending_balance: round(endBalance, 4),
    });

    totalInterest += interest;
    balance = endBalance;
  }

  const last = lines[lines.length - 1];

  return {
    monthlyPayment,
    scheduledPayment,
    lines,
    totalInterest: round(totalInterest, 4),
    totalPaid: round(principal + totalInterest, 4),
    // Note 2: read from the loop, never derived by month arithmetic.
    payoffDate: last ? last.payment_date : opts.startDate,
    months: lines.length,
    ranPastTerm: lines.length > termMonths,
  };
}

export interface PrepaymentResult {
  baseline: AmortizationResult;
  accelerated: AmortizationResult;
  interestSaved: number;
  monthsSaved: number;
  yearsSaved: number;
}

/**
 * Compares the baseline schedule against the same loan with prepayments, and
 * reports the interest and time saved.
 *
 * `monthsSaved` is measured against the computed baseline (note 4), so it stays
 * correct when a rounding residue adds an installment to that baseline.
 */
export function simulatePrepayment(opts: ScheduleOptions): PrepaymentResult {
  // The baseline is the same loan with no prepayments at all. Building it from
  // `opts` would carry the very extra payment it is supposed to be measuring
  // against, and every saving would compute as zero.
  const { extraMonthly: _e, lumpSum: _l, lumpSumDate: _d, rateChanges, ...base } = opts;
  const baseline = buildSchedule({ ...base, rateChanges });
  const accelerated = buildSchedule({
    ...base,
    rateChanges,
    extraMonthly: opts.extraMonthly ?? 0,
    lumpSum: opts.lumpSum ?? 0,
    lumpSumDate: opts.lumpSumDate,
  });

  const interestSaved = round(Math.max(baseline.totalInterest - accelerated.totalInterest, 0), 4);
  const monthsSaved = Math.max(baseline.months - accelerated.months, 0);

  return {
    baseline,
    accelerated,
    interestSaved,
    monthsSaved,
    yearsSaved: round(monthsSaved / 12, 1),
  };
}

export interface RateObservation {
  date: string;
  /** Annualised rate as a percentage, derived from an observed interest payment. */
  rate: number;
  interest: number;
  balance: number;
}

/**
 * Infers historical rate segments from observed interest payments, mirroring
 * `loan.py::action_infer_rate_changes`.
 *
 * Each observation annualises the interest actually charged: `(interest /
 * balance) * 12 * 100`. A new segment begins whenever an observation deviates
 * from the current segment's median by at least 15 basis points.
 */
export function detectRateChanges(
  observations: RateObservation[],
  stepThresholdPct = 0.15
): Array<{ effective_date: string; annual_rate: number; observation_count: number }> {
  if (observations.length < 2) return [];

  const sorted = [...observations].sort((a, b) => a.date.localeCompare(b.date));
  const segments: RateObservation[][] = [];
  let current: RateObservation[] = [sorted[0]];

  for (const obs of sorted.slice(1)) {
    const rates = current.map((o) => o.rate).sort((a, b) => a - b);
    const median = rates[Math.floor(rates.length / 2)];
    if (Math.abs(obs.rate - median) >= stepThresholdPct) {
      segments.push(current);
      current = [obs];
    } else {
      current.push(obs);
    }
  }
  if (current.length) segments.push(current);

  // The first segment is the loan's opening rate, not a change — it is returned
  // as segment 0 so the caller can set annual_interest_rate from it, matching
  // upstream, which writes it to the scenario rather than creating a rate change.
  return segments.map((seg) => {
    const rates = seg.map((s) => s.rate).sort((a, b) => a - b);
    return {
      effective_date: seg[0].date,
      annual_rate: round(rates[Math.floor(rates.length / 2)], 3),
      observation_count: seg.length,
    };
  });
}
