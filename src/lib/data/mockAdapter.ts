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
  PortfolioHolding,
  TaxLot,
  TaxLotDisposal,
  PortfolioSummary,
  TaxLotStrategy,
  PropertyAsset,
  PropertyTenant,
  RentPayment,
  LoanScenario,
  LoanRateChange,
  PropertyValuation,
} from '../types/moneta';
import { computeGoalMetrics, toDateOnlyString, todayDateOnly } from './goalMath';
import { computeLotMetrics, disposeTaxLots, computeModifiedDietz, computeXIRR } from './portfolioMath';
import {
  computePropertyMetrics,
  computeLeaseStatus,
  computeBalanceDue,
  computeRentPaymentStatus,
  computeRentTotals,
  generateRentSchedule,
} from './propertyMath';
import { simulatePrepayment, detectRateChanges } from './loanMath';
import type { RateObservation } from './loanMath';

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
  // Monthly interest charges on the HDB mortgage — the basis for
  // `inferLoanRateChanges` on the linked loan scenario.
  {
    id: 'tx-7',
    account_id: 'acc-6',
    account_name: 'HDB Concessionary Housing Loan',
    date: '2026-06-02',
    payee_name: 'HDB Concessionary Housing Loan',
    category_name: 'Mortgage Interest',
    amount: -617.5,
    transaction_type: 'expense',
    reconciliation_state: 'cleared',
    running_balance: -285000.0,
    memo: 'June monthly interest',
  },
  {
    id: 'tx-8',
    account_id: 'acc-6',
    account_name: 'HDB Concessionary Housing Loan',
    date: '2026-07-02',
    payee_name: 'HDB Concessionary Housing Loan',
    category_name: 'Mortgage Interest',
    amount: -616.16,
    transaction_type: 'expense',
    reconciliation_state: 'cleared',
    running_balance: -284382.5,
    memo: 'July monthly interest',
  },
  {
    id: 'tx-9',
    account_id: 'acc-6',
    account_name: 'HDB Concessionary Housing Loan',
    date: '2026-08-03',
    payee_name: 'HDB Concessionary Housing Loan',
    category_name: 'Mortgage Interest',
    amount: -614.83,
    transaction_type: 'expense',
    reconciliation_state: 'cleared',
    running_balance: -283766.33,
    memo: 'August monthly interest',
  },
  {
    id: 'tx-10',
    account_id: 'acc-6',
    account_name: 'HDB Concessionary Housing Loan',
    date: '2026-09-02',
    payee_name: 'HDB Concessionary Housing Loan',
    category_name: 'Mortgage Interest',
    amount: -613.5,
    transaction_type: 'expense',
    reconciliation_state: 'cleared',
    running_balance: -283151.5,
    memo: 'September monthly interest',
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

  async getPortfolioHoldings(accountId?: string | number): Promise<PortfolioHolding[]> {
    let list = mockHoldings;
    if (accountId) {
      list = list.filter((h) => String(h.account_id) === String(accountId));
    }
    const totalVal = list.reduce((sum, h) => sum + h.current_market_value, 0);
    return list.map((h) => ({
      ...h,
      weight_in_portfolio: totalVal > 0 ? Math.round((h.current_market_value / totalVal) * 1000) / 10 : 0,
    }));
  }

  async getTaxLots(symbol?: string, accountId?: string | number, state?: string): Promise<TaxLot[]> {
    let list = mockTaxLots;
    if (symbol) {
      list = list.filter((l) => l.symbol.toLowerCase() === symbol.trim().toLowerCase());
    }
    if (accountId) {
      list = list.filter((l) => String(l.account_id) === String(accountId));
    }
    if (state) {
      list = list.filter((l) => l.state === state);
    }
    return list.map((l) => {
      const hld = mockHoldings.find((h) => h.symbol === l.symbol);
      const curPrice = hld ? hld.current_price : l.purchase_price;
      return computeLotMetrics(l, curPrice) as TaxLot;
    });
  }

  async getTaxLotDisposals(year?: number): Promise<TaxLotDisposal[]> {
    let list = mockTaxLotDisposals;
    if (year) {
      list = list.filter((d) => d.disposal_date.startsWith(String(year)));
    }
    return [...list];
  }

  async executeInvestmentTrade(payload: {
    accountId: string | number;
    symbol: string;
    action: 'buy' | 'sell';
    quantity: number;
    price: number;
    tradeDate?: string;
    commission?: number;
    strategy?: TaxLotStrategy;
    selectedLotId?: string | number;
    memo?: string;
  }): Promise<{ success: boolean; transactionId?: number }> {
    const symbol = payload.symbol.trim().toUpperCase();
    const accId = String(payload.accountId);
    const qty = Math.abs(Number(payload.quantity) || 0);
    const price = Math.abs(Number(payload.price) || 0);
    const tradeDate = payload.tradeDate || new Date().toISOString().split('T')[0];
    const commission = Math.abs(Number(payload.commission) || 0);

    if (payload.action === 'buy') {
      const newLot: TaxLot = {
        id: `mock-lot-${Date.now()}`,
        account_id: accId,
        account_name: mockAccounts.find((a) => String(a.id) === accId)?.name || 'Brokerage Account',
        symbol,
        purchase_date: tradeDate,
        initial_quantity: qty,
        remaining_quantity: qty,
        purchase_price: price,
        commission_paid: commission,
        total_cost_basis: Math.round(qty * price * 100) / 100,
        current_market_value: Math.round(qty * price * 100) / 100,
        unrealized_gain: 0,
        unrealized_gain_percent: 0,
        holding_days: 0,
        term_type: 'short_term',
        state: 'open',
      };
      mockTaxLots.unshift(newLot);

      const hld = mockHoldings.find((h) => h.symbol === symbol && String(h.account_id) === accId);
      if (hld) {
        const curQty = hld.total_quantity;
        const curAvg = hld.average_cost;
        const newQty = curQty + qty;
        const newAvg = ((curQty * curAvg) + (qty * price)) / newQty;
        hld.total_quantity = newQty;
        hld.average_cost = Math.round(newAvg * 10000) / 10000;
        hld.total_cost_basis = Math.round(newQty * newAvg * 100) / 100;
        hld.current_market_value = Math.round(newQty * hld.current_price * 100) / 100;
        hld.unrealized_gain = Math.round((hld.current_market_value - hld.total_cost_basis) * 100) / 100;
        hld.unrealized_gain_percent = hld.total_cost_basis > 0 ? Math.round(((hld.current_market_value - hld.total_cost_basis) / hld.total_cost_basis) * 10000) / 100 : 0;
      } else {
        mockHoldings.unshift({
          id: `mock-hld-${Date.now()}`,
          account_id: accId,
          account_name: mockAccounts.find((a) => String(a.id) === accId)?.name || 'Brokerage Account',
          security_id: `sec-${symbol.toLowerCase()}`,
          symbol,
          name: symbol,
          security_type: 'stock',
          currency: 'USD',
          total_quantity: qty,
          average_cost: price,
          current_price: price,
          total_cost_basis: Math.round(qty * price * 100) / 100,
          current_market_value: Math.round(qty * price * 100) / 100,
          unrealized_gain: 0,
          unrealized_gain_percent: 0,
          weight_in_portfolio: 0,
          last_quote_date: tradeDate,
        });
      }
    } else {
      const openLots = mockTaxLots.filter((l) => l.symbol === symbol && String(l.account_id) === accId && l.remaining_quantity > 0);
      const selectedIds = payload.selectedLotId ? [payload.selectedLotId] : undefined;
      const { disposals, updatedLots } = disposeTaxLots(
        openLots,
        qty,
        price,
        tradeDate,
        payload.strategy || 'FIFO',
        selectedIds
      );

      for (const ul of updatedLots) {
        const idx = mockTaxLots.findIndex((l) => l.id === ul.id);
        if (idx !== -1) mockTaxLots[idx] = ul;
      }

      for (const d of disposals) {
        mockTaxLotDisposals.unshift(d);
      }

      const hld = mockHoldings.find((h) => h.symbol === symbol && String(h.account_id) === accId);
      if (hld) {
        hld.total_quantity = Math.max(0, hld.total_quantity - qty);
        hld.total_cost_basis = Math.round(hld.total_quantity * hld.average_cost * 100) / 100;
        hld.current_market_value = Math.round(hld.total_quantity * hld.current_price * 100) / 100;
        hld.unrealized_gain = Math.round((hld.current_market_value - hld.total_cost_basis) * 100) / 100;
      }
    }

    return { success: true };
  }

  async getPortfolioSummary(accountId?: string | number): Promise<PortfolioSummary> {
    const holdings = await this.getPortfolioHoldings(accountId);
    const totVal = holdings.reduce((sum, h) => sum + h.current_market_value, 0);
    const totCost = holdings.reduce((sum, h) => sum + h.total_cost_basis, 0);
    const totUnrealized = Math.round((totVal - totCost) * 100) / 100;
    const totUnrealizedPct = totCost > 0 ? Math.round(((totVal - totCost) / totCost) * 10000) / 100 : 0.0;

    const currentYear = new Date().getFullYear();
    const disposals = await this.getTaxLotDisposals(currentYear);
    const totRealizedYtd = Math.round(disposals.reduce((sum, d) => sum + d.realized_gain, 0) * 100) / 100;

    const openLots = await this.getTaxLots(undefined, accountId, 'open');

    const assetMap: Record<string, number> = {};
    for (const h of holdings) {
      const secType = h.security_type || 'stock';
      assetMap[secType] = (assetMap[secType] || 0) + h.current_market_value;
    }

    const colorMap: Record<string, string> = {
      stock: '#10b981',
      etf: '#3b82f6',
      crypto: '#f59e0b',
      mutual_fund: '#8b5cf6',
      bond: '#06b6d4',
    };

    const allocation = Object.entries(assetMap).map(([type, val]) => ({
      category: type === 'stock' ? 'Equities' : type.toUpperCase(),
      value: Math.round(val * 100) / 100,
      percentage: totVal > 0 ? Math.round((val / totVal) * 1000) / 10 : 0,
      color: colorMap[type] || '#71717a',
    }));

    const cashflows: Array<{ date: string; amount: number }> = [];
    for (const lot of openLots) {
      cashflows.push({ date: lot.purchase_date, amount: lot.total_cost_basis });
    }
    for (const d of disposals) {
      cashflows.push({ date: d.disposal_date, amount: -d.proceeds });
    }

    const twr = computeModifiedDietz(cashflows, totVal);
    const xirrCfs = [
      ...cashflows.map((c) => ({ date: c.date, amount: -c.amount })),
      { date: new Date().toISOString().split('T')[0], amount: totVal },
    ];
    const xirr = computeXIRR(xirrCfs);

    return {
      total_portfolio_value: Math.round(totVal * 100) / 100,
      total_cost_basis: Math.round(totCost * 100) / 100,
      total_unrealized_gain: totUnrealized,
      total_unrealized_gain_percent: totUnrealizedPct,
      total_realized_gain_ytd: totRealizedYtd,
      holdings_count: holdings.length,
      open_lots_count: openLots.length,
      time_weighted_return: twr !== null ? Math.round(twr * 10000) / 100 : undefined,
      money_weighted_return: xirr !== null ? Math.round(xirr * 10000) / 100 : undefined,
      asset_allocation: allocation,
    };
  }

  /**
   * Phase 5: Property, Rental & Loan Scenario Methods
   *
   * Derived figures are recomputed on read through propertyMath.ts and
   * loanMath.ts, exactly as `getGoals()` recomputes goal metrics — a seeded
   * property cannot carry a stale equity or rent roll as time passes.
   */

  private deriveProperty(p: PropertyAsset): PropertyAsset {
    const acc = p.mortgage_account_id
      ? mockAccounts.find((a) => String(a.id) === String(p.mortgage_account_id))
      : undefined;

    // Only tenants whose lease is active contribute to the rent roll.
    const activeTenants = mockTenants
      .filter((t) => String(t.property_id) === String(p.id))
      .filter((t) => computeLeaseStatus(t.lease_start_date, t.lease_end_date) === 'active')
      .map((t) => ({ monthly_rent_amount: t.monthly_rent_amount }));

    const metrics = computePropertyMetrics({
      current_market_value: p.current_market_value,
      mortgageBalance: acc?.current_balance,
      mortgageMonthlyPayment: acc?.monthly_payment,
      monthly_rental_income: p.monthly_rental_income,
      monthly_property_tax: p.monthly_property_tax,
      monthly_insurance: p.monthly_insurance,
      monthly_hoa_maintenance: p.monthly_hoa_maintenance,
      activeTenants,
    });

    const valuation_history = mockPropertyValuations
      .filter((v) => String(v.property_id) === String(p.id))
      .sort((a, b) => b.valuation_date.localeCompare(a.valuation_date));

    return { ...p, ...metrics, valuation_history };
  }

  async getProperties(): Promise<PropertyAsset[]> {
    return mockProperties
      .map((p) => this.deriveProperty(p))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async createProperty(payload: Partial<PropertyAsset>): Promise<PropertyAsset> {
    const property: PropertyAsset = {
      id: payload.id || `mock-prop-${Date.now()}`,
      name: payload.name || 'New Property',
      asset_category: payload.asset_category || 'real_estate',
      property_type: payload.property_type || 'other',
      purchase_date: payload.purchase_date,
      purchase_price: payload.purchase_price !== undefined ? Number(payload.purchase_price) : undefined,
      current_market_value: Number(payload.current_market_value || 0),
      mortgage_account_id: payload.mortgage_account_id,
      mortgage_account_name: payload.mortgage_account_name,
      color: payload.color,
      notes: payload.notes,
      vehicle_make: payload.vehicle_make,
      vehicle_model: payload.vehicle_model,
      vehicle_year: payload.vehicle_year,
      vehicle_vin: payload.vehicle_vin,
      vehicle_license_plate: payload.vehicle_license_plate,
      vehicle_mileage: payload.vehicle_mileage,
      antique_era: payload.antique_era,
      maker_artist: payload.maker_artist,
      condition_grade: payload.condition_grade,
      insured_value: payload.insured_value !== undefined ? Number(payload.insured_value) : undefined,
      insurance_policy_number: payload.insurance_policy_number,
      storage_location: payload.storage_location,
      monthly_rental_income:
        payload.monthly_rental_income !== undefined ? Number(payload.monthly_rental_income) : undefined,
      monthly_property_tax:
        payload.monthly_property_tax !== undefined ? Number(payload.monthly_property_tax) : undefined,
      monthly_insurance: payload.monthly_insurance !== undefined ? Number(payload.monthly_insurance) : undefined,
      monthly_hoa_maintenance:
        payload.monthly_hoa_maintenance !== undefined ? Number(payload.monthly_hoa_maintenance) : undefined,
      // Placeholders — never returned; `getProperties()` derives these on read.
      mortgage_balance: 0,
      equity_value: 0,
      loan_to_value_ratio: 0,
      tenant_count: 0,
      gross_annual_rental_income: 0,
      gross_rental_yield_pct: 0,
      net_operating_income: 0,
      net_monthly_cashflow: 0,
      occupancy_rate_pct: 0,
      valuation_history: [],
    };
    mockProperties.push(property);
    return this.deriveProperty(property);
  }

  async updateProperty(id: string | number, payload: Partial<PropertyAsset>): Promise<PropertyAsset> {
    const idx = mockProperties.findIndex((p) => String(p.id) === String(id));
    if (idx === -1) throw new Error(`Property ${id} not found`);

    const merged: PropertyAsset = { ...mockProperties[idx], ...payload };
    mockProperties[idx] = merged;
    return this.deriveProperty(merged);
  }

  async deleteProperty(id: string | number): Promise<boolean> {
    const idx = mockProperties.findIndex((p) => String(p.id) === String(id));
    if (idx === -1) return false;
    mockProperties.splice(idx, 1);
    return true;
  }

  async addPropertyValuation(
    id: string | number,
    payload: { valuation_date: string; appraised_value: number; appraiser?: string; notes?: string }
  ): Promise<PropertyAsset> {
    const idx = mockProperties.findIndex((p) => String(p.id) === String(id));
    if (idx === -1) throw new Error(`Property ${id} not found`);

    const appraisedValue = Number(payload.appraised_value || 0);
    mockPropertyValuations.push({
      id: `mock-valu-${Date.now()}`,
      property_id: String(id),
      valuation_date: payload.valuation_date || new Date().toISOString().split('T')[0],
      appraised_value: appraisedValue,
      appraiser: payload.appraiser,
      notes: payload.notes,
    });

    const updated = { ...mockProperties[idx], current_market_value: appraisedValue };
    mockProperties[idx] = updated;
    return this.deriveProperty(updated);
  }

  async getTenants(): Promise<PropertyTenant[]> {
    const propNames = new Map(mockProperties.map((p) => [String(p.id), p.name]));
    return mockTenants
      .map((t) => {
        const payments = mockRentPayments.filter((p) => String(p.tenant_id) === String(t.id));
        return {
          ...t,
          property_name: propNames.get(String(t.property_id)),
          lease_status: computeLeaseStatus(t.lease_start_date, t.lease_end_date),
          ...computeRentTotals(payments),
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async createTenant(payload: Partial<PropertyTenant>): Promise<PropertyTenant> {
    const tenant: PropertyTenant = {
      id: payload.id || `mock-tenant-${Date.now()}`,
      name: payload.name || 'New Tenant',
      property_id: payload.property_id || '',
      property_name: mockProperties.find((p) => String(p.id) === String(payload.property_id))?.name,
      unit_number: payload.unit_number,
      email: payload.email,
      phone: payload.phone,
      emergency_contact: payload.emergency_contact,
      lease_start_date: payload.lease_start_date || new Date().toISOString().split('T')[0],
      lease_end_date: payload.lease_end_date || new Date().toISOString().split('T')[0],
      monthly_rent_amount: Number(payload.monthly_rent_amount || 0),
      rent_due_day: payload.rent_due_day !== undefined ? Number(payload.rent_due_day) : 1,
      security_deposit_held: Number(payload.security_deposit_held ?? 0),
      security_deposit_refunded: Number(payload.security_deposit_refunded ?? 0),
      deposit_status: payload.deposit_status || 'held',
      notes: payload.notes,
      lease_status: 'active',
      total_rent_collected: 0,
      total_rent_overdue: 0,
    };
    const created = {
      ...tenant,
      lease_status: computeLeaseStatus(tenant.lease_start_date, tenant.lease_end_date),
    };
    mockTenants.push(created);
    return created;
  }

  async updateTenant(id: string | number, payload: Partial<PropertyTenant>): Promise<PropertyTenant> {
    const idx = mockTenants.findIndex((t) => String(t.id) === String(id));
    if (idx === -1) throw new Error(`Tenant ${id} not found`);

    const merged: PropertyTenant = { ...mockTenants[idx], ...payload };
    const updated = {
      ...merged,
      lease_status: computeLeaseStatus(merged.lease_start_date, merged.lease_end_date),
    };
    mockTenants[idx] = updated;
    return updated;
  }

  async deleteTenant(id: string | number): Promise<boolean> {
    const idx = mockTenants.findIndex((t) => String(t.id) === String(id));
    if (idx === -1) return false;
    mockTenants.splice(idx, 1);
    // A deleted tenant's rent roll is meaningless — drop it with the tenant.
    mockRentPayments = mockRentPayments.filter((p) => String(p.tenant_id) !== String(id));
    return true;
  }

  async generateRentSchedule(tenantId: string | number): Promise<number> {
    const tenant = mockTenants.find((t) => String(t.id) === String(tenantId));
    if (!tenant) throw new Error(`Tenant ${tenantId} not found`);

    const existingPeriodMonths = mockRentPayments
      .filter((p) => String(p.tenant_id) === String(tenantId))
      .map((p) => p.period_month);

    const generated = generateRentSchedule(
      {
        lease_start_date: tenant.lease_start_date,
        lease_end_date: tenant.lease_end_date,
        monthly_rent_amount: tenant.monthly_rent_amount,
        rent_due_day: tenant.rent_due_day,
      },
      existingPeriodMonths
    );

    const base = Date.now();
    generated.forEach((g, i) => {
      mockRentPayments.push({
        id: `mock-rp-${base}-${i}`,
        tenant_id: String(tenantId),
        property_id: tenant.property_id,
        period_month: g.period_month,
        due_date: g.due_date,
        amount_due: g.amount_due,
        amount_paid: g.amount_paid,
        balance_due: 0,
        paid_date: undefined,
        payment_status: g.payment_status,
        memo: undefined,
        notes: undefined,
      });
    });

    return generated.length;
  }

  async getRentPayments(tenantId?: string | number): Promise<RentPayment[]> {
    const tenantNames = new Map(mockTenants.map((t) => [String(t.id), t.name]));
    let payments = mockRentPayments;
    if (tenantId) {
      payments = payments.filter((p) => String(p.tenant_id) === String(tenantId));
    }
    return payments
      .map((p) => ({
        ...p,
        tenant_name: tenantNames.get(String(p.tenant_id)),
        balance_due: computeBalanceDue(p.amount_due, p.amount_paid),
        payment_status: computeRentPaymentStatus(p),
      }))
      .sort((a, b) => b.period_month.localeCompare(a.period_month));
  }

  async markRentPaid(paymentId: string | number): Promise<RentPayment> {
    const idx = mockRentPayments.findIndex((p) => String(p.id) === String(paymentId));
    if (idx === -1) throw new Error(`Rent payment ${paymentId} not found`);

    mockRentPayments[idx] = {
      ...mockRentPayments[idx],
      amount_paid: mockRentPayments[idx].amount_due,
      paid_date: toDateOnlyString(todayDateOnly()),
    };

    const payments = await this.getRentPayments();
    return payments.find((p) => String(p.id) === String(paymentId)) || mockRentPayments[idx];
  }

  private deriveLoanScenario(s: LoanScenario): LoanScenario {
    const termMonths =
      (Number(s.loan_term_years) || 0) * 12 + (Number(s.loan_term_months) || 0);
    const rateChanges = mockLoanRateChanges.filter((rc) => String(rc.scenario_id) === String(s.id));
    const sim = simulatePrepayment({
      principal: s.principal_amount,
      annualRatePct: s.annual_interest_rate,
      termMonths,
      startDate: s.start_date,
      extraMonthly: s.extra_monthly_payment,
      lumpSum: s.lump_sum_payment,
      lumpSumDate: s.lump_sum_date,
      rateChanges,
    });
    return {
      ...s,
      rate_changes: rateChanges,
      monthly_payment: sim.baseline.monthlyPayment,
      total_payment_original: sim.baseline.totalPaid,
      total_interest_original: sim.baseline.totalInterest,
      original_payoff_date: sim.baseline.payoffDate,
      total_payment_actual: sim.accelerated.totalPaid,
      total_interest_actual: sim.accelerated.totalInterest,
      actual_payoff_date: sim.accelerated.payoffDate,
      interest_saved: sim.interestSaved,
      months_saved: sim.monthsSaved,
      years_saved: sim.yearsSaved,
    };
  }

  async getLoanScenarios(): Promise<LoanScenario[]> {
    return mockLoanScenarios
      .map((s) => this.deriveLoanScenario(s))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async createLoanScenario(payload: Partial<LoanScenario>): Promise<LoanScenario> {
    const scenario: LoanScenario = {
      id: payload.id || `mock-loan-${Date.now()}`,
      name: payload.name || 'New Loan Scenario',
      account_id: payload.account_id,
      account_name: payload.account_name,
      principal_amount: Number(payload.principal_amount || 0),
      annual_interest_rate: Number(payload.annual_interest_rate || 0),
      loan_term_years: Number(payload.loan_term_years || 0),
      loan_term_months: Number(payload.loan_term_months || 0),
      start_date: payload.start_date || toDateOnlyString(todayDateOnly()),
      extra_monthly_payment: Number(payload.extra_monthly_payment || 0),
      lump_sum_payment: Number(payload.lump_sum_payment || 0),
      lump_sum_date: payload.lump_sum_date,
      rate_changes: [],
      // Placeholders — never returned; `getLoanScenarios()` derives these on read.
      monthly_payment: 0,
      total_payment_original: 0,
      total_interest_original: 0,
      original_payoff_date: '',
      total_payment_actual: 0,
      total_interest_actual: 0,
      actual_payoff_date: '',
      interest_saved: 0,
      months_saved: 0,
      years_saved: 0,
    };
    mockLoanScenarios.push(scenario);
    return this.deriveLoanScenario(scenario);
  }

  async updateLoanScenario(id: string | number, payload: Partial<LoanScenario>): Promise<LoanScenario> {
    const idx = mockLoanScenarios.findIndex((s) => String(s.id) === String(id));
    if (idx === -1) throw new Error(`Loan scenario ${id} not found`);

    const merged: LoanScenario = { ...mockLoanScenarios[idx], ...payload };
    mockLoanScenarios[idx] = merged;
    return this.deriveLoanScenario(merged);
  }

  async deleteLoanScenario(id: string | number): Promise<boolean> {
    const idx = mockLoanScenarios.findIndex((s) => String(s.id) === String(id));
    if (idx === -1) return false;
    mockLoanScenarios.splice(idx, 1);
    // Rate-change segments belong to the scenario; drop them with it.
    mockLoanRateChanges = mockLoanRateChanges.filter((rc) => String(rc.scenario_id) !== String(id));
    return true;
  }

  async inferLoanRateChanges(id: string | number): Promise<LoanRateChange[]> {
    const scenario = mockLoanScenarios.find((s) => String(s.id) === String(id));
    if (!scenario) throw new Error(`Loan scenario ${id} not found`);
    if (!scenario.account_id) return [];

    // Annualise the interest actually charged: (interest / balance) * 12 * 100.
    const observations: RateObservation[] = [];
    for (const tx of mockTransactions) {
      if (String(tx.account_id) !== String(scenario.account_id)) continue;
      const category = (tx.category_name || '').toLowerCase();
      if (!category.includes('interest')) continue;
      const interest = Math.abs(Number(tx.amount) || 0);
      const runningBalance = Number(tx.running_balance) || 0;
      const balanceBefore = Math.abs(runningBalance) + interest;
      if (balanceBefore <= 500) continue;
      const rate = (interest / balanceBefore) * 12 * 100;
      if (rate < 0.1 || rate > 30) continue;
      observations.push({ date: tx.date, rate, interest, balance: balanceBefore });
    }

    const segments = detectRateChanges(observations);
    if (segments.length === 0) return [];

    // Segment 0 is the loan's opening rate, not a change. Existing segments are
    // replaced so re-running reflects the current transaction history.
    scenario.annual_interest_rate = segments[0].annual_rate;
    mockLoanRateChanges = mockLoanRateChanges.filter((rc) => String(rc.scenario_id) !== String(id));

    const created: LoanRateChange[] = [];
    segments.slice(1).forEach((seg, i) => {
      const rateChange: LoanRateChange = {
        id: `mock-rc-${Date.now()}-${i}`,
        scenario_id: String(id),
        effective_date: seg.effective_date,
        annual_rate: seg.annual_rate,
        note: `Inferred from ${seg.observation_count} interest payments`,
      };
      mockLoanRateChanges.push(rateChange);
      created.push(rateChange);
    });
    return created;
  }
}

let mockHoldings: PortfolioHolding[] = [
  {
    id: 'hld-nvda',
    account_id: 'acc-3',
    account_name: 'Interactive Brokers (IBKR LLC)',
    security_id: 'sec-nvda',
    symbol: 'NVDA',
    name: 'NVIDIA Corporation',
    security_type: 'stock',
    currency: 'USD',
    total_quantity: 50.0,
    average_cost: 161.83,
    current_price: 182.50,
    total_cost_basis: 8091.50,
    current_market_value: 9125.00,
    unrealized_gain: 1033.50,
    unrealized_gain_percent: 12.77,
    weight_in_portfolio: 35.8,
    day_change: 2.80,
    day_change_percent: 1.56,
    last_quote_date: '2026-09-18',
  },
  {
    id: 'hld-msft',
    account_id: 'acc-3',
    account_name: 'Interactive Brokers (IBKR LLC)',
    security_id: 'sec-msft',
    symbol: 'MSFT',
    name: 'Microsoft Corporation',
    security_type: 'stock',
    currency: 'USD',
    total_quantity: 10.0,
    average_cost: 426.41,
    current_price: 452.00,
    total_cost_basis: 4264.10,
    current_market_value: 4520.00,
    unrealized_gain: 255.90,
    unrealized_gain_percent: 6.00,
    weight_in_portfolio: 17.7,
    day_change: -1.20,
    day_change_percent: -0.26,
    last_quote_date: '2026-09-18',
  },
  {
    id: 'hld-avgo',
    account_id: 'acc-3',
    account_name: 'Interactive Brokers (IBKR LLC)',
    security_id: 'sec-avgo',
    symbol: 'AVGO',
    name: 'Broadcom Inc.',
    security_type: 'stock',
    currency: 'USD',
    total_quantity: 15.0,
    average_cost: 155.00,
    current_price: 172.40,
    total_cost_basis: 2325.00,
    current_market_value: 2586.00,
    unrealized_gain: 261.00,
    unrealized_gain_percent: 11.23,
    weight_in_portfolio: 10.1,
    day_change: 3.10,
    day_change_percent: 1.83,
    last_quote_date: '2026-09-18',
  },
  {
    id: 'hld-d05',
    account_id: 'acc-4',
    account_name: 'CDP / DBS Vickers',
    security_id: 'sec-d05',
    symbol: 'D05.SI',
    name: 'DBS Group Holdings Ltd',
    security_type: 'stock',
    currency: 'SGD',
    total_quantity: 200.0,
    average_cost: 34.20,
    current_price: 38.60,
    total_cost_basis: 6840.00,
    current_market_value: 7720.00,
    unrealized_gain: 880.00,
    unrealized_gain_percent: 12.87,
    weight_in_portfolio: 30.3,
    day_change: 0.40,
    day_change_percent: 1.05,
    last_quote_date: '2026-09-18',
  },
  {
    id: 'hld-es3',
    account_id: 'acc-5',
    account_name: 'Tiger Brokers Singapore',
    security_id: 'sec-es3',
    symbol: 'ES3.SI',
    name: 'SPDR Straits Times Index ETF',
    security_type: 'etf',
    currency: 'SGD',
    total_quantity: 500.0,
    average_cost: 3.10,
    current_price: 3.35,
    total_cost_basis: 1550.00,
    current_market_value: 1675.00,
    unrealized_gain: 125.00,
    unrealized_gain_percent: 8.06,
    weight_in_portfolio: 6.6,
    day_change: 0.02,
    day_change_percent: 0.60,
    last_quote_date: '2026-09-18',
  },
];

let mockTaxLots: TaxLot[] = [
  {
    id: 'lot-nvda-1',
    holding_id: 'hld-nvda',
    account_id: 'acc-3',
    account_name: 'Interactive Brokers (IBKR LLC)',
    symbol: 'NVDA',
    purchase_date: '2025-01-15',
    initial_quantity: 30.0,
    remaining_quantity: 30.0,
    purchase_price: 155.00,
    commission_paid: 1.00,
    total_cost_basis: 4650.00,
    current_market_value: 5475.00,
    unrealized_gain: 825.00,
    unrealized_gain_percent: 17.74,
    holding_days: 611,
    term_type: 'long_term',
    state: 'open',
  },
  {
    id: 'lot-nvda-2',
    holding_id: 'hld-nvda',
    account_id: 'acc-3',
    account_name: 'Interactive Brokers (IBKR LLC)',
    symbol: 'NVDA',
    purchase_date: '2025-08-20',
    initial_quantity: 20.0,
    remaining_quantity: 20.0,
    purchase_price: 172.075,
    commission_paid: 1.00,
    total_cost_basis: 3441.50,
    current_market_value: 3650.00,
    unrealized_gain: 208.50,
    unrealized_gain_percent: 6.06,
    holding_days: 394,
    term_type: 'long_term',
    state: 'open',
  },
  {
    id: 'lot-msft-1',
    holding_id: 'hld-msft',
    account_id: 'acc-3',
    account_name: 'Interactive Brokers (IBKR LLC)',
    symbol: 'MSFT',
    purchase_date: '2025-06-10',
    initial_quantity: 10.0,
    remaining_quantity: 10.0,
    purchase_price: 426.41,
    commission_paid: 1.00,
    total_cost_basis: 4264.10,
    current_market_value: 4520.00,
    unrealized_gain: 255.90,
    unrealized_gain_percent: 6.00,
    holding_days: 465,
    term_type: 'long_term',
    state: 'open',
  },
  {
    id: 'lot-avgo-1',
    holding_id: 'hld-avgo',
    account_id: 'acc-3',
    account_name: 'Interactive Brokers (IBKR LLC)',
    symbol: 'AVGO',
    purchase_date: '2026-03-12',
    initial_quantity: 15.0,
    remaining_quantity: 15.0,
    purchase_price: 155.00,
    commission_paid: 1.00,
    total_cost_basis: 2325.00,
    current_market_value: 2586.00,
    unrealized_gain: 261.00,
    unrealized_gain_percent: 11.23,
    holding_days: 190,
    term_type: 'short_term',
    state: 'open',
  },
  {
    id: 'lot-d05-1',
    holding_id: 'hld-d05',
    account_id: 'acc-4',
    account_name: 'CDP / DBS Vickers',
    symbol: 'D05.SI',
    purchase_date: '2025-02-14',
    initial_quantity: 200.0,
    remaining_quantity: 200.0,
    purchase_price: 34.20,
    commission_paid: 10.00,
    total_cost_basis: 6840.00,
    current_market_value: 7720.00,
    unrealized_gain: 880.00,
    unrealized_gain_percent: 12.87,
    holding_days: 581,
    term_type: 'long_term',
    state: 'open',
  },
  {
    id: 'lot-es3-1',
    holding_id: 'hld-es3',
    account_id: 'acc-5',
    account_name: 'Tiger Brokers Singapore',
    symbol: 'ES3.SI',
    purchase_date: '2025-11-05',
    initial_quantity: 500.0,
    remaining_quantity: 500.0,
    purchase_price: 3.10,
    commission_paid: 2.50,
    total_cost_basis: 1550.00,
    current_market_value: 1675.00,
    unrealized_gain: 125.00,
    unrealized_gain_percent: 8.06,
    holding_days: 317,
    term_type: 'short_term',
    state: 'open',
  },
];

let mockTaxLotDisposals: TaxLotDisposal[] = [
  {
    id: 'disp-nvda-1',
    lot_id: 'lot-nvda-prior',
    symbol: 'NVDA',
    account_id: 'acc-3',
    disposal_date: '2026-07-15',
    quantity_sold: 10.0,
    cost_basis_sold: 1550.00,
    proceeds: 1900.00,
    realized_gain: 350.00,
    term_type: 'long_term',
    disposal_strategy: 'FIFO',
  },
  {
    id: 'disp-aapl-1',
    lot_id: 'lot-aapl-prior',
    symbol: 'AAPL',
    account_id: 'acc-3',
    disposal_date: '2026-04-10',
    quantity_sold: 20.0,
    cost_basis_sold: 3800.00,
    proceeds: 4500.00,
    realized_gain: 700.00,
    term_type: 'long_term',
    disposal_strategy: 'HIFO',
  },
];

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

/**
 * Phase 5 seed data. Mirroring `mockGoals`, properties and loan scenarios
 * persist only their own fields — the derived figures (equity, rent roll,
 * valuation history, amortization summaries) are computed on read through
 * `propertyMath.ts` / `loanMath.ts` by `getProperties()` and
 * `getLoanScenarios()`. The zeroed metrics are placeholders, never returned.
 */
let mockPropertyValuations: PropertyValuation[] = [
  {
    id: 'valu-1',
    property_id: 'prop-1',
    valuation_date: '2024-12-01',
    appraised_value: 745000,
    appraiser: 'Independent Valuers Pte Ltd',
    notes: 'HDB resale market benchmark',
  },
  {
    id: 'valu-2',
    property_id: 'prop-1',
    valuation_date: '2026-03-02',
    appraised_value: 780000,
    appraiser: 'Independent Valuers Pte Ltd',
    notes: 'Post-uplift valuation for refinancing review',
  },
];

let mockProperties: PropertyAsset[] = [
  {
    id: 'prop-1',
    name: 'Tanjong Pagar 4-Room Flat',
    asset_category: 'real_estate',
    property_type: 'primary_residence',
    purchase_date: '2019-03-15',
    purchase_price: 520000,
    current_market_value: 780000,
    mortgage_account_id: 'acc-6',
    mortgage_account_name: 'HDB Concessionary Housing Loan',
    color: 2,
    notes: 'Corner unit with unblocked view; master bedroom rented out.',
    monthly_rental_income: 1200,
    monthly_property_tax: 92.5,
    monthly_insurance: 28.5,
    monthly_hoa_maintenance: 63.4,
    mortgage_balance: 0,
    equity_value: 0,
    loan_to_value_ratio: 0,
    tenant_count: 0,
    gross_annual_rental_income: 0,
    gross_rental_yield_pct: 0,
    net_operating_income: 0,
    net_monthly_cashflow: 0,
    occupancy_rate_pct: 0,
    valuation_history: [],
  },
  {
    id: 'prop-2',
    name: 'Johor Bahru Investment Condo',
    asset_category: 'real_estate',
    property_type: 'rental_property',
    purchase_date: '2022-09-30',
    purchase_price: 425000,
    current_market_value: 460000,
    notes: 'Freehold unit near CIQ; tenanted on a one-year lease.',
    monthly_rental_income: 3800,
    monthly_property_tax: 140,
    monthly_insurance: 55,
    monthly_hoa_maintenance: 120,
    mortgage_balance: 0,
    equity_value: 0,
    loan_to_value_ratio: 0,
    tenant_count: 0,
    gross_annual_rental_income: 0,
    gross_rental_yield_pct: 0,
    net_operating_income: 0,
    net_monthly_cashflow: 0,
    occupancy_rate_pct: 0,
    valuation_history: [],
  },
];

let mockTenants: PropertyTenant[] = [
  {
    id: 'tenant-1',
    name: 'Lim Wei Jie',
    property_id: 'prop-2',
    property_name: 'Johor Bahru Investment Condo',
    unit_number: '12-03',
    email: 'weijie.lim@example.com',
    phone: '+60 12-345 6789',
    emergency_contact: 'Lim Ah Kow (father) +60 16-222 3333',
    lease_start_date: '2026-01-01',
    lease_end_date: '2026-12-31',
    monthly_rent_amount: 3800,
    rent_due_day: 1,
    security_deposit_held: 11400,
    security_deposit_refunded: 0,
    deposit_status: 'held',
    notes: 'Works in Singapore, commutes weekly; rent via DBS transfer.',
    lease_status: 'active',
    total_rent_collected: 0,
    total_rent_overdue: 0,
  },
  {
    id: 'tenant-2',
    name: 'Nurul Aisyah',
    property_id: 'prop-1',
    property_name: 'Tanjong Pagar 4-Room Flat',
    unit_number: '08-21 (Common Room)',
    email: 'nurul.aisyah@example.com',
    phone: '+65 8123 4567',
    emergency_contact: 'Dewi Kartini (mother) +65 9123 8899',
    lease_start_date: '2025-06-01',
    lease_end_date: '2026-11-30',
    monthly_rent_amount: 1200,
    rent_due_day: 5,
    security_deposit_held: 1200,
    security_deposit_refunded: 0,
    deposit_status: 'held',
    notes: 'Room rental; utilities shared.',
    lease_status: 'active',
    total_rent_collected: 0,
    total_rent_overdue: 0,
  },
];

let mockRentPayments: RentPayment[] = [
  // tenant-1 (JB condo): paid through August, September overdue.
  {
    id: 'rp-1',
    tenant_id: 'tenant-1',
    property_id: 'prop-2',
    period_month: '2026-06-01',
    due_date: '2026-06-01',
    amount_due: 3800,
    amount_paid: 3800,
    balance_due: 0,
    paid_date: '2026-06-02',
    payment_status: 'paid',
    memo: 'June rent — DBS transfer',
    notes: undefined,
  },
  {
    id: 'rp-2',
    tenant_id: 'tenant-1',
    property_id: 'prop-2',
    period_month: '2026-07-01',
    due_date: '2026-07-01',
    amount_due: 3800,
    amount_paid: 3800,
    balance_due: 0,
    paid_date: '2026-07-02',
    payment_status: 'paid',
    memo: 'July rent — DBS transfer',
    notes: undefined,
  },
  {
    id: 'rp-3',
    tenant_id: 'tenant-1',
    property_id: 'prop-2',
    period_month: '2026-08-01',
    due_date: '2026-08-01',
    amount_due: 3800,
    amount_paid: 3800,
    balance_due: 0,
    paid_date: '2026-08-03',
    payment_status: 'paid',
    memo: 'August rent — paid late after reminder',
    notes: undefined,
  },
  {
    id: 'rp-4',
    tenant_id: 'tenant-1',
    property_id: 'prop-2',
    period_month: '2026-09-01',
    due_date: '2026-09-01',
    amount_due: 3800,
    amount_paid: 0,
    balance_due: 0,
    paid_date: undefined,
    payment_status: 'pending',
    memo: 'September rent',
    notes: undefined,
  },
  // tenant-2 (TP flat room): July paid, August and September overdue.
  {
    id: 'rp-5',
    tenant_id: 'tenant-2',
    property_id: 'prop-1',
    period_month: '2026-07-01',
    due_date: '2026-07-05',
    amount_due: 1200,
    amount_paid: 1200,
    balance_due: 0,
    paid_date: '2026-07-05',
    payment_status: 'paid',
    memo: 'July room rent',
    notes: undefined,
  },
  {
    id: 'rp-6',
    tenant_id: 'tenant-2',
    property_id: 'prop-1',
    period_month: '2026-08-01',
    due_date: '2026-08-05',
    amount_due: 1200,
    amount_paid: 0,
    balance_due: 0,
    paid_date: undefined,
    payment_status: 'pending',
    memo: 'August room rent',
    notes: undefined,
  },
  {
    id: 'rp-7',
    tenant_id: 'tenant-2',
    property_id: 'prop-1',
    period_month: '2026-09-01',
    due_date: '2026-09-05',
    amount_due: 1200,
    amount_paid: 0,
    balance_due: 0,
    paid_date: undefined,
    payment_status: 'pending',
    memo: 'September room rent',
    notes: undefined,
  },
];

let mockLoanScenarios: LoanScenario[] = [
  {
    id: 'loan-1',
    name: 'HDB Concessionary Housing Loan',
    account_id: 'acc-6',
    account_name: 'HDB Concessionary Housing Loan',
    principal_amount: 285000,
    annual_interest_rate: 2.6,
    loan_term_years: 25,
    loan_term_months: 0,
    start_date: '2024-06-01',
    extra_monthly_payment: 0,
    lump_sum_payment: 0,
    rate_changes: [],
    monthly_payment: 0,
    total_payment_original: 0,
    total_interest_original: 0,
    original_payoff_date: '',
    total_payment_actual: 0,
    total_interest_actual: 0,
    actual_payoff_date: '',
    interest_saved: 0,
    months_saved: 0,
    years_saved: 0,
  },
];

let mockLoanRateChanges: LoanRateChange[] = [];
