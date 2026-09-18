import type { IMonetaRepository } from './repository';
import type {
  MonetaAccount,
  MonetaTransaction,
  DashboardMetrics,
  ReconcileState,
  EnvelopeBudget,
  OdooSettingsPayload,
} from '../types/moneta';
import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js';
import { DEFAULT_RULES } from './rulesEngine';

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

    // Always purge any leftover placeholder demo accounts (Brokerage Equity Portfolio, etc.)
    this.db.run(`
      DELETE FROM transaction_splits WHERE transaction_id IN (SELECT id FROM transactions WHERE account_id LIKE 'sq-acc-%');
      DELETE FROM transactions WHERE account_id LIKE 'sq-acc-%' OR id LIKE 'sq-tx-%';
      DELETE FROM accounts WHERE id LIKE 'sq-acc-%';
    `);
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
   * Export the SQLite database as a binary Blob for backup or external analysis
   */
  exportDatabaseFile(): Blob | null {
    if (!this.db) return null;
    const data = this.db.export();
    return new Blob([data as unknown as BlobPart], { type: 'application/x-sqlite3' });
  }
}
