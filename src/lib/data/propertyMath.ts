import type {
  PropertyAsset,
  PropertyTenant,
  RentPayment,
  LeaseStatus,
  RentPaymentStatus,
} from '../types/moneta';
// The explicit `.ts` extension is required here, unlike the type-only imports
// elsewhere: this is a *runtime* import between two shared math modules, and
// the `node --experimental-strip-types` verification scripts must resolve it
// without a bundler. `allowImportingTsExtensions` in tsconfig.app.json permits
// it, and Vite resolves it natively.
import { addMonths, parseDateOnly, toDateOnlyString } from './loanMath.ts';

/**
 * Single source of truth for property equity, rental performance and rent-roll
 * derivation.
 *
 * Mirrors `moneta_finance/models/property.py::_compute_equity` and the rental
 * extension in `moneta_finance_property/models/rental_property.py`
 * (`_compute_rental_metrics`, `_compute_lease_status`, `_compute_balance_due`).
 *
 * Both the SQLite and Mock adapters call this rather than recomputing, per
 * AGENTS.md Rule 7 (One Derivation, One Place) — the same rule `goalMath.ts`,
 * `portfolioMath.ts` and `loanMath.ts` follow.
 *
 * Date handling is imported from `loanMath.ts` so the two modules cannot
 * disagree about what "one month later" means.
 */

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

/** Today at local midnight, so date comparisons are date-only. */
function todayDateOnly(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export type PropertyMetrics = Pick<
  PropertyAsset,
  | 'mortgage_balance'
  | 'equity_value'
  | 'loan_to_value_ratio'
  | 'tenant_count'
  | 'gross_annual_rental_income'
  | 'gross_rental_yield_pct'
  | 'net_operating_income'
  | 'net_monthly_cashflow'
  | 'occupancy_rate_pct'
>;

export interface PropertyMetricsInput {
  current_market_value: number;
  /** The linked mortgage account's current balance, as a signed liability (negative). */
  mortgageBalance?: number;
  /** The linked mortgage account's monthly payment, for the cashflow line. */
  mortgageMonthlyPayment?: number;
  monthly_rental_income?: number;
  monthly_property_tax?: number;
  monthly_insurance?: number;
  monthly_hoa_maintenance?: number;
  /** Only tenants whose lease is `active` contribute rent. */
  activeTenants?: Array<{ monthly_rent_amount: number }>;
}

/**
 * Derives every figure `moneta.property` reports.
 *
 * **Equity is clamped at zero**, mirroring upstream's
 * `max(market_value − debt, 0)`. This was a deliberate choice: the Desktop app
 * stays numerically identical to Odoo, at the cost that an underwater property
 * — one owing more than it is worth — reads as zero equity rather than as a
 * negative figure. The debt itself is still visible in `loan_to_value_ratio`
 * and in the linked account's balance, so the loss is not hidden, only the
 * net-equity line is floored.
 */
export function computePropertyMetrics(input: PropertyMetricsInput): PropertyMetrics {
  const marketValue = Number(input.current_market_value) || 0;

  // The linked account carries debt as a negative balance on a liability
  // account; equity compares magnitudes.
  const debt = Math.abs(Number(input.mortgageBalance) || 0);

  const mortgage_balance = debt;
  const equity_value = Math.max(marketValue - debt, 0);
  const loan_to_value_ratio = round(marketValue > 0 ? (debt / marketValue) * 100 : 0, 1);

  const activeTenants = input.activeTenants || [];
  const tenant_count = activeTenants.length;
  const occupancy_rate_pct = activeTenants.length > 0 ? 100 : 0;

  // Active tenants' actual rent wins; the base field is the fallback for a
  // vacant or not-yet-let property.
  const monthlyRent =
    activeTenants.length > 0
      ? activeTenants.reduce((sum, t) => sum + (Number(t.monthly_rent_amount) || 0), 0)
      : Number(input.monthly_rental_income) || 0;

  const gross_annual_rental_income = round(monthlyRent * 12, 4);
  const gross_rental_yield_pct = round(
    marketValue > 0 ? (gross_annual_rental_income / marketValue) * 100 : 0,
    2
  );

  const monthlyOpex =
    (Number(input.monthly_property_tax) || 0) +
    (Number(input.monthly_insurance) || 0) +
    (Number(input.monthly_hoa_maintenance) || 0);

  const net_operating_income = round(gross_annual_rental_income - monthlyOpex * 12, 4);
  const mortgageMonthly = Number(input.mortgageMonthlyPayment) || 0;
  const net_monthly_cashflow = round(monthlyRent - monthlyOpex - mortgageMonthly, 4);

  return {
    mortgage_balance,
    equity_value: round(equity_value, 4),
    loan_to_value_ratio,
    tenant_count,
    gross_annual_rental_income,
    gross_rental_yield_pct,
    net_operating_income,
    net_monthly_cashflow,
    occupancy_rate_pct,
  };
}

/**
 * Lease status from the lease dates, mirroring
 * `rental_property.py::_compute_lease_status`.
 *
 * Both boundaries are inclusive: a lease starting today is already `active`,
 * and one ending today is still `active` until the day passes.
 *
 * `terminated` is a valid status but is never produced here — upstream cannot
 * reach it either, since no compute or action assigns it. It is a manual state.
 */
export function computeLeaseStatus(
  leaseStart: string | undefined,
  leaseEnd: string | undefined,
  today: Date = todayDateOnly()
): LeaseStatus {
  if (!leaseStart || !leaseEnd) return 'active';

  const start = parseDateOnly(leaseStart);
  const end = parseDateOnly(leaseEnd);

  if (today.getTime() < start.getTime()) return 'upcoming';
  if (today.getTime() > end.getTime()) return 'expired';
  return 'active';
}

/**
 * Derives a rent payment's status.
 *
 * Upstream's `_compute_balance_due` only ever assigns `paid` or `partial`, and
 * leaves `overdue` and `waived` to logic that does not exist in the module
 * (verified: neither value is assigned anywhere in `rental_property.py`). A
 * rent roll that cannot say "overdue" is not a rent roll, so this derivation
 * adds it: an unsettled payment past its due date is `overdue`.
 *
 * `waived` is preserved when already set, because waiving is a decision rather
 * than an inference.
 *
 * Timing is checked **before** part-payment, so a payment that is partly paid
 * and past its due date reads `overdue` rather than `partial`. The two are
 * orthogonal in reality — an amount state and a timing state — and with one
 * field the missed deadline is the more actionable fact: it is what the rent
 * roll chases, and `amount_paid` still carries the part-payment detail.
 */
export function computeRentPaymentStatus(
  payment: Pick<RentPayment, 'amount_due' | 'amount_paid' | 'due_date' | 'payment_status'>,
  today: Date = todayDateOnly()
): RentPaymentStatus {
  if (payment.payment_status === 'waived') return 'waived';

  const due = Number(payment.amount_due) || 0;
  const paid = Number(payment.amount_paid) || 0;

  if (due > 0 && paid >= due) return 'paid';

  const dueDate = payment.due_date ? parseDateOnly(payment.due_date) : null;
  const isPastDue = !!dueDate && dueDate.getTime() < today.getTime();

  // A deadline missed with money still owed is overdue, whether or not part of
  // it has been paid.
  if (isPastDue && due > paid) return 'overdue';

  if (paid > 0) return 'partial';

  return 'pending';
}

/** `max(amount_due − amount_paid, 0)` — never negative, so an overpayment does not read as a credit. */
export function computeBalanceDue(amountDue: number, amountPaid: number): number {
  return round(Math.max((Number(amountDue) || 0) - (Number(amountPaid) || 0), 0), 4);
}

export interface RentTotals {
  total_rent_collected: number;
  total_rent_overdue: number;
}

/** Collected is every payment's `amount_paid`; overdue counts only unsettled balances past due. */
export function computeRentTotals(
  payments: RentPayment[],
  today: Date = todayDateOnly()
): RentTotals {
  let collected = 0;
  let overdue = 0;

  for (const p of payments) {
    collected += Number(p.amount_paid) || 0;
    if (computeRentPaymentStatus(p, today) === 'overdue') {
      overdue += computeBalanceDue(p.amount_due, p.amount_paid);
    }
  }

  return {
    total_rent_collected: round(collected, 4),
    total_rent_overdue: round(overdue, 4),
  };
}

export interface GeneratedRentPayment {
  period_month: string;
  due_date: string;
  amount_due: number;
  amount_paid: number;
  payment_status: RentPaymentStatus;
}

/**
 * Generates one rent payment per lease month, mirroring
 * `rental_property.py::action_generate_rent_schedule`.
 *
 * `period_month` is the **first** of the rental month and identifies the slot,
 * so re-running the generator skips months that already have a payment rather
 * than duplicating them. The due day is capped at 28 so a due day of 29–31 can
 * never overflow into the following month.
 */
export function generateRentSchedule(
  tenant: Pick<
    PropertyTenant,
    'lease_start_date' | 'lease_end_date' | 'monthly_rent_amount' | 'rent_due_day'
  >,
  existingPeriodMonths: string[] = []
): GeneratedRentPayment[] {
  if (!tenant.lease_start_date || !tenant.lease_end_date) return [];

  const existing = new Set(existingPeriodMonths);
  const start = parseDateOnly(tenant.lease_start_date);
  const end = parseDateOnly(tenant.lease_end_date);

  const startOfMonth = new Date(start.getFullYear(), start.getMonth(), 1);
  const dueDay = Math.min(Math.max(Number(tenant.rent_due_day) || 1, 1), 28);
  const amount = Number(tenant.monthly_rent_amount) || 0;

  const generated: GeneratedRentPayment[] = [];
  let cursor = startOfMonth;
  let guard = 0;

  while (cursor.getTime() <= end.getTime() && guard < 1200) {
    guard += 1;
    const periodMonth = toDateOnlyString(cursor);

    if (!existing.has(periodMonth)) {
      generated.push({
        period_month: periodMonth,
        due_date: toDateOnlyString(new Date(cursor.getFullYear(), cursor.getMonth(), dueDay)),
        amount_due: amount,
        amount_paid: 0,
        payment_status: 'pending',
      });
    }
    cursor = addMonths(cursor, 1);
  }

  return generated;
}

/** Net equity across a portfolio of properties, using the same clamped rule as each property. */
export function computePortfolioEquity(properties: PropertyAsset[]): {
  total_market_value: number;
  total_mortgage_balance: number;
  total_equity: number;
  blended_ltv: number;
} {
  const totalMarket = properties.reduce((s, p) => s + (Number(p.current_market_value) || 0), 0);
  const totalDebt = properties.reduce((s, p) => s + (Number(p.mortgage_balance) || 0), 0);
  const totalEquity = properties.reduce((s, p) => s + (Number(p.equity_value) || 0), 0);

  return {
    total_market_value: round(totalMarket, 4),
    total_mortgage_balance: round(totalDebt, 4),
    total_equity: round(totalEquity, 4),
    blended_ltv: round(totalMarket > 0 ? (totalDebt / totalMarket) * 100 : 0, 1),
  };
}
