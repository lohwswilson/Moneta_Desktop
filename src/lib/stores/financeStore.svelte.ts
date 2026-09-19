import type {
  MonetaAccount,
  MonetaTransaction,
  DashboardMetrics,
  ReconcileState,
  ConnectionConfig,
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
} from '../types/moneta';
import type { IMonetaRepository } from '../data/repository';
import { OdooAdapter } from '../data/odooAdapter';
import { MockAdapter } from '../data/mockAdapter';
import { SqliteAdapter } from '../data/sqliteAdapter';
import { configureApiClient } from '../api/client';

/**
 * Normalises a saved config, migrating the pre-local-first shape.
 *
 * The old field was `mode: 'odoo' | 'sqlite' | 'mock'`, which conflated two
 * orthogonal things — which local store to use, and whether to talk to Odoo.
 * `'odoo'` meant *live queries against the server*, incompatible with the
 * local-first model, so it maps to the real local store with the cloud
 * credentials retained. Both `'odoo'` and `'sqlite'` used the local database
 * as the real store; only the query routing differed, and that is what changed.
 *
 * The storage key is still `moneta_desktop_config` **deliberately** — see
 * AGENTS.md. Renaming it would orphan every existing install's settings.
 */
function migrateSavedConfig(parsed: any): ConnectionConfig {
  const serverUrl = typeof parsed?.serverUrl === 'string' ? parsed.serverUrl : '';
  const apiToken = typeof parsed?.apiToken === 'string' ? parsed.apiToken : '';

  // Already migrated.
  if (parsed?.dataSource === 'local' || parsed?.dataSource === 'sandbox') {
    return { dataSource: parsed.dataSource, serverUrl, apiToken };
  }

  // Pre-local-first: 'mock' was the sandbox, everything else was the real store.
  return {
    dataSource: parsed?.mode === 'mock' ? 'sandbox' : 'local',
    serverUrl,
    apiToken,
  };
}

class FinanceStore {
  // Svelte 5 Runes state
  config = $state<ConnectionConfig>({
    dataSource: 'local',
    serverUrl: '',
    apiToken: '',
  });

  /**
   * True when Moneta Cloud credentials are present *and* we are on the real
   * local store. Sandbox never syncs.
   *
   * Everything cloud-related is gated on this, and every cloud operation is
   * best-effort: the app is local-first, so a missing or unreachable server
   * must never prevent local data from loading.
   */
  get cloudConfigured(): boolean {
    return (
      this.config.dataSource === 'local' &&
      !!this.config.serverUrl &&
      !!this.config.apiToken
    );
  }

  connectedUser = $state<string | null>(null);
  isConnected = $state<boolean>(false);
  isConnecting = $state<boolean>(false);
  connectionError = $state<string | null>(null);

  metrics = $state<DashboardMetrics | null>(null);
  accounts = $state<MonetaAccount[]>([]);
  selectedAccountId = $state<string | number | null>(null);
  activeView = $state<'command_center' | 'register' | 'budgets' | 'bills' | 'cashflow' | 'payees' | 'goals' | 'portfolio' | 'property' | 'loans' | 'landlord'>('command_center');
  transactions = $state<MonetaTransaction[]>([]);
  budgets = $state<EnvelopeBudget[]>([]);
  bills = $state<RecurringBill[]>([]);
  detectedSubscriptions = $state<DetectedSubscription[]>([]);
  cashflowForecast = $state<CashflowForecast | null>(null);
  cashflowHorizon = $state<30 | 90 | 180 | 365>(90);
  payees = $state<PayeeIntelligence[]>([]);
  goals = $state<FinancialGoal[]>([]);
  holdings = $state<PortfolioHolding[]>([]);
  taxLots = $state<TaxLot[]>([]);
  taxLotDisposals = $state<TaxLotDisposal[]>([]);
  portfolioSummary = $state<PortfolioSummary | null>(null);
  selectedPortfolioAccountId = $state<string | number | null>(null);
  isTradeModalOpen = $state<boolean>(false);
  tradingHolding = $state<PortfolioHolding | null>(null);

  // Phase 5: property, rental & loan scenarios
  properties = $state<PropertyAsset[]>([]);
  tenants = $state<PropertyTenant[]>([]);
  rentPayments = $state<RentPayment[]>([]);
  loanScenarios = $state<LoanScenario[]>([]);
  selectedLoanId = $state<string | number | null>(null);
  settings = $state<OdooSettingsPayload | null>(null);
  filterState = $state<'all' | 'unreconciled' | 'cleared' | 'reconciled'>('all');
  isLoading = $state<boolean>(false);
  isSidebarCollapsed = $state<boolean>(false);

  isQuickAddOpen = $state<boolean>(false);
  editingTransaction = $state<MonetaTransaction | null>(null);
  isSettingsOpen = $state<boolean>(false);
  isImportModalOpen = $state<boolean>(false);
  isBudgetModalOpen = $state<boolean>(false);
  editingBudget = $state<EnvelopeBudget | null>(null);
  isCanISpendOpen = $state<boolean>(false);
  isBillModalOpen = $state<boolean>(false);
  editingBill = $state<RecurringBill | null>(null);
  isGoalModalOpen = $state<boolean>(false);
  editingGoal = $state<FinancialGoal | null>(null);
  isFundGoalOpen = $state<boolean>(false);
  fundingGoal = $state<FinancialGoal | null>(null);
  isPropertyModalOpen = $state<boolean>(false);
  editingProperty = $state<PropertyAsset | null>(null);
  isValuationModalOpen = $state<boolean>(false);
  valuingProperty = $state<PropertyAsset | null>(null);
  isTenantModalOpen = $state<boolean>(false);
  editingTenant = $state<PropertyTenant | null>(null);
  isLoanModalOpen = $state<boolean>(false);
  editingLoan = $state<LoanScenario | null>(null);
  isVerifyBalanceModalOpen = $state<boolean>(false);
  isAddAccountOpen = $state<boolean>(false);
  editingAccount = $state<MonetaAccount | null>(null);

  public sqliteAdapter: SqliteAdapter = new SqliteAdapter();
  private repository: IMonetaRepository = new MockAdapter();

  constructor() {
    this.loadPersistedConfig();
  }

  loadPersistedConfig() {
    if (typeof window !== 'undefined' && window.localStorage) {
      const savedConfig = localStorage.getItem('moneta_desktop_config');
      if (savedConfig) {
        try {
          this.config = migrateSavedConfig(JSON.parse(savedConfig));
        } catch {
          // ignore corrupted local storage
        }
      }
    }
    this.updateAdapter();
  }

  saveConfig(newConfig: ConnectionConfig) {
    this.config = { ...newConfig };
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem('moneta_desktop_config', JSON.stringify(this.config));
    }
    this.updateAdapter();
    this.refreshAll();
  }

  /**
   * Points `repository` at the chosen **local** store and, when cloud
   * credentials are present, configures the API client for sync.
   *
   * Odoo is never the repository. It is a replication target: reached through
   * an explicit `OdooAdapter` for settings sync and migration, never as the
   * source of ordinary reads and writes.
   */
  updateAdapter() {
    this.repository =
      this.config.dataSource === 'sandbox' ? new MockAdapter() : this.sqliteAdapter;

    if (this.cloudConfigured) {
      configureApiClient(this.config.serverUrl, this.config.apiToken);
    }
  }

  /**
   * Probes Moneta Cloud when configured.
   *
   * In local-first the repository is always the local store, which needs no
   * connection — probing it would always report success and tell the user
   * nothing. What is worth reporting is whether the *cloud* is reachable, and
   * that is informational only: a failure never blocks local data.
   */
  async testCurrentConnection(): Promise<{ success: boolean; message: string; user?: string }> {
    this.isConnecting = true;
    this.connectionError = null;
    try {
      if (!this.cloudConfigured) {
        // Sandbox, or local-only. Neither has a server to reach.
        const res = await this.repository.testConnection();
        this.isConnected = res.success;
        this.connectedUser = null;
        return res;
      }

      const res = await new OdooAdapter().testConnection();
      this.isConnected = res.success;
      if (res.success) {
        this.connectedUser = res.user || 'Authorized User';
      } else {
        this.connectionError = res.message;
      }
      return res;
    } catch (err: any) {
      this.isConnected = false;
      const errMsg = err?.message || 'Connection failed';
      this.connectionError = errMsg;
      return { success: false, message: errMsg };
    } finally {
      this.isConnecting = false;
    }
  }

  async refreshAll() {
    this.isLoading = true;
    try {
      // ---------------------------------------------------------------------
      // Local-first: the app loads from the local store, always.
      //
      // Cloud work happens first but is strictly best-effort — it must never
      // prevent local data from loading. The previous implementation returned
      // early when the server was unreachable, which meant an offline launch
      // showed an empty app even though the data was on disk.
      // ---------------------------------------------------------------------
      if (this.cloudConfigured) {
        await this.testCurrentConnection();

        // Settings are pulled every launch if cloud is connected: base currency, FX rates and rules
        // are canonical on the server and cheap to refresh.
        await this.syncOdooSettingsToSqlite();
      } else {
        await this.testCurrentConnection();
      }

      await this.loadSettings();

      const [metrics, accounts] = await Promise.all([
        this.repository.getDashboardSummary(),
        this.repository.getAccounts(),
      ]);

      this.metrics = metrics;
      this.accounts = accounts;

      await this.loadBudgets();
      await this.loadBills();
      await this.loadCashflow();
      await this.loadPayees();
      await this.loadGoals();
      await this.loadProperties();
      await this.loadTenants();
      await this.loadRentPayments();
      await this.loadLoanScenarios();
      await this.loadPortfolio();

      if (!this.selectedAccountId && accounts.length > 0) {
        this.selectedAccountId = accounts[0].id;
      }

      if (this.selectedAccountId) {
        await this.loadRegister(this.selectedAccountId);
      }
    } catch (err: any) {
      console.error('Error refreshing finance data:', err);
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Always sync settings from Odoo DB into SQLite DB
   */
  async syncOdooSettingsToSqlite() {
    try {
      if (this.config.serverUrl && this.config.apiToken) {
        configureApiClient(this.config.serverUrl, this.config.apiToken);
        const odoo = new OdooAdapter();
        const settings = await odoo.getSettings();
        if (settings) {
          await this.sqliteAdapter.syncSettingsFromOdoo(settings);
          this.settings = settings;
        }
      }
    } catch (err) {
      console.warn('Could not sync settings from Odoo DB to SQLite DB:', err);
    }
  }

  async loadSettings() {
    try {
      if (this.repository.getSettings) {
        this.settings = await this.repository.getSettings();
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    }
  }

  async selectAccount(accountId: string | number) {
    this.selectedAccountId = accountId;
    this.activeView = 'register';
    await this.loadRegister(accountId);
  }

  openAddAccountModal() {
    this.editingAccount = null;
    this.isAddAccountOpen = true;
  }

  openEditAccountModal(account: MonetaAccount) {
    this.editingAccount = { ...account };
    this.isAddAccountOpen = true;
  }

  async saveAccount(payload: Partial<MonetaAccount>) {
    this.isLoading = true;
    try {
      let saved: MonetaAccount;
      if (payload.id && this.repository.updateAccount) {
        saved = await this.repository.updateAccount(payload.id, payload);
      } else if (this.repository.createAccount) {
        saved = await this.repository.createAccount(payload);
      } else {
        throw new Error('Account operations not supported by current adapter');
      }
      this.accounts = await this.repository.getAccounts();
      this.metrics = await this.repository.getDashboardSummary();
      this.isAddAccountOpen = false;
      this.editingAccount = null;
      if (!payload.id) {
        await this.selectAccount(saved.id);
      } else if (this.selectedAccountId === payload.id) {
        await this.loadRegister(payload.id);
      }
      return saved;
    } catch (err) {
      console.error('Failed to save account:', err);
      throw err;
    } finally {
      this.isLoading = false;
    }
  }

  async deleteAccount(id: string | number) {
    this.isLoading = true;
    try {
      if (this.repository.deleteAccount) {
        await this.repository.deleteAccount(id);
      }
      this.accounts = await this.repository.getAccounts();
      this.metrics = await this.repository.getDashboardSummary();
      if (this.selectedAccountId === id) {
        if (this.accounts.length > 0) {
          await this.selectAccount(this.accounts[0].id);
        } else {
          this.navigateToOverview();
        }
      }
    } catch (err) {
      console.error('Failed to delete account:', err);
      throw err;
    } finally {
      this.isLoading = false;
    }
  }

  navigateToOverview() {
    this.selectedAccountId = null;
    this.activeView = 'command_center';
  }

  async navigateToBudgets() {
    this.selectedAccountId = null;
    this.activeView = 'budgets';
    await this.loadBudgets();
  }

  async loadBudgets() {
    try {
      if (this.repository.getBudgets) {
        this.budgets = await this.repository.getBudgets();
      } else {
        this.budgets = [];
      }
    } catch (err) {
      console.error('Failed to load budgets:', err);
    }
  }

  async saveBudget(payload: Partial<EnvelopeBudget>) {
    this.isLoading = true;
    try {
      if (payload.id && this.repository.updateBudget) {
        await this.repository.updateBudget(payload.id, payload);
      } else if (this.repository.createBudget) {
        await this.repository.createBudget(payload);
      }
      await this.loadBudgets();
      this.isBudgetModalOpen = false;
      this.editingBudget = null;
    } catch (err) {
      console.error('Failed to save budget:', err);
      throw err;
    } finally {
      this.isLoading = false;
    }
  }

  async deleteBudget(id: string | number) {
    this.isLoading = true;
    try {
      if (this.repository.deleteBudget) {
        await this.repository.deleteBudget(id);
      }
      await this.loadBudgets();
    } catch (err) {
      console.error('Failed to delete budget:', err);
    } finally {
      this.isLoading = false;
    }
  }

  async navigateToBills() {
    this.selectedAccountId = null;
    this.activeView = 'bills';
    await this.loadBills();
  }

  async loadBills(days: number = 30) {
    try {
      if (this.repository.getRecurringBills) {
        this.bills = await this.repository.getRecurringBills(days);
      } else {
        this.bills = [];
      }
    } catch (err) {
      console.error('Failed to load recurring bills:', err);
    }
  }

  async saveBill(payload: Partial<RecurringBill>) {
    this.isLoading = true;
    try {
      if (payload.id && this.repository.updateRecurringBill) {
        await this.repository.updateRecurringBill(payload.id, payload);
      } else if (this.repository.createRecurringBill) {
        await this.repository.createRecurringBill(payload);
      }
      await this.loadBills();
      this.isBillModalOpen = false;
      this.editingBill = null;
    } catch (err) {
      console.error('Failed to save recurring bill:', err);
      throw err;
    } finally {
      this.isLoading = false;
    }
  }

  async deleteBill(id: string | number) {
    this.isLoading = true;
    try {
      if (this.repository.deleteRecurringBill) {
        await this.repository.deleteRecurringBill(id);
      }
      await this.loadBills();
    } catch (err) {
      console.error('Failed to delete recurring bill:', err);
    } finally {
      this.isLoading = false;
    }
  }

  async markBillPaid(id: string | number, accountId?: string | number, date?: string): Promise<boolean> {
    this.isLoading = true;
    try {
      if (this.repository.markBillPaid) {
        const res = await this.repository.markBillPaid(id, accountId, date);
        if (res.success) {
          await this.loadBills();
          const [updatedMetrics, accounts] = await Promise.all([
            this.repository.getDashboardSummary(),
            this.repository.getAccounts(),
          ]);
          this.metrics = updatedMetrics;
          this.accounts = accounts;
          if (this.selectedAccountId) {
            await this.loadRegister(this.selectedAccountId);
          }
          return true;
        }
      }
      return false;
    } catch (err) {
      console.error('Failed to mark bill as paid:', err);
      return false;
    } finally {
      this.isLoading = false;
    }
  }

  async detectSubscriptions(): Promise<DetectedSubscription[]> {
    this.isLoading = true;
    try {
      if (this.repository.detectSubscriptions) {
        const detected = await this.repository.detectSubscriptions();
        this.detectedSubscriptions = detected;
        return detected;
      }
      return [];
    } catch (err) {
      console.error('Failed to detect subscriptions:', err);
      return [];
    } finally {
      this.isLoading = false;
    }
  }

  async navigateToCashflow() {
    this.selectedAccountId = null;
    this.activeView = 'cashflow';
    await this.loadCashflow(this.cashflowHorizon);
  }

  async loadCashflow(days?: number, accountId?: string | number) {
    const horizon = days || this.cashflowHorizon;
    this.cashflowHorizon = horizon as any;
    try {
      if (this.repository.getCashflowForecast) {
        this.cashflowForecast = await this.repository.getCashflowForecast(horizon, accountId);
      }
    } catch (err) {
      console.error('Failed to load cashflow forecast:', err);
    }
  }

  async navigateToPayees() {
    this.selectedAccountId = null;
    this.activeView = 'payees';
    await this.loadPayees();
  }

  async loadPayees() {
    try {
      if (this.repository.getPayees) {
        this.payees = await this.repository.getPayees();
      } else {
        this.payees = [];
      }
    } catch (err) {
      console.error('Failed to load payees:', err);
    }
  }

  async updatePayee(id: string | number, payload: Partial<PayeeIntelligence>): Promise<boolean> {
    this.isLoading = true;
    try {
      let success = false;
      if (this.repository.updatePayee) {
        success = await this.repository.updatePayee(id, payload);
      }
      if (success) {
        await this.loadPayees();
      }
      return success;
    } catch (err) {
      console.error('Failed to update payee:', err);
      return false;
    } finally {
      this.isLoading = false;
    }
  }

  async navigateToGoals() {
    this.selectedAccountId = null;
    this.activeView = 'goals';
    await this.loadGoals();
  }

  async loadGoals() {
    try {
      if (this.repository.getGoals) {
        this.goals = await this.repository.getGoals();
      } else {
        this.goals = [];
      }
    } catch (err) {
      console.error('Failed to load goals:', err);
    }
  }

  async saveGoal(payload: Partial<FinancialGoal>): Promise<boolean> {
    this.isLoading = true;
    try {
      const editing = this.editingGoal;
      if (editing) {
        if (this.repository.updateGoal) {
          await this.repository.updateGoal(editing.id, payload);
        }
      } else if (this.repository.createGoal) {
        await this.repository.createGoal(payload);
      }
      await this.loadGoals();
      return true;
    } catch (err) {
      console.error('Failed to save goal:', err);
      return false;
    } finally {
      this.isLoading = false;
    }
  }

  async fundGoal(id: string | number, amount: number, actionType: 'deposit' | 'withdraw'): Promise<boolean> {
    this.isLoading = true;
    try {
      if (this.repository.fundGoal) {
        await this.repository.fundGoal(id, amount, actionType);
      }
      await this.loadGoals();
      return true;
    } catch (err) {
      console.error('Failed to fund goal:', err);
      return false;
    } finally {
      this.isLoading = false;
    }
  }

  async deleteGoal(id: string | number): Promise<boolean> {
    this.isLoading = true;
    try {
      let success = false;
      if (this.repository.deleteGoal) {
        success = await this.repository.deleteGoal(id);
      }
      if (success) {
        await this.loadGoals();
      }
      return success;
    } catch (err) {
      console.error('Failed to delete goal:', err);
      return false;
    } finally {
      this.isLoading = false;
    }
  }

  async navigateToPortfolio() {
    this.selectedAccountId = null;
    this.activeView = 'portfolio';
    await this.loadPortfolio();
  }

  async loadPortfolio(accountId?: string | number) {
    try {
      if (this.repository.getPortfolioHoldings) {
        const targetAcc = accountId !== undefined ? accountId : (this.selectedPortfolioAccountId || undefined);
        const [holdings, lots, disposals, summary] = await Promise.all([
          this.repository.getPortfolioHoldings(targetAcc),
          this.repository.getTaxLots ? this.repository.getTaxLots(undefined, targetAcc) : Promise.resolve([]),
          this.repository.getTaxLotDisposals ? this.repository.getTaxLotDisposals() : Promise.resolve([]),
          this.repository.getPortfolioSummary ? this.repository.getPortfolioSummary(targetAcc) : Promise.resolve(null),
        ]);
        this.holdings = holdings;
        this.taxLots = lots;
        this.taxLotDisposals = disposals;
        this.portfolioSummary = summary;
      } else {
        this.holdings = [];
        this.taxLots = [];
        this.taxLotDisposals = [];
        this.portfolioSummary = null;
      }
    } catch (err) {
      console.error('Failed to load portfolio:', err);
    }
  }

  openTradeModal(holding?: PortfolioHolding) {
    this.tradingHolding = holding || null;
    this.isTradeModalOpen = true;
  }

  closeTradeModal() {
    this.isTradeModalOpen = false;
    this.tradingHolding = null;
  }

  async executeTrade(tradePayload: {
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
  }): Promise<{ success: boolean; message?: string }> {
    this.isLoading = true;
    try {
      if (!this.repository.executeInvestmentTrade) {
        throw new Error('Trade execution not supported by current repository adapter');
      }
      const res = await this.repository.executeInvestmentTrade(tradePayload);
      if (res.success) {
        await this.loadPortfolio(tradePayload.accountId);
        const [updatedMetrics, accounts] = await Promise.all([
          this.repository.getDashboardSummary(),
          this.repository.getAccounts(),
        ]);
        this.metrics = updatedMetrics;
        this.accounts = accounts;
        this.closeTradeModal();
        return { success: true };
      } else {
        return { success: false, message: 'Trade execution failed' };
      }
    } catch (err: any) {
      console.error('Failed to execute trade:', err);
      return { success: false, message: err?.message || 'Trade execution failed' };
    } finally {
      this.isLoading = false;
    }
  }

  // -------------------------------------------------------------------------
  // Phase 5: Property, Rental & Loan Scenarios
  // -------------------------------------------------------------------------

  async navigateToProperties() {
    this.selectedAccountId = null;
    this.activeView = 'property';
    await this.loadProperties();
  }

  async loadProperties() {
    try {
      this.properties = this.repository.getProperties ? await this.repository.getProperties() : [];
    } catch (err) {
      console.error('Failed to load properties:', err);
    }
  }

  async saveProperty(payload: Partial<PropertyAsset>): Promise<boolean> {
    this.isLoading = true;
    try {
      const editing = this.editingProperty;
      if (editing) {
        if (this.repository.updateProperty) await this.repository.updateProperty(editing.id, payload);
      } else if (this.repository.createProperty) {
        await this.repository.createProperty(payload);
      }
      await this.loadProperties();
      return true;
    } catch (err) {
      console.error('Failed to save property:', err);
      return false;
    } finally {
      this.isLoading = false;
    }
  }

  async deleteProperty(id: string | number): Promise<boolean> {
    this.isLoading = true;
    try {
      const ok = this.repository.deleteProperty ? await this.repository.deleteProperty(id) : false;
      if (ok) await this.loadProperties();
      return ok;
    } catch (err) {
      console.error('Failed to delete property:', err);
      return false;
    } finally {
      this.isLoading = false;
    }
  }

  async addPropertyValuation(
    id: string | number,
    payload: { valuation_date: string; appraised_value: number; appraiser?: string; notes?: string }
  ): Promise<boolean> {
    this.isLoading = true;
    try {
      if (this.repository.addPropertyValuation) {
        await this.repository.addPropertyValuation(id, payload);
      }
      // A new appraisal changes the property's market value, which changes
      // equity, LTV and yield — so reload rather than patching one row.
      await this.loadProperties();
      return true;
    } catch (err) {
      console.error('Failed to add valuation:', err);
      return false;
    } finally {
      this.isLoading = false;
    }
  }

  async navigateToLandlord() {
    this.selectedAccountId = null;
    this.activeView = 'landlord';
    await Promise.all([this.loadTenants(), this.loadRentPayments()]);
  }

  async loadTenants() {
    try {
      this.tenants = this.repository.getTenants ? await this.repository.getTenants() : [];
    } catch (err) {
      console.error('Failed to load tenants:', err);
    }
  }

  async loadRentPayments(tenantId?: string | number) {
    try {
      this.rentPayments = this.repository.getRentPayments
        ? await this.repository.getRentPayments(tenantId)
        : [];
    } catch (err) {
      console.error('Failed to load rent payments:', err);
    }
  }

  async saveTenant(payload: Partial<PropertyTenant>): Promise<boolean> {
    this.isLoading = true;
    try {
      const editing = this.editingTenant;
      if (editing) {
        if (this.repository.updateTenant) await this.repository.updateTenant(editing.id, payload);
      } else if (this.repository.createTenant) {
        await this.repository.createTenant(payload);
      }
      await this.loadTenants();
      return true;
    } catch (err) {
      console.error('Failed to save tenant:', err);
      return false;
    } finally {
      this.isLoading = false;
    }
  }

  async deleteTenant(id: string | number): Promise<boolean> {
    this.isLoading = true;
    try {
      const ok = this.repository.deleteTenant ? await this.repository.deleteTenant(id) : false;
      if (ok) await Promise.all([this.loadTenants(), this.loadRentPayments()]);
      return ok;
    } catch (err) {
      console.error('Failed to delete tenant:', err);
      return false;
    } finally {
      this.isLoading = false;
    }
  }

  /** Returns how many rent payments were generated — zero means the schedule was already complete. */
  async generateRentSchedule(tenantId: string | number): Promise<number> {
    this.isLoading = true;
    try {
      const created = this.repository.generateRentSchedule
        ? await this.repository.generateRentSchedule(tenantId)
        : 0;
      await Promise.all([this.loadTenants(), this.loadRentPayments()]);
      return created;
    } catch (err) {
      console.error('Failed to generate rent schedule:', err);
      return 0;
    } finally {
      this.isLoading = false;
    }
  }

  async markRentPaid(paymentId: string | number): Promise<boolean> {
    this.isLoading = true;
    try {
      if (this.repository.markRentPaid) await this.repository.markRentPaid(paymentId);
      await Promise.all([this.loadTenants(), this.loadRentPayments()]);
      return true;
    } catch (err) {
      console.error('Failed to mark rent paid:', err);
      return false;
    } finally {
      this.isLoading = false;
    }
  }

  async navigateToLoans() {
    this.selectedAccountId = null;
    this.activeView = 'loans';
    await this.loadLoanScenarios();
  }

  async loadLoanScenarios() {
    try {
      this.loanScenarios = this.repository.getLoanScenarios
        ? await this.repository.getLoanScenarios()
        : [];
      if (!this.selectedLoanId && this.loanScenarios.length > 0) {
        this.selectedLoanId = this.loanScenarios[0].id;
      }
    } catch (err) {
      console.error('Failed to load loan scenarios:', err);
    }
  }

  async saveLoanScenario(payload: Partial<LoanScenario>): Promise<boolean> {
    this.isLoading = true;
    try {
      const editing = this.editingLoan;
      if (editing) {
        if (this.repository.updateLoanScenario) await this.repository.updateLoanScenario(editing.id, payload);
      } else if (this.repository.createLoanScenario) {
        const created = await this.repository.createLoanScenario(payload);
        if (created?.id) this.selectedLoanId = created.id;
      }
      await this.loadLoanScenarios();
      return true;
    } catch (err) {
      console.error('Failed to save loan scenario:', err);
      return false;
    } finally {
      this.isLoading = false;
    }
  }

  async deleteLoanScenario(id: string | number): Promise<boolean> {
    this.isLoading = true;
    try {
      const ok = this.repository.deleteLoanScenario ? await this.repository.deleteLoanScenario(id) : false;
      if (ok) {
        if (String(this.selectedLoanId) === String(id)) this.selectedLoanId = null;
        await this.loadLoanScenarios();
      }
      return ok;
    } catch (err) {
      console.error('Failed to delete loan scenario:', err);
      return false;
    } finally {
      this.isLoading = false;
    }
  }

  /** Returns how many rate-change segments were inferred. */
  async inferLoanRateChanges(id: string | number): Promise<number> {
    this.isLoading = true;
    try {
      const segments = this.repository.inferLoanRateChanges
        ? await this.repository.inferLoanRateChanges(id)
        : [];
      await this.loadLoanScenarios();
      return segments.length;
    } catch (err) {
      console.error('Failed to infer rate changes:', err);
      return 0;
    } finally {
      this.isLoading = false;
    }
  }

  async loadAccounts() {
    try {
      this.accounts = await this.repository.getAccounts();
    } catch (err) {
      console.error('Failed to load accounts:', err);
    }
  }

  async loadRegister(accountId: string | number) {
    this.isLoading = true;
    try {
      const txs = await this.repository.getAccountTransactions(accountId, 100);
      this.transactions = txs;
    } catch (err) {
      console.error('Failed to load register:', err);
    } finally {
      this.isLoading = false;
    }
  }

  async toggleClr(transactionId: string | number) {
    const tx = this.transactions.find((t) => String(t.id) === String(transactionId));
    if (!tx) return;

    // Cycle: unreconciled -> cleared -> reconciled -> unreconciled
    let nextState: ReconcileState = 'cleared';
    if (tx.reconciliation_state === 'unreconciled') nextState = 'cleared';
    else if (tx.reconciliation_state === 'cleared') nextState = 'reconciled';
    else nextState = 'unreconciled';

    // Optimistic UI update
    const previousState = tx.reconciliation_state;
    tx.reconciliation_state = nextState;

    try {
      const res = await this.repository.updateReconciliationState(transactionId, nextState);
      if (!res.success) {
        tx.reconciliation_state = previousState;
      } else if (res.cleared_balance !== undefined && this.selectedAccountId) {
        const acc = this.accounts.find((a) => String(a.id) === String(this.selectedAccountId));
        if (acc) {
          acc.cleared_balance = res.cleared_balance;
        }
      }
    } catch (err) {
      tx.reconciliation_state = previousState;
      console.error('Failed to update reconciliation state:', err);
    }
  }

  openVerifyBalanceModal() {
    this.isVerifyBalanceModalOpen = true;
  }

  closeVerifyBalanceModal() {
    this.isVerifyBalanceModalOpen = false;
  }

  async verifyAndReconcileAccount(confirmedBalance: number, createAdjustment: boolean = false) {
    if (!this.selectedAccountId) return;
    this.isLoading = true;
    try {
      let adjustmentAmount: number | undefined = undefined;
      if (createAdjustment) {
        const acc = this.accounts.find((a) => String(a.id) === String(this.selectedAccountId));
        const currentCleared = acc?.cleared_balance ?? 0;
        adjustmentAmount = Number((confirmedBalance - currentCleared).toFixed(2));
      }

      if (this.repository.verifyAndReconcileAccount) {
        await this.repository.verifyAndReconcileAccount(
          this.selectedAccountId,
          confirmedBalance,
          adjustmentAmount
        );
      } else {
        if (adjustmentAmount && Math.abs(adjustmentAmount) >= 0.01) {
          await this.repository.createTransaction({
            account_id: this.selectedAccountId,
            date: new Date().toISOString().split('T')[0],
            payee_name: 'Reconciliation Balance Adjustment',
            category_name: 'Adjustment',
            memo: 'Automatic balance adjustment to match bank statement',
            amount: Number(adjustmentAmount),
            reconciliation_state: 'reconciled',
          });
        }
        for (const tx of this.transactions) {
          if (tx.reconciliation_state === 'cleared') {
            await this.repository.updateReconciliationState(tx.id, 'reconciled');
          }
        }
      }

      this.closeVerifyBalanceModal();
      await this.loadAccounts();
      const updatedMetrics = await this.repository.getDashboardSummary();
      this.metrics = updatedMetrics;
      if (this.selectedAccountId) {
        await this.loadRegister(this.selectedAccountId);
      }
      await this.loadBudgets();
      await this.loadPayees();
    } catch (err) {
      console.error('Failed to verify and reconcile account:', err);
    } finally {
      this.isLoading = false;
    }
  }

  toggleSidebar() {
    this.isSidebarCollapsed = !this.isSidebarCollapsed;
  }

  openAddTransactionModal(accountId?: string | number | null) {
    if (accountId) {
      this.selectedAccountId = accountId;
    }
    this.editingTransaction = null;
    this.isQuickAddOpen = true;
  }

  openEditTransactionModal(tx: MonetaTransaction) {
    this.editingTransaction = tx;
    this.isQuickAddOpen = true;
  }

  closeTransactionModal() {
    this.isQuickAddOpen = false;
    this.editingTransaction = null;
  }

  async addTransaction(payload: Partial<MonetaTransaction>) {
    if (!this.selectedAccountId) return;
    try {
      const newTx = await this.repository.createTransaction({
        ...payload,
        account_id: this.selectedAccountId,
      });
      this.transactions = [newTx, ...this.transactions];
      this.closeTransactionModal();
      // Refresh accounts, dashboard metrics & budget progress
      await this.loadAccounts();
      const updatedMetrics = await this.repository.getDashboardSummary();
      this.metrics = updatedMetrics;
      await this.loadBudgets();
      await this.loadPayees();
    } catch (err) {
      console.error('Failed to create transaction:', err);
    }
  }

  async updateTransaction(id: string | number, payload: Partial<MonetaTransaction>) {
    try {
      let updatedTx: MonetaTransaction | undefined;
      if (this.repository.updateTransaction) {
        updatedTx = await this.repository.updateTransaction(id, payload);
      } else {
        const idx = this.transactions.findIndex((t) => String(t.id) === String(id));
        if (idx !== -1) {
          this.transactions[idx] = { ...this.transactions[idx], ...payload };
          updatedTx = this.transactions[idx];
        }
      }

      if (updatedTx) {
        const idx = this.transactions.findIndex((t) => String(t.id) === String(id));
        if (idx !== -1) {
          this.transactions[idx] = updatedTx;
        }
      }

      this.closeTransactionModal();

      // Refresh accounts & dashboard metrics & register
      await this.loadAccounts();
      const updatedMetrics = await this.repository.getDashboardSummary();
      this.metrics = updatedMetrics;
      if (this.selectedAccountId) {
        await this.loadRegister(this.selectedAccountId);
      }
      await this.loadBudgets();
      await this.loadPayees();
    } catch (err) {
      console.error('Failed to update transaction:', err);
      throw err;
    }
  }

  async deleteTransaction(id: string | number) {
    try {
      if (this.repository.deleteTransaction) {
        await this.repository.deleteTransaction(id);
      }
      this.transactions = this.transactions.filter((t) => String(t.id) !== String(id));
      this.closeTransactionModal();

      // Refresh accounts & dashboard metrics & register
      await this.loadAccounts();
      const updatedMetrics = await this.repository.getDashboardSummary();
      this.metrics = updatedMetrics;
      if (this.selectedAccountId) {
        await this.loadRegister(this.selectedAccountId);
      }
      await this.loadBudgets();
      await this.loadPayees();
    } catch (err) {
      console.error('Failed to delete transaction:', err);
      throw err;
    }
  }

  async batchImportTransactions(
    accountId: string | number,
    rows: Partial<MonetaTransaction>[]
  ) {
    if (rows.length === 0) return;
    this.isLoading = true;
    try {
      if (this.repository.batchCreateTransactions) {
        const created = await this.repository.batchCreateTransactions(accountId, rows);
        if (String(this.selectedAccountId) === String(accountId)) {
          this.transactions = [...created, ...this.transactions];
        }
      } else {
        for (const row of rows) {
          await this.repository.createTransaction({
            ...row,
            account_id: accountId,
          });
        }
        if (String(this.selectedAccountId) === String(accountId)) {
          await this.loadRegister(accountId);
        }
      }

      const [updatedMetrics, accounts] = await Promise.all([
        this.repository.getDashboardSummary(),
        this.repository.getAccounts(),
      ]);
      this.metrics = updatedMetrics;
      this.accounts = accounts;
      await this.loadBudgets();
      await this.loadPayees();
    } catch (err) {
      console.error('Failed to batch import transactions:', err);
      throw err;
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * 1-Click Migration: Syncs all accounts & transactions from Odoo directly into local SQLite
   */
  async migrateFromOdoo(serverUrl?: string, apiToken?: string): Promise<{ success: boolean; message: string }> {
    try {
      const targetUrl = serverUrl || this.config.serverUrl;
      const targetToken = apiToken || this.config.apiToken;
      configureApiClient(targetUrl, targetToken);

      const odoo = new OdooAdapter();
      const test = await odoo.testConnection();
      if (!test.success) {
        return { success: false, message: `Moneta Cloud connection failed: ${test.message}` };
      }

      const odooAccounts = await odoo.getAccounts();
      if (odooAccounts.length === 0) {
        return { success: false, message: 'No accounts found in Moneta Cloud.' };
      }

      const result = await this.sqliteAdapter.importFromOdooData(
        odooAccounts,
        (accId) => odoo.getAccountTransactions(accId, 500)
      );

      // Persist the credentials and stay on the real local store. Migration
      // no longer switches "mode" — Odoo is not a data source any more, it is
      // where the local database was populated from.
      this.saveConfig({
        dataSource: 'local',
        serverUrl: targetUrl,
        apiToken: targetToken,
      });

      return {
        success: true,
        message: `Successfully migrated ${result.importedAccounts} accounts and ${result.importedTransactions} transactions to local SQLite!`,
      };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Migration failed' };
    }
  }

  /**
   * Export the local SQLite database as a downloadable .sqlite file with timestamp
   */
  downloadSqliteBackup() {
    const blob = this.sqliteAdapter.exportDatabaseFile();
    if (!blob) return;

    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '');
    const filename = `moneta-wealth-backup-${dateStr}-${timeStr}.sqlite`;

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Restore the local SQLite database from an uploaded .sqlite backup file
   */
  async restoreSqliteBackup(file: File): Promise<{
    success: boolean;
    message: string;
    counts?: Record<string, number>;
  }> {
    this.isLoading = true;
    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      const res = await this.sqliteAdapter.restoreDatabaseFromBytes(bytes);
      await this.refreshAll();
      return {
        success: res.success,
        message: res.message || 'Database restored successfully.',
        counts: res.counts,
      };
    } catch (err: any) {
      console.error('Failed to restore database backup:', err);
      return {
        success: false,
        message: err?.message || 'Database restore failed.',
      };
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Reset the local SQLite database to clean empty state
   */
  async resetLocalDatabase(): Promise<{ success: boolean; message: string }> {
    this.isLoading = true;
    try {
      // 1. Reset SQLite
      await this.sqliteAdapter.resetDatabase();

      // 2. Clear all local store collections immediately
      this.accounts = [];
      this.transactions = [];
      this.selectedAccountId = null;
      this.budgets = [];
      this.bills = [];
      this.goals = [];
      this.properties = [];
      this.holdings = [];
      this.taxLots = [];
      this.taxLotDisposals = [];
      this.metrics = null;
      this.activeView = 'command_center';

      // 3. Ensure we are in local store mode
      if (this.config.dataSource !== 'local') {
        this.config.dataSource = 'local';
        this.saveConfig(this.config);
      }

      // 4. Also reset mock repository if active
      if (this.repository.resetDatabase) {
        await this.repository.resetDatabase();
      }

      // 5. Reload clean state
      await this.refreshAll();

      return {
        success: true,
        message: 'Database has been reset. All accounts and records have been cleared.',
      };
    } catch (err: any) {
      console.error('Failed to reset database:', err);
      return {
        success: false,
        message: err?.message || 'Failed to reset database.',
      };
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Inspect current SQLite database size and table metrics
   */
  async getDatabaseStats() {
    return this.sqliteAdapter.getDatabaseInfo();
  }
}

export const financeStore = new FinanceStore();
