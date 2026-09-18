import type {
  MonetaAccount,
  MonetaTransaction,
  DashboardMetrics,
  ReconcileState,
} from '../types/moneta';

export interface IMonetaRepository {
  testConnection(): Promise<{ success: boolean; message: string; user?: string }>;
  getDashboardSummary(): Promise<DashboardMetrics>;
  getAccounts(): Promise<MonetaAccount[]>;
  getAccountTransactions(accountId: string | number, limit?: number): Promise<MonetaTransaction[]>;
  updateReconciliationState(
    transactionId: string | number,
    state: ReconcileState
  ): Promise<{ success: boolean; cleared_balance?: number }>;
  createTransaction(payload: Partial<MonetaTransaction>): Promise<MonetaTransaction>;
  batchCreateTransactions?(
    accountId: string | number,
    transactions: Partial<MonetaTransaction>[]
  ): Promise<MonetaTransaction[]>;
}
