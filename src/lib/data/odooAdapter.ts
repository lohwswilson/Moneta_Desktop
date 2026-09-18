import type { IMonetaRepository } from './repository';
import { OdooApi } from '../api/odooApi';
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

  async getBudgets(): Promise<EnvelopeBudget[]> {
    return OdooApi.getBudgets();
  }

  async getSettings(): Promise<OdooSettingsPayload | null> {
    return OdooApi.fetchSettings();
  }

  async getRecurringBills(days?: number): Promise<RecurringBill[]> {
    return OdooApi.getRecurringBills(days);
  }

  async createRecurringBill(payload: Partial<RecurringBill>): Promise<RecurringBill> {
    return OdooApi.createRecurringBill(payload);
  }

  async updateRecurringBill(id: string | number, payload: Partial<RecurringBill>): Promise<RecurringBill> {
    await OdooApi.updateRecurringBill(id, payload);
    const bills = await OdooApi.getRecurringBills(0);
    const found = bills.find((b) => String(b.id) === String(id));
    return found || (payload as RecurringBill);
  }

  async deleteRecurringBill(id: string | number): Promise<boolean> {
    return OdooApi.deleteRecurringBill(id);
  }

  async markBillPaid(id: string | number, accountId?: string | number, date?: string): Promise<{ success: boolean; transaction?: MonetaTransaction }> {
    const res = await OdooApi.markBillPaid(id, accountId, date);
    return { success: res.success };
  }

  async detectSubscriptions(): Promise<DetectedSubscription[]> {
    return OdooApi.detectSubscriptions();
  }

  async getCashflowForecast(days: number = 90, accountId?: string | number): Promise<CashflowForecast> {
    return OdooApi.getCashflowProjection(days, accountId);
  }
}
