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
} from '../types/moneta';
import type { IMonetaRepository } from '../data/repository';
import { OdooAdapter } from '../data/odooAdapter';
import { MockAdapter } from '../data/mockAdapter';
import { SqliteAdapter } from '../data/sqliteAdapter';
import { configureApiClient } from '../api/client';

class FinanceStore {
  // Svelte 5 Runes state
  config = $state<ConnectionConfig>({
    mode: 'mock',
    serverUrl: 'https://weeseng.dev8.ansis.com.sg',
    apiToken: '',
  });

  connectedUser = $state<string | null>(null);
  isConnected = $state<boolean>(false);
  isConnecting = $state<boolean>(false);
  connectionError = $state<string | null>(null);

  metrics = $state<DashboardMetrics | null>(null);
  accounts = $state<MonetaAccount[]>([]);
  selectedAccountId = $state<string | number | null>(null);
  activeView = $state<'command_center' | 'register' | 'budgets' | 'bills'>('command_center');
  transactions = $state<MonetaTransaction[]>([]);
  budgets = $state<EnvelopeBudget[]>([]);
  bills = $state<RecurringBill[]>([]);
  detectedSubscriptions = $state<DetectedSubscription[]>([]);
  settings = $state<OdooSettingsPayload | null>(null);
  filterState = $state<'all' | 'unreconciled' | 'cleared' | 'reconciled'>('all');
  isLoading = $state<boolean>(false);

  isQuickAddOpen = $state<boolean>(false);
  isSettingsOpen = $state<boolean>(false);
  isImportModalOpen = $state<boolean>(false);
  isBudgetModalOpen = $state<boolean>(false);
  editingBudget = $state<EnvelopeBudget | null>(null);
  isCanISpendOpen = $state<boolean>(false);
  isBillModalOpen = $state<boolean>(false);
  editingBill = $state<RecurringBill | null>(null);

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
          const parsed = JSON.parse(savedConfig);
          this.config = {
            mode: parsed.mode || 'mock',
            serverUrl: parsed.serverUrl || 'https://weeseng.dev8.ansis.com.sg',
            apiToken: parsed.apiToken || '',
          };
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

  updateAdapter() {
    if (this.config.mode === 'odoo') {
      configureApiClient(this.config.serverUrl, this.config.apiToken);
      this.repository = new OdooAdapter();
    } else if (this.config.mode === 'sqlite') {
      this.repository = this.sqliteAdapter;
    } else {
      this.repository = new MockAdapter();
    }
  }

  async testCurrentConnection(): Promise<{ success: boolean; message: string; user?: string }> {
    this.isConnecting = true;
    this.connectionError = null;
    try {
      const res = await this.repository.testConnection();
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
      const test = await this.testCurrentConnection();
      if (!test.success && this.config.mode === 'odoo') {
        return;
      }

      // Always refer back to Odoo DB for settings (base currency, FX rates, rules)
      if (this.config.mode === 'odoo' || (this.config.serverUrl && this.config.apiToken)) {
        await this.syncOdooSettingsToSqlite();
      }

      // If in SQLite mode and SQLite database has 0 accounts, auto-populate from Odoo DB
      if (this.config.mode === 'sqlite' && this.config.serverUrl && this.config.apiToken) {
        const localAccounts = await this.sqliteAdapter.getAccounts();
        if (localAccounts.length === 0) {
          await this.migrateFromOdoo(this.config.serverUrl, this.config.apiToken);
        }
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

  async addTransaction(payload: Partial<MonetaTransaction>) {
    if (!this.selectedAccountId) return;
    try {
      const newTx = await this.repository.createTransaction({
        ...payload,
        account_id: this.selectedAccountId,
      });
      this.transactions = [newTx, ...this.transactions];
      this.isQuickAddOpen = false;
      // Refresh dashboard metrics & budget progress
      const updatedMetrics = await this.repository.getDashboardSummary();
      this.metrics = updatedMetrics;
      await this.loadBudgets();
    } catch (err) {
      console.error('Failed to create transaction:', err);
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
        return { success: false, message: `Odoo connection failed: ${test.message}` };
      }

      const odooAccounts = await odoo.getAccounts();
      if (odooAccounts.length === 0) {
        return { success: false, message: 'No accounts found in Odoo.' };
      }

      const result = await this.sqliteAdapter.importFromOdooData(
        odooAccounts,
        (accId) => odoo.getAccountTransactions(accId, 500)
      );

      // Save token & URL into persisted config and switch mode to SQLite
      this.saveConfig({
        mode: 'sqlite',
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
   * Export the local SQLite database as a downloadable .sqlite file
   */
  downloadSqliteBackup() {
    const blob = this.sqliteAdapter.exportDatabaseFile();
    if (!blob) return;

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `moneta-backup-${new Date().toISOString().split('T')[0]}.sqlite`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

export const financeStore = new FinanceStore();
