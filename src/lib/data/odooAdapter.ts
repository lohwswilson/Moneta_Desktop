import type { IMonetaRepository } from './repository';
import { OdooApi } from '../api/odooApi';
import type {
  MonetaAccount,
  MonetaTransaction,
  DashboardMetrics,
  ReconcileState,
} from '../types/moneta';

export class OdooAdapter implements IMonetaRepository {
  async testConnection(): Promise<{ success: boolean; message: string; user?: string }> {
    return OdooApi.testConnection();
  }

  async getDashboardSummary(): Promise<DashboardMetrics> {
    return OdooApi.getDashboardSummary();
  }

  async getAccounts(): Promise<MonetaAccount[]> {
    return OdooApi.getAccounts();
  }

  async getAccountTransactions(
    accountId: string | number,
    limit?: number
  ): Promise<MonetaTransaction[]> {
    return OdooApi.getAccountTransactions(accountId, limit);
  }

  async updateReconciliationState(
    transactionId: string | number,
    state: ReconcileState
  ): Promise<{ success: boolean; cleared_balance?: number }> {
    return OdooApi.updateReconciliationState(transactionId, state);
  }

  async createTransaction(payload: Partial<MonetaTransaction>): Promise<MonetaTransaction> {
    return OdooApi.createTransaction(payload);
  }
}
