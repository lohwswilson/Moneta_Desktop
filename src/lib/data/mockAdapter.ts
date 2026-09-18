import type { IMonetaRepository } from './repository';
import type {
  MonetaAccount,
  MonetaTransaction,
  DashboardMetrics,
  ReconcileState,
  EnvelopeBudget,
  OdooSettingsPayload,
  RecurringBill,
  DetectedSubscription,
  CashflowForecast,
  PayeeIntelligence,
  FinancialGoal,
} from '../types/moneta';
import { computeGoalMetrics, toDateOnlyString, todayDateOnly } from './goalMath';

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

  async getRecurringBills(days: number = 14): Promise<RecurringBill[]> {
    if (!days || days <= 0) return [...mockBills];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const cutoff = new Date(today.getTime() + days * 86400000);
    return mockBills.filter((b) => {
      const due = new Date(b.next_due_date);
      return due <= cutoff;
    });
  }

  async createRecurringBill(payload: Partial<RecurringBill>): Promise<RecurringBill> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = payload.next_due_date ? new Date(payload.next_due_date) : today;
    const diff = Math.ceil((due.getTime() - today.getTime()) / 86400000);
    let status: 'overdue' | 'today' | 'due_soon' | 'upcoming' = 'upcoming';
    if (diff < 0) status = 'overdue';
    else if (diff === 0) status = 'today';
    else if (diff <= 7) status = 'due_soon';

    const bill: RecurringBill = {
      id: payload.id || `bill-${Date.now()}`,
      name: payload.name || 'Recurring Bill',
      payee_name: payload.payee_name || payload.name || 'Payee',
      category_name: payload.category_name || 'Utilities',
      account_id: payload.account_id || 'acc-1',
      account_name: payload.account_name || 'Checking Account',
      amount: Number(payload.amount || 0),
      frequency: payload.frequency || 'monthly',
      next_due_date: payload.next_due_date || today.toISOString().split('T')[0],
      days_until_due: diff,
      due_status: status,
      auto_pay: Boolean(payload.auto_pay),
      active: true,
    };
    mockBills.push(bill);
    return bill;
  }

  async updateRecurringBill(id: string | number, payload: Partial<RecurringBill>): Promise<RecurringBill> {
    const idx = mockBills.findIndex((b) => String(b.id) === String(id));
    if (idx === -1) throw new Error(`Bill ${id} not found`);

    const existing = mockBills[idx];
    const nextDate = payload.next_due_date || existing.next_due_date;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(nextDate);
    const diff = Math.ceil((due.getTime() - today.getTime()) / 86400000);
    let status: 'overdue' | 'today' | 'due_soon' | 'upcoming' = 'upcoming';
    if (diff < 0) status = 'overdue';
    else if (diff === 0) status = 'today';
    else if (diff <= 7) status = 'due_soon';

    const updated: RecurringBill = {
      ...existing,
      ...payload,
      next_due_date: nextDate,
      days_until_due: diff,
      due_status: status,
    };
    mockBills[idx] = updated;
    return updated;
  }

  async deleteRecurringBill(id: string | number): Promise<boolean> {
    const idx = mockBills.findIndex((b) => String(b.id) === String(id));
    if (idx !== -1) {
      mockBills.splice(idx, 1);
      return true;
    }
    return false;
  }

  async markBillPaid(id: string | number, accountId?: string | number, date?: string): Promise<{ success: boolean; transaction?: MonetaTransaction }> {
    const bill = mockBills.find((b) => String(b.id) === String(id));
    if (!bill) return { success: false };

    // 1. Post transaction into register
    const txDate = date || new Date().toISOString().split('T')[0];
    const accId = accountId || bill.account_id || 'acc-1';
    const tx: MonetaTransaction = {
      id: `tx-${Date.now()}`,
      account_id: accId,
      date: txDate,
      payee_name: bill.payee_name,
      category_name: bill.category_name,
      amount: -Math.abs(bill.amount),
      transaction_type: 'expense',
      reconciliation_state: 'cleared',
      memo: `Paid bill: ${bill.name}`,
    };
    mockTransactions.unshift(tx);

    // 2. Advance next due date
    const d = new Date(bill.next_due_date);
    if (bill.frequency === 'weekly') d.setDate(d.getDate() + 7);
    else if (bill.frequency === 'biweekly') d.setDate(d.getDate() + 14);
    else if (bill.frequency === 'monthly') d.setMonth(d.getMonth() + 1);
    else if (bill.frequency === 'quarterly') d.setMonth(d.getMonth() + 3);
    else if (bill.frequency === 'semiannual') d.setMonth(d.getMonth() + 6);
    else if (bill.frequency === 'yearly') d.setFullYear(d.getFullYear() + 1);

    bill.next_due_date = d.toISOString().split('T')[0];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    bill.days_until_due = Math.ceil((d.getTime() - today.getTime()) / 86400000);
    bill.due_status = bill.days_until_due <= 7 ? 'due_soon' : 'upcoming';

    return { success: true, transaction: tx };
  }

  async detectSubscriptions(): Promise<DetectedSubscription[]> {
    return [...mockDetectedSubscriptions];
  }

  async getCashflowForecast(days: number = 90, accountId?: string | number): Promise<CashflowForecast> {
    const horizon = days || 90;
    const startBal = accountId
      ? (mockAccounts.find((a) => String(a.id) === String(accountId))?.current_balance || 14850.50)
      : mockAccounts
          .filter((a) => ['checking', 'savings', 'cash'].includes(a.account_type))
          .reduce((sum, a) => sum + a.current_balance, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dailyPoints = [];
    let running = startBal;
    let lowestBal = startBal;
    let lowestDate = today.toISOString().split('T')[0];
    let totalInc = 0;
    let totalExp = 0;
    let overdraftCount = 0;

    for (let i = 0; i <= horizon; i++) {
      const d = new Date(today.getTime() + i * 86400000);
      const dateStr = d.toISOString().split('T')[0];
      const dayOfMonth = d.getDate();
      const dayOfWeek = d.toLocaleDateString('en-SG', { weekday: 'long' });

      let dayInc = 0;
      let dayExp = 0;
      const events: string[] = [];

      // Monthly Salary on 25th
      if (dayOfMonth === 25) {
        dayInc += 8500.0;
        events.push('Salary (+$8,500)');
      }
      // Monthly Rental Income on 1st
      if (dayOfMonth === 1) {
        dayInc += 3800.0;
        events.push('Rental Income (+$3,800)');
      }
      // Quarterly Dividend on 15th (Jan, Apr, Jul, Oct)
      if (dayOfMonth === 15 && [0, 3, 6, 9].includes(d.getMonth())) {
        dayInc += 450.0;
        events.push('Quarterly Dividends (+$450)');
      }

      // Check recurring bills due on this date
      for (const b of mockBills) {
        if (b.next_due_date === dateStr) {
          dayExp += b.amount;
          events.push(`${b.name} (-$${b.amount.toFixed(2)})`);
        }
      }

      // Baseline living expenses distributed over month
      if (i > 0) {
        const dailyLiving = 75.0;
        dayExp += dailyLiving;
      }

      const netChange = dayInc - dayExp;
      const openBal = running;
      const closeBal = running + netChange;
      running = closeBal;

      totalInc += dayInc;
      totalExp += dayExp;

      if (closeBal < lowestBal) {
        lowestBal = closeBal;
        lowestDate = dateStr;
      }

      if (closeBal < 0) {
        overdraftCount++;
      }

      dailyPoints.push({
        date: dateStr,
        day_of_week: dayOfWeek,
        opening_balance: Math.round(openBal * 100) / 100,
        total_income: Math.round(dayInc * 100) / 100,
        total_expense: Math.round(dayExp * 100) / 100,
        net_change: Math.round(netChange * 100) / 100,
        closing_balance: Math.round(closeBal * 100) / 100,
        is_overdraft: closeBal < 0,
        event_summary: events.join(', '),
      });
    }

    // Build Sankey Nodes & Links normalized to horizon
    const months = horizon / 30.0;
    const salaryTotal = Math.round(8500 * months);
    const rentalTotal = Math.round(3800 * months);
    const divTotal = Math.round(450 * (months / 3));
    const totalInflow = salaryTotal + rentalTotal + divTotal;

    const groceries = Math.round(650 * months);
    const dining = Math.round(450 * months);
    const utilities = Math.round(250 * months);
    const transport = Math.round(200 * months);
    const shopping = Math.round(300 * months);
    const housing = Math.round(1800 * months);
    const insurance = Math.round(400 * months);

    const cpfSavings = Math.round(1700 * months);
    const ibkrInvest = Math.round(2500 * months);
    const allocatedOutflows = groceries + dining + utilities + transport + shopping + housing + insurance + cpfSavings + ibkrInvest;
    const surplusSavings = Math.max(0, totalInflow - allocatedOutflows);

    const nodes = [
      { id: 'in-salary', name: 'Employment Salary', tier: 'inflow' as const, value: salaryTotal, color: '#10b981' },
      { id: 'in-rental', name: 'Rental Income', tier: 'inflow' as const, value: rentalTotal, color: '#34d399' },
      { id: 'in-divs', name: 'Dividends & Yield', tier: 'inflow' as const, value: divTotal, color: '#6ee7b7' },
      { id: 'hub-cash', name: 'Liquid Cash Accounts', tier: 'hub' as const, value: totalInflow, color: '#6366f1' },
      { id: 'out-housing', name: 'Housing & Mortgage', tier: 'outflow' as const, value: housing, color: '#3b82f6' },
      { id: 'out-groceries', name: 'Groceries & Household', tier: 'outflow' as const, value: groceries, color: '#f59e0b' },
      { id: 'out-dining', name: 'Hawker & Dining Out', tier: 'outflow' as const, value: dining, color: '#fbbf24' },
      { id: 'out-utilities', name: 'Utilities & Fibre', tier: 'outflow' as const, value: utilities, color: '#06b6d4' },
      { id: 'out-transport', name: 'Transport & Grab', tier: 'outflow' as const, value: transport, color: '#ec4899' },
      { id: 'out-shopping', name: 'Shopping & Lifestyle', tier: 'outflow' as const, value: shopping, color: '#8b5cf6' },
      { id: 'out-insurance', name: 'Insurance & Health', tier: 'outflow' as const, value: insurance, color: '#ef4444' },
      { id: 'sav-cpf', name: 'CPF OA & SA Savings', tier: 'saving' as const, value: cpfSavings, color: '#059669' },
      { id: 'sav-invest', name: 'IBKR Portfolio Dollar-Cost', tier: 'saving' as const, value: ibkrInvest, color: '#047857' },
    ];

    if (surplusSavings > 0) {
      nodes.push({ id: 'sav-surplus', name: 'Cash Reserve / Net Surplus', tier: 'saving' as const, value: surplusSavings, color: '#10b981' });
    }

    const links = [
      { source: 'in-salary', target: 'hub-cash', value: salaryTotal },
      { source: 'in-rental', target: 'hub-cash', value: rentalTotal },
      { source: 'in-divs', target: 'hub-cash', value: divTotal },
      { source: 'hub-cash', target: 'out-housing', value: housing },
      { source: 'hub-cash', target: 'out-groceries', value: groceries },
      { source: 'hub-cash', target: 'out-dining', value: dining },
      { source: 'hub-cash', target: 'out-utilities', value: utilities },
      { source: 'hub-cash', target: 'out-transport', value: transport },
      { source: 'hub-cash', target: 'out-shopping', value: shopping },
      { source: 'hub-cash', target: 'out-insurance', value: insurance },
      { source: 'hub-cash', target: 'sav-cpf', value: cpfSavings },
      { source: 'hub-cash', target: 'sav-invest', value: ibkrInvest },
    ];

    if (surplusSavings > 0) {
      links.push({ source: 'hub-cash', target: 'sav-surplus', value: surplusSavings });
    }

    return {
      summary: {
        starting_balance: Math.round(startBal * 100) / 100,
        lowest_projected_balance: Math.round(lowestBal * 100) / 100,
        lowest_balance_date: lowestDate,
        ending_projected_balance: Math.round(running * 100) / 100,
        total_projected_income: Math.round(totalInc * 100) / 100,
        total_projected_expenses: Math.round(totalExp * 100) / 100,
        net_projected_cashflow: Math.round((totalInc - totalExp) * 100) / 100,
        overdraft_days_count: overdraftCount,
        has_overdraft_risk: overdraftCount > 0,
      },
      daily_points: dailyPoints,
      sankey: {
        nodes,
        links,
      },
    };
  }

  async getPayees(): Promise<PayeeIntelligence[]> {
    return [...mockPayees];
  }

  async updatePayee(id: string | number, payload: Partial<PayeeIntelligence>): Promise<boolean> {
    const idx = mockPayees.findIndex((p) => String(p.id) === String(id));
    if (idx !== -1) {
      mockPayees[idx] = { ...mockPayees[idx], ...payload };
      return true;
    }
    return false;
  }

  async getGoals(): Promise<FinancialGoal[]> {
    // Derived figures are recomputed on read so a seeded goal cannot carry a
    // stale progress bar as time passes.
    return mockGoals
      .map((goal) => ({ ...goal, ...computeGoalMetrics(goal) }))
      .sort((a, b) => a.target_date.localeCompare(b.target_date) || a.name.localeCompare(b.name));
  }

  async createGoal(payload: Partial<FinancialGoal>): Promise<FinancialGoal> {
    const today = toDateOnlyString(todayDateOnly());
    const goal: FinancialGoal = {
      id: payload.id || `mock-goal-${Date.now()}`,
      name: payload.name || 'New Goal',
      target_amount: Number(payload.target_amount || 0),
      current_amount: Number(payload.current_amount || 0),
      start_date: payload.start_date || today,
      target_date: payload.target_date || today,
      account_id: payload.account_id,
      account_name: payload.account_name,
      icon: payload.icon || '🎯',
      color: payload.color !== undefined ? payload.color : 4,
      notes: payload.notes,
      status: payload.status || 'in_progress',
      remaining_amount: 0,
      progress_percent: 0,
      months_remaining: 0,
      monthly_contribution_required: 0,
    };
    const created = { ...goal, ...computeGoalMetrics(goal) };
    mockGoals.push(created);
    return created;
  }

  async updateGoal(id: string | number, payload: Partial<FinancialGoal>): Promise<FinancialGoal> {
    const idx = mockGoals.findIndex((g) => String(g.id) === String(id));
    if (idx === -1) throw new Error(`Goal ${id} not found`);

    const merged: FinancialGoal = { ...mockGoals[idx], ...payload };
    const updated = { ...merged, ...computeGoalMetrics(merged) };
    mockGoals[idx] = updated;
    return updated;
  }

  async deleteGoal(id: string | number): Promise<boolean> {
    const idx = mockGoals.findIndex((g) => String(g.id) === String(id));
    if (idx === -1) return false;
    mockGoals.splice(idx, 1);
    return true;
  }

  async fundGoal(
    id: string | number,
    amount: number,
    actionType: 'deposit' | 'withdraw'
  ): Promise<FinancialGoal> {
    const amt = Number(amount) || 0;
    if (amt <= 0) throw new Error('Please specify an amount greater than 0.');

    const idx = mockGoals.findIndex((g) => String(g.id) === String(id));
    if (idx === -1) throw new Error(`Goal ${id} not found`);

    const currentAmount = Number(mockGoals[idx].current_amount) || 0;
    const nextAmount = actionType === 'withdraw' ? Math.max(currentAmount - amt, 0) : currentAmount + amt;
    const merged: FinancialGoal = { ...mockGoals[idx], current_amount: nextAmount };
    const updated = { ...merged, ...computeGoalMetrics(merged) };
    mockGoals[idx] = updated;
    return updated;
  }
}

let mockPayees: PayeeIntelligence[] = [
  {
    id: 'payee-1',
    name: 'FairPrice Finest',
    default_category_name: 'Groceries',
    suggested_category_name: 'Groceries',
    total_spend: 1420.50,
    transaction_count: 18,
    avg_amount: 78.92,
    last_transaction_date: '2026-09-14',
    detected_cadence: 'biweekly',
    website: 'https://fairprice.com.sg',
    notes: 'Primary supermarket for groceries',
  },
  {
    id: 'payee-2',
    name: 'Grab Singapore',
    default_category_name: 'Transportation',
    suggested_category_name: 'Transportation',
    total_spend: 685.20,
    transaction_count: 24,
    avg_amount: 28.55,
    last_transaction_date: '2026-09-17',
    detected_cadence: 'weekly',
    website: 'https://grab.com/sg',
    notes: 'Rides and GrabFood deliveries',
  },
  {
    id: 'payee-3',
    name: 'Bacha Coffee',
    default_category_name: 'Dining',
    suggested_category_name: 'Dining',
    total_spend: 240.00,
    transaction_count: 4,
    avg_amount: 60.00,
    last_transaction_date: '2026-09-08',
    detected_cadence: 'monthly',
    website: 'https://bachacoffee.com',
    notes: 'Coffee beans and gifts',
  },
  {
    id: 'payee-4',
    name: 'SP Services Ltd',
    default_category_name: 'Utilities',
    suggested_category_name: 'Utilities',
    total_spend: 871.20,
    transaction_count: 6,
    avg_amount: 145.20,
    last_transaction_date: '2026-09-02',
    detected_cadence: 'monthly',
    website: 'https://spgroup.com.sg',
    notes: 'Home electricity & water utilities',
  },
  {
    id: 'payee-5',
    name: 'Singtel',
    default_category_name: 'Utilities',
    suggested_category_name: 'Utilities',
    total_spend: 479.40,
    transaction_count: 6,
    avg_amount: 79.90,
    last_transaction_date: '2026-09-05',
    detected_cadence: 'monthly',
    website: 'https://singtel.com',
    notes: 'Home fibre broadband',
  },
  {
    id: 'payee-6',
    name: 'Netflix',
    default_category_name: 'Entertainment',
    suggested_category_name: 'Entertainment',
    total_spend: 155.88,
    transaction_count: 6,
    avg_amount: 25.98,
    last_transaction_date: '2026-09-11',
    detected_cadence: 'monthly',
    website: 'https://netflix.com',
    notes: 'Family 4K subscription',
  },
  {
    id: 'payee-7',
    name: 'Pure Fitness',
    default_category_name: 'Fitness & Health',
    suggested_category_name: 'Fitness & Health',
    total_spend: 1170.00,
    transaction_count: 6,
    avg_amount: 195.00,
    last_transaction_date: '2026-09-18',
    detected_cadence: 'monthly',
    website: 'https://pure-fitness.com',
    notes: 'Gym membership',
  },
  {
    id: 'payee-8',
    name: 'Din Tai Fung',
    default_category_name: 'Dining',
    suggested_category_name: 'Dining',
    total_spend: 540.00,
    transaction_count: 5,
    avg_amount: 108.00,
    last_transaction_date: '2026-09-10',
    detected_cadence: 'monthly',
    website: 'https://dintaifung.com.sg',
    notes: 'Family dinners',
  },
  {
    id: 'payee-9',
    name: 'Shopee Singapore',
    default_category_name: 'Shopping',
    suggested_category_name: 'Shopping',
    total_spend: 920.40,
    transaction_count: 14,
    avg_amount: 65.74,
    last_transaction_date: '2026-09-12',
    detected_cadence: 'biweekly',
    website: 'https://shopee.sg',
    notes: 'Online marketplace',
  },
  {
    id: 'payee-10',
    name: 'Great Eastern Life',
    default_category_name: 'Insurance',
    suggested_category_name: 'Insurance',
    total_spend: 1280.00,
    transaction_count: 4,
    avg_amount: 320.00,
    last_transaction_date: '2026-08-15',
    detected_cadence: 'quarterly',
    website: 'https://greateasternlife.com',
    notes: 'Term life and health rider',
  },
];

let mockBills: RecurringBill[] = [
  {
    id: 'bill-1',
    name: 'SP Group Utilities',
    payee_name: 'SP Services',
    category_name: 'Utilities',
    account_id: 'acc-1',
    account_name: 'DBS High Interest Checking',
    amount: 145.20,
    frequency: 'monthly',
    next_due_date: new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0],
    days_until_due: 2,
    due_status: 'due_soon',
    auto_pay: true,
    active: true,
  },
  {
    id: 'bill-2',
    name: 'Singtel 2Gbps Home Fibre',
    payee_name: 'Singtel',
    category_name: 'Utilities',
    account_id: 'acc-1',
    account_name: 'DBS High Interest Checking',
    amount: 79.90,
    frequency: 'monthly',
    next_due_date: new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0],
    days_until_due: 5,
    due_status: 'due_soon',
    auto_pay: true,
    active: true,
  },
  {
    id: 'bill-3',
    name: 'Netflix Premium 4K Family',
    payee_name: 'Netflix',
    category_name: 'Entertainment',
    account_id: 'acc-5',
    account_name: 'StanChart Simply Cash Credit Card',
    amount: 25.98,
    frequency: 'monthly',
    next_due_date: new Date(Date.now() + 11 * 86400000).toISOString().split('T')[0],
    days_until_due: 11,
    due_status: 'due_soon',
    auto_pay: true,
    active: true,
  },
  {
    id: 'bill-4',
    name: 'Pure Fitness Monthly Membership',
    payee_name: 'Pure Fitness',
    category_name: 'Fitness & Health',
    account_id: 'acc-5',
    account_name: 'StanChart Simply Cash Credit Card',
    amount: 195.00,
    frequency: 'monthly',
    next_due_date: new Date(Date.now() + 18 * 86400000).toISOString().split('T')[0],
    days_until_due: 18,
    due_status: 'upcoming',
    auto_pay: false,
    active: true,
  },
  {
    id: 'bill-5',
    name: 'Great Eastern Term Life Premium',
    payee_name: 'Great Eastern',
    category_name: 'Insurance',
    account_id: 'acc-1',
    account_name: 'DBS High Interest Checking',
    amount: 320.00,
    frequency: 'quarterly',
    next_due_date: new Date(Date.now() - 1 * 86400000).toISOString().split('T')[0],
    days_until_due: -1,
    due_status: 'overdue',
    auto_pay: false,
    active: true,
  },
];

let mockDetectedSubscriptions: DetectedSubscription[] = [
  {
    payee_name: 'Spotify Singapore',
    average_amount: 10.98,
    detected_frequency: 'monthly',
    charge_count: 5,
    last_charge_date: new Date(Date.now() - 15 * 86400000).toISOString().split('T')[0],
    account_id: 'acc-5',
    category_name: 'Entertainment',
  },
  {
    payee_name: 'iCloud 2TB Storage',
    average_amount: 13.98,
    detected_frequency: 'monthly',
    charge_count: 6,
    last_charge_date: new Date(Date.now() - 20 * 86400000).toISOString().split('T')[0],
    account_id: 'acc-5',
    category_name: 'Software',
  },
];

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

/**
 * Seeded goals persist only their own fields — `getGoals()` derives the
 * progress figures through `computeGoalMetrics`, the same helper the SQLite
 * adapter uses. The zeroed metrics here are placeholders, never returned.
 */
let mockGoals: FinancialGoal[] = [
  {
    id: 'goal-1',
    name: 'Emergency Fund (6 Months)',
    target_amount: 60000.0,
    current_amount: 45000.0,
    start_date: '2025-01-01',
    target_date: '2027-06-30',
    account_id: 'acc-2',
    account_name: 'Emergency Savings Reserve',
    icon: '🛡️',
    color: 4,
    notes: 'Six months of living expenses held in the OCBC reserve account.',
    status: 'in_progress',
    remaining_amount: 0,
    progress_percent: 0,
    months_remaining: 0,
    monthly_contribution_required: 0,
  },
  {
    id: 'goal-2',
    name: 'Japan Family Holiday',
    target_amount: 12000.0,
    current_amount: 3200.0,
    start_date: '2026-03-01',
    target_date: '2027-03-31',
    account_id: 'acc-1',
    account_name: 'DBS High Interest Checking',
    icon: '✈️',
    color: 6,
    notes: 'Flights, accommodation and spending money for a two-week trip.',
    status: 'in_progress',
    remaining_amount: 0,
    progress_percent: 0,
    months_remaining: 0,
    monthly_contribution_required: 0,
  },
  {
    id: 'goal-3',
    name: 'Home Down Payment',
    target_amount: 250000.0,
    current_amount: 88000.0,
    start_date: '2025-06-01',
    target_date: '2029-12-31',
    icon: '🏡',
    color: 2,
    notes: 'Targeting a 25% down payment to keep the mortgage within MSR.',
    status: 'in_progress',
    remaining_amount: 0,
    progress_percent: 0,
    months_remaining: 0,
    monthly_contribution_required: 0,
  },
  {
    id: 'goal-4',
    name: 'Laptop Replacement Fund',
    target_amount: 4500.0,
    current_amount: 4500.0,
    start_date: '2025-11-01',
    target_date: '2026-08-31',
    icon: '💻',
    color: 8,
    notes: 'Fully funded — kept open as a reference for the next cycle.',
    status: 'in_progress',
    remaining_amount: 0,
    progress_percent: 0,
    months_remaining: 0,
    monthly_contribution_required: 0,
  },
];
