import type { IMonetaRepository } from './repository';
import type {
  MonetaAccount,
  MonetaTransaction,
  DashboardMetrics,
  ReconcileState,
  EnvelopeBudget,
  OdooSettingsPayload,
} from '../types/moneta';

let mockAccounts: MonetaAccount[] = [
  {
    id: 'acc-1',
    name: 'DBS High Interest Checking',
    account_type: 'checking',
    account_number_mask: '••••4829',
    institution_name: 'DBS Bank',
    currency_code: 'SGD',
    current_balance: 14850.5,
    cleared_balance: 14200.0,
    reconciled_balance: 12500.0,
    interest_rate: 3.5,
    active: true,
  },
  {
    id: 'acc-2',
    name: 'Emergency Savings Reserve',
    account_type: 'savings',
    account_number_mask: '••••1092',
    institution_name: 'OCBC Bank',
    currency_code: 'SGD',
    current_balance: 45000.0,
    cleared_balance: 45000.0,
    reconciled_balance: 45000.0,
    interest_rate: 4.1,
    active: true,
  },
  {
    id: 'acc-3',
    name: 'IBKR Global Wealth Portfolio',
    account_type: 'brokerage',
    account_number_mask: '••••U928',
    institution_name: 'Interactive Brokers',
    currency_code: 'USD',
    current_balance: 168400.75,
    cleared_balance: 168400.75,
    reconciled_balance: 168400.75,
    active: true,
  },
  {
    id: 'acc-4',
    name: 'CPF Ordinary Account (OA)',
    account_type: 'cpf_oa',
    account_number_mask: '••••8821',
    institution_name: 'CPF Board',
    currency_code: 'SGD',
    current_balance: 92350.0,
    cleared_balance: 92350.0,
    reconciled_balance: 92350.0,
    interest_rate: 2.5,
    active: true,
  },
  {
    id: 'acc-5',
    name: 'StanChart Simply Cash Credit Card',
    account_type: 'credit',
    account_number_mask: '••••3910',
    institution_name: 'Standard Chartered',
    currency_code: 'SGD',
    current_balance: -2480.6,
    cleared_balance: -2150.0,
    credit_limit: 15000.0,
    active: true,
  },
  {
    id: 'acc-6',
    name: 'HDB Concessionary Housing Loan',
    account_type: 'mortgage',
    account_number_mask: '••••5521',
    institution_name: 'HDB',
    currency_code: 'SGD',
    current_balance: -285000.0,
    cleared_balance: -285000.0,
    interest_rate: 2.6,
    monthly_payment: 1340.0,
    active: true,
  },
  {
    id: 'acc-7',
    name: 'Tanjong Pagar 4-Room Flat',
    account_type: 'asset',
    institution_name: 'Real Estate',
    currency_code: 'SGD',
    current_balance: 780000.0,
    cleared_balance: 780000.0,
    active: true,
  },
];

let mockTransactions: MonetaTransaction[] = [
  {
    id: 'tx-1',
    account_id: 'acc-1',
    account_name: 'DBS High Interest Checking',
    date: '2026-09-17',
    payee_name: 'FairPrice Finest Supermarket',
    category_name: 'Split',
    amount: -128.45,
    transaction_type: 'expense',
    reconciliation_state: 'cleared',
    running_balance: 14850.5,
    memo: 'Weekly family groceries & supplies',
    splits: [
      { id: 'sp-1', category_name: 'Groceries', amount: -98.45, memo: 'Food & produce' },
      { id: 'sp-2', category_name: 'Household Supplies', amount: -30.00, memo: 'Kitchen essentials' },
    ],
  },
  {
    id: 'tx-2',
    account_id: 'acc-1',
    account_name: 'DBS High Interest Checking',
    date: '2026-09-16',
    payee_name: 'Singapore Power Utilities',
    category_name: 'Utilities',
    amount: -210.8,
    transaction_type: 'expense',
    reconciliation_state: 'cleared',
    running_balance: 14978.95,
    memo: 'Electricity & water bill Aug-Sep',
  },
  {
    id: 'tx-3',
    account_id: 'acc-1',
    account_name: 'DBS High Interest Checking',
    date: '2026-09-15',
    payee_name: 'Tech Consulting Client',
    category_name: 'Income & Salary',
    amount: 8500.0,
    transaction_type: 'income',
    reconciliation_state: 'reconciled',
    running_balance: 15189.75,
    memo: 'Retainer milestone payout',
  },
  {
    id: 'tx-4',
    account_id: 'acc-1',
    account_name: 'DBS High Interest Checking',
    date: '2026-09-12',
    payee_name: 'Bacha Coffee ION Orchard',
    category_name: 'Dining & Cafes',
    amount: -45.5,
    transaction_type: 'expense',
    reconciliation_state: 'unreconciled',
    running_balance: 6689.75,
    memo: 'Afternoon coffee meeting',
  },
  {
    id: 'tx-5',
    account_id: 'acc-1',
    account_name: 'DBS High Interest Checking',
    date: '2026-09-10',
    payee_name: 'Grab Transport SG',
    category_name: 'Transportation',
    amount: -32.8,
    transaction_type: 'expense',
    reconciliation_state: 'unreconciled',
    running_balance: 6735.25,
    memo: 'CBD to airport trip',
  },
  {
    id: 'tx-6',
    account_id: 'acc-5',
    account_name: 'StanChart Simply Cash Credit Card',
    date: '2026-09-14',
    payee_name: 'Apple Services Monthly',
    category_name: 'Subscriptions',
    amount: -39.98,
    transaction_type: 'expense',
    reconciliation_state: 'cleared',
    running_balance: -2480.6,
    memo: 'iCloud 2TB + Apple One Premier',
  },
];

export class MockAdapter implements IMonetaRepository {
  async testConnection(): Promise<{ success: boolean; message: string; user?: string }> {
    return {
      success: true,
      message: 'Demo Sandbox Active',
      user: 'Wilson Loh (Demo)',
    };
  }

  async getDashboardSummary(): Promise<DashboardMetrics> {
    const liquid = mockAccounts
      .filter((a) => ['checking', 'chequing', 'savings', 'cash', 'cpf_oa', 'cpf_sa', 'cpf_ma', 'cpf_ra', 'srs', 'epf_akaun_persaraan', 'epf_akaun_sejahtera', 'epf_akaun_fleksibel'].includes(a.account_type))
      .reduce((sum, a) => sum + a.current_balance, 0);

    const investments = mockAccounts
      .filter((a) => ['brokerage', 'retirement', 'crypto'].includes(a.account_type))
      .reduce((sum, a) => sum + a.current_balance, 0);

    const tangibleAssets = mockAccounts
      .filter((a) => ['asset', 'property', 'other'].includes(a.account_type))
      .reduce((sum, a) => sum + a.current_balance, 0);

    const liabilities = mockAccounts
      .filter((a) => ['credit', 'credit_card', 'loc', 'loan', 'mortgage'].includes(a.account_type))
      .reduce((sum, a) => sum + Math.abs(a.current_balance), 0);

    const netWorth = liquid + investments + tangibleAssets - liabilities;

    return {
      net_worth: netWorth,
      liquid_cash: liquid,
      investments: investments,
      tangible_assets: tangibleAssets,
      total_liabilities: liabilities,
      monthly_income: 14500.0,
      monthly_expenses: 4200.0,
      savings_rate_pct: 71.0,
      fire_target_amount: 4200 * 12 * 25,
      fire_progress_pct: Number(Math.min(100, (netWorth / (4200 * 12 * 25)) * 100).toFixed(1)),
      monthly_burn_rate: 4200.0,
      emergency_runway_months: Number((liquid / 4200.0).toFixed(1)),
    };
  }

  async getAccounts(): Promise<MonetaAccount[]> {
    return [...mockAccounts];
  }

  async getAccountTransactions(
    accountId: string | number,
    _limit?: number
  ): Promise<MonetaTransaction[]> {
    return mockTransactions.filter((t) => String(t.account_id) === String(accountId));
  }

  async updateReconciliationState(
    transactionId: string | number,
    state: ReconcileState
  ): Promise<{ success: boolean; cleared_balance?: number }> {
    const tx = mockTransactions.find((t) => String(t.id) === String(transactionId));
    if (tx) {
      tx.reconciliation_state = state;
      return { success: true };
    }
    return { success: false };
  }

  async createTransaction(payload: Partial<MonetaTransaction>): Promise<MonetaTransaction> {
    const newTx: MonetaTransaction = {
      id: `tx-${Date.now()}`,
      account_id: payload.account_id || 'acc-1',
      date: payload.date || new Date().toISOString().split('T')[0],
      payee_name: payload.payee_name || 'Expense',
      category_name: payload.category_name || (payload.splits && payload.splits.length > 0 ? 'Split' : 'General'),
      amount: Number(payload.amount || 0),
      transaction_type: (payload.amount || 0) >= 0 ? 'income' : 'expense',
      reconciliation_state: payload.reconciliation_state || 'unreconciled',
      memo: payload.memo || '',
      splits: payload.splits,
    };
    mockTransactions.unshift(newTx);
    return newTx;
  }

  async batchCreateTransactions(
    accountId: string | number,
    transactions: Partial<MonetaTransaction>[]
  ): Promise<MonetaTransaction[]> {
    const created: MonetaTransaction[] = [];
    for (let i = 0; i < transactions.length; i++) {
      const p = transactions[i];
      const tx: MonetaTransaction = {
        id: `tx-${Date.now()}-${i}`,
        account_id: accountId,
        date: p.date || new Date().toISOString().split('T')[0],
        payee_name: p.payee_name || 'Transaction',
        category_name: p.category_name || 'General',
        amount: Number(p.amount || 0),
        transaction_type: (p.amount || 0) >= 0 ? 'income' : 'expense',
        reconciliation_state: p.reconciliation_state || 'unreconciled',
        memo: p.memo || '',
        splits: p.splits,
      };
      mockTransactions.unshift(tx);
      created.push(tx);
    }
    return created;
  }

  async getBudgets(): Promise<EnvelopeBudget[]> {
    return [...mockBudgets];
  }

  async createBudget(payload: Partial<EnvelopeBudget>): Promise<EnvelopeBudget> {
    const allocated = Number(payload.allocated_amount || 0);
    const spent = Number(payload.spent_amount || 0);
    const pct = allocated > 0 ? Math.round((spent / allocated) * 100) : 0;
    let alertLevel: 'none' | 'warning' | 'critical' | 'over_budget' = 'none';
    if (pct >= 100) alertLevel = 'over_budget';
    else if (pct >= 85) alertLevel = 'critical';
    else if (pct >= 70) alertLevel = 'warning';

    const newBudget: EnvelopeBudget = {
      id: payload.id || `bgt-${Date.now()}`,
      name: payload.name || 'New Budget',
      category_name: payload.category_name || 'General',
      allocated_amount: allocated,
      spent_amount: spent,
      remaining_amount: allocated - spent,
      spent_percent: pct,
      period: payload.period || 'monthly',
      category_group: payload.category_group || 'need',
      rollover: payload.rollover ?? false,
      color_code: payload.color_code || '#3b82f6',
      alert_level: alertLevel,
    };
    mockBudgets.push(newBudget);
    return newBudget;
  }

  async updateBudget(id: string | number, payload: Partial<EnvelopeBudget>): Promise<EnvelopeBudget> {
    const idx = mockBudgets.findIndex((b) => String(b.id) === String(id));
    if (idx === -1) throw new Error(`Budget ${id} not found`);

    const existing = mockBudgets[idx];
    const allocated = payload.allocated_amount !== undefined ? Number(payload.allocated_amount) : existing.allocated_amount;
    const spent = payload.spent_amount !== undefined ? Number(payload.spent_amount) : existing.spent_amount;
    const pct = allocated > 0 ? Math.round((spent / allocated) * 100) : 0;
    let alertLevel: 'none' | 'warning' | 'critical' | 'over_budget' = 'none';
    if (pct >= 100) alertLevel = 'over_budget';
    else if (pct >= 85) alertLevel = 'critical';
    else if (pct >= 70) alertLevel = 'warning';

    const updated: EnvelopeBudget = {
      ...existing,
      ...payload,
      allocated_amount: allocated,
      spent_amount: spent,
      remaining_amount: allocated - spent,
      spent_percent: pct,
      alert_level: alertLevel,
    };
    mockBudgets[idx] = updated;
    return updated;
  }

  async deleteBudget(id: string | number): Promise<boolean> {
    const idx = mockBudgets.findIndex((b) => String(b.id) === String(id));
    if (idx !== -1) {
      mockBudgets.splice(idx, 1);
      return true;
    }
    return false;
  }

  async getSettings(): Promise<OdooSettingsPayload | null> {
    return {
      base_currency: 'SGD',
      base_symbol: '$',
      company_name: 'Demo Company',
      user_name: 'Demo Sandbox User',
      rates: {
        SGD: 1.0,
        MYR: 3.18,
        USD: 0.76335878,
      },
    };
  }

  async syncSettingsFromOdoo(_settings: OdooSettingsPayload): Promise<void> {
    // Mock adapter no-op
  }
}

let mockBudgets: EnvelopeBudget[] = [
  {
    id: 'bgt-1',
    name: 'Groceries & Provisions',
    category_name: 'Groceries',
    allocated_amount: 650.0,
    spent_amount: 412.5,
    remaining_amount: 237.5,
    spent_percent: 63,
    period: 'monthly',
    category_group: 'need',
    rollover: true,
    color_code: '#10b981',
    alert_level: 'none',
  },
  {
    id: 'bgt-2',
    name: 'Dining & Hawker Food',
    category_name: 'Dining',
    allocated_amount: 450.0,
    spent_amount: 385.0,
    remaining_amount: 65.0,
    spent_percent: 86,
    period: 'monthly',
    category_group: 'want',
    rollover: false,
    color_code: '#f59e0b',
    alert_level: 'critical',
  },
  {
    id: 'bgt-3',
    name: 'Utilities & Telco',
    category_name: 'Utilities',
    allocated_amount: 250.0,
    spent_amount: 145.2,
    remaining_amount: 104.8,
    spent_percent: 58,
    period: 'monthly',
    category_group: 'need',
    rollover: false,
    color_code: '#3b82f6',
    alert_level: 'none',
  },
  {
    id: 'bgt-4',
    name: 'Public Transport & Grab',
    category_name: 'Transportation',
    allocated_amount: 200.0,
    spent_amount: 195.0,
    remaining_amount: 5.0,
    spent_percent: 98,
    period: 'monthly',
    category_group: 'need',
    rollover: false,
    color_code: '#6366f1',
    alert_level: 'critical',
  },
  {
    id: 'bgt-5',
    name: 'Shopping & Retail',
    category_name: 'Shopping',
    allocated_amount: 300.0,
    spent_amount: 320.0,
    remaining_amount: -20.0,
    spent_percent: 107,
    period: 'monthly',
    category_group: 'want',
    rollover: false,
    color_code: '#ec4899',
    alert_level: 'over_budget',
  },
  {
    id: 'bgt-6',
    name: 'Entertainment & Outings',
    category_name: 'Entertainment',
    allocated_amount: 180.0,
    spent_amount: 75.0,
    remaining_amount: 105.0,
    spent_percent: 42,
    period: 'monthly',
    category_group: 'want',
    rollover: false,
    color_code: '#8b5cf6',
    alert_level: 'none',
  },
];
