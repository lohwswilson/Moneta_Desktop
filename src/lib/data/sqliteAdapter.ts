import type { IMonetaRepository } from './repository';
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
  GoalStatus,
  PortfolioHolding,
  TaxLot,
  TaxLotDisposal,
  PortfolioSummary,
  TaxLotStrategy,
} from '../types/moneta';
import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js';
import { DEFAULT_RULES } from './rulesEngine';
import { computeGoalMetrics, toDateOnlyString, todayDateOnly } from './goalMath';
import { computeLotMetrics, disposeTaxLots, computeModifiedDietz, computeXIRR } from './portfolioMath';

const DB_INDEXEDDB_NAME = 'moneta_sqlite_db';
const STORE_NAME = 'sqlite_storage';
const DB_KEY = 'moneta_main_db';

// Native IndexedDB persistence helper
const saveDatabaseBytes = (data: Uint8Array): Promise<void> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_INDEXEDDB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => {
      const idb = request.result;
      const tx = idb.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(data, DB_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    };
    request.onerror = () => reject(request.error);
  });
};

const loadDatabaseBytes = (): Promise<Uint8Array | null> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_INDEXEDDB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => {
      const idb = request.result;
      const tx = idb.transaction(STORE_NAME, 'readonly');
      const getReq = tx.objectStore(STORE_NAME).get(DB_KEY);
      getReq.onsuccess = () => resolve(getReq.result || null);
      getReq.onerror = () => reject(getReq.error);
    };
    request.onerror = () => reject(request.error);
  });
};

export class SqliteAdapter implements IMonetaRepository {
  private SQL: SqlJsStatic | null = null;
  private db: Database | null = null;
  private isInitialized = false;

  async init(): Promise<void> {
    if (this.isInitialized && this.db) return;

    this.SQL = await initSqlJs({
      locateFile: () => '/sql-wasm.wasm',
    });

    const savedBytes = await loadDatabaseBytes();
    if (savedBytes && savedBytes.length > 0) {
      try {
        this.db = new this.SQL.Database(savedBytes);
      } catch (e) {
        console.warn('Failed to parse saved SQLite bytes, initializing fresh:', e);
        this.db = new this.SQL.Database();
      }
    } else {
      this.db = new this.SQL.Database();
    }

    this.runMigrations();
    this.isInitialized = true;
  }

  private runMigrations() {
    if (!this.db) return;

    this.db.run(`
      CREATE TABLE IF NOT EXISTS accounts (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        account_type TEXT NOT NULL,
        institution_name TEXT,
        account_number_mask TEXT,
        currency_code TEXT DEFAULT 'SGD',
        current_balance REAL DEFAULT 0.0,
        cleared_balance REAL DEFAULT 0.0,
        reconciled_balance REAL DEFAULT 0.0,
        interest_rate REAL,
        monthly_payment REAL,
        credit_limit REAL,
        active INTEGER DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL,
        date TEXT NOT NULL,
        payee_name TEXT NOT NULL,
        category_name TEXT,
        amount REAL NOT NULL,
        transaction_type TEXT NOT NULL,
        reconciliation_state TEXT DEFAULT 'unreconciled',
        running_balance REAL,
        memo TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS transaction_splits (
        id TEXT PRIMARY KEY,
        transaction_id TEXT NOT NULL,
        category_name TEXT NOT NULL,
        amount REAL NOT NULL,
        memo TEXT
      );

      CREATE TABLE IF NOT EXISTS categorization_rules (
        id TEXT PRIMARY KEY,
        priority INTEGER DEFAULT 10,
        match_field TEXT NOT NULL,
        match_pattern TEXT NOT NULL,
        category_name TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS budgets (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        category_name TEXT NOT NULL,
        allocated_amount REAL NOT NULL DEFAULT 0.0,
        period TEXT DEFAULT 'monthly',
        category_group TEXT DEFAULT 'need',
        rollover INTEGER DEFAULT 0,
        color_code TEXT DEFAULT '#3b82f6'
      );

      CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS currency_rates (
        currency_code TEXT PRIMARY KEY,
        rate_to_base REAL NOT NULL,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS recurring_bills (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        payee_name TEXT NOT NULL,
        category_name TEXT,
        account_id TEXT,
        account_name TEXT,
        amount REAL NOT NULL,
        frequency TEXT DEFAULT 'monthly',
        next_due_date TEXT NOT NULL,
        auto_pay INTEGER DEFAULT 0,
        active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS payees (
        id TEXT PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        default_category_name TEXT,
        suggested_category_name TEXT,
        detected_cadence TEXT DEFAULT 'none',
        website TEXT,
        notes TEXT,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS goals (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        target_amount REAL NOT NULL DEFAULT 0,
        current_amount REAL NOT NULL DEFAULT 0,
        start_date TEXT NOT NULL,
        target_date TEXT NOT NULL,
        account_id TEXT,
        account_name TEXT,
        icon TEXT DEFAULT '🎯',
        color INTEGER DEFAULT 4,
        notes TEXT,
        status TEXT DEFAULT 'in_progress',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS securities (
        id TEXT PRIMARY KEY,
        symbol TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        security_type TEXT DEFAULT 'stock',
        currency_code TEXT DEFAULT 'USD',
        current_price REAL DEFAULT 0.0,
        last_quote_date TEXT,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS holdings (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL,
        security_id TEXT NOT NULL,
        symbol TEXT NOT NULL,
        quantity REAL DEFAULT 0.0,
        average_cost REAL DEFAULT 0.0,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(account_id, security_id)
      );

      CREATE TABLE IF NOT EXISTS security_lots (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL,
        security_id TEXT NOT NULL,
        symbol TEXT NOT NULL,
        purchase_date TEXT NOT NULL,
        initial_quantity REAL NOT NULL,
        remaining_quantity REAL NOT NULL,
        purchase_price REAL NOT NULL,
        commission_paid REAL DEFAULT 0.0,
        state TEXT DEFAULT 'open',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS lot_disposals (
        id TEXT PRIMARY KEY,
        lot_id TEXT NOT NULL,
        account_id TEXT NOT NULL,
        symbol TEXT NOT NULL,
        disposal_date TEXT NOT NULL,
        quantity_sold REAL NOT NULL,
        cost_basis_sold REAL NOT NULL,
        proceeds REAL NOT NULL,
        realized_gain REAL NOT NULL,
        term_type TEXT NOT NULL,
        disposal_strategy TEXT DEFAULT 'FIFO',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Seed default settings and rates if empty
    this.db.run(`
      INSERT OR IGNORE INTO app_settings (key, value) VALUES ('base_currency', 'SGD');
      INSERT OR IGNORE INTO currency_rates (currency_code, rate_to_base) VALUES
        ('SGD', 1.0),
        ('MYR', 3.18),
        ('USD', 0.7633587786259541),
        ('EUR', 1.0),
        ('GBP', 1.0),
        ('HKD', 1.0),
        ('JPY', 1.0);
    `);

    // Seed default categorization rules if table is empty
    const ruleRes = this.db.exec('SELECT COUNT(*) as count FROM categorization_rules;');
    const ruleCount = ruleRes[0]?.values[0]?.[0] as number;
    if (ruleCount === 0) {
      for (const rule of DEFAULT_RULES) {
        this.db.run(
          `INSERT INTO categorization_rules (id, priority, match_field, match_pattern, category_name)
           VALUES (:id, :priority, :match_field, :match_pattern, :category_name);`,
          {
            ':id': rule.id,
            ':priority': rule.priority,
            ':match_field': rule.match_field,
            ':match_pattern': rule.match_pattern,
            ':category_name': rule.category_name,
          }
        );
      }
    }

    // Seed default Singapore envelope budgets if table is empty
    const budgetRes = this.db.exec('SELECT COUNT(*) as count FROM budgets;');
    const budgetCount = (budgetRes[0]?.values[0]?.[0] as number) || 0;
    if (budgetCount === 0) {
      const defaultBudgets = [
        { id: 'bgt-1', name: 'Groceries & Provisions', category_name: 'Groceries', allocated_amount: 650.0, period: 'monthly', category_group: 'need', color_code: '#10b981' },
        { id: 'bgt-2', name: 'Dining & Hawker Food', category_name: 'Dining', allocated_amount: 450.0, period: 'monthly', category_group: 'want', color_code: '#f59e0b' },
        { id: 'bgt-3', name: 'Utilities & Telco', category_name: 'Utilities', allocated_amount: 250.0, period: 'monthly', category_group: 'need', color_code: '#3b82f6' },
        { id: 'bgt-4', name: 'Public Transport & Taxi', category_name: 'Transportation', allocated_amount: 200.0, period: 'monthly', category_group: 'need', color_code: '#6366f1' },
        { id: 'bgt-5', name: 'Shopping & Retail', category_name: 'Shopping', allocated_amount: 300.0, period: 'monthly', category_group: 'want', color_code: '#ec4899' },
        { id: 'bgt-6', name: 'Entertainment & Outings', category_name: 'Entertainment', allocated_amount: 180.0, period: 'monthly', category_group: 'want', color_code: '#8b5cf6' },
      ];
      for (const b of defaultBudgets) {
        this.db.run(
          `INSERT INTO budgets (id, name, category_name, allocated_amount, period, category_group, rollover, color_code)
           VALUES (:id, :name, :category_name, :allocated_amount, :period, :category_group, 0, :color_code);`,
          {
            ':id': b.id,
            ':name': b.name,
            ':category_name': b.category_name,
            ':allocated_amount': b.allocated_amount,
            ':period': b.period,
            ':category_group': b.category_group,
            ':color_code': b.color_code,
          }
        );
      }
    }

    // Seed default Singapore recurring bills if table is empty
    const billRes = this.db.exec('SELECT COUNT(*) as count FROM recurring_bills;');
    const billCount = (billRes[0]?.values[0]?.[0] as number) || 0;
    if (billCount === 0) {
      const defaultBills = [
        { id: 'sq-bill-1', name: 'SP Group Utilities', payee: 'SP Services', cat: 'Utilities', amt: 145.20, freq: 'monthly', days: 2, auto: 1 },
        { id: 'sq-bill-2', name: 'Singtel Fiber Broadband', payee: 'Singtel', cat: 'Utilities', amt: 79.90, freq: 'monthly', days: 5, auto: 1 },
        { id: 'sq-bill-3', name: 'Netflix 4K Premium', payee: 'Netflix', cat: 'Entertainment', amt: 25.98, freq: 'monthly', days: 11, auto: 1 },
        { id: 'sq-bill-4', name: 'Fitness First Gym Membership', payee: 'Fitness First', cat: 'Fitness & Health', amt: 175.00, freq: 'monthly', days: 18, auto: 0 },
      ];
      for (const b of defaultBills) {
        const dueDate = new Date(Date.now() + b.days * 86400000).toISOString().split('T')[0];
        this.db.run(`
          INSERT INTO recurring_bills (id, name, payee_name, category_name, amount, frequency, next_due_date, auto_pay, active)
          VALUES (:id, :name, :payee, :cat, :amt, :freq, :next, :auto, 1);
        `, {
          ':id': b.id,
          ':name': b.name,
          ':payee': b.payee,
          ':cat': b.cat,
          ':amt': b.amt,
          ':freq': b.freq,
          ':next': dueDate,
          ':auto': b.auto,
        });
      }
    }

    // Always purge any leftover placeholder demo accounts (Brokerage Equity Portfolio, etc.)
    this.db.run(`
      DELETE FROM transaction_splits WHERE transaction_id IN (SELECT id FROM transactions WHERE account_id LIKE 'sq-acc-%');
      DELETE FROM transactions WHERE account_id LIKE 'sq-acc-%' OR id LIKE 'sq-tx-%';
      DELETE FROM accounts WHERE id LIKE 'sq-acc-%';
    `);

    // Seed default securities and investment tax-lots if table is empty
    const secRes = this.db.exec('SELECT COUNT(*) as count FROM securities;');
    const secCount = (secRes[0]?.values[0]?.[0] as number) || 0;
    if (secCount === 0) {
      const accRes = this.db.exec("SELECT id FROM accounts WHERE account_type IN ('brokerage', 'retirement', 'crypto') LIMIT 1;");
      const brokerAccId = (accRes[0]?.values[0]?.[0] as string) || 'acc-3';

      this.db.run(`
        INSERT OR IGNORE INTO securities (id, symbol, name, security_type, currency_code, current_price, last_quote_date)
        VALUES
          ('sec-nvda', 'NVDA', 'NVIDIA Corporation', 'stock', 'USD', 180.00, '2026-09-18'),
          ('sec-msft', 'MSFT', 'Microsoft Corporation', 'stock', 'USD', 450.00, '2026-09-18'),
          ('sec-avgo', 'AVGO', 'Broadcom Inc.', 'stock', 'USD', 170.00, '2026-09-18'),
          ('sec-d05', 'D05.SI', 'DBS Group Holdings Ltd', 'stock', 'SGD', 38.50, '2026-09-18'),
          ('sec-z74', 'Z74.SI', 'Singtel Ltd', 'stock', 'SGD', 3.20, '2026-09-18');

        INSERT OR IGNORE INTO security_lots (id, account_id, security_id, symbol, purchase_date, initial_quantity, remaining_quantity, purchase_price, commission_paid, state)
        VALUES
          ('lot-nvda-1', :acc, 'sec-nvda', 'NVDA', '2025-01-15', 50.0, 50.0, 161.83, 1.00, 'open'),
          ('lot-msft-1', :acc, 'sec-msft', 'MSFT', '2025-06-10', 10.0, 10.0, 426.41, 1.00, 'open');

        INSERT OR IGNORE INTO holdings (id, account_id, security_id, symbol, quantity, average_cost)
        VALUES
          ('hld-nvda', :acc, 'sec-nvda', 'NVDA', 50.0, 161.83),
          ('hld-msft', :acc, 'sec-msft', 'MSFT', 10.0, 426.41);
      `, { ':acc': brokerAccId });
    }

    this.persist();
  }

  private async persist() {
    if (!this.db) return;
    try {
      const data = this.db.export();
      await saveDatabaseBytes(data);
    } catch (err) {
      console.error('Failed to persist SQLite database to IndexedDB:', err);
    }
  }

  async testConnection(): Promise<{ success: boolean; message: string; user?: string }> {
    await this.init();
    return {
      success: true,
      message: 'Local SQLite Database Connected (IndexedDB Persisted)',
      user: 'Local SQLite User',
    };
  }

  /**
   * Currency conversion helper referring dynamically to Odoo exchange rates stored in SQLite
   */
  private convertToBaseCurrency(amount: number, currencyCode: string = 'SGD'): number {
    if (!this.db) return amount;
    const curr = (currencyCode || 'SGD').toUpperCase();

    // 1. Get base currency from app_settings
    let baseCurrency = 'SGD';
    try {
      const baseRes = this.db.exec("SELECT value FROM app_settings WHERE key = 'base_currency';");
      if (baseRes?.[0]?.values?.[0]?.[0]) {
        baseCurrency = String(baseRes[0].values[0][0]).toUpperCase();
      }
    } catch {
      // fallback
    }

    if (curr === baseCurrency) return amount;

    // 2. Query currency_rates synced from Odoo
    try {
      const rateRes = this.db.exec("SELECT rate_to_base FROM currency_rates WHERE currency_code = :curr;", {
        ':curr': curr,
      });
      const rate = Number(rateRes?.[0]?.values?.[0]?.[0]);
      if (rate && rate > 0) {
        return amount / rate;
      }
    } catch {
      // fallback
    }

    // 3. Fallback parity rates
    const fallbackRates: Record<string, number> = {
      SGD: 1.0,
      MYR: 3.18,
      USD: 0.7633587786259541,
    };
    const fbRate = fallbackRates[curr];
    return fbRate && fbRate > 0 ? amount / fbRate : amount;
  }

  async getDashboardSummary(): Promise<DashboardMetrics> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    const accounts = await this.getAccounts();

    const liquidCash = accounts
      .filter((a) => ['checking', 'chequing', 'savings', 'cash', 'cpf_oa', 'cpf_sa', 'cpf_ma', 'cpf_ra', 'srs', 'epf_akaun_persaraan', 'epf_akaun_sejahtera', 'epf_akaun_fleksibel'].includes(a.account_type))
      .reduce((sum, a) => sum + this.convertToBaseCurrency(a.current_balance, a.currency_code), 0);

    const investments = accounts
      .filter((a) => ['brokerage', 'retirement', 'crypto'].includes(a.account_type))
      .reduce((sum, a) => sum + this.convertToBaseCurrency(a.current_balance, a.currency_code), 0);

    const tangibleAssets = accounts
      .filter((a) => ['asset', 'property', 'other'].includes(a.account_type))
      .reduce((sum, a) => sum + this.convertToBaseCurrency(a.current_balance, a.currency_code), 0);

    const liabilities = accounts
      .filter((a) => ['credit', 'credit_card', 'loc', 'loan', 'mortgage'].includes(a.account_type))
      .reduce((sum, a) => sum + Math.abs(this.convertToBaseCurrency(a.current_balance, a.currency_code)), 0);

    const netWorth = liquidCash + investments + tangibleAssets - liabilities;

    // Calculate monthly income and expenses
    const res = this.db.exec(`
      SELECT 
        COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0) as income,
        COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END), 0) as expenses
      FROM transactions
      WHERE date >= strftime('%Y-%m-01', 'now');
    `);

    const income = (res[0]?.values[0]?.[0] as number) || 0;
    const expenses = (res[0]?.values[0]?.[1] as number) || 0;

    const savingsRate = income > 0 ? Math.max(0, ((income - expenses) / income) * 100) : 0;
    const burnRate = expenses > 0 ? expenses : 3000;
    const runway = burnRate > 0 ? liquidCash / burnRate : 12;
    const fireTarget = burnRate * 12 * 25;
    const fireProgress = fireTarget > 0 ? Math.min(100, (netWorth / fireTarget) * 100) : 0;

    return {
      net_worth: netWorth,
      liquid_cash: liquidCash,
      investments: investments,
      tangible_assets: tangibleAssets,
      total_liabilities: liabilities,
      monthly_income: income,
      monthly_expenses: expenses,
      savings_rate_pct: Number(savingsRate.toFixed(1)),
      fire_target_amount: fireTarget,
      fire_progress_pct: Number(fireProgress.toFixed(1)),
      monthly_burn_rate: burnRate,
      emergency_runway_months: Number(runway.toFixed(1)),
    };
  }

  async getAccounts(): Promise<MonetaAccount[]> {
    await this.init();
    if (!this.db) return [];

    const res = this.db.exec(`
      SELECT id, name, account_type, institution_name, account_number_mask, currency_code,
             current_balance, cleared_balance, reconciled_balance, interest_rate, monthly_payment, credit_limit, active
      FROM accounts
      WHERE active = 1
      ORDER BY name ASC;
    `);

    if (!res[0]) return [];

    const columns = res[0].columns;
    return res[0].values.map((row) => {
      const obj: any = {};
      columns.forEach((col, idx) => {
        obj[col] = row[idx];
      });
      obj.active = Boolean(obj.active);
      return obj as MonetaAccount;
    });
  }

  async getAccountTransactions(
    accountId: string | number,
    limit: number = 200
  ): Promise<MonetaTransaction[]> {
    await this.init();
    if (!this.db) return [];

    const stmt = this.db.prepare(`
      SELECT id, account_id, date, payee_name, category_name, amount, transaction_type,
             reconciliation_state, running_balance, memo, created_at
      FROM transactions
      WHERE account_id = :accId
      ORDER BY date DESC, id DESC
      LIMIT :lim;
    `);

    stmt.bind({ ':accId': String(accountId), ':lim': limit });
    const transactions: MonetaTransaction[] = [];

    while (stmt.step()) {
      const row = stmt.getAsObject();
      transactions.push(row as unknown as MonetaTransaction);
    }
    stmt.free();

    // Attach splits if any exist
    if (transactions.length > 0) {
      const ids = transactions.map((t) => `'${t.id}'`).join(',');
      const splitsRes = this.db.exec(`
        SELECT id, transaction_id, category_name, amount, memo
        FROM transaction_splits
        WHERE transaction_id IN (${ids});
      `);
      if (splitsRes[0]) {
        const cols = splitsRes[0].columns;
        const splitsMap: Record<string, any[]> = {};
        for (const val of splitsRes[0].values) {
          const sObj: any = {};
          cols.forEach((col, idx) => (sObj[col] = val[idx]));
          if (!splitsMap[sObj.transaction_id]) {
            splitsMap[sObj.transaction_id] = [];
          }
          splitsMap[sObj.transaction_id].push({
            id: sObj.id,
            category_name: sObj.category_name,
            amount: sObj.amount,
            memo: sObj.memo,
          });
        }
        for (const t of transactions) {
          if (splitsMap[String(t.id)]) {
            t.splits = splitsMap[String(t.id)];
          }
        }
      }
    }

    return transactions;
  }

  async updateReconciliationState(
    transactionId: string | number,
    state: ReconcileState
  ): Promise<{ success: boolean; cleared_balance?: number }> {
    await this.init();
    if (!this.db) return { success: false };

    this.db.run(
      `UPDATE transactions SET reconciliation_state = :state WHERE id = :id;`,
      { ':state': state, ':id': String(transactionId) }
    );

    // Recompute cleared balance for account
    const accRes = this.db.exec(
      `SELECT account_id FROM transactions WHERE id = '${transactionId}';`
    );
    const accountId = accRes[0]?.values[0]?.[0] as string;

    let clearedBalance = 0;
    if (accountId) {
      const balRes = this.db.exec(
        `SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE account_id = '${accountId}' AND reconciliation_state IN ('cleared', 'reconciled');`
      );
      clearedBalance = (balRes[0]?.values[0]?.[0] as number) || 0;
      this.db.run(
        `UPDATE accounts SET cleared_balance = :bal WHERE id = :accId;`,
        { ':bal': clearedBalance, ':accId': accountId }
      );
    }

    await this.persist();
    return { success: true, cleared_balance: clearedBalance };
  }

  async createTransaction(payload: Partial<MonetaTransaction>): Promise<MonetaTransaction> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    const id = payload.id || `sq-tx-${Date.now()}`;
    const accountId = String(payload.account_id);
    const date = payload.date || new Date().toISOString().split('T')[0];
    const payee = payload.payee_name || 'Expense';
    const category = payload.category_name || (payload.splits && payload.splits.length > 0 ? 'Split' : 'General');
    const amount = Number(payload.amount || 0);
    const txType = amount >= 0 ? 'income' : 'expense';
    const state = payload.reconciliation_state || 'unreconciled';
    const memo = payload.memo || '';

    // Get current balance
    const curBalRes = this.db.exec(`SELECT current_balance FROM accounts WHERE id = '${accountId}';`);
    const oldBalance = (curBalRes[0]?.values[0]?.[0] as number) || 0;
    const newBalance = oldBalance + amount;

    this.db.run(`
      INSERT INTO transactions (id, account_id, date, payee_name, category_name, amount, transaction_type, reconciliation_state, running_balance, memo)
      VALUES (:id, :accId, :date, :payee, :cat, :amt, :type, :state, :bal, :memo);
    `, {
      ':id': id,
      ':accId': accountId,
      ':date': date,
      ':payee': payee,
      ':cat': category,
      ':amt': amount,
      ':type': txType,
      ':state': state,
      ':bal': newBalance,
      ':memo': memo,
    });

    // Insert splits if provided
    if (payload.splits && payload.splits.length > 0) {
      for (const sp of payload.splits) {
        const splitId = sp.id || `sp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        this.db.run(`
          INSERT INTO transaction_splits (id, transaction_id, category_name, amount, memo)
          VALUES (:id, :txId, :cat, :amt, :memo);
        `, {
          ':id': splitId,
          ':txId': id,
          ':cat': sp.category_name,
          ':amt': sp.amount,
          ':memo': sp.memo || '',
        });
      }
    }

    // Update account balance
    this.db.run(`UPDATE accounts SET current_balance = :bal WHERE id = :accId;`, {
      ':bal': newBalance,
      ':accId': accountId,
    });

    await this.persist();

    return {
      id,
      account_id: accountId,
      date,
      payee_name: payee,
      category_name: category,
      amount,
      transaction_type: txType,
      reconciliation_state: state as ReconcileState,
      running_balance: newBalance,
      memo,
      splits: payload.splits,
    };
  }

  async batchCreateTransactions(
    accountId: string | number,
    transactions: Partial<MonetaTransaction>[]
  ): Promise<MonetaTransaction[]> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    const created: MonetaTransaction[] = [];
    const accIdStr = String(accountId);

    const curBalRes = this.db.exec(`SELECT current_balance FROM accounts WHERE id = '${accIdStr}';`);
    let currentBalance = (curBalRes[0]?.values[0]?.[0] as number) || 0;

    for (let i = 0; i < transactions.length; i++) {
      const payload = transactions[i];
      const id = payload.id || `sq-tx-${Date.now()}-${i}`;
      const date = payload.date || new Date().toISOString().split('T')[0];
      const payee = payload.payee_name || 'Transaction';
      const category = payload.category_name || 'General';
      const amount = Number(payload.amount || 0);
      const txType = amount >= 0 ? 'income' : 'expense';
      const state = payload.reconciliation_state || 'unreconciled';
      const memo = payload.memo || '';

      currentBalance += amount;

      this.db.run(`
        INSERT INTO transactions (id, account_id, date, payee_name, category_name, amount, transaction_type, reconciliation_state, running_balance, memo)
        VALUES (:id, :accId, :date, :payee, :cat, :amt, :type, :state, :bal, :memo);
      `, {
        ':id': id,
        ':accId': accIdStr,
        ':date': date,
        ':payee': payee,
        ':cat': category,
        ':amt': amount,
        ':type': txType,
        ':state': state,
        ':bal': currentBalance,
        ':memo': memo,
      });

      if (payload.splits && payload.splits.length > 0) {
        for (const sp of payload.splits) {
          const splitId = sp.id || `sp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
          this.db.run(`
            INSERT INTO transaction_splits (id, transaction_id, category_name, amount, memo)
            VALUES (:id, :txId, :cat, :amt, :memo);
          `, {
            ':id': splitId,
            ':txId': id,
            ':cat': sp.category_name,
            ':amt': sp.amount,
            ':memo': sp.memo || '',
          });
        }
      }

      created.push({
        id,
        account_id: accIdStr,
        date,
        payee_name: payee,
        category_name: category,
        amount,
        transaction_type: txType,
        reconciliation_state: state as ReconcileState,
        running_balance: currentBalance,
        memo,
        splits: payload.splits,
      });
    }

    this.db.run(`UPDATE accounts SET current_balance = :bal WHERE id = :accId;`, {
      ':bal': currentBalance,
      ':accId': accIdStr,
    });

    await this.persist();
    return created;
  }

  /**
   * 1-Click Import / Migration from Odoo into local SQLite
   */
  async importFromOdooData(
    accounts: MonetaAccount[],
    transactionsGetter: (accId: string | number) => Promise<MonetaTransaction[]>
  ): Promise<{ importedAccounts: number; importedTransactions: number }> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    // Remove demo placeholder seed accounts prior to importing clean Odoo data
    this.db.run(`
      DELETE FROM transaction_splits WHERE transaction_id IN (SELECT id FROM transactions WHERE account_id LIKE 'sq-acc-%');
      DELETE FROM transactions WHERE account_id LIKE 'sq-acc-%' OR id LIKE 'sq-tx-%';
      DELETE FROM accounts WHERE id LIKE 'sq-acc-%';
    `);

    let txCount = 0;

    for (const acc of accounts) {
      this.db.run(`
        INSERT OR REPLACE INTO accounts 
          (id, name, account_type, institution_name, account_number_mask, currency_code, current_balance, cleared_balance, interest_rate, monthly_payment, credit_limit, active)
        VALUES 
          (:id, :name, :type, :inst, :mask, :curr, :curBal, :clrBal, :ir, :mp, :limit, :act);
      `, {
        ':id': String(acc.id),
        ':name': acc.name,
        ':type': acc.account_type,
        ':inst': acc.institution_name || '',
        ':mask': acc.account_number_mask || '',
        ':curr': acc.currency_code || 'SGD',
        ':curBal': acc.current_balance || 0,
        ':clrBal': acc.cleared_balance || 0,
        ':ir': acc.interest_rate || null,
        ':mp': acc.monthly_payment || null,
        ':limit': acc.credit_limit || null,
        ':act': acc.active ? 1 : 0,
      });

      const txs = await transactionsGetter(acc.id);
      for (const tx of txs) {
        this.db.run(`
          INSERT OR REPLACE INTO transactions
            (id, account_id, date, payee_name, category_name, amount, transaction_type, reconciliation_state, running_balance, memo)
          VALUES
            (:id, :accId, :date, :payee, :cat, :amt, :type, :state, :bal, :memo);
        `, {
          ':id': String(tx.id),
          ':accId': String(acc.id),
          ':date': tx.date,
          ':payee': tx.payee_name || 'Expense',
          ':cat': tx.category_name || '',
          ':amt': tx.amount,
          ':type': tx.transaction_type || (tx.amount >= 0 ? 'income' : 'expense'),
          ':state': tx.reconciliation_state || 'unreconciled',
          ':bal': tx.running_balance || null,
          ':memo': tx.memo || '',
        });
        txCount++;
      }
    }

    await this.persist();
    return { importedAccounts: accounts.length, importedTransactions: txCount };
  }

  /**
   * Zero-Based Envelope Budget Hub methods
   */
  async getBudgets(): Promise<EnvelopeBudget[]> {
    if (!this.db) await this.init();
    if (!this.db) return [];

    const res = this.db.exec(`
      SELECT id, name, category_name, allocated_amount, period, category_group, rollover, color_code
      FROM budgets
      ORDER BY allocated_amount DESC;
    `);

    if (!res || res.length === 0 || !res[0].values) {
      return [];
    }

    const currentMonthPrefix = new Date().toISOString().substring(0, 7); // 'YYYY-MM'

    return res[0].values.map((row) => {
      const id = String(row[0]);
      const name = String(row[1]);
      const categoryName = String(row[2]);
      const allocated = Number(row[3]) || 0;
      const period = (row[4] as 'monthly' | 'annual' | 'weekly') || 'monthly';
      const categoryGroup = (row[5] as 'need' | 'want' | 'saving') || 'need';
      const rollover = Boolean(row[6]);
      const colorCode = String(row[7] || '#3b82f6');

      let spent = 0;
      try {
        // Direct category spending in current month
        const txSpendRes = this.db?.exec(
          `SELECT COALESCE(SUM(ABS(amount)), 0) FROM transactions 
           WHERE LOWER(category_name) = LOWER(:cat) 
             AND amount < 0 
             AND strftime('%Y-%m', date) = :month;`,
          { ':cat': categoryName, ':month': currentMonthPrefix }
        );
        const directSpent = Number(txSpendRes?.[0]?.values?.[0]?.[0]) || 0;

        // Split item spending in current month
        const splitSpendRes = this.db?.exec(
          `SELECT COALESCE(SUM(ABS(s.amount)), 0) FROM transaction_splits s
           JOIN transactions t ON s.transaction_id = t.id
           WHERE LOWER(s.category_name) = LOWER(:cat) 
             AND s.amount < 0 
             AND strftime('%Y-%m', t.date) = :month;`,
          { ':cat': categoryName, ':month': currentMonthPrefix }
        );
        const splitSpent = Number(splitSpendRes?.[0]?.values?.[0]?.[0]) || 0;

        spent = directSpent + splitSpent;
      } catch (err) {
        console.error('Error computing category spending:', err);
      }

      const remaining = allocated - spent;
      const pct = allocated > 0 ? Math.round((spent / allocated) * 100) : 0;
      let alertLevel: 'none' | 'warning' | 'critical' | 'over_budget' = 'none';
      if (pct >= 100) alertLevel = 'over_budget';
      else if (pct >= 85) alertLevel = 'critical';
      else if (pct >= 70) alertLevel = 'warning';

      return {
        id,
        name,
        category_name: categoryName,
        allocated_amount: allocated,
        spent_amount: spent,
        remaining_amount: remaining,
        spent_percent: pct,
        period,
        category_group: categoryGroup,
        rollover,
        color_code: colorCode,
        alert_level: alertLevel,
      };
    });
  }

  async createBudget(payload: Partial<EnvelopeBudget>): Promise<EnvelopeBudget> {
    if (!this.db) await this.init();
    if (!this.db) throw new Error('Database not initialized');

    const id = payload.id ? String(payload.id) : `bgt-${Date.now()}`;
    const name = payload.name || 'New Budget';
    const categoryName = payload.category_name || name;
    const allocated = Number(payload.allocated_amount || 0);
    const period = payload.period || 'monthly';
    const categoryGroup = payload.category_group || 'need';
    const rollover = payload.rollover ? 1 : 0;
    const colorCode = payload.color_code || '#3b82f6';

    this.db.run(
      `INSERT INTO budgets (id, name, category_name, allocated_amount, period, category_group, rollover, color_code)
       VALUES (:id, :name, :category_name, :allocated_amount, :period, :category_group, :rollover, :color_code);`,
      {
        ':id': id,
        ':name': name,
        ':category_name': categoryName,
        ':allocated_amount': allocated,
        ':period': period,
        ':category_group': categoryGroup,
        ':rollover': rollover,
        ':color_code': colorCode,
      }
    );

    await this.persist();
    return {
      id,
      name,
      category_name: categoryName,
      allocated_amount: allocated,
      spent_amount: 0,
      remaining_amount: allocated,
      spent_percent: 0,
      period,
      category_group: categoryGroup,
      rollover: Boolean(rollover),
      color_code: colorCode,
      alert_level: 'none',
    };
  }

  async updateBudget(id: string | number, payload: Partial<EnvelopeBudget>): Promise<EnvelopeBudget> {
    if (!this.db) await this.init();
    if (!this.db) throw new Error('Database not initialized');

    const strId = String(id);
    const sets: string[] = [];
    const params: Record<string, any> = { ':id': strId };

    if (payload.name !== undefined) {
      sets.push('name = :name');
      params[':name'] = payload.name;
    }
    if (payload.category_name !== undefined) {
      sets.push('category_name = :cat');
      params[':cat'] = payload.category_name;
    }
    if (payload.allocated_amount !== undefined) {
      sets.push('allocated_amount = :amt');
      params[':amt'] = Number(payload.allocated_amount);
    }
    if (payload.period !== undefined) {
      sets.push('period = :period');
      params[':period'] = payload.period;
    }
    if (payload.category_group !== undefined) {
      sets.push('category_group = :group');
      params[':group'] = payload.category_group;
    }
    if (payload.rollover !== undefined) {
      sets.push('rollover = :rollover');
      params[':rollover'] = payload.rollover ? 1 : 0;
    }
    if (payload.color_code !== undefined) {
      sets.push('color_code = :color');
      params[':color'] = payload.color_code;
    }

    if (sets.length > 0) {
      this.db.run(`UPDATE budgets SET ${sets.join(', ')} WHERE id = :id;`, params);
      await this.persist();
    }

    const all = await this.getBudgets();
    const updated = all.find((b) => String(b.id) === strId);
    if (!updated) throw new Error(`Budget ${id} not found`);
    return updated;
  }

  async deleteBudget(id: string | number): Promise<boolean> {
    if (!this.db) await this.init();
    if (!this.db) return false;

    this.db.run('DELETE FROM budgets WHERE id = :id;', { ':id': String(id) });
    await this.persist();
    return true;
  }

  /**
   * Always sync and refer back to Odoo DB for settings (base currency, FX rates, rules)
   */
  async syncSettingsFromOdoo(settings: OdooSettingsPayload): Promise<void> {
    if (!this.db) await this.init();
    if (!this.db) return;

    // 1. Update app_settings
    this.db.run(`
      INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES
        ('base_currency', :base_curr, CURRENT_TIMESTAMP),
        ('base_symbol', :base_sym, CURRENT_TIMESTAMP),
        ('company_name', :comp_name, CURRENT_TIMESTAMP),
        ('last_odoo_sync', :last_sync, CURRENT_TIMESTAMP);
    `, {
      ':base_curr': settings.base_currency || 'SGD',
      ':base_sym': settings.base_symbol || '$',
      ':comp_name': settings.company_name || '',
      ':last_sync': new Date().toISOString(),
    });

    // 2. Update currency_rates
    if (settings.rates) {
      for (const [code, rate] of Object.entries(settings.rates)) {
        this.db.run(`
          INSERT OR REPLACE INTO currency_rates (currency_code, rate_to_base, updated_at)
          VALUES (:code, :rate, CURRENT_TIMESTAMP);
        `, {
          ':code': code.toUpperCase(),
          ':rate': Number(rate),
        });
      }
    }

    // 3. Update categorization_rules if provided by Odoo
    if (settings.rules && settings.rules.length > 0) {
      this.db.run('DELETE FROM categorization_rules;');
      for (const rule of settings.rules) {
        this.db.run(`
          INSERT INTO categorization_rules (id, priority, match_field, match_pattern, category_name)
          VALUES (:id, :priority, :field, :pattern, :cat);
        `, {
          ':id': String(rule.id),
          ':priority': rule.priority,
          ':field': rule.match_field,
          ':pattern': rule.match_pattern,
          ':cat': rule.category_name,
        });
      }
    }

    await this.persist();
  }

  async getSettings(): Promise<OdooSettingsPayload | null> {
    if (!this.db) await this.init();
    if (!this.db) return null;

    let baseCurrency = 'SGD';
    let baseSymbol = '$';
    let companyName = '';

    try {
      const sRes = this.db.exec("SELECT key, value FROM app_settings;");
      if (sRes?.[0]?.values) {
        for (const row of sRes[0].values) {
          const k = String(row[0]);
          const v = String(row[1]);
          if (k === 'base_currency') baseCurrency = v;
          if (k === 'base_symbol') baseSymbol = v;
          if (k === 'company_name') companyName = v;
        }
      }
    } catch {
      // fallback
    }

    const rates: Record<string, number> = {};
    try {
      const rRes = this.db.exec("SELECT currency_code, rate_to_base FROM currency_rates;");
      if (rRes?.[0]?.values) {
        for (const row of rRes[0].values) {
          rates[String(row[0])] = Number(row[1]);
        }
      }
    } catch {
      // fallback
    }

    return {
      base_currency: baseCurrency,
      base_symbol: baseSymbol,
      company_name: companyName,
      rates,
    };
  }

  /**
   * Recurring Bills & Subscription Detector for SQLite
   */
  async getRecurringBills(days: number = 14): Promise<RecurringBill[]> {
    if (!this.db) await this.init();
    if (!this.db) return [];

    const res = this.db.exec(`SELECT * FROM recurring_bills WHERE active = 1 ORDER BY next_due_date ASC;`);
    if (!res || res.length === 0 || !res[0].values) return [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const cutoff = days > 0 ? new Date(today.getTime() + days * 86400000) : null;

    const bills: RecurringBill[] = [];
    for (const row of res[0].values) {
      const nextDueDate = String(row[8]);
      const due = new Date(nextDueDate);
      if (cutoff && due > cutoff) continue;

      const diff = Math.ceil((due.getTime() - today.getTime()) / 86400000);
      let status: 'overdue' | 'today' | 'due_soon' | 'upcoming' = 'upcoming';
      if (diff < 0) status = 'overdue';
      else if (diff === 0) status = 'today';
      else if (diff <= 7) status = 'due_soon';

      bills.push({
        id: String(row[0]),
        name: String(row[1]),
        payee_name: String(row[2]),
        category_name: row[3] ? String(row[3]) : 'Utilities',
        account_id: row[4] ? String(row[4]) : undefined,
        account_name: row[5] ? String(row[5]) : undefined,
        amount: Number(row[6]),
        frequency: String(row[7]) as any,
        next_due_date: nextDueDate,
        auto_pay: Boolean(row[9]),
        active: Boolean(row[10]),
        days_until_due: diff,
        due_status: status,
      });
    }
    return bills;
  }

  async createRecurringBill(payload: Partial<RecurringBill>): Promise<RecurringBill> {
    if (!this.db) await this.init();
    if (!this.db) throw new Error('Database not initialized');

    const id = payload.id || `sq-bill-${Date.now()}`;
    const name = payload.name || 'Recurring Bill';
    const payee = payload.payee_name || name;
    const cat = payload.category_name || 'Utilities';
    const accId = payload.account_id ? String(payload.account_id) : '';
    const accName = payload.account_name || '';
    const amount = Number(payload.amount || 0);
    const freq = payload.frequency || 'monthly';
    const nextDate = payload.next_due_date || new Date().toISOString().split('T')[0];
    const auto = payload.auto_pay ? 1 : 0;

    this.db.run(`
      INSERT INTO recurring_bills (id, name, payee_name, category_name, account_id, account_name, amount, frequency, next_due_date, auto_pay, active)
      VALUES (:id, :name, :payee, :cat, :accId, :accName, :amt, :freq, :next, :auto, 1);
    `, {
      ':id': id,
      ':name': name,
      ':payee': payee,
      ':cat': cat,
      ':accId': accId,
      ':accName': accName,
      ':amt': amount,
      ':freq': freq,
      ':next': nextDate,
      ':auto': auto,
    });

    await this.persist();

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(nextDate);
    const diff = Math.ceil((due.getTime() - today.getTime()) / 86400000);
    let status: 'overdue' | 'today' | 'due_soon' | 'upcoming' = 'upcoming';
    if (diff < 0) status = 'overdue';
    else if (diff === 0) status = 'today';
    else if (diff <= 7) status = 'due_soon';

    return {
      id,
      name,
      payee_name: payee,
      category_name: cat,
      account_id: accId,
      account_name: accName,
      amount,
      frequency: freq,
      next_due_date: nextDate,
      auto_pay: Boolean(auto),
      active: true,
      days_until_due: diff,
      due_status: status,
    };
  }

  async updateRecurringBill(id: string | number, payload: Partial<RecurringBill>): Promise<RecurringBill> {
    if (!this.db) await this.init();
    if (!this.db) throw new Error('Database not initialized');

    const strId = String(id);
    const existingRes = this.db.exec(`SELECT * FROM recurring_bills WHERE id = '${strId}';`);
    if (!existingRes || !existingRes[0]?.values?.length) {
      throw new Error(`Bill ${id} not found`);
    }

    const row = existingRes[0].values[0];
    const name = payload.name !== undefined ? payload.name : String(row[1]);
    const payee = payload.payee_name !== undefined ? payload.payee_name : String(row[2]);
    const cat = payload.category_name !== undefined ? payload.category_name : (row[3] ? String(row[3]) : 'Utilities');
    const accId = payload.account_id !== undefined ? String(payload.account_id) : (row[4] ? String(row[4]) : '');
    const accName = payload.account_name !== undefined ? payload.account_name : (row[5] ? String(row[5]) : '');
    const amount = payload.amount !== undefined ? Number(payload.amount) : Number(row[6]);
    const freq = payload.frequency !== undefined ? payload.frequency : String(row[7]);
    const nextDate = payload.next_due_date !== undefined ? payload.next_due_date : String(row[8]);
    const auto = payload.auto_pay !== undefined ? (payload.auto_pay ? 1 : 0) : Number(row[9]);
    const active = payload.active !== undefined ? (payload.active ? 1 : 0) : Number(row[10]);

    this.db.run(`
      UPDATE recurring_bills
      SET name = :name, payee_name = :payee, category_name = :cat, account_id = :accId, account_name = :accName,
          amount = :amt, frequency = :freq, next_due_date = :next, auto_pay = :auto, active = :active
      WHERE id = :id;
    `, {
      ':id': strId,
      ':name': name,
      ':payee': payee,
      ':cat': cat,
      ':accId': accId,
      ':accName': accName,
      ':amt': amount,
      ':freq': freq,
      ':next': nextDate,
      ':auto': auto,
      ':active': active,
    });

    await this.persist();

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(nextDate);
    const diff = Math.ceil((due.getTime() - today.getTime()) / 86400000);
    let status: 'overdue' | 'today' | 'due_soon' | 'upcoming' = 'upcoming';
    if (diff < 0) status = 'overdue';
    else if (diff === 0) status = 'today';
    else if (diff <= 7) status = 'due_soon';

    return {
      id: strId,
      name,
      payee_name: payee,
      category_name: cat,
      account_id: accId,
      account_name: accName,
      amount,
      frequency: freq as any,
      next_due_date: nextDate,
      auto_pay: Boolean(auto),
      active: Boolean(active),
      days_until_due: diff,
      due_status: status,
    };
  }

  async deleteRecurringBill(id: string | number): Promise<boolean> {
    if (!this.db) await this.init();
    if (!this.db) return false;

    this.db.run('DELETE FROM recurring_bills WHERE id = :id;', { ':id': String(id) });
    await this.persist();
    return true;
  }

  async markBillPaid(
    id: string | number,
    accountId?: string | number,
    date?: string
  ): Promise<{ success: boolean; transaction?: MonetaTransaction }> {
    if (!this.db) await this.init();
    if (!this.db) return { success: false };

    const bRes = this.db.exec(`SELECT * FROM recurring_bills WHERE id = '${String(id)}';`);
    if (!bRes || !bRes[0]?.values?.length) return { success: false };
    const row = bRes[0].values[0];
    const billName = String(row[1]);
    const payeeName = String(row[2]);
    const catName = row[3] ? String(row[3]) : 'Utilities';
    const defaultAccId = row[4] ? String(row[4]) : undefined;
    const amount = Number(row[6]);
    const frequency = String(row[7]);
    const curNextDate = String(row[8]);

    // Choose target account
    let targetAccId = accountId ? String(accountId) : defaultAccId;
    if (!targetAccId) {
      const accRes = this.db.exec(`SELECT id FROM accounts LIMIT 1;`);
      targetAccId = accRes?.[0]?.values?.[0]?.[0] ? String(accRes[0].values[0][0]) : 'acc-1';
    }

    const txDate = date || new Date().toISOString().split('T')[0];

    // 1. Create paid expense transaction in register
    const tx = await this.createTransaction({
      account_id: targetAccId,
      date: txDate,
      payee_name: payeeName,
      category_name: catName,
      amount: -Math.abs(amount),
      transaction_type: 'expense',
      reconciliation_state: 'cleared',
      memo: `Paid bill: ${billName}`,
    });

    // 2. Advance next due date
    const d = new Date(curNextDate);
    if (frequency === 'weekly') d.setDate(d.getDate() + 7);
    else if (frequency === 'biweekly') d.setDate(d.getDate() + 14);
    else if (frequency === 'quarterly') d.setMonth(d.getMonth() + 3);
    else if (frequency === 'semiannual') d.setMonth(d.getMonth() + 6);
    else if (frequency === 'yearly') d.setFullYear(d.getFullYear() + 1);
    else d.setMonth(d.getMonth() + 1);

    const newNextDate = d.toISOString().split('T')[0];
    this.db.run(`UPDATE recurring_bills SET next_due_date = :next WHERE id = :id;`, {
      ':next': newNextDate,
      ':id': String(id),
    });

    await this.persist();
    return { success: true, transaction: tx };
  }

  /**
   * Offline Subscription Detector: scans past 180 days of transaction expenses
   * and clusters repeat merchants into cadences.
   */
  async detectSubscriptions(): Promise<DetectedSubscription[]> {
    if (!this.db) await this.init();
    if (!this.db) return [];

    // Get active bills payees to avoid re-suggesting already tracked bills
    const existingRes = this.db.exec('SELECT LOWER(payee_name), LOWER(name) FROM recurring_bills WHERE active = 1;');
    const trackedNames = new Set<string>();
    if (existingRes?.[0]?.values) {
      for (const row of existingRes[0].values) {
        if (row[0]) trackedNames.add(String(row[0]).trim());
        if (row[1]) trackedNames.add(String(row[1]).trim());
      }
    }

    // Query past expense transactions ordered by payee and date
    const txRes = this.db.exec(`
      SELECT payee_name, category_name, amount, date
      FROM transactions
      WHERE amount < 0
      ORDER BY LOWER(payee_name) ASC, date ASC;
    `);

    if (!txRes || !txRes[0]?.values?.length) return [];

    const grouped: Record<string, { payee: string; category: string; amounts: number[]; dates: string[] }> = {};
    for (const row of txRes[0].values) {
      const payee = String(row[0] || '').trim();
      if (!payee || payee.length < 2) continue;
      const key = payee.toLowerCase();

      // Skip already tracked bills
      if (trackedNames.has(key)) continue;

      if (!grouped[key]) {
        grouped[key] = {
          payee,
          category: row[1] ? String(row[1]) : 'Subscription',
          amounts: [],
          dates: [],
        };
      }
      grouped[key].amounts.push(Math.abs(Number(row[2])));
      grouped[key].dates.push(String(row[3]));
    }

    const detected: DetectedSubscription[] = [];

    for (const [key, data] of Object.entries(grouped)) {
      if (data.dates.length < 2) continue;

      // Calculate intervals in days between consecutive occurrences
      const intervals: number[] = [];
      for (let i = 1; i < data.dates.length; i++) {
        const d1 = new Date(data.dates[i - 1]).getTime();
        const d2 = new Date(data.dates[i]).getTime();
        const diffDays = Math.round((d2 - d1) / 86400000);
        if (diffDays > 0) intervals.push(diffDays);
      }

      if (intervals.length === 0) continue;

      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const avgAmount = data.amounts.reduce((a, b) => a + b, 0) / data.amounts.length;
      const lastDate = data.dates[data.dates.length - 1];

      let detectedFreq: 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly' | null = null;
      if (avgInterval >= 6 && avgInterval <= 8) detectedFreq = 'weekly';
      else if (avgInterval >= 12 && avgInterval <= 16) detectedFreq = 'biweekly';
      else if (avgInterval >= 25 && avgInterval <= 35) detectedFreq = 'monthly';
      else if (avgInterval >= 80 && avgInterval <= 100) detectedFreq = 'quarterly';
      else if (avgInterval >= 340 && avgInterval <= 380) detectedFreq = 'yearly';

      if (detectedFreq) {
        // Compute variance of intervals
        const variance = intervals.reduce((sum, v) => sum + Math.pow(v - avgInterval, 2), 0) / intervals.length;
        const confidence: 'high' | 'medium' | 'low' = variance < 4 ? 'high' : variance < 16 ? 'medium' : 'low';

        // Calculate next expected date
        const dNext = new Date(lastDate);
        dNext.setDate(dNext.getDate() + Math.round(avgInterval));
        const nextExpected = dNext.toISOString().split('T')[0];

        // Monthly normalized cost
        let monthlyEst = avgAmount;
        if (detectedFreq === 'weekly') monthlyEst = avgAmount * 4.33;
        else if (detectedFreq === 'biweekly') monthlyEst = avgAmount * 2.16;
        else if (detectedFreq === 'quarterly') monthlyEst = avgAmount / 3;
        else if (detectedFreq === 'yearly') monthlyEst = avgAmount / 12;

        detected.push({
          payee_name: data.payee,
          category_name: data.category,
          average_amount: Math.round(avgAmount * 100) / 100,
          detected_frequency: detectedFreq,
          charge_count: data.dates.length,
          last_charge_date: lastDate,
        });
      }
    }

    return detected;
  }

  /**
   * Quicken-style projected cash flow simulation and Sankey graph generator
   */
  async getCashflowForecast(days: number = 90, accountId?: string | number): Promise<CashflowForecast> {
    if (!this.db) await this.init();
    if (!this.db) throw new Error('Database not initialized');

    const horizon = days || 90;

    // 1. Calculate Starting Balance
    let startBal = 0;
    if (accountId) {
      const res = this.db.exec(`SELECT current_balance FROM accounts WHERE id = '${String(accountId)}';`);
      startBal = (res[0]?.values[0]?.[0] as number) || 0;
    } else {
      const res = this.db.exec(`
        SELECT SUM(current_balance) FROM accounts
        WHERE account_type IN ('checking', 'chequing', 'savings', 'cash');
      `);
      startBal = (res[0]?.values[0]?.[0] as number) || 0;
      if (startBal === 0) {
        const fallbackRes = this.db.exec(`SELECT SUM(current_balance) FROM accounts;`);
        startBal = (fallbackRes[0]?.values[0]?.[0] as number) || 0;
      }
    }

    // 2. Fetch recurring bills
    const bills = await this.getRecurringBills(0);

    // 3. Scan historical income patterns from transactions table
    let monthlySalary = 6500.0;
    let monthlyOther = 1200.0;

    try {
      const incRes = this.db.exec(`
        SELECT amount, payee_name, date FROM transactions
        WHERE amount > 500
        ORDER BY date DESC LIMIT 20;
      `);
      if (incRes?.[0]?.values && incRes[0].values.length > 0) {
        const amounts = incRes[0].values.map((v) => Number(v[0]));
        const maxInc = Math.max(...amounts);
        if (maxInc >= 2000) {
          monthlySalary = maxInc;
        }
      }
    } catch {
      // fallback to default
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Map scheduled dates to bills
    const scheduledByDate = new Map<string, Array<{ name: string; amount: number }>>();
    for (const b of bills) {
      let d = new Date(b.next_due_date);
      const cutoff = new Date(today.getTime() + horizon * 86400000);
      while (d <= cutoff) {
        const dStr = d.toISOString().split('T')[0];
        if (d >= today) {
          if (!scheduledByDate.has(dStr)) scheduledByDate.set(dStr, []);
          scheduledByDate.get(dStr)!.push({ name: b.name, amount: b.amount });
        }
        if (b.frequency === 'weekly') d.setDate(d.getDate() + 7);
        else if (b.frequency === 'biweekly') d.setDate(d.getDate() + 14);
        else if (b.frequency === 'quarterly') d.setMonth(d.getMonth() + 3);
        else if (b.frequency === 'semiannual') d.setMonth(d.getMonth() + 6);
        else if (b.frequency === 'yearly') d.setFullYear(d.getFullYear() + 1);
        else d.setMonth(d.getMonth() + 1);
      }
    }

    const dailyPoints = [];
    let running = startBal;
    let lowestBal = startBal;
    let lowestDate = today.toISOString().split('T')[0];
    let totalInc = 0;
    let totalExp = 0;
    let overdraftCount = 0;

    for (let i = 0; i <= horizon; i++) {
      const d = new Date(today.getTime() + i * 86400000);
      const dateStr = d.toISOString().split('T')[0];
      const dayOfMonth = d.getDate();
      const dayOfWeek = d.toLocaleDateString('en-SG', { weekday: 'long' });

      let dayInc = 0;
      let dayExp = 0;
      const events: string[] = [];

      // Monthly Salary deposit on 25th
      if (dayOfMonth === 25) {
        dayInc += monthlySalary;
        events.push(`Salary (+$${monthlySalary.toLocaleString()})`);
      }
      // Alternate / Secondary Income on 1st
      if (dayOfMonth === 1 && monthlyOther > 0) {
        dayInc += monthlyOther;
        events.push(`Other Inflow (+$${monthlyOther.toLocaleString()})`);
      }

      // Check scheduled bills
      const dueBills = scheduledByDate.get(dateStr);
      if (dueBills) {
        for (const b of dueBills) {
          dayExp += b.amount;
          events.push(`${b.name} (-$${b.amount.toFixed(2)})`);
        }
      }

      // Daily baseline living expenses
      if (i > 0) {
        const baselineDaily = 50.0;
        dayExp += baselineDaily;
      }

      const netChange = dayInc - dayExp;
      const openBal = running;
      const closeBal = running + netChange;
      running = closeBal;

      totalInc += dayInc;
      totalExp += dayExp;

      if (closeBal < lowestBal) {
        lowestBal = closeBal;
        lowestDate = dateStr;
      }

      if (closeBal < 0) {
        overdraftCount++;
      }

      dailyPoints.push({
        date: dateStr,
        day_of_week: dayOfWeek,
        opening_balance: Math.round(openBal * 100) / 100,
        total_income: Math.round(dayInc * 100) / 100,
        total_expense: Math.round(dayExp * 100) / 100,
        net_change: Math.round(netChange * 100) / 100,
        closing_balance: Math.round(closeBal * 100) / 100,
        is_overdraft: closeBal < 0,
        event_summary: events.join(', '),
      });
    }

    // 4. Build Sankey Graph from Budgets & Incomes
    const months = horizon / 30.0;
    const salaryTotal = Math.round(monthlySalary * months);
    const otherTotal = Math.round(monthlyOther * months);
    const totalInflow = salaryTotal + otherTotal;

    const budgets = await this.getBudgets();
    const nodes: any[] = [
      { id: 'in-salary', name: 'Employment Salary', tier: 'inflow', value: salaryTotal, color: '#10b981' },
      { id: 'in-other', name: 'Secondary Inflows', tier: 'inflow', value: otherTotal, color: '#34d399' },
      { id: 'hub-cash', name: 'Liquid Cash Accounts', tier: 'hub', value: totalInflow, color: '#6366f1' },
    ];

    const links: any[] = [
      { source: 'in-salary', target: 'hub-cash', value: salaryTotal },
      { source: 'in-other', target: 'hub-cash', value: otherTotal },
    ];

    let allocatedExp = 0;
    if (budgets.length > 0) {
      for (const b of budgets) {
        const val = Math.round((b.allocated_amount || 0) * months);
        if (val > 0) {
          const tier = b.category_group === 'saving' ? 'saving' : 'outflow';
          const nodeColor = b.color_code || (tier === 'saving' ? '#10b981' : '#f59e0b');
          nodes.push({ id: `out-${b.id}`, name: b.name, tier, value: val, color: nodeColor });
          links.push({ source: 'hub-cash', target: `out-${b.id}`, value: val });
          allocatedExp += val;
        }
      }
    } else {
      const defExp = Math.round(totalInflow * 0.7);
      nodes.push({ id: 'out-general', name: 'Living Expenses', tier: 'outflow', value: defExp, color: '#f59e0b' });
      links.push({ source: 'hub-cash', target: 'out-general', value: defExp });
      allocatedExp += defExp;
    }

    const surplus = Math.max(0, totalInflow - allocatedExp);
    if (surplus > 0) {
      nodes.push({ id: 'sav-surplus', name: 'Net Savings Reserve', tier: 'saving', value: surplus, color: '#059669' });
      links.push({ source: 'hub-cash', target: 'sav-surplus', value: surplus });
    }

    return {
      summary: {
        starting_balance: Math.round(startBal * 100) / 100,
        lowest_projected_balance: Math.round(lowestBal * 100) / 100,
        lowest_balance_date: lowestDate,
        ending_projected_balance: Math.round(running * 100) / 100,
        total_projected_income: Math.round(totalInc * 100) / 100,
        total_projected_expenses: Math.round(totalExp * 100) / 100,
        net_projected_cashflow: Math.round((totalInc - totalExp) * 100) / 100,
        overdraft_days_count: overdraftCount,
        has_overdraft_risk: overdraftCount > 0,
      },
      daily_points: dailyPoints,
      sankey: {
        nodes,
        links,
      },
    };
  }

  /**
   * Aggregate payees from transactions table and merge with custom payee metadata
   */
  async getPayees(): Promise<PayeeIntelligence[]> {
    await this.init();
    if (!this.db) return [];

    // 1. Aggregate statistics grouped by payee_name
    const txStmt = `
      SELECT
        TRIM(payee_name) as p_name,
        COUNT(*) as tx_count,
        SUM(ABS(amount)) as total_spend,
        AVG(ABS(amount)) as avg_amount,
        MAX(date) as last_date
      FROM transactions
      WHERE payee_name IS NOT NULL AND TRIM(payee_name) != ''
      GROUP BY LOWER(TRIM(payee_name))
      ORDER BY total_spend DESC;
    `;
    const txRes = this.db.exec(txStmt);

    // 2. Query category frequencies per payee to determine most-used category
    const catStmt = `
      SELECT
        LOWER(TRIM(payee_name)) as norm_name,
        category_name,
        COUNT(*) as cat_count
      FROM transactions
      WHERE payee_name IS NOT NULL AND TRIM(payee_name) != '' AND category_name IS NOT NULL AND TRIM(category_name) != ''
      GROUP BY LOWER(TRIM(payee_name)), category_name
      ORDER BY LOWER(TRIM(payee_name)), cat_count DESC;
    `;
    const catRes = this.db.exec(catStmt);
    const topCategoryMap: Record<string, string> = {};
    if (catRes.length > 0 && catRes[0].values) {
      for (const row of catRes[0].values) {
        const norm = String(row[0]).toLowerCase();
        const cat = String(row[1]);
        if (!topCategoryMap[norm]) {
          topCategoryMap[norm] = cat;
        }
      }
    }

    // 3. Cadence detection from dates
    const dateStmt = `
      SELECT LOWER(TRIM(payee_name)) as norm_name, date
      FROM transactions
      WHERE payee_name IS NOT NULL AND TRIM(payee_name) != ''
      ORDER BY LOWER(TRIM(payee_name)), date ASC;
    `;
    const dateRes = this.db.exec(dateStmt);
    const datesMap: Record<string, string[]> = {};
    if (dateRes.length > 0 && dateRes[0].values) {
      for (const row of dateRes[0].values) {
        const norm = String(row[0]).toLowerCase();
        const d = String(row[1]);
        if (!datesMap[norm]) datesMap[norm] = [];
        datesMap[norm].push(d);
      }
    }

    const cadenceMap: Record<string, 'none' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly'> = {};
    for (const [norm, dateList] of Object.entries(datesMap)) {
      if (dateList.length < 3) {
        cadenceMap[norm] = 'none';
        continue;
      }
      const intervals: number[] = [];
      for (let i = 1; i < dateList.length; i++) {
        const t1 = new Date(dateList[i - 1]).getTime();
        const t2 = new Date(dateList[i]).getTime();
        const days = Math.round((t2 - t1) / 86400000);
        if (days > 0) intervals.push(days);
      }
      if (intervals.length < 2) {
        cadenceMap[norm] = 'none';
        continue;
      }
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      if (avgInterval >= 5 && avgInterval <= 9) cadenceMap[norm] = 'weekly';
      else if (avgInterval >= 12 && avgInterval <= 16) cadenceMap[norm] = 'biweekly';
      else if (avgInterval >= 26 && avgInterval <= 35) cadenceMap[norm] = 'monthly';
      else if (avgInterval >= 80 && avgInterval <= 100) cadenceMap[norm] = 'quarterly';
      else if (avgInterval >= 350 && avgInterval <= 380) cadenceMap[norm] = 'yearly';
      else cadenceMap[norm] = 'none';
    }

    // 4. Query payees table for overrides
    const metaStmt = `SELECT id, name, default_category_name, suggested_category_name, detected_cadence, website, notes FROM payees;`;
    const metaRes = this.db.exec(metaStmt);
    const metaMap: Record<string, any> = {};
    if (metaRes.length > 0 && metaRes[0].values) {
      for (const row of metaRes[0].values) {
        const [id, name, defCat, sugCat, cadence, website, notes] = row;
        metaMap[String(name).toLowerCase()] = {
          id: String(id),
          name: String(name),
          default_category_name: defCat ? String(defCat) : undefined,
          suggested_category_name: sugCat ? String(sugCat) : undefined,
          detected_cadence: cadence ? String(cadence) : undefined,
          website: website ? String(website) : undefined,
          notes: notes ? String(notes) : undefined,
        };
      }
    }

    const payees: PayeeIntelligence[] = [];
    const seenNorms = new Set<string>();

    if (txRes.length > 0 && txRes[0].values) {
      for (const row of txRes[0].values) {
        const pName = String(row[0]);
        const norm = pName.toLowerCase();
        seenNorms.add(norm);

        const txCount = Number(row[1]) || 0;
        const totalSpend = Number(row[2]) || 0;
        const avgAmt = Number(row[3]) || 0;
        const lastDate = row[4] ? String(row[4]) : undefined;

        const meta = metaMap[norm];
        const topCat = topCategoryMap[norm];
        const detectedCadence = meta?.detected_cadence || cadenceMap[norm] || 'none';

        payees.push({
          id: meta?.id || `payee-${norm.replace(/[^a-z0-9]/g, '-')}`,
          name: meta?.name || pName,
          default_category_name: meta?.default_category_name || topCat,
          suggested_category_name: meta?.suggested_category_name || topCat,
          total_spend: Math.round(totalSpend * 100) / 100,
          transaction_count: txCount,
          avg_amount: Math.round(avgAmt * 100) / 100,
          last_transaction_date: lastDate,
          detected_cadence: detectedCadence as any,
          website: meta?.website,
          notes: meta?.notes,
        });
      }
    }

    // Include payees from payees table that have no transactions yet
    for (const [norm, meta] of Object.entries(metaMap)) {
      if (!seenNorms.has(norm)) {
        payees.push({
          id: meta.id,
          name: meta.name,
          default_category_name: meta.default_category_name,
          suggested_category_name: meta.suggested_category_name,
          total_spend: 0,
          transaction_count: 0,
          avg_amount: 0,
          detected_cadence: meta.detected_cadence || 'none',
          website: meta.website,
          notes: meta.notes,
        });
      }
    }

    return payees.sort((a, b) => b.total_spend - a.total_spend);
  }

  /**
   * Update or create payee metadata (default category, cadence, notes) in SQLite
   */
  async updatePayee(id: string | number, payload: Partial<PayeeIntelligence>): Promise<boolean> {
    await this.init();
    if (!this.db) return false;

    const existing = this.db.exec(`SELECT id, name FROM payees WHERE id = :id OR LOWER(name) = LOWER(:name);`, {
      ':id': String(id),
      ':name': payload.name || '',
    });

    const existingId = existing[0]?.values[0]?.[0] as string | undefined;
    const finalId = existingId || String(id);
    const payeeName = payload.name || (existing[0]?.values[0]?.[1] as string) || `Payee-${id}`;

    this.db.run(
      `INSERT INTO payees (id, name, default_category_name, suggested_category_name, detected_cadence, website, notes, updated_at)
       VALUES (:id, :name, :default_category_name, :suggested_category_name, :detected_cadence, :website, :notes, CURRENT_TIMESTAMP)
       ON CONFLICT(name) DO UPDATE SET
         default_category_name = COALESCE(:default_category_name, default_category_name),
         suggested_category_name = COALESCE(:suggested_category_name, suggested_category_name),
         detected_cadence = COALESCE(:detected_cadence, detected_cadence),
         website = COALESCE(:website, website),
         notes = COALESCE(:notes, notes),
         updated_at = CURRENT_TIMESTAMP;`,
      {
        ':id': finalId,
        ':name': payeeName,
        ':default_category_name': payload.default_category_name !== undefined ? payload.default_category_name : null,
        ':suggested_category_name': payload.suggested_category_name !== undefined ? payload.suggested_category_name : null,
        ':detected_cadence': payload.detected_cadence !== undefined ? payload.detected_cadence : null,
        ':website': payload.website !== undefined ? payload.website : null,
        ':notes': payload.notes !== undefined ? payload.notes : null,
      }
    );

    await this.persist();
    return true;
  }

  // ---------------------------------------------------------------------------
  // Financial Goals & Sinking Funds
  // ---------------------------------------------------------------------------

  /**
   * Maps a `goals` row to a FinancialGoal, deriving progress figures through
   * `computeGoalMetrics` so this adapter and the Odoo server agree.
   */
  private mapGoalRow(row: any[]): FinancialGoal {
    const today = toDateOnlyString(todayDateOnly());
    const persisted = {
      id: String(row[0]),
      name: String(row[1]),
      target_amount: Number(row[2]) || 0,
      current_amount: Number(row[3]) || 0,
      start_date: row[4] ? String(row[4]) : today,
      target_date: row[5] ? String(row[5]) : today,
      account_id: row[6] ? String(row[6]) : undefined,
      account_name: row[7] ? String(row[7]) : undefined,
      icon: row[8] ? String(row[8]) : '🎯',
      color: row[9] !== null && row[9] !== undefined ? Number(row[9]) : undefined,
      notes: row[10] ? String(row[10]) : undefined,
      status: ((row[11] as GoalStatus) || 'in_progress') as GoalStatus,
    };
    return { ...persisted, ...computeGoalMetrics(persisted) };
  }

  async getGoals(): Promise<FinancialGoal[]> {
    if (!this.db) await this.init();
    if (!this.db) return [];

    const res = this.db.exec(`SELECT * FROM goals ORDER BY target_date ASC, name ASC;`);
    if (!res || res.length === 0 || !res[0].values) return [];

    return res[0].values.map((row) => this.mapGoalRow(row));
  }

  async createGoal(payload: Partial<FinancialGoal>): Promise<FinancialGoal> {
    if (!this.db) await this.init();
    if (!this.db) throw new Error('Database not initialized');

    const id = payload.id ? String(payload.id) : `sq-goal-${Date.now()}`;
    const today = toDateOnlyString(todayDateOnly());

    this.db.run(
      `INSERT INTO goals (id, name, target_amount, current_amount, start_date, target_date, account_id, account_name, icon, color, notes, status)
       VALUES (:id, :name, :target, :current, :start, :target_date, :acc_id, :acc_name, :icon, :color, :notes, :status);`,
      {
        ':id': id,
        ':name': payload.name || 'New Goal',
        ':target': Number(payload.target_amount || 0),
        ':current': Number(payload.current_amount || 0),
        ':start': payload.start_date || today,
        ':target_date': payload.target_date || today,
        ':acc_id': payload.account_id ? String(payload.account_id) : null,
        ':acc_name': payload.account_name || null,
        ':icon': payload.icon || '🎯',
        ':color': payload.color !== undefined ? payload.color : 4,
        ':notes': payload.notes || null,
        ':status': payload.status || 'in_progress',
      }
    );

    await this.persist();
    const goals = await this.getGoals();
    return goals.find((g) => g.id === id) || (payload as FinancialGoal);
  }

  async updateGoal(id: string | number, payload: Partial<FinancialGoal>): Promise<FinancialGoal> {
    if (!this.db) await this.init();
    if (!this.db) throw new Error('Database not initialized');

    const existing = this.db.exec(`SELECT * FROM goals WHERE id = :id;`, { ':id': String(id) });
    if (!existing || existing.length === 0 || !existing[0].values?.length) {
      throw new Error(`Goal ${id} not found`);
    }
    const current = this.mapGoalRow(existing[0].values[0]);

    this.db.run(
      `UPDATE goals SET
         name = :name, target_amount = :target, current_amount = :current,
         start_date = :start, target_date = :target_date,
         account_id = :acc_id, account_name = :acc_name,
         icon = :icon, color = :color, notes = :notes, status = :status
       WHERE id = :id;`,
      {
        ':id': String(id),
        ':name': payload.name !== undefined ? payload.name : current.name,
        ':target': payload.target_amount !== undefined ? Number(payload.target_amount) : current.target_amount,
        ':current': payload.current_amount !== undefined ? Number(payload.current_amount) : current.current_amount,
        ':start': payload.start_date !== undefined ? payload.start_date : current.start_date,
        ':target_date': payload.target_date !== undefined ? payload.target_date : current.target_date,
        ':acc_id':
          payload.account_id !== undefined
            ? payload.account_id
              ? String(payload.account_id)
              : null
            : current.account_id
              ? String(current.account_id)
              : null,
        ':acc_name':
          payload.account_name !== undefined ? payload.account_name : current.account_name || null,
        ':icon': payload.icon !== undefined ? payload.icon : current.icon,
        ':color': payload.color !== undefined ? payload.color : current.color ?? 4,
        ':notes': payload.notes !== undefined ? payload.notes : current.notes || null,
        ':status': payload.status !== undefined ? payload.status : current.status,
      }
    );

    await this.persist();
    const goals = await this.getGoals();
    return goals.find((g) => g.id === String(id)) || current;
  }

  async deleteGoal(id: string | number): Promise<boolean> {
    if (!this.db) await this.init();
    if (!this.db) return false;

    this.db.run(`DELETE FROM goals WHERE id = :id;`, { ':id': String(id) });
    await this.persist();
    return true;
  }

  /**
   * Deposits into or withdraws from a goal's saved balance. Withdrawal clamps
   * at zero; a non-positive amount is rejected, matching
   * `goal.py::MonetaGoalFundWizard.action_apply`.
   */
  async fundGoal(
    id: string | number,
    amount: number,
    actionType: 'deposit' | 'withdraw'
  ): Promise<FinancialGoal> {
    if (!this.db) await this.init();
    if (!this.db) throw new Error('Database not initialized');

    const amt = Number(amount) || 0;
    if (amt <= 0) throw new Error('Please specify an amount greater than 0.');

    const existing = this.db.exec(`SELECT current_amount FROM goals WHERE id = :id;`, {
      ':id': String(id),
    });
    if (!existing || existing.length === 0 || !existing[0].values?.length) {
      throw new Error(`Goal ${id} not found`);
    }
    const currentAmount = Number(existing[0].values[0][0]) || 0;
    const nextAmount = actionType === 'withdraw' ? Math.max(currentAmount - amt, 0) : currentAmount + amt;

    this.db.run(`UPDATE goals SET current_amount = :amt WHERE id = :id;`, {
      ':id': String(id),
      ':amt': nextAmount,
    });
    await this.persist();

    const goals = await this.getGoals();
    return goals.find((g) => g.id === String(id)) || ({} as FinancialGoal);
  }

  /**
   * Phase 4: Stock Portfolio & Tax-Lot Accounting Methods
   */

  async getPortfolioHoldings(accountId?: string | number): Promise<PortfolioHolding[]> {
    await this.init();
    if (!this.db) return [];

    let query = `
      SELECT
        h.id,
        h.account_id,
        COALESCE(a.name, 'Brokerage Account') as account_name,
        h.security_id,
        h.symbol,
        COALESCE(s.name, h.symbol) as name,
        COALESCE(s.security_type, 'stock') as security_type,
        COALESCE(s.currency_code, 'USD') as currency,
        h.quantity,
        h.average_cost,
        COALESCE(s.current_price, h.average_cost) as current_price,
        s.last_quote_date
      FROM holdings h
      LEFT JOIN securities s ON h.security_id = s.id OR h.symbol = s.symbol
      LEFT JOIN accounts a ON h.account_id = a.id
    `;
    const params: Record<string, any> = {};
    if (accountId) {
      query += ` WHERE h.account_id = :acc`;
      params[':acc'] = String(accountId);
    }
    query += ` ORDER BY h.symbol ASC;`;

    const res = this.db.exec(query, params);
    if (!res.length || !res[0].values) return [];

    const rawHoldings = res[0].values.map((row) => {
      const qty = Number(row[8]) || 0;
      const avgCost = Number(row[9]) || 0;
      const curPrice = Number(row[10]) || avgCost;
      const costBasis = Math.round(qty * avgCost * 100) / 100;
      const mktVal = Math.round(qty * curPrice * 100) / 100;
      const unrealized = Math.round((mktVal - costBasis) * 100) / 100;
      const unrealizedPct = costBasis > 0 ? Math.round(((mktVal - costBasis) / costBasis) * 10000) / 100 : 0.0;

      return {
        id: String(row[0]),
        account_id: String(row[1]),
        account_name: String(row[2]),
        security_id: String(row[3]),
        symbol: String(row[4]),
        name: String(row[5]),
        security_type: (row[6] as any) || 'stock',
        currency: String(row[7]),
        total_quantity: qty,
        average_cost: avgCost,
        current_price: curPrice,
        total_cost_basis: costBasis,
        current_market_value: mktVal,
        unrealized_gain: unrealized,
        unrealized_gain_percent: unrealizedPct,
        weight_in_portfolio: 0,
        last_quote_date: row[11] ? String(row[11]) : undefined,
      };
    });

    const totalVal = rawHoldings.reduce((sum, h) => sum + h.current_market_value, 0);
    return rawHoldings.map((h) => ({
      ...h,
      weight_in_portfolio: totalVal > 0 ? Math.round((h.current_market_value / totalVal) * 1000) / 10 : 0,
    }));
  }

  async getTaxLots(symbol?: string, accountId?: string | number, state?: string): Promise<TaxLot[]> {
    await this.init();
    if (!this.db) return [];

    let query = `
      SELECT
        l.id,
        l.account_id,
        COALESCE(a.name, 'Brokerage Account') as account_name,
        l.security_id,
        l.symbol,
        l.purchase_date,
        l.initial_quantity,
        l.remaining_quantity,
        l.purchase_price,
        l.commission_paid,
        l.state,
        COALESCE(s.current_price, l.purchase_price) as current_price
      FROM security_lots l
      LEFT JOIN securities s ON l.security_id = s.id OR l.symbol = s.symbol
      LEFT JOIN accounts a ON l.account_id = a.id
      WHERE 1=1
    `;
    const params: Record<string, any> = {};
    if (symbol) {
      query += ` AND LOWER(l.symbol) = LOWER(:sym)`;
      params[':sym'] = symbol.trim().toLowerCase();
    }
    if (accountId) {
      query += ` AND l.account_id = :acc`;
      params[':acc'] = String(accountId);
    }
    if (state) {
      query += ` AND l.state = :st`;
      params[':st'] = state;
    }
    query += ` ORDER BY l.purchase_date ASC, l.id ASC;`;

    const res = this.db.exec(query, params);
    if (!res.length || !res[0].values) return [];

    const todayStr = new Date().toISOString().split('T')[0];

    return res[0].values.map((row) => {
      const curPrice = Number(row[11]) || Number(row[8]) || 0;
      const rawLot: Partial<TaxLot> = {
        id: String(row[0]),
        account_id: String(row[1]),
        account_name: String(row[2]),
        symbol: String(row[4]),
        purchase_date: String(row[5]),
        initial_quantity: Number(row[6]) || 0,
        remaining_quantity: Number(row[7]) || 0,
        purchase_price: Number(row[8]) || 0,
        commission_paid: Number(row[9]) || 0,
        state: (row[10] as any) || 'open',
      };
      return computeLotMetrics(rawLot, curPrice, todayStr) as TaxLot;
    });
  }

  async getTaxLotDisposals(year?: number): Promise<TaxLotDisposal[]> {
    await this.init();
    if (!this.db) return [];

    let query = `
      SELECT
        id, lot_id, account_id, symbol, disposal_date,
        quantity_sold, cost_basis_sold, proceeds, realized_gain, term_type, disposal_strategy
      FROM lot_disposals
    `;
    const params: Record<string, any> = {};
    if (year) {
      query += ` WHERE disposal_date >= :yStart AND disposal_date <= :yEnd`;
      params[':yStart'] = `${year}-01-01`;
      params[':yEnd'] = `${year}-12-31`;
    }
    query += ` ORDER BY disposal_date DESC, id DESC;`;

    const res = this.db.exec(query, params);
    if (!res.length || !res[0].values) return [];

    return res[0].values.map((r) => ({
      id: String(r[0]),
      lot_id: String(r[1]),
      account_id: String(r[2]),
      symbol: String(r[3]),
      disposal_date: String(r[4]),
      quantity_sold: Number(r[5]) || 0,
      cost_basis_sold: Number(r[6]) || 0,
      proceeds: Number(r[7]) || 0,
      realized_gain: Number(r[8]) || 0,
      term_type: (r[9] as any) || 'short_term',
      disposal_strategy: (r[10] as any) || 'FIFO',
    }));
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
    await this.init();
    if (!this.db) return { success: false };

    const symbol = payload.symbol.trim().toUpperCase();
    const accId = String(payload.accountId);
    const qty = Math.abs(Number(payload.quantity) || 0);
    const price = Math.abs(Number(payload.price) || 0);
    const tradeDate = payload.tradeDate || new Date().toISOString().split('T')[0];
    const commission = Math.abs(Number(payload.commission) || 0);

    const secRes = this.db.exec(`SELECT id FROM securities WHERE symbol = :sym;`, { ':sym': symbol });
    let secId = secRes[0]?.values[0]?.[0] as string | undefined;
    if (!secId) {
      secId = `sec-${symbol.toLowerCase()}`;
      this.db.run(`
        INSERT INTO securities (id, symbol, name, security_type, currency_code, current_price, last_quote_date)
        VALUES (:id, :sym, :name, 'stock', 'USD', :price, :dt);
      `, {
        ':id': secId,
        ':sym': symbol,
        ':name': symbol,
        ':price': price,
        ':dt': tradeDate,
      });
    } else {
      this.db.run(`UPDATE securities SET current_price = :price, last_quote_date = :dt WHERE id = :id;`, {
        ':price': price,
        ':dt': tradeDate,
        ':id': secId,
      });
    }

    if (payload.action === 'buy') {
      const lotId = `lot-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      this.db.run(`
        INSERT INTO security_lots (id, account_id, security_id, symbol, purchase_date, initial_quantity, remaining_quantity, purchase_price, commission_paid, state)
        VALUES (:id, :acc, :sec, :sym, :date, :qty, :qty, :price, :comm, 'open');
      `, {
        ':id': lotId,
        ':acc': accId,
        ':sec': secId,
        ':sym': symbol,
        ':date': tradeDate,
        ':qty': qty,
        ':price': price,
        ':comm': commission,
      });

      const hldRes = this.db.exec(`SELECT quantity, average_cost FROM holdings WHERE account_id = :acc AND symbol = :sym;`, {
        ':acc': accId,
        ':sym': symbol,
      });

      if (hldRes.length && hldRes[0].values?.length) {
        const curQty = Number(hldRes[0].values[0][0]) || 0;
        const curAvg = Number(hldRes[0].values[0][1]) || 0;
        const newQty = curQty + qty;
        const newAvg = newQty > 0 ? ((curQty * curAvg) + (qty * price)) / newQty : price;
        this.db.run(`
          UPDATE holdings SET quantity = :qty, average_cost = :avg, updated_at = CURRENT_TIMESTAMP
          WHERE account_id = :acc AND symbol = :sym;
        `, {
          ':qty': newQty,
          ':avg': Math.round(newAvg * 10000) / 10000,
          ':acc': accId,
          ':sym': symbol,
        });
      } else {
        const hldId = `hld-${accId}-${symbol.toLowerCase()}`;
        this.db.run(`
          INSERT INTO holdings (id, account_id, security_id, symbol, quantity, average_cost)
          VALUES (:id, :acc, :sec, :sym, :qty, :avg);
        `, {
          ':id': hldId,
          ':acc': accId,
          ':sec': secId,
          ':sym': symbol,
          ':qty': qty,
          ':avg': price,
        });
      }
    } else {
      const openLots = await this.getTaxLots(symbol, accId, 'open');
      const selectedIds = payload.selectedLotId ? [payload.selectedLotId] : undefined;
      const { disposals, updatedLots } = disposeTaxLots(
        openLots,
        qty,
        price,
        tradeDate,
        payload.strategy || 'FIFO',
        selectedIds
      );

      for (const ul of updatedLots) {
        this.db.run(`
          UPDATE security_lots SET remaining_quantity = :rem, state = :st WHERE id = :id;
        `, {
          ':rem': ul.remaining_quantity,
          ':st': ul.state,
          ':id': ul.id,
        });
      }

      for (const d of disposals) {
        this.db.run(`
          INSERT INTO lot_disposals (id, lot_id, account_id, symbol, disposal_date, quantity_sold, cost_basis_sold, proceeds, realized_gain, term_type, disposal_strategy)
          VALUES (:id, :lot_id, :acc, :sym, :date, :qty, :cost, :proc, :gain, :term, :strat);
        `, {
          ':id': d.id,
          ':lot_id': d.lot_id,
          ':acc': d.account_id,
          ':sym': d.symbol,
          ':date': d.disposal_date,
          ':qty': d.quantity_sold,
          ':cost': d.cost_basis_sold,
          ':proc': d.proceeds,
          ':gain': d.realized_gain,
          ':term': d.term_type,
          ':strat': d.disposal_strategy,
        });
      }

      const hldRes = this.db.exec(`SELECT quantity FROM holdings WHERE account_id = :acc AND symbol = :sym;`, {
        ':acc': accId,
        ':sym': symbol,
      });
      if (hldRes.length && hldRes[0].values?.length) {
        const curQty = Number(hldRes[0].values[0][0]) || 0;
        const newQty = Math.max(0, curQty - qty);
        this.db.run(`UPDATE holdings SET quantity = :qty, updated_at = CURRENT_TIMESTAMP WHERE account_id = :acc AND symbol = :sym;`, {
          ':qty': newQty,
          ':acc': accId,
          ':sym': symbol,
        });
      }
    }

    await this.persist();
    return { success: true };
  }

  async getPortfolioSummary(accountId?: string | number): Promise<PortfolioSummary> {
    const holdings = await this.getPortfolioHoldings(accountId);
    const totVal = holdings.reduce((sum, h) => sum + h.current_market_value, 0);
    const totCost = holdings.reduce((sum, h) => sum + h.total_cost_basis, 0);
    const totUnrealized = Math.round((totVal - totCost) * 100) / 100;
    const totUnrealizedPct = totCost > 0 ? Math.round(((totVal - totCost) / totCost) * 10000) / 100 : 0.0;

    const currentYear = new Date().getFullYear();
    const disposals = await this.getTaxLotDisposals(currentYear);
    const totRealizedYtd = Math.round(disposals.reduce((sum, d) => sum + d.realized_gain, 0) * 100) / 100;

    const openLots = await this.getTaxLots(undefined, accountId, 'open');

    const assetMap: Record<string, number> = {};
    for (const h of holdings) {
      const secType = h.security_type || 'stock';
      assetMap[secType] = (assetMap[secType] || 0) + h.current_market_value;
    }

    const colorMap: Record<string, string> = {
      stock: '#10b981',
      etf: '#3b82f6',
      crypto: '#f59e0b',
      mutual_fund: '#8b5cf6',
      bond: '#06b6d4',
    };

    const allocation = Object.entries(assetMap).map(([type, val]) => ({
      category: type === 'stock' ? 'Equities' : type.toUpperCase(),
      value: Math.round(val * 100) / 100,
      percentage: totVal > 0 ? Math.round((val / totVal) * 1000) / 10 : 0,
      color: colorMap[type] || '#71717a',
    }));

    const cashflows: Array<{ date: string; amount: number }> = [];
    for (const lot of openLots) {
      cashflows.push({ date: lot.purchase_date, amount: lot.total_cost_basis });
    }
    for (const d of disposals) {
      cashflows.push({ date: d.disposal_date, amount: -d.proceeds });
    }

    const twr = computeModifiedDietz(cashflows, totVal);
    const xirrCfs = [
      ...cashflows.map((c) => ({ date: c.date, amount: -c.amount })),
      { date: new Date().toISOString().split('T')[0], amount: totVal },
    ];
    const xirr = computeXIRR(xirrCfs);

    return {
      total_portfolio_value: Math.round(totVal * 100) / 100,
      total_cost_basis: Math.round(totCost * 100) / 100,
      total_unrealized_gain: totUnrealized,
      total_unrealized_gain_percent: totUnrealizedPct,
      total_realized_gain_ytd: totRealizedYtd,
      holdings_count: holdings.length,
      open_lots_count: openLots.length,
      time_weighted_return: twr !== null ? Math.round(twr * 10000) / 100 : undefined,
      money_weighted_return: xirr !== null ? Math.round(xirr * 10000) / 100 : undefined,
      asset_allocation: allocation,
    };
  }

  /**
   * Export the SQLite database as a binary Blob for backup or external analysis
   */
  exportDatabaseFile(): Blob | null {
    if (!this.db) return null;
    const data = this.db.export();
    return new Blob([data as unknown as BlobPart], { type: 'application/x-sqlite3' });
  }
}
