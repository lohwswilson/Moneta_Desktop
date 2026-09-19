export type AccountType =
  | 'checking'
  | 'chequing'
  | 'savings'
  | 'cash'
  | 'credit'
  | 'credit_card'
  | 'loan'
  | 'mortgage'
  | 'loc'
  | 'brokerage'
  | 'retirement'
  | 'crypto'
  | 'asset'
  | 'property'
  | 'cpf_oa'
  | 'cpf_sa'
  | 'cpf_ma'
  | 'cpf_ra'
  | 'srs'
  | 'epf_akaun_persaraan'
  | 'epf_akaun_sejahtera'
  | 'epf_akaun_fleksibel'
  | 'other';

export type ReconcileState = 'unreconciled' | 'cleared' | 'reconciled' | 'void';

export type TransactionType = 'expense' | 'income' | 'transfer';

export interface MonetaAccount {
  id: string | number;
  name: string;
  account_type: AccountType;
  account_number_mask?: string;
  institution_name?: string;
  currency_code: string;
  current_balance: number;
  cleared_balance: number;
  reconciled_balance?: number;
  interest_rate?: number;
  monthly_payment?: number;
  credit_limit?: number;
  active: boolean;
}

export interface MonetaTransaction {
  id: string | number;
  account_id: string | number;
  account_name?: string;
  date: string; // YYYY-MM-DD
  payee_name: string;
  category_name?: string;
  amount: number; // Negative for debit/expense, positive for deposit/credit
  transaction_type: TransactionType;
  reconciliation_state: ReconcileState;
  running_balance?: number;
  memo?: string;
  tags?: string[];
  transfer_account_id?: string | number;
  created_at?: string;
  splits?: TransactionSplit[];
}

export interface TransactionSplit {
  id?: string;
  category_name: string;
  amount: number;
  memo?: string;
}

export interface CategorizationRule {
  id: string;
  priority: number;
  match_field: 'payee' | 'memo';
  match_pattern: string;
  category_name: string;
}

export interface DashboardMetrics {
  net_worth: number;
  liquid_cash: number;
  investments: number;
  tangible_assets?: number;
  total_liabilities: number;
  monthly_income: number;
  monthly_expenses: number;
  savings_rate_pct: number;
  fire_target_amount: number;
  fire_progress_pct: number;
  monthly_burn_rate: number;
  emergency_runway_months: number;
}

export interface ConnectionConfig {
  /**
   * Which **local** store to use. Sync is orthogonal — see `serverUrl`/`apiToken`.
   *
   * - `local`   — the real SQLite database (the default for a real ledger)
   * - `sandbox` — in-memory demo data for exploring the app without a ledger.
   *               Never syncs, never touches Moneta Cloud.
   *
   * This replaced a `mode: 'odoo' | 'sqlite' | 'mock'` field, where `'odoo'`
   * meant *live queries against the server*. That is incompatible with the
   * local-first model — Odoo is a replication target now, not a query target.
   */
  dataSource: 'local' | 'sandbox';
  /** Moneta Cloud endpoint for optional sync. Empty means local-only. */
  serverUrl: string;
  apiToken: string;
}

/** `upsert` covers insert and update — the sync engine pushes current state either way. */
export type SyncOp = 'upsert' | 'delete';

/**
 * One locally-recorded change awaiting push to Moneta Cloud.
 *
 * Written by SQLite triggers, not application code — see
 * `src/lib/data/syncSchema.ts`. The log is **append-only**: editing a row that
 * has already synced inserts a *new* entry rather than reviving the old one, so
 * `synced_at` marks what was pushed and never needs un-marking.
 */
export interface SyncChange {
  /** Change-log sequence number. Monotonic, so it doubles as the push order. */
  id: number;
  /** Table name — see `SYNC_TRACKED_TABLES`. */
  entity: string;
  entity_id: string;
  op: SyncOp;
  changed_at: string;
  /** NULL until pushed. */
  synced_at?: string;
}

export interface EnvelopeBudget {
  id: string | number;
  name: string;
  category_name: string;
  allocated_amount: number;
  spent_amount: number;
  remaining_amount: number;
  spent_percent?: number;
  period: 'monthly' | 'annual' | 'weekly';
  category_group?: 'need' | 'want' | 'saving';
  rollover?: boolean;
  color_code?: string;
  alert_level?: 'none' | 'warning' | 'critical' | 'over_budget';
}

export interface OdooSettingsPayload {
  base_currency: string;
  base_symbol?: string;
  company_name?: string;
  user_name?: string;
  rates: Record<string, number>;
  rules?: Array<{
    id: string | number;
    priority: number;
    match_field: string;
    match_pattern: string;
    category_name: string;
  }>;
  categories?: Array<{
    id: string | number;
    name: string;
    group?: string;
    color_hex?: string;
  }>;
}

export type BillFrequency = 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'semiannual' | 'yearly';

export interface RecurringBill {
  id: string | number;
  name: string;
  payee_name: string;
  category_name: string;
  account_id?: string | number;
  account_name?: string;
  amount: number;
  frequency: BillFrequency;
  next_due_date: string;
  days_until_due: number;
  due_status: 'overdue' | 'today' | 'due_soon' | 'upcoming';
  auto_pay: boolean;
  active?: boolean;
}

export interface DetectedSubscription {
  payee_name: string;
  average_amount: number;
  detected_frequency: BillFrequency;
  charge_count: number;
  last_charge_date: string;
  account_id?: string | number;
  category_name?: string;
}

export interface CashflowDailyPoint {
  date: string;
  day_of_week: string;
  opening_balance: number;
  total_income: number;
  total_expense: number;
  net_change: number;
  closing_balance: number;
  is_overdraft: boolean;
  event_summary: string;
}

export interface SankeyNode {
  id: string;
  name: string;
  tier: 'inflow' | 'hub' | 'outflow' | 'saving';
  value: number;
  color?: string;
}

export interface SankeyLink {
  source: string;
  target: string;
  value: number;
}

export interface CashflowForecast {
  summary: {
    starting_balance: number;
    lowest_projected_balance: number;
    lowest_balance_date: string;
    ending_projected_balance: number;
    total_projected_income: number;
    total_projected_expenses: number;
    net_projected_cashflow: number;
    overdraft_days_count: number;
    has_overdraft_risk: boolean;
  };
  daily_points: CashflowDailyPoint[];
  sankey: {
    nodes: SankeyNode[];
    links: SankeyLink[];
  };
}

export interface PayeeIntelligence {
  id: string | number;
  name: string;
  default_category_name?: string;
  suggested_category_name?: string;
  total_spend: number;
  transaction_count: number;
  avg_amount: number;
  last_transaction_date?: string;
  detected_cadence?: 'none' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';
  website?: string;
  notes?: string;
}

export type GoalStatus = 'in_progress' | 'achieved' | 'paused';

export interface FinancialGoal {
  id: string | number;
  name: string;
  target_amount: number;
  current_amount: number;
  start_date: string;
  target_date: string;
  account_id?: string | number;
  account_name?: string;
  icon: string;
  color?: number;
  notes?: string;
  /** Computed — see goalMath.ts; never persisted by an adapter. */
  remaining_amount: number;
  progress_percent: number;
  months_remaining: number;
  monthly_contribution_required: number;
  status: GoalStatus;
}

export type SecurityType = 'stock' | 'etf' | 'crypto' | 'mutual_fund' | 'bond';
export type TaxLotStrategy = 'FIFO' | 'LIFO' | 'HIFO' | 'SpecID';
export type TaxLotTermType = 'short_term' | 'long_term';

export interface PortfolioHolding {
  id: string | number;
  account_id: string | number;
  account_name: string;
  security_id: string | number;
  symbol: string;
  name: string;
  security_type: SecurityType;
  currency: string;
  total_quantity: number;
  average_cost: number;
  current_price: number;
  total_cost_basis: number;
  current_market_value: number;
  unrealized_gain: number;
  unrealized_gain_percent: number;
  weight_in_portfolio: number;
  day_change?: number;
  day_change_percent?: number;
  last_quote_date?: string;
}

export interface TaxLot {
  id: string | number;
  holding_id?: string | number;
  account_id: string | number;
  account_name?: string;
  symbol: string;
  purchase_date: string;
  initial_quantity: number;
  remaining_quantity: number;
  purchase_price: number;
  commission_paid?: number;
  total_cost_basis: number;
  current_market_value: number;
  unrealized_gain: number;
  unrealized_gain_percent: number;
  holding_days: number;
  term_type: TaxLotTermType; // short_term (< 365 days) vs long_term (>= 365 days)
  state: 'open' | 'closed';
}

export interface TaxLotDisposal {
  id: string | number;
  lot_id: string | number;
  symbol: string;
  account_id: string | number;
  disposal_date: string;
  quantity_sold: number;
  cost_basis_sold: number;
  proceeds: number;
  realized_gain: number;
  term_type: TaxLotTermType;
  disposal_strategy: TaxLotStrategy;
}

export interface PortfolioSummary {
  total_portfolio_value: number;
  total_cost_basis: number;
  total_unrealized_gain: number;
  total_unrealized_gain_percent: number;
  total_realized_gain_ytd: number;
  holdings_count: number;
  open_lots_count: number;
  time_weighted_return?: number;
  money_weighted_return?: number;
  asset_allocation: Array<{
    category: string;
    value: number;
    percentage: number;
    color: string;
  }>;
}

// ---------------------------------------------------------------------------
// Phase 5: Property, Rental & Loan Scenarios
// ---------------------------------------------------------------------------

export type AssetCategory = 'real_estate' | 'vehicle' | 'jewelry' | 'antiques' | 'other';

export type PropertyType =
  | 'primary_residence'
  | 'vacation_home'
  | 'rental_property'
  | 'commercial'
  | 'land'
  | 'automobile'
  | 'motorcycle'
  | 'luxury_watch'
  | 'fine_jewelry'
  | 'antique_furniture'
  | 'fine_art'
  | 'collectible'
  | 'other';

export interface PropertyValuation {
  id: string | number;
  property_id: string | number;
  valuation_date: string;
  appraised_value: number;
  appraiser?: string;
  notes?: string;
}

export interface PropertyAsset {
  id: string | number;
  name: string;
  asset_category: AssetCategory;
  property_type: PropertyType;
  purchase_date?: string;
  purchase_price?: number;
  current_market_value: number;
  mortgage_account_id?: string | number;
  mortgage_account_name?: string;
  color?: number;
  notes?: string;
  /** Vehicle detail, when `asset_category` is `vehicle`. */
  vehicle_make?: string;
  vehicle_model?: string;
  vehicle_year?: number;
  vehicle_vin?: string;
  vehicle_license_plate?: string;
  vehicle_mileage?: number;
  /** Valuables detail, when `asset_category` is `jewelry` or `antiques`. */
  antique_era?: string;
  maker_artist?: string;
  condition_grade?: 'mint' | 'near_mint' | 'excellent' | 'very_good' | 'good' | 'fair';
  insured_value?: number;
  insurance_policy_number?: string;
  storage_location?: string;
  /** User-entered rental cost inputs — see `propertyMath.ts` for the derivation. */
  monthly_rental_income?: number;
  monthly_property_tax?: number;
  monthly_insurance?: number;
  monthly_hoa_maintenance?: number;
  /**
   * Derived — see `propertyMath.ts`; never persisted by an adapter. Mirrors
   * `moneta.property._compute_equity` and the rental extension's
   * `_compute_rental_metrics`.
   */
  mortgage_balance: number;
  equity_value: number;
  loan_to_value_ratio: number;
  tenant_count: number;
  gross_annual_rental_income: number;
  gross_rental_yield_pct: number;
  net_operating_income: number;
  net_monthly_cashflow: number;
  occupancy_rate_pct: number;
  valuation_history?: PropertyValuation[];
}

export type LeaseStatus = 'upcoming' | 'active' | 'expired' | 'terminated';
export type DepositStatus = 'held' | 'partially_refunded' | 'refunded' | 'forfeited';
export type RentPaymentStatus = 'pending' | 'paid' | 'partial' | 'overdue' | 'waived';

export interface PropertyTenant {
  id: string | number;
  name: string;
  property_id: string | number;
  property_name?: string;
  unit_number?: string;
  email?: string;
  phone?: string;
  emergency_contact?: string;
  lease_start_date: string;
  lease_end_date: string;
  monthly_rent_amount: number;
  rent_due_day: number;
  security_deposit_held?: number;
  security_deposit_refunded?: number;
  deposit_status: DepositStatus;
  notes?: string;
  /** Derived — see `propertyMath.ts`. */
  lease_status: LeaseStatus;
  total_rent_collected: number;
  total_rent_overdue: number;
}

export interface RentPayment {
  id: string | number;
  tenant_id: string | number;
  tenant_name?: string;
  property_id?: string | number;
  /** First day of the rental month this payment covers. */
  period_month: string;
  due_date: string;
  amount_due: number;
  amount_paid: number;
  /** Derived: `max(amount_due − amount_paid, 0)`. */
  balance_due: number;
  paid_date?: string;
  payment_status: RentPaymentStatus;
  memo?: string;
  notes?: string;
}

export interface LoanRateChange {
  id?: string | number;
  scenario_id?: string | number;
  effective_date: string;
  /** Annual rate as a percentage, e.g. 4.25 for 4.25%. */
  annual_rate: number;
  note?: string;
}

export interface AmortizationLine {
  payment_number: number;
  payment_date: string;
  starting_balance: number;
  scheduled_payment: number;
  principal_amount: number;
  interest_amount: number;
  extra_payment: number;
  total_payment: number;
  ending_balance: number;
}

export interface LoanScenario {
  id: string | number;
  name: string;
  account_id?: string | number;
  account_name?: string;
  principal_amount: number;
  annual_interest_rate: number;
  loan_term_years: number;
  loan_term_months: number;
  start_date: string;
  extra_monthly_payment: number;
  lump_sum_payment: number;
  lump_sum_date?: string;
  rate_changes?: LoanRateChange[];
  /**
   * Derived — see `loanMath.ts`; never persisted by an adapter. Mirrors
   * `moneta.loan.scenario._compute_amortization_schedule`.
   */
  monthly_payment: number;
  total_payment_original: number;
  total_interest_original: number;
  original_payoff_date: string;
  total_payment_actual: number;
  total_interest_actual: number;
  actual_payoff_date: string;
  interest_saved: number;
  months_saved: number;
  years_saved: number;
}

// --- Milestone 1: Singapore Regional Wealth Pack ---

export interface CPFAccountSummary {
  oa_balance: number;
  sa_balance: number;
  ma_balance: number;
  ra_balance: number;
  total_balance: number;
  total_annual_interest: number;
  extra_interest_earned: number;
  user_age: number;
  monthly_salary?: number;
}

export interface CPFHousingRecord {
  id: string | number;
  property_name: string;
  purchase_date: string;
  purchase_price: number;
  valuation: number;
  oa_withdrawn_downpayment: number;
  oa_withdrawn_monthly: number;
  housing_grant_amount: number;
  outstanding_loan: number;
  ownership_years: number;
  /** Derived metrics — see `cpfMath.ts` */
  accrued_interest: number;
  total_refund_due: number;
  net_sale_cash_proceeds: number;
  notes?: string;
  created_at?: string;
}

export interface IRASTaxRecord {
  id: string | number;
  assessment_year: number;
  employment_income: number;
  trade_income: number;
  rental_income: number;
  other_income: number;
  cpf_employee_relief: number;
  earned_income_relief: number;
  srs_contribution: number;
  rstu_self: number;
  rstu_family: number;
  nsman_relief: number;
  child_relief: number;
  parent_relief: number;
  donations_250: number;
  /** Derived metrics — see `irasMath.ts` */
  total_income: number;
  total_reliefs: number;
  chargeable_income: number;
  tax_payable: number;
  effective_tax_rate_pct: number;
  marginal_tax_rate_pct: number;
  srs_potential_tax_savings: number;
  notes?: string;
  created_at?: string;
}

export interface SSBBondRecord {
  id: string | number;
  issue_code: string;
  investment_amount: number;
  issue_date: string;
  maturity_date: string;
  funding_source: 'cash' | 'srs';
  rate_year_1: number;
  rate_year_2: number;
  rate_year_3: number;
  rate_year_4: number;
  rate_year_5: number;
  rate_year_6: number;
  rate_year_7: number;
  rate_year_8: number;
  rate_year_9: number;
  rate_year_10: number;
  average_10yr_yield: number;
  total_interest_to_maturity: number;
  next_coupon_payout: number;
  state: 'active' | 'redeemed' | 'matured';
  notes?: string;
  created_at?: string;
}

export interface TBillRecord {
  id: string | number;
  issue_code: string;
  tenure_type: '6_month' | '1_year';
  auction_date?: string;
  issue_date: string;
  maturity_date: string;
  funding_source: 'cash' | 'cpf_oa' | 'cpf_sa' | 'srs';
  face_value: number;
  issue_price_per_hundred: number;
  total_investment_cost: number;
  net_discount_profit: number;
  cut_off_yield_p_a: number;
  state: 'active' | 'matured';
  notes?: string;
  created_at?: string;
}

export interface SRSTrackerRecord {
  id: string | number;
  tax_year: number;
  residency_status: 'citizen_pr' | 'foreigner';
  annual_cap: number;
  total_contributed: number;
  remaining_allowance: number;
  marginal_tax_rate: number;
  estimated_tax_savings: number;
  srs_current_balance: number;
  annual_withdrawal_target: number;
  annual_taxable_portion: number;
  is_tax_free_strategy: boolean;
  notes?: string;
  created_at?: string;
}

export interface UCITSComparisonRecord {
  id: string | number;
  name: string;
  portfolio_value: number;
  dividend_yield_pct: number;
  expected_growth_rate: number;
  investment_horizon_years: number;
  annual_tax_savings_with_ucits: number;
  cumulative_tax_savings_horizon: number;
  us_estate_tax_exposure: number;
  notes?: string;
}


