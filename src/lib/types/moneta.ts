export type AccountType =
  | 'checking'
  | 'savings'
  | 'cash'
  | 'credit'
  | 'loan'
  | 'mortgage'
  | 'brokerage'
  | 'retirement'
  | 'crypto'
  | 'cpf_oa'
  | 'cpf_sa'
  | 'cpf_ma'
  | 'cpf_ra'
  | 'srs'
  | 'epf_akaun_persaraan'
  | 'epf_akaun_sejahtera'
  | 'epf_akaun_fleksibel';

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
