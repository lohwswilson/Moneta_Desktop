import { getApiClient } from './client';
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
} from '../types/moneta';

export const OdooApi = {
  /**
   * Healthcheck & Token validation
   */
  async testConnection(): Promise<{ success: boolean; message: string; user?: string }> {
    try {
      const response = await getApiClient().post('/api/v1/mobile/ping', {
        jsonrpc: '2.0',
        params: {},
      });
      const data = response.data?.result;
      if (data && data.status === 'ok') {
        return {
          success: true,
          message: `Connected to Odoo 18 (${data.module || 'moneta_finance'})`,
          user: data.user_name,
        };
      }
      return { success: false, message: response.data?.error?.message || 'Unauthorized or invalid response' };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Network connection error' };
    }
  },

  /**
   * Fetch executive wealth & FIRE dashboard metrics (<40ms)
   */
  async getDashboardSummary(): Promise<DashboardMetrics> {
    const response = await getApiClient().post('/api/v1/mobile/dashboard/summary', {
      jsonrpc: '2.0',
      params: {},
    });
    return response.data?.result?.metrics;
  },

  /**
   * Fetch all active financial accounts
   */
  async getAccounts(): Promise<MonetaAccount[]> {
    const response = await getApiClient().post('/api/v1/mobile/accounts/list', {
      jsonrpc: '2.0',
      params: {},
    });
    return response.data?.result?.accounts || [];
  },

  /**
   * Fetch checkbook register transactions for a specific account
   */
  async getAccountTransactions(
    accountId: string | number,
    limit: number = 100
  ): Promise<MonetaTransaction[]> {
    const response = await getApiClient().post('/api/v1/mobile/transactions/register', {
      jsonrpc: '2.0',
      params: {
        account_id: accountId,
        limit,
      },
    });
    return response.data?.result?.transactions || [];
  },

  /**
   * 1-Click update of reconciliation state (unreconciled | cleared | reconciled)
   */
  async updateReconciliationState(
    transactionId: string | number,
    state: ReconcileState
  ): Promise<{ success: boolean; cleared_balance?: number }> {
    const response = await getApiClient().post('/api/v1/mobile/transactions/reconcile', {
      jsonrpc: '2.0',
      params: {
        transaction_id: transactionId,
        reconciliation_state: state,
      },
    });
    return response.data?.result || { success: true };
  },

  /**
   * Create a new expense or income transaction
   */
  async createTransaction(payload: Partial<MonetaTransaction>): Promise<MonetaTransaction> {
    const response = await getApiClient().post('/api/v1/mobile/transactions/create', {
      jsonrpc: '2.0',
      params: payload,
    });
    return response.data?.result?.transaction;
  },

  /**
   * Fetch active envelope budgets
   */
  async getBudgets(): Promise<EnvelopeBudget[]> {
    const response = await getApiClient().post('/api/v1/mobile/budgets/list', {
      jsonrpc: '2.0',
      params: {},
    });
    return response.data?.result?.budgets || [];
  },

  /**
   * Fetch canonical Odoo settings (base currency, FX rates, categorization rules)
   */
  async fetchSettings(): Promise<OdooSettingsPayload | null> {
    const response = await getApiClient().post('/api/v1/mobile/settings', {
      jsonrpc: '2.0',
      params: {},
    });
    return response.data?.result?.settings || null;
  },

  /**
   * Fetch recurring bills due in the next N days (or all if days=0)
   */
  async getRecurringBills(days: number = 14): Promise<RecurringBill[]> {
    const response = await getApiClient().post('/api/v1/mobile/bills/upcoming', {
      jsonrpc: '2.0',
      params: { days },
    });
    return response.data?.result?.bills || [];
  },

  /**
   * Create a new recurring bill in Odoo
   */
  async createRecurringBill(payload: Partial<RecurringBill>): Promise<RecurringBill> {
    const response = await getApiClient().post('/api/v1/mobile/bills/create', {
      jsonrpc: '2.0',
      params: payload,
    });
    return response.data?.result?.bill;
  },

  /**
   * Update an existing recurring bill
   */
  async updateRecurringBill(id: string | number, payload: Partial<RecurringBill>): Promise<boolean> {
    const response = await getApiClient().post('/api/v1/mobile/bills/update', {
      jsonrpc: '2.0',
      params: {
        bill_id: id,
        ...payload,
      },
    });
    return response.data?.result?.success || false;
  },

  /**
   * Delete a recurring bill
   */
  async deleteRecurringBill(id: string | number): Promise<boolean> {
    const response = await getApiClient().post('/api/v1/mobile/bills/delete', {
      jsonrpc: '2.0',
      params: { bill_id: id },
    });
    return response.data?.result?.success || false;
  },

  /**
   * Mark bill as paid: creates ledger transaction and advances due date
   */
  async markBillPaid(id: string | number, accountId?: string | number, date?: string): Promise<{ success: boolean; next_due_date?: string }> {
    const response = await getApiClient().post('/api/v1/mobile/bills/mark_paid', {
      jsonrpc: '2.0',
      params: {
        bill_id: id,
        account_id: accountId,
        date,
      },
    });
    return response.data?.result || { success: false };
  },

  /**
   * Automatically detect recurring subscriptions from transaction history
   */
  async detectSubscriptions(): Promise<DetectedSubscription[]> {
    const response = await getApiClient().post('/api/v1/mobile/subscriptions/detect', {
      jsonrpc: '2.0',
      params: {},
    });
    return response.data?.result?.subscriptions || [];
  },

  /**
   * Fetch cash flow projection simulation and Sankey graph data
   */
  async getCashflowProjection(days: number = 90, accountId?: string | number): Promise<CashflowForecast> {
    const response = await getApiClient().post('/api/v1/mobile/cashflow/projection', {
      jsonrpc: '2.0',
      params: {
        days,
        account_id: accountId,
      },
    });
    return response.data?.result?.forecast;
  },

  /**
   * Fetch all payees and merchant intelligence
   */
  async getPayees(): Promise<PayeeIntelligence[]> {
    const response = await getApiClient().post('/api/v1/mobile/payees/list', {
      jsonrpc: '2.0',
      params: {},
    });
    return response.data?.result?.payees || [];
  },

  /**
   * Update payee metadata
   */
  async updatePayee(id: string | number, payload: Partial<PayeeIntelligence>): Promise<boolean> {
    const response = await getApiClient().post('/api/v1/mobile/payees/update', {
      jsonrpc: '2.0',
      params: {
        payee_id: id,
        ...payload,
      },
    });
    return response.data?.result?.success || false;
  },

  /**
   * Fetch all financial goals and sinking funds
   */
  async getGoals(): Promise<FinancialGoal[]> {
    const response = await getApiClient().post('/api/v1/mobile/goals/list', {
      jsonrpc: '2.0',
      params: {},
    });
    return response.data?.result?.goals || [];
  },

  /**
   * Create a financial goal
   */
  async createGoal(payload: Partial<FinancialGoal>): Promise<FinancialGoal> {
    const response = await getApiClient().post('/api/v1/mobile/goals/create', {
      jsonrpc: '2.0',
      params: payload,
    });
    return response.data?.result?.goal;
  },

  /**
   * Update a financial goal (also used to pause or resume it)
   */
  async updateGoal(id: string | number, payload: Partial<FinancialGoal>): Promise<FinancialGoal> {
    const response = await getApiClient().post('/api/v1/mobile/goals/update', {
      jsonrpc: '2.0',
      params: {
        goal_id: id,
        ...payload,
      },
    });
    return response.data?.result?.goal;
  },

  /**
   * Delete a financial goal
   */
  async deleteGoal(id: string | number): Promise<boolean> {
    const response = await getApiClient().post('/api/v1/mobile/goals/delete', {
      jsonrpc: '2.0',
      params: { goal_id: id },
    });
    return response.data?.result?.success || false;
  },

  /**
   * Deposit into or withdraw from a goal's saved balance
   */
  async fundGoal(
    id: string | number,
    amount: number,
    actionType: 'deposit' | 'withdraw'
  ): Promise<FinancialGoal> {
    const response = await getApiClient().post('/api/v1/mobile/goals/fund', {
      jsonrpc: '2.0',
      params: {
        goal_id: id,
        amount,
        action_type: actionType,
      },
    });
    return response.data?.result?.goal;
  },

  /**
   * Fetch active portfolio holdings
   */
  async getPortfolioHoldings(accountId?: string | number): Promise<PortfolioHolding[]> {
    const response = await getApiClient().post('/api/v1/mobile/investments/holdings', {
      jsonrpc: '2.0',
      params: { account_id: accountId },
    });
    return response.data?.result?.holdings || [];
  },

  /**
   * Fetch tax lots for holdings
   */
  async getTaxLots(symbol?: string, accountId?: string | number, state?: string): Promise<TaxLot[]> {
    const response = await getApiClient().post('/api/v1/mobile/investments/lots', {
      jsonrpc: '2.0',
      params: { symbol, account_id: accountId, state },
    });
    return response.data?.result?.lots || [];
  },

  /**
   * Fetch realized capital gains (tax lot disposals)
   */
  async getTaxLotDisposals(year?: number): Promise<TaxLotDisposal[]> {
    const response = await getApiClient().post('/api/v1/mobile/investments/disposals', {
      jsonrpc: '2.0',
      params: { year },
    });
    return response.data?.result?.disposals || [];
  },

  /**
   * Execute an investment trade (Buy or Sell) with tax-lot creation or allocation
   */
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
    const response = await getApiClient().post('/api/v1/mobile/investments/trade', {
      jsonrpc: '2.0',
      params: {
        account_id: payload.accountId,
        symbol: payload.symbol,
        action: payload.action,
        quantity: payload.quantity,
        price: payload.price,
        trade_date: payload.tradeDate,
        commission: payload.commission,
        strategy: payload.strategy,
        selected_lot_id: payload.selectedLotId,
        memo: payload.memo,
      },
    });
    return {
      success: response.data?.result?.success || false,
      transactionId: response.data?.result?.transaction_id,
    };
  },

  /**
   * Fetch portfolio summary analytics
   */
  async getPortfolioSummary(accountId?: string | number): Promise<PortfolioSummary> {
    const response = await getApiClient().post('/api/v1/mobile/investments/summary', {
      jsonrpc: '2.0',
      params: { account_id: accountId },
    });
    return response.data?.result?.summary || {
      total_portfolio_value: 0,
      total_cost_basis: 0,
      total_unrealized_gain: 0,
      total_unrealized_gain_percent: 0,
      total_realized_gain_ytd: 0,
      holdings_count: 0,
      open_lots_count: 0,
      asset_allocation: [],
    };
  },
};

