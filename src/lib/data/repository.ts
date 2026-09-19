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
  SyncChange,
} from '../types/moneta';

export interface VerifyBalanceResult {
  success: boolean;
  reconciledCount: number;
  clearedBalance: number;
  adjustmentTransaction?: MonetaTransaction;
}

export interface IMonetaRepository {
  testConnection(): Promise<{ success: boolean; message: string; user?: string }>;
  getDashboardSummary(): Promise<DashboardMetrics>;
  getAccounts(): Promise<MonetaAccount[]>;
  getAccountTransactions(accountId: string | number, limit?: number): Promise<MonetaTransaction[]>;
  updateReconciliationState(
    transactionId: string | number,
    state: ReconcileState
  ): Promise<{ success: boolean; cleared_balance?: number }>;
  verifyAndReconcileAccount?(
    accountId: string | number,
    confirmedBalance: number,
    adjustmentAmount?: number
  ): Promise<VerifyBalanceResult>;
  createTransaction(payload: Partial<MonetaTransaction>): Promise<MonetaTransaction>;
  updateTransaction?(
    id: string | number,
    payload: Partial<MonetaTransaction>
  ): Promise<MonetaTransaction>;
  deleteTransaction?(id: string | number): Promise<boolean>;
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
  getGoals?(): Promise<FinancialGoal[]>;
  createGoal?(payload: Partial<FinancialGoal>): Promise<FinancialGoal>;
  updateGoal?(id: string | number, payload: Partial<FinancialGoal>): Promise<FinancialGoal>;
  deleteGoal?(id: string | number): Promise<boolean>;
  fundGoal?(
    id: string | number,
    amount: number,
    actionType: 'deposit' | 'withdraw'
  ): Promise<FinancialGoal>;
  getPortfolioHoldings?(accountId?: string | number): Promise<PortfolioHolding[]>;
  getTaxLots?(symbol?: string, accountId?: string | number, state?: string): Promise<TaxLot[]>;
  getTaxLotDisposals?(year?: number): Promise<TaxLotDisposal[]>;
  executeInvestmentTrade?(payload: {
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
  }): Promise<{ success: boolean; transactionId?: number }>;
  getPortfolioSummary?(accountId?: string | number): Promise<PortfolioSummary>;

  // --- Phase 5: Property, Rental & Loan Scenarios ---
  getProperties?(): Promise<PropertyAsset[]>;
  createProperty?(payload: Partial<PropertyAsset>): Promise<PropertyAsset>;
  updateProperty?(id: string | number, payload: Partial<PropertyAsset>): Promise<PropertyAsset>;
  deleteProperty?(id: string | number): Promise<boolean>;
  addPropertyValuation?(
    id: string | number,
    payload: { valuation_date: string; appraised_value: number; appraiser?: string; notes?: string }
  ): Promise<PropertyAsset>;

  getTenants?(): Promise<PropertyTenant[]>;
  createTenant?(payload: Partial<PropertyTenant>): Promise<PropertyTenant>;
  updateTenant?(id: string | number, payload: Partial<PropertyTenant>): Promise<PropertyTenant>;
  deleteTenant?(id: string | number): Promise<boolean>;
  /** Returns how many rent payments were created. Idempotent per rental month. */
  generateRentSchedule?(tenantId: string | number): Promise<number>;
  getRentPayments?(tenantId?: string | number): Promise<RentPayment[]>;
  markRentPaid?(paymentId: string | number): Promise<RentPayment>;

  getLoanScenarios?(): Promise<LoanScenario[]>;
  createLoanScenario?(payload: Partial<LoanScenario>): Promise<LoanScenario>;
  updateLoanScenario?(id: string | number, payload: Partial<LoanScenario>): Promise<LoanScenario>;
  deleteLoanScenario?(id: string | number): Promise<boolean>;
  /** Infers rate-change segments from historical interest payments on the linked account. */
  inferLoanRateChanges?(id: string | number): Promise<LoanRateChange[]>;

  // --- Sync change tracking (local store only) ---
  /** Changes recorded locally that have not yet been pushed to Moneta Cloud. */
  getPendingChanges?(limit?: number): Promise<SyncChange[]>;
  /** How many changes await push. */
  getPendingChangeCount?(): Promise<number>;
  /** Marks changes as pushed. Returns how many were marked. */
  markChangesSynced?(ids: number[]): Promise<number>;
}

