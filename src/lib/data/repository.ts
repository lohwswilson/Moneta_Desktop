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
  getBudgets?(): Promise<EnvelopeBudget[]>;
  createBudget?(payload: Partial<EnvelopeBudget>): Promise<EnvelopeBudget>;
  updateBudget?(id: string | number, payload: Partial<EnvelopeBudget>): Promise<EnvelopeBudget>;
  deleteBudget?(id: string | number): Promise<boolean>;
  getSettings?(): Promise<OdooSettingsPayload | null>;
  syncSettingsFromOdoo?(settings: OdooSettingsPayload): Promise<void>;
  getRecurringBills?(days?: number): Promise<RecurringBill[]>;
  createRecurringBill?(payload: Partial<RecurringBill>): Promise<RecurringBill>;
  updateRecurringBill?(id: string | number, payload: Partial<RecurringBill>): Promise<RecurringBill>;
  deleteRecurringBill?(id: string | number): Promise<boolean>;
  markBillPaid?(id: string | number, accountId?: string | number, date?: string): Promise<{ success: boolean; transaction?: MonetaTransaction }>;
  detectSubscriptions?(): Promise<DetectedSubscription[]>;
  getCashflowForecast?(days?: number, accountId?: string | number): Promise<CashflowForecast>;
  getPayees?(): Promise<PayeeIntelligence[]>;
  updatePayee?(id: string | number, payload: Partial<PayeeIntelligence>): Promise<boolean>;
}
