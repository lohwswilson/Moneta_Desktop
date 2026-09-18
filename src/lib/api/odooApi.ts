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
    const response = await getApiClient().post('/api/v1/mobile/transactions/list', {
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
};
