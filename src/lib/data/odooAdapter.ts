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
  PayeeIntelligence,
  FinancialGoal,
  PortfolioHolding,
  TaxLot,
  TaxLotDisposal,
  PortfolioSummary,
  TaxLotStrategy,
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

  async getPayees(): Promise<PayeeIntelligence[]> {
    return OdooApi.getPayees();
  }

  async updatePayee(id: string | number, payload: Partial<PayeeIntelligence>): Promise<boolean> {
    return OdooApi.updatePayee(id, payload);
  }

  async getGoals(): Promise<FinancialGoal[]> {
    return OdooApi.getGoals();
  }

  async createGoal(payload: Partial<FinancialGoal>): Promise<FinancialGoal> {
    return OdooApi.createGoal(payload);
  }

  async updateGoal(id: string | number, payload: Partial<FinancialGoal>): Promise<FinancialGoal> {
    return OdooApi.updateGoal(id, payload);
  }

  async deleteGoal(id: string | number): Promise<boolean> {
    return OdooApi.deleteGoal(id);
  }

  async fundGoal(
    id: string | number,
    amount: number,
    actionType: 'deposit' | 'withdraw'
  ): Promise<FinancialGoal> {
    return OdooApi.fundGoal(id, amount, actionType);
  }

  async getPortfolioHoldings(accountId?: string | number): Promise<PortfolioHolding[]> {
    return OdooApi.getPortfolioHoldings(accountId);
  }

  async getTaxLots(symbol?: string, accountId?: string | number, state?: string): Promise<TaxLot[]> {
    return OdooApi.getTaxLots(symbol, accountId, state);
  }

  async getTaxLotDisposals(year?: number): Promise<TaxLotDisposal[]> {
    return OdooApi.getTaxLotDisposals(year);
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
    return OdooApi.executeInvestmentTrade(payload);
  }

  async getPortfolioSummary(accountId?: string | number): Promise<PortfolioSummary> {
    return OdooApi.getPortfolioSummary(accountId);
  }
}
