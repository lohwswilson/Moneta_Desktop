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
  mode: 'odoo' | 'sqlite' | 'mock';
  serverUrl: string;
  apiToken: string;
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




