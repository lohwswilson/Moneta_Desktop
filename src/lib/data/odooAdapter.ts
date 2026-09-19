import type { IMonetaRepository, VerifyBalanceResult } from './repository';
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
  PropertyAsset,
  PropertyTenant,
  RentPayment,
  LoanScenario,
  LoanRateChange,
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

  async verifyAndReconcileAccount(
    accountId: string | number,
    confirmedBalance: number,
    adjustmentAmount?: number
  ): Promise<VerifyBalanceResult> {
    const res = await OdooApi.verifyAccountBalance(
      accountId,
      confirmedBalance,
      adjustmentAmount
    );
    return {
      success: res.success,
      reconciledCount: res.reconciled_count,
      clearedBalance: res.cleared_balance,
      adjustmentTransaction: res.adjustment_transaction,
    };
  }

  async createTransaction(payload: Partial<MonetaTransaction>): Promise<MonetaTransaction> {
    return OdooApi.createTransaction(payload);
  }

  async updateTransaction(
    id: string | number,
    payload: Partial<MonetaTransaction>
  ): Promise<MonetaTransaction> {
    return OdooApi.updateTransaction(id, payload);
  }

  async deleteTransaction(id: string | number): Promise<boolean> {
    return OdooApi.deleteTransaction(id);
  }

  async batchCreateTransactions(
    accountId: string | number,
    transactions: Partial<MonetaTransaction>[]
  ): Promise<MonetaTransaction[]> {
    return OdooApi.batchCreateTransactions(accountId, transactions);
  }

  async getBudgets(): Promise<EnvelopeBudget[]> {
    return OdooApi.getBudgets();
  }

  async createBudget(payload: Partial<EnvelopeBudget>): Promise<EnvelopeBudget> {
    return OdooApi.createBudget(payload);
  }

  async updateBudget(
    id: string | number,
    payload: Partial<EnvelopeBudget>
  ): Promise<EnvelopeBudget> {
    return OdooApi.updateBudget(id, payload);
  }

  async deleteBudget(id: string | number): Promise<boolean> {
    return OdooApi.deleteBudget(id);
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

  // --- Phase 5 ---

  async getProperties(): Promise<PropertyAsset[]> {
    return OdooApi.getProperties();
  }

  async createProperty(payload: Partial<PropertyAsset>): Promise<PropertyAsset> {
    return OdooApi.createProperty(payload);
  }

  async updateProperty(id: string | number, payload: Partial<PropertyAsset>): Promise<PropertyAsset> {
    return OdooApi.updateProperty(id, payload);
  }

  async deleteProperty(id: string | number): Promise<boolean> {
    return OdooApi.deleteProperty(id);
  }

  async addPropertyValuation(
    id: string | number,
    payload: { valuation_date: string; appraised_value: number; appraiser?: string; notes?: string }
  ): Promise<PropertyAsset> {
    return OdooApi.addPropertyValuation(id, payload);
  }

  async getTenants(): Promise<PropertyTenant[]> {
    return OdooApi.getTenants();
  }

  async createTenant(payload: Partial<PropertyTenant>): Promise<PropertyTenant> {
    return OdooApi.createTenant(payload);
  }

  async updateTenant(id: string | number, payload: Partial<PropertyTenant>): Promise<PropertyTenant> {
    return OdooApi.updateTenant(id, payload);
  }

  async deleteTenant(id: string | number): Promise<boolean> {
    return OdooApi.deleteTenant(id);
  }

  async generateRentSchedule(tenantId: string | number): Promise<number> {
    return OdooApi.generateRentSchedule(tenantId);
  }

  async getRentPayments(tenantId?: string | number): Promise<RentPayment[]> {
    return OdooApi.getRentPayments(tenantId);
  }

  async markRentPaid(paymentId: string | number): Promise<RentPayment> {
    return OdooApi.markRentPaid(paymentId);
  }

  async getLoanScenarios(): Promise<LoanScenario[]> {
    return OdooApi.getLoanScenarios();
  }

  async createLoanScenario(payload: Partial<LoanScenario>): Promise<LoanScenario> {
    return OdooApi.createLoanScenario(payload);
  }

  async updateLoanScenario(id: string | number, payload: Partial<LoanScenario>): Promise<LoanScenario> {
    return OdooApi.updateLoanScenario(id, payload);
  }

  async deleteLoanScenario(id: string | number): Promise<boolean> {
    return OdooApi.deleteLoanScenario(id);
  }

  async inferLoanRateChanges(id: string | number): Promise<LoanRateChange[]> {
    return OdooApi.inferLoanRateChanges(id);
  }
}
