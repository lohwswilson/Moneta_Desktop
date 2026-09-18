import type { IMonetaRepository } from './repository';
import type {
  MonetaAccount,
  MonetaTransaction,
  DashboardMetrics,
  ReconcileState,
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

    // Check if empty, seed default accounts if brand new
    const res = this.db.exec('SELECT COUNT(*) as count FROM accounts;');
    const count = res[0]?.values[0]?.[0] as number;
    if (count === 0) {
      this.seedDefaultAccounts();
    }
  }

  private seedDefaultAccounts() {
    if (!this.db) return;

    this.db.run(`
      INSERT INTO accounts (id, name, account_type, institution_name, account_number_mask, currency_code, current_balance, cleared_balance)
      VALUES 
        ('sq-acc-1', 'Main Checking (Local)', 'checking', 'DBS Bank', '••••1234', 'SGD', 12500.0, 12500.0),
        ('sq-acc-2', 'High-Yield Savings', 'savings', 'OCBC Bank', '••••5678', 'SGD', 35000.0, 35000.0),
        ('sq-acc-3', 'Brokerage Equity Portfolio', 'brokerage', 'IBKR', '••••U109', 'USD', 85000.0, 85000.0),
        ('sq-acc-4', 'Everyday Rewards Card', 'credit', 'StanChart', '••••9921', 'SGD', -1450.0, -1450.0);

      INSERT INTO transactions (id, account_id, date, payee_name, category_name, amount, transaction_type, reconciliation_state, running_balance, memo)
      VALUES
        ('sq-tx-1', 'sq-acc-1', date('now', '-1 day'), 'FairPrice Supermarket', 'Split', -85.50, 'expense', 'cleared', 12500.0, 'Weekly household groceries'),
        ('sq-tx-2', 'sq-acc-1', date('now', '-3 day'), 'Salary Payroll Transfer', 'Income & Salary', 6500.00, 'income', 'reconciled', 12585.5, 'Monthly salary deposit'),
        ('sq-tx-3', 'sq-acc-1', date('now', '-5 day'), 'SP Utilities Services', 'Utilities', -145.20, 'expense', 'unreconciled', 6085.5, 'Water and power bill');

      INSERT INTO transaction_splits (id, transaction_id, category_name, amount, memo)
      VALUES
        ('sp-1', 'sq-tx-1', 'Groceries', -65.50, 'Food & pantry essentials'),
        ('sp-2', 'sq-tx-1', 'Household Supplies', -20.00, 'Detergent and paper towels');
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

  async getDashboardSummary(): Promise<DashboardMetrics> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    const accounts = await this.getAccounts();

    const liquidCash = accounts
      .filter((a) => ['checking', 'chequing', 'savings', 'cash', 'cpf_oa', 'cpf_sa', 'cpf_ma', 'cpf_ra', 'srs', 'epf_akaun_persaraan', 'epf_akaun_sejahtera', 'epf_akaun_fleksibel'].includes(a.account_type))
      .reduce((sum, a) => sum + a.current_balance, 0);

    const investments = accounts
      .filter((a) => ['brokerage', 'retirement', 'crypto'].includes(a.account_type))
      .reduce((sum, a) => sum + a.current_balance, 0);

    const tangibleAssets = accounts
      .filter((a) => ['asset', 'property', 'other'].includes(a.account_type))
      .reduce((sum, a) => sum + a.current_balance, 0);

    const liabilities = accounts
      .filter((a) => ['credit', 'credit_card', 'loc', 'loan', 'mortgage'].includes(a.account_type))
      .reduce((sum, a) => sum + Math.abs(a.current_balance), 0);

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
   * Export the SQLite database as a binary Blob for backup or external analysis
   */
  exportDatabaseFile(): Blob | null {
    if (!this.db) return null;
    const data = this.db.export();
    return new Blob([data as unknown as BlobPart], { type: 'application/x-sqlite3' });
  }
}
