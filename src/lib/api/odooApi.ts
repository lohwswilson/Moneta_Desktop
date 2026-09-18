import { getApiClient } from './client';
import type {
  MonetaAccount,
  MonetaTransaction,
  DashboardMetrics,
  ReconcileState,
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

      if (response.data?.result?.status === 'ok') {
        return {
          success: true,
          message: 'Connected successfully',
          user: response.data.result.user_name,
        };
      }

      const err = response.data?.error;
      const msg =
        err?.data?.message ||
        err?.message ||
        response.data?.result?.message ||
        'Connection failed';

      return {
        success: false,
        message: msg,
      };
    } catch (err: any) {
      return {
        success: false,
        message: err.response?.data?.message || err.message || 'Unable to reach Odoo server',
      };
    }
  },

  /**
   * Fetch executive dashboard summary metrics
   */
  async getDashboardSummary(): Promise<DashboardMetrics> {
    const response = await getApiClient().post('/api/v1/mobile/dashboard/summary', {
      jsonrpc: '2.0',
      params: {},
    });
    return response.data?.result?.metrics;
  },

  /**
   * List all active accounts
   */
  async getAccounts(): Promise<MonetaAccount[]> {
    const response = await getApiClient().post('/api/v1/mobile/accounts/list', {
      jsonrpc: '2.0',
      params: {},
    });
    return response.data?.result?.accounts || [];
  },

  /**
   * Fetch checkbook register transactions for an account
   */
  async getAccountTransactions(
    accountId: string | number,
    limit: number = 200
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
   * 1-Tap toggle or update transaction reconciliation state
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
};
