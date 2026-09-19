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
  CPFAccountSummary,
  CPFHousingRecord,
  IRASTaxRecord,
  SSBBondRecord,
  TBillRecord,
  SRSTrackerRecord,
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

  async createAccount(payload: Partial<MonetaAccount>): Promise<MonetaAccount> {
    throw new Error('Account creation via Odoo remote API is not supported. Use Local SQLite.');
  }

  async updateAccount(id: string | number, payload: Partial<MonetaAccount>): Promise<MonetaAccount> {
    throw new Error('Account update via Odoo remote API is not supported. Use Local SQLite.');
  }

  async deleteAccount(id: string | number): Promise<boolean> {
    throw new Error('Account deletion via Odoo remote API is not supported. Use Local SQLite.');
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

  // --- Milestone 1: Singapore Regional Wealth Pack ---
  async getCPFAccounts(userAge: number = 35): Promise<CPFAccountSummary> {
    // When in live Odoo mode, compute from synced accounts or fallback
    const accounts = await this.getAccounts();
    let oa = 0, sa = 0, ma = 0, ra = 0;
    for (const a of accounts) {
      if (a.account_type === 'cpf_oa') oa += a.current_balance;
      else if (a.account_type === 'cpf_sa') sa += a.current_balance;
      else if (a.account_type === 'cpf_ma') ma += a.current_balance;
      else if (a.account_type === 'cpf_ra') ra += a.current_balance;
    }
    const { computeCPFInterest } = await import('./cpfMath');
    const metrics = computeCPFInterest({ oa, sa, ma, ra, age: userAge });
    return {
      oa_balance: oa,
      sa_balance: sa,
      ma_balance: ma,
      ra_balance: ra,
      total_balance: oa + sa + ma + ra,
      total_annual_interest: metrics.totalAnnualInterest,
      extra_interest_earned: metrics.extraInterestTotal,
      user_age: userAge,
    };
  }

  async getCPFHousingRecords(): Promise<CPFHousingRecord[]> {
    return [];
  }

  async saveCPFHousingRecord(record: Partial<CPFHousingRecord>): Promise<CPFHousingRecord> {
    const { computeCPFHousingRefund } = await import('./cpfMath');
    const refund = computeCPFHousingRefund({
      downpaymentOA: Number(record.oa_withdrawn_downpayment) || 0,
      monthlyOA: Number(record.oa_withdrawn_monthly) || 0,
      housingGrants: Number(record.housing_grant_amount) || 0,
      yearsHeld: Number(record.ownership_years) || 0,
      marketValuation: Number(record.valuation) || 0,
      outstandingLoan: Number(record.outstanding_loan) || 0,
    });
    return {
      id: record.id || `cpf-h-${Date.now()}`,
      property_name: record.property_name || 'Property',
      purchase_date: record.purchase_date || new Date().toISOString().split('T')[0],
      purchase_price: Number(record.purchase_price) || 0,
      valuation: Number(record.valuation) || 0,
      oa_withdrawn_downpayment: Number(record.oa_withdrawn_downpayment) || 0,
      oa_withdrawn_monthly: Number(record.oa_withdrawn_monthly) || 0,
      housing_grant_amount: Number(record.housing_grant_amount) || 0,
      outstanding_loan: Number(record.outstanding_loan) || 0,
      ownership_years: Number(record.ownership_years) || 0,
      accrued_interest: refund.totalAccruedInterest,
      total_refund_due: refund.totalRefundRequired,
      net_sale_cash_proceeds: refund.netCashProceeds,
      notes: record.notes,
    };
  }

  async deleteCPFHousingRecord(_id: string | number): Promise<boolean> {
    return true;
  }

  async getIRASTaxRecords(): Promise<IRASTaxRecord[]> {
    return [];
  }

  async saveIRASTaxRecord(record: Partial<IRASTaxRecord>): Promise<IRASTaxRecord> {
    const { computeSingaporeTax } = await import('./irasMath');
    const res = computeSingaporeTax({
      employmentIncome: Number(record.employment_income) || 0,
      tradeIncome: Number(record.trade_income) || 0,
      rentalIncome: Number(record.rental_income) || 0,
      otherIncome: Number(record.other_income) || 0,
      reliefs: {
        cpfEmployee: Number(record.cpf_employee_relief) || 0,
        earnedIncome: Number(record.earned_income_relief) || 0,
        srs: Number(record.srs_contribution) || 0,
        rstuSelf: Number(record.rstu_self) || 0,
        rstuFamily: Number(record.rstu_family) || 0,
        nsman: Number(record.nsman_relief) || 0,
        child: Number(record.child_relief) || 0,
        parent: Number(record.parent_relief) || 0,
        donations250Pct: Number(record.donations_250) || 0,
      },
    });
    return {
      id: record.id || `iras-${Date.now()}`,
      assessment_year: Number(record.assessment_year) || 2025,
      employment_income: Number(record.employment_income) || 0,
      trade_income: Number(record.trade_income) || 0,
      rental_income: Number(record.rental_income) || 0,
      other_income: Number(record.other_income) || 0,
      cpf_employee_relief: Number(record.cpf_employee_relief) || 0,
      earned_income_relief: Number(record.earned_income_relief) || 0,
      srs_contribution: Number(record.srs_contribution) || 0,
      rstu_self: Number(record.rstu_self) || 0,
      rstu_family: Number(record.rstu_family) || 0,
      nsman_relief: Number(record.nsman_relief) || 0,
      child_relief: Number(record.child_relief) || 0,
      parent_relief: Number(record.parent_relief) || 0,
      donations_250: Number(record.donations_250) || 0,
      total_income: res.totalIncome,
      total_reliefs: res.totalReliefs,
      chargeable_income: res.chargeableIncome,
      tax_payable: res.netTaxPayable,
      effective_tax_rate_pct: res.effectiveTaxRatePct,
      marginal_tax_rate_pct: res.marginalTaxRatePct,
      srs_potential_tax_savings: res.srsPotentialTaxSavings,
      notes: record.notes,
    };
  }

  async deleteIRASTaxRecord(_id: string | number): Promise<boolean> {
    return true;
  }

  // Singapore Fixed Income (SSB & T-Bills) & SRS
  async getSSBBonds(): Promise<SSBBondRecord[]> {
    return [];
  }

  async saveSSBBond(record: Partial<SSBBondRecord>): Promise<SSBBondRecord> {
    const { computeSSBYields } = await import('./singaporeFixedIncomeMath');
    const code = record.issue_code || 'SBNEW';
    const amt = Number(record.investment_amount || 10000);
    const issueDate = record.issue_date || new Date().toISOString().split('T')[0];
    const maturityDate = record.maturity_date || `${Number(issueDate.split('-')[0]) + 10}-${issueDate.slice(5)}`;
    const fundingSource = record.funding_source || 'cash';
    const rates = [
      record.rate_year_1 ?? 2.80, record.rate_year_2 ?? 2.85, record.rate_year_3 ?? 2.90, record.rate_year_4 ?? 2.95, record.rate_year_5 ?? 3.00,
      record.rate_year_6 ?? 3.05, record.rate_year_7 ?? 3.10, record.rate_year_8 ?? 3.15, record.rate_year_9 ?? 3.20, record.rate_year_10 ?? 3.30,
    ];
    const yields = computeSSBYields({ investmentAmount: amt, stepUpRates: rates });
    const state = record.state || 'active';
    const notes = record.notes || '';

    return {
      id: record.id || `ssb-${Date.now()}`,
      issue_code: code,
      investment_amount: amt,
      issue_date: issueDate,
      maturity_date: maturityDate,
      funding_source: fundingSource,
      rate_year_1: rates[0],
      rate_year_2: rates[1],
      rate_year_3: rates[2],
      rate_year_4: rates[3],
      rate_year_5: rates[4],
      rate_year_6: rates[5],
      rate_year_7: rates[6],
      rate_year_8: rates[7],
      rate_year_9: rates[8],
      rate_year_10: rates[9],
      average_10yr_yield: yields.average10YrYield,
      total_interest_to_maturity: yields.totalInterestToMaturity,
      next_coupon_payout: yields.nextSemiAnnualCoupon,
      state,
      notes,
    };
  }

  async deleteSSBBond(_id: string | number): Promise<boolean> {
    return true;
  }

  async getTBills(): Promise<TBillRecord[]> {
    return [];
  }

  async saveTBill(record: Partial<TBillRecord>): Promise<TBillRecord> {
    const { computeTBillEconomics } = await import('./singaporeFixedIncomeMath');
    const code = record.issue_code || 'BSNEW';
    const tenure = record.tenure_type || '6_month';
    const auctionDate = record.auction_date || new Date().toISOString().split('T')[0];
    const issueDate = record.issue_date || new Date().toISOString().split('T')[0];
    const fundingSource = record.funding_source || 'cash';
    const face = Number(record.face_value || 10000);
    const price = Number(record.issue_price_per_hundred || 98.15);
    const econ = computeTBillEconomics({
      faceValue: face,
      issuePricePerHundred: price,
      tenureType: tenure,
      fundingSource,
      issueDate,
    });
    const state = record.state || 'active';
    const notes = record.notes || '';

    return {
      id: record.id || `tbill-${Date.now()}`,
      issue_code: code,
      tenure_type: tenure,
      auction_date: auctionDate,
      issue_date: issueDate,
      maturity_date: econ.maturityDate,
      funding_source: fundingSource,
      face_value: face,
      issue_price_per_hundred: price,
      total_investment_cost: econ.totalInvestmentCost,
      net_discount_profit: econ.netDiscountProfit,
      cut_off_yield_p_a: econ.cutOffYieldPA,
      state,
      notes,
    };
  }

  async deleteTBill(_id: string | number): Promise<boolean> {
    return true;
  }

  async getSRSRecords(): Promise<SRSTrackerRecord[]> {
    return [];
  }

  async saveSRSRecord(record: Partial<SRSTrackerRecord>): Promise<SRSTrackerRecord> {
    const { computeSRSMetrics, computeSRSWithdrawalPlan } = await import('./srsMath');
    const taxYear = Number(record.tax_year || new Date().getFullYear());
    const residency = record.residency_status || 'citizen_pr';
    const contrib = Number(record.total_contributed || 0);
    const rate = Number(record.marginal_tax_rate || 15.0);
    const bal = Number(record.srs_current_balance || 0);
    const notes = record.notes || '';

    const metrics = computeSRSMetrics({
      residencyStatus: residency,
      totalContributedYTD: contrib,
      marginalTaxRatePct: rate,
    });
    const plan = computeSRSWithdrawalPlan({
      currentBalance: bal,
    });

    return {
      id: record.id || `srs-${Date.now()}`,
      tax_year: taxYear,
      residency_status: residency,
      annual_cap: metrics.annualCap,
      total_contributed: contrib,
      remaining_allowance: metrics.remainingAllowance,
      marginal_tax_rate: rate,
      estimated_tax_savings: metrics.estimatedTaxSavings,
      srs_current_balance: bal,
      annual_withdrawal_target: plan.annualWithdrawalTarget,
      annual_taxable_portion: plan.annualTaxablePortion,
      is_tax_free_strategy: plan.isTaxFreeStrategy,
      notes,
    };
  }

  async deleteSRSRecord(_id: string | number): Promise<boolean> {
    return true;
  }
}
