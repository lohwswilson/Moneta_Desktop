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
  PropertyAsset,
  PropertyTenant,
  RentPayment,
  LoanScenario,
  LoanRateChange,
  PropertyValuation,
  SyncChange,
  SyncOp,
} from '../types/moneta';
import type { VerifyBalanceResult } from './repository';
import { buildSyncSchemaDDL, SYNC_NOW_EXPR } from './syncSchema';
import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js';
import { DEFAULT_RULES } from './rulesEngine';
import { computeGoalMetrics, toDateOnlyString, todayDateOnly } from './goalMath';
import { computeLotMetrics, disposeTaxLots, computeModifiedDietz, computeXIRR } from './portfolioMath';
import {
  computePropertyMetrics,
  computeLeaseStatus,
  computeBalanceDue,
  computeRentPaymentStatus,
  computeRentTotals,
  generateRentSchedule,
} from './propertyMath';
import { simulatePrepayment, detectRateChanges, resolveTermMonths } from './loanMath';
import type { RateObservation } from './loanMath';

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

      CREATE TABLE IF NOT EXISTS properties (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        asset_category TEXT,
        property_type TEXT,
        purchase_date TEXT,
        purchase_price REAL,
        current_market_value REAL DEFAULT 0,
        mortgage_account_id TEXT,
        mortgage_account_name TEXT,
        color INTEGER,
        notes TEXT,
        vehicle_make TEXT,
        vehicle_model TEXT,
        vehicle_year INTEGER,
        vehicle_vin TEXT,
        vehicle_license_plate TEXT,
        vehicle_mileage INTEGER,
        antique_era TEXT,
        maker_artist TEXT,
        condition_grade TEXT,
        insured_value REAL,
        insurance_policy_number TEXT,
        storage_location TEXT,
        monthly_rental_income REAL,
        monthly_property_tax REAL,
        monthly_insurance REAL,
        monthly_hoa_maintenance REAL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS property_valuations (
        id TEXT PRIMARY KEY,
        property_id TEXT NOT NULL,
        valuation_date TEXT NOT NULL,
        appraised_value REAL NOT NULL,
        appraiser TEXT,
        notes TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS tenants (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        property_id TEXT NOT NULL,
        unit_number TEXT,
        email TEXT,
        phone TEXT,
        emergency_contact TEXT,
        lease_start_date TEXT NOT NULL,
        lease_end_date TEXT NOT NULL,
        monthly_rent_amount REAL NOT NULL,
        rent_due_day INTEGER DEFAULT 1,
        security_deposit_held REAL DEFAULT 0,
        security_deposit_refunded REAL DEFAULT 0,
        deposit_status TEXT DEFAULT 'held',
        notes TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS rent_payments (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        property_id TEXT,
        period_month TEXT NOT NULL,
        due_date TEXT NOT NULL,
        amount_due REAL NOT NULL,
        amount_paid REAL DEFAULT 0,
        paid_date TEXT,
        payment_status TEXT DEFAULT 'pending',
        memo TEXT,
        notes TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS loan_scenarios (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        account_id TEXT,
        account_name TEXT,
        principal_amount REAL NOT NULL,
        annual_interest_rate REAL NOT NULL,
        loan_term_years INTEGER,
        loan_term_months INTEGER,
        start_date TEXT NOT NULL,
        extra_monthly_payment REAL DEFAULT 0,
        lump_sum_payment REAL DEFAULT 0,
        lump_sum_date TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS loan_rate_changes (
        id TEXT PRIMARY KEY,
        scenario_id TEXT NOT NULL,
        effective_date TEXT NOT NULL,
        annual_rate REAL NOT NULL,
        note TEXT
      );
    `);

    // Change tracking is attached at the END of this method, after seeding —
    // see the note there for why the order matters.

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

    // ---------------------------------------------------------------------
    // Change tracking — attached AFTER seeding, deliberately.
    //
    // The triggers record every write, and seeding runs on every fresh
    // install. Creating them before the seed block queued ~48 default rows
    // (categorization rules, budgets, bills, demo securities) as pending
    // changes, which a first sync would then push to the server as though the
    // user had entered them. Attaching the triggers afterwards leaves seeded
    // defaults as plain local state.
    //
    // Defined in syncSchema.ts — triggers rather than application-level
    // logging, so deletes are captured and no write path can forget to record
    // itself. See that file for the reasoning.
    // ---------------------------------------------------------------------
    this.db.run(buildSyncSchemaDDL());

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

  async createAccount(payload: Partial<MonetaAccount>): Promise<MonetaAccount> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    const id = payload.id ? String(payload.id) : `acc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const name = payload.name || 'New Account';
    const accountType = payload.account_type || 'checking';
    const instName = payload.institution_name || null;
    const mask = payload.account_number_mask || null;
    const curr = payload.currency_code || 'SGD';
    const initialBalance = Number(payload.current_balance || 0.0);
    const clearedBal = Number(payload.cleared_balance || initialBalance);
    const reconciledBal = Number(payload.reconciled_balance || 0.0);
    const interestRate = payload.interest_rate !== undefined ? Number(payload.interest_rate) : null;
    const monthlyPayment = payload.monthly_payment !== undefined ? Number(payload.monthly_payment) : null;
    const creditLimit = payload.credit_limit !== undefined ? Number(payload.credit_limit) : null;
    const active = payload.active !== undefined ? (payload.active ? 1 : 0) : 1;

    this.db.run(
      `INSERT INTO accounts (id, name, account_type, institution_name, account_number_mask, currency_code,
                             current_balance, cleared_balance, reconciled_balance, interest_rate, monthly_payment, credit_limit, active)
       VALUES (:id, :name, :type, :inst, :mask, :curr, :curBal, :clrBal, :recBal, :rate, :pmt, :limit, :act);`,
      {
        ':id': id,
        ':name': name,
        ':type': accountType,
        ':inst': instName,
        ':mask': mask,
        ':curr': curr,
        ':curBal': initialBalance,
        ':clrBal': clearedBal,
        ':recBal': reconciledBal,
        ':rate': interestRate,
        ':pmt': monthlyPayment,
        ':limit': creditLimit,
        ':act': active,
      }
    );

    // If initial balance is non-zero, create an opening balance transaction
    if (initialBalance !== 0) {
      const today = new Date().toISOString().split('T')[0];
      const txId = `tx-init-${id}`;
      const isPositive = initialBalance > 0;
      this.db.run(
        `INSERT INTO transactions (id, account_id, date, payee_name, category_name, amount, transaction_type, reconciliation_state, running_balance, memo)
         VALUES (:id, :accId, :date, :payee, :cat, :amt, :txType, 'cleared', :bal, :memo);`,
        {
          ':id': txId,
          ':accId': id,
          ':date': today,
          ':payee': 'Opening Balance',
          ':cat': isPositive ? 'Income' : 'Other Expense',
          ':amt': initialBalance,
          ':txType': isPositive ? 'income' : 'expense',
          ':bal': initialBalance,
          ':memo': 'Starting Account Balance',
        }
      );
    }

    await this.persist();

    return {
      id,
      name,
      account_type: accountType,
      institution_name: instName || undefined,
      account_number_mask: mask || undefined,
      currency_code: curr,
      current_balance: initialBalance,
      cleared_balance: clearedBal,
      reconciled_balance: reconciledBal,
      interest_rate: interestRate !== null ? interestRate : undefined,
      monthly_payment: monthlyPayment !== null ? monthlyPayment : undefined,
      credit_limit: creditLimit !== null ? creditLimit : undefined,
      active: Boolean(active),
    };
  }

  async updateAccount(
    id: string | number,
    payload: Partial<MonetaAccount>
  ): Promise<MonetaAccount> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    const accIdStr = String(id);
    const existing = this.db.exec(`SELECT id, name, account_type, institution_name, account_number_mask, currency_code, current_balance, cleared_balance, reconciled_balance, interest_rate, monthly_payment, credit_limit, active FROM accounts WHERE id = '${accIdStr}';`);
    if (!existing || existing.length === 0 || existing[0].values.length === 0) {
      throw new Error(`Account ${id} not found`);
    }

    const row = existing[0].values[0];
    const targetName = payload.name !== undefined ? payload.name : String(row[1]);
    const targetType = payload.account_type !== undefined ? payload.account_type : (row[2] as any);
    const targetInst = payload.institution_name !== undefined ? payload.institution_name : (row[3] as string);
    const targetMask = payload.account_number_mask !== undefined ? payload.account_number_mask : (row[4] as string);
    const targetCurr = payload.currency_code !== undefined ? payload.currency_code : String(row[5]);
    const targetCurBal = payload.current_balance !== undefined ? Number(payload.current_balance) : Number(row[6]);
    const targetClrBal = payload.cleared_balance !== undefined ? Number(payload.cleared_balance) : Number(row[7]);
    const targetRecBal = payload.reconciled_balance !== undefined ? Number(payload.reconciled_balance) : Number(row[8]);
    const targetRate = payload.interest_rate !== undefined ? Number(payload.interest_rate) : (row[9] !== null ? Number(row[9]) : null);
    const targetPmt = payload.monthly_payment !== undefined ? Number(payload.monthly_payment) : (row[10] !== null ? Number(row[10]) : null);
    const targetLimit = payload.credit_limit !== undefined ? Number(payload.credit_limit) : (row[11] !== null ? Number(row[11]) : null);
    const targetActive = payload.active !== undefined ? (payload.active ? 1 : 0) : Number(row[12]);

    this.db.run(
      `UPDATE accounts
       SET name = :name, account_type = :type, institution_name = :inst, account_number_mask = :mask,
           currency_code = :curr, current_balance = :curBal, cleared_balance = :clrBal, reconciled_balance = :recBal,
           interest_rate = :rate, monthly_payment = :pmt, credit_limit = :limit, active = :act
       WHERE id = :id;`,
      {
        ':id': accIdStr,
        ':name': targetName,
        ':type': targetType,
        ':inst': targetInst,
        ':mask': targetMask,
        ':curr': targetCurr,
        ':curBal': targetCurBal,
        ':clrBal': targetClrBal,
        ':recBal': targetRecBal,
        ':rate': targetRate,
        ':pmt': targetPmt,
        ':limit': targetLimit,
        ':act': targetActive,
      }
    );

    await this.persist();

    return {
      id: accIdStr,
      name: targetName,
      account_type: targetType,
      institution_name: targetInst || undefined,
      account_number_mask: targetMask || undefined,
      currency_code: targetCurr,
      current_balance: targetCurBal,
      cleared_balance: targetClrBal,
      reconciled_balance: targetRecBal,
      interest_rate: targetRate !== null ? targetRate : undefined,
      monthly_payment: targetPmt !== null ? targetPmt : undefined,
      credit_limit: targetLimit !== null ? targetLimit : undefined,
      active: Boolean(targetActive),
    };
  }

  async deleteAccount(id: string | number): Promise<boolean> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    const accIdStr = String(id);
    this.db.run(`UPDATE accounts SET active = 0 WHERE id = :id;`, { ':id': accIdStr });
    await this.persist();
    return true;
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

  async verifyAndReconcileAccount(
    accountId: string | number,
    confirmedBalance: number,
    adjustmentAmount?: number
  ): Promise<VerifyBalanceResult> {
    await this.init();
    if (!this.db) return { success: false, reconciledCount: 0, clearedBalance: 0 };

    let adjustmentTx: MonetaTransaction | undefined;

    // 1. If an adjustment amount is needed, create an adjustment transaction
    if (adjustmentAmount && Math.abs(adjustmentAmount) >= 0.01) {
      adjustmentTx = await this.createTransaction({
        account_id: accountId,
        date: new Date().toISOString().split('T')[0],
        payee_name: 'Reconciliation Balance Adjustment',
        category_name: 'Adjustment',
        memo: 'Automatic balance adjustment to match bank statement',
        amount: Number(adjustmentAmount),
        reconciliation_state: 'reconciled',
      });
    }

    // 2. Count and promote all 'cleared' transactions for this account to 'reconciled'
    const countRes = this.db.exec(
      `SELECT COUNT(*) FROM transactions WHERE account_id = '${accountId}' AND reconciliation_state = 'cleared';`
    );
    const count = (countRes[0]?.values[0]?.[0] as number) || 0;

    this.db.run(
      `UPDATE transactions SET reconciliation_state = 'reconciled' WHERE account_id = :accId AND reconciliation_state = 'cleared';`,
      { ':accId': String(accountId) }
    );

    // 3. Recompute cleared, reconciled and total balance for account
    const balRes = this.db.exec(
      `SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE account_id = '${accountId}' AND reconciliation_state IN ('cleared', 'reconciled');`
    );
    const clearedBalance = (balRes[0]?.values[0]?.[0] as number) || 0;

    const recRes = this.db.exec(
      `SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE account_id = '${accountId}' AND reconciliation_state = 'reconciled';`
    );
    const reconciledBalance = (recRes[0]?.values[0]?.[0] as number) || 0;

    const totRes = this.db.exec(
      `SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE account_id = '${accountId}';`
    );
    const currentBalance = (totRes[0]?.values[0]?.[0] as number) || 0;

    this.db.run(
      `UPDATE accounts SET cleared_balance = :clearedBal, current_balance = :currentBal, reconciled_balance = :recBal WHERE id = :accId;`,
      { ':clearedBal': clearedBalance, ':currentBal': currentBalance, ':recBal': reconciledBalance, ':accId': String(accountId) }
    );

    await this.persist();

    return {
      success: true,
      reconciledCount: count + (adjustmentTx ? 1 : 0),
      clearedBalance,
      adjustmentTransaction: adjustmentTx,
    };
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

  async updateTransaction(
    id: string | number,
    payload: Partial<MonetaTransaction>
  ): Promise<MonetaTransaction> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');
    const db = this.db;

    const txIdStr = String(id);
    const existingRes = db.exec(
      `SELECT id, account_id, date, payee_name, category_name, amount, transaction_type, reconciliation_state, running_balance, memo FROM transactions WHERE id = '${txIdStr}';`
    );
    if (!existingRes || existingRes.length === 0 || existingRes[0].values.length === 0) {
      throw new Error(`Transaction ${id} not found`);
    }

    const row = existingRes[0].values[0];
    const oldAccountId = row[1] as string;
    const oldDate = row[2] as string;
    const oldPayee = row[3] as string;
    const oldCategory = row[4] as string;
    const oldAmount = Number(row[5]);
    const oldState = (row[7] as string) || 'unreconciled';
    const oldMemo = (row[9] as string) || '';

    const targetAccountId = payload.account_id !== undefined ? String(payload.account_id) : oldAccountId;
    const targetDate = payload.date !== undefined ? payload.date : oldDate;
    const targetPayee = payload.payee_name !== undefined ? payload.payee_name : oldPayee;
    const targetAmount = payload.amount !== undefined ? Number(payload.amount) : oldAmount;
    const targetCategory = payload.category_name !== undefined
      ? payload.category_name
      : (payload.splits && payload.splits.length > 0 ? 'Split' : oldCategory);
    const targetTxType = targetAmount >= 0 ? 'income' : 'expense';
    const targetState = (payload.reconciliation_state !== undefined ? payload.reconciliation_state : oldState) as ReconcileState;
    const targetMemo = payload.memo !== undefined ? payload.memo : oldMemo;

    // Adjust account current balance
    if (targetAccountId === oldAccountId) {
      const delta = targetAmount - oldAmount;
      if (delta !== 0) {
        db.run(`UPDATE accounts SET current_balance = current_balance + :delta WHERE id = :accId;`, {
          ':delta': delta,
          ':accId': targetAccountId,
        });
      }
    } else {
      db.run(`UPDATE accounts SET current_balance = current_balance - :oldAmt WHERE id = :oldAcc;`, {
        ':oldAmt': oldAmount,
        ':oldAcc': oldAccountId,
      });
      db.run(`UPDATE accounts SET current_balance = current_balance + :newAmt WHERE id = :newAcc;`, {
        ':newAmt': targetAmount,
        ':newAcc': targetAccountId,
      });
    }

    // Update transaction record
    db.run(`
      UPDATE transactions
      SET account_id = :accId,
          date = :date,
          payee_name = :payee,
          category_name = :cat,
          amount = :amt,
          transaction_type = :type,
          reconciliation_state = :state,
          memo = :memo
      WHERE id = :id;
    `, {
      ':id': txIdStr,
      ':accId': targetAccountId,
      ':date': targetDate,
      ':payee': targetPayee,
      ':cat': targetCategory,
      ':amt': targetAmount,
      ':type': targetTxType,
      ':state': targetState,
      ':memo': targetMemo,
    });

    // Handle splits
    if (payload.splits !== undefined) {
      db.run(`DELETE FROM transaction_splits WHERE transaction_id = :txId;`, {
        ':txId': txIdStr,
      });
      if (payload.splits && payload.splits.length > 0) {
        for (const sp of payload.splits) {
          const splitId = sp.id || `sp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
          db.run(`
            INSERT INTO transaction_splits (id, transaction_id, category_name, amount, memo)
            VALUES (:id, :txId, :cat, :amt, :memo);
          `, {
            ':id': splitId,
            ':txId': txIdStr,
            ':cat': sp.category_name,
            ':amt': sp.amount,
            ':memo': sp.memo || '',
          });
        }
      }
    }

    // Recalculate cleared_balance
    const recalcCleared = (accId: string) => {
      const balRes = db.exec(
        `SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE account_id = '${accId}' AND reconciliation_state IN ('cleared', 'reconciled');`
      );
      const clrBal = (balRes[0]?.values[0]?.[0] as number) || 0;
      db.run(`UPDATE accounts SET cleared_balance = :bal WHERE id = :accId;`, {
        ':bal': clrBal,
        ':accId': accId,
      });
    };

    recalcCleared(targetAccountId);
    if (oldAccountId !== targetAccountId) {
      recalcCleared(oldAccountId);
    }

    await this.persist();

    // Fetch splits
    const splitsRes = this.db.exec(
      `SELECT id, category_name, amount, memo FROM transaction_splits WHERE transaction_id = '${txIdStr}';`
    );
    const finalSplits = splitsRes[0]?.values.map((v) => ({
      id: v[0] as string,
      category_name: v[1] as string,
      amount: v[2] as number,
      memo: v[3] as string,
    })) || [];

    // Get current balance of target account
    const curBalRes = this.db.exec(`SELECT current_balance FROM accounts WHERE id = '${targetAccountId}';`);
    const runningBal = (curBalRes[0]?.values[0]?.[0] as number) || 0;

    return {
      id: txIdStr,
      account_id: targetAccountId,
      date: targetDate,
      payee_name: targetPayee,
      category_name: targetCategory,
      amount: targetAmount,
      transaction_type: targetTxType,
      reconciliation_state: targetState,
      running_balance: runningBal,
      memo: targetMemo,
      splits: finalSplits.length > 0 ? finalSplits : undefined,
    };
  }

  async deleteTransaction(id: string | number): Promise<boolean> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');
    const db = this.db;

    const txIdStr = String(id);
    const existingRes = db.exec(
      `SELECT account_id, amount FROM transactions WHERE id = '${txIdStr}';`
    );
    if (!existingRes || existingRes.length === 0 || existingRes[0].values.length === 0) {
      return false;
    }

    const row = existingRes[0].values[0];
    const accountId = row[0] as string;
    const amount = Number(row[1]);

    // Revert account current_balance
    db.run(`UPDATE accounts SET current_balance = current_balance - :amt WHERE id = :accId;`, {
      ':amt': amount,
      ':accId': accountId,
    });

    // Delete splits and transaction
    db.run(`DELETE FROM transaction_splits WHERE transaction_id = :txId;`, { ':txId': txIdStr });
    db.run(`DELETE FROM transactions WHERE id = :txId;`, { ':txId': txIdStr });

    // Recalculate cleared_balance
    const balRes = db.exec(
      `SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE account_id = '${accountId}' AND reconciliation_state IN ('cleared', 'reconciled');`
    );
    const clrBal = (balRes[0]?.values[0]?.[0] as number) || 0;
    db.run(`UPDATE accounts SET cleared_balance = :bal WHERE id = :accId;`, {
      ':bal': clrBal,
      ':accId': accountId,
    });

    await this.persist();
    return true;
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
   * Phase 5: Property, Rental & Loan Scenario Methods
   */

  /**
   * Maps a `properties` row to the persisted field shape. Everything that is
   * derived (equity, rental metrics, valuation history) is attached later by
   * `enrichProperty` through `computePropertyMetrics` — see propertyMath.ts.
   */
  private mapPropertyColumns(row: any[], columns: string[]): PropertyAsset {
    const raw: Record<string, any> = {};
    columns.forEach((col, idx) => (raw[col] = row[idx]));
    return {
      id: String(raw.id ?? ''),
      name: String(raw.name ?? ''),
      asset_category: (raw.asset_category as PropertyAsset['asset_category']) || 'real_estate',
      property_type: (raw.property_type as PropertyAsset['property_type']) || 'other',
      purchase_date: raw.purchase_date ? String(raw.purchase_date) : undefined,
      purchase_price: raw.purchase_price !== null && raw.purchase_price !== undefined ? Number(raw.purchase_price) : undefined,
      current_market_value: Number(raw.current_market_value) || 0,
      mortgage_account_id: raw.mortgage_account_id ? String(raw.mortgage_account_id) : undefined,
      mortgage_account_name: raw.mortgage_account_name ? String(raw.mortgage_account_name) : undefined,
      color: raw.color !== null && raw.color !== undefined ? Number(raw.color) : undefined,
      notes: raw.notes ? String(raw.notes) : undefined,
      vehicle_make: raw.vehicle_make ? String(raw.vehicle_make) : undefined,
      vehicle_model: raw.vehicle_model ? String(raw.vehicle_model) : undefined,
      vehicle_year: raw.vehicle_year !== null && raw.vehicle_year !== undefined ? Number(raw.vehicle_year) : undefined,
      vehicle_vin: raw.vehicle_vin ? String(raw.vehicle_vin) : undefined,
      vehicle_license_plate: raw.vehicle_license_plate ? String(raw.vehicle_license_plate) : undefined,
      vehicle_mileage: raw.vehicle_mileage !== null && raw.vehicle_mileage !== undefined ? Number(raw.vehicle_mileage) : undefined,
      antique_era: raw.antique_era ? String(raw.antique_era) : undefined,
      maker_artist: raw.maker_artist ? String(raw.maker_artist) : undefined,
      condition_grade: raw.condition_grade ? (raw.condition_grade as PropertyAsset['condition_grade']) : undefined,
      insured_value: raw.insured_value !== null && raw.insured_value !== undefined ? Number(raw.insured_value) : undefined,
      insurance_policy_number: raw.insurance_policy_number ? String(raw.insurance_policy_number) : undefined,
      storage_location: raw.storage_location ? String(raw.storage_location) : undefined,
      monthly_rental_income:
        raw.monthly_rental_income !== null && raw.monthly_rental_income !== undefined ? Number(raw.monthly_rental_income) : undefined,
      monthly_property_tax:
        raw.monthly_property_tax !== null && raw.monthly_property_tax !== undefined ? Number(raw.monthly_property_tax) : undefined,
      monthly_insurance:
        raw.monthly_insurance !== null && raw.monthly_insurance !== undefined ? Number(raw.monthly_insurance) : undefined,
      monthly_hoa_maintenance:
        raw.monthly_hoa_maintenance !== null && raw.monthly_hoa_maintenance !== undefined
          ? Number(raw.monthly_hoa_maintenance)
          : undefined,
    } as PropertyAsset;
  }

  /**
   * Attaches every derived figure to a persisted property: the linked mortgage
   * account's balance and payment, the property's active tenants, the metrics
   * from `computePropertyMetrics` and the valuation history.
   */
  private async enrichProperty(persisted: PropertyAsset): Promise<PropertyAsset> {
    if (!this.db) return persisted;

    let mortgageBalance: number | undefined;
    let mortgageMonthlyPayment: number | undefined;
    if (persisted.mortgage_account_id) {
      const accRes = this.db.exec(`SELECT current_balance, monthly_payment FROM accounts WHERE id = :id;`, {
        ':id': String(persisted.mortgage_account_id),
      });
      const acc = accRes[0]?.values?.[0];
      if (acc) {
        mortgageBalance = Number(acc[0]) || 0;
        mortgageMonthlyPayment = Number(acc[1]) || 0;
      }
    }

    // Only tenants with an active lease contribute rent (propertyMath.ts).
    const tenantRes = this.db.exec(
      `SELECT lease_start_date, lease_end_date, monthly_rent_amount FROM tenants WHERE property_id = :id;`,
      { ':id': String(persisted.id) }
    );
    const activeTenants: Array<{ monthly_rent_amount: number }> = [];
    for (const row of tenantRes[0]?.values || []) {
      const start = row[0] ? String(row[0]) : undefined;
      const end = row[1] ? String(row[1]) : undefined;
      if (computeLeaseStatus(start, end) === 'active') {
        activeTenants.push({ monthly_rent_amount: Number(row[2]) || 0 });
      }
    }

    const metrics = computePropertyMetrics({
      current_market_value: persisted.current_market_value,
      mortgageBalance,
      mortgageMonthlyPayment,
      monthly_rental_income: persisted.monthly_rental_income,
      monthly_property_tax: persisted.monthly_property_tax,
      monthly_insurance: persisted.monthly_insurance,
      monthly_hoa_maintenance: persisted.monthly_hoa_maintenance,
      activeTenants,
    });

    const valRes = this.db.exec(
      `SELECT id, property_id, valuation_date, appraised_value, appraiser, notes
       FROM property_valuations WHERE property_id = :id ORDER BY valuation_date DESC;`,
      { ':id': String(persisted.id) }
    );
    const valuation_history: PropertyValuation[] = (valRes[0]?.values || []).map((r) => ({
      id: String(r[0]),
      property_id: String(r[1]),
      valuation_date: String(r[2]),
      appraised_value: Number(r[3]) || 0,
      appraiser: r[4] ? String(r[4]) : undefined,
      notes: r[5] ? String(r[5]) : undefined,
    }));

    return { ...persisted, ...metrics, valuation_history };
  }

  private async fetchProperty(id: string | number): Promise<PropertyAsset | null> {
    if (!this.db) return null;
    const res = this.db.exec(`SELECT * FROM properties WHERE id = :id;`, { ':id': String(id) });
    if (!res || !res[0]?.values?.length) return null;
    return this.enrichProperty(this.mapPropertyColumns(res[0].values[0], res[0].columns));
  }

  async getProperties(): Promise<PropertyAsset[]> {
    if (!this.db) await this.init();
    if (!this.db) return [];

    const res = this.db.exec(`SELECT * FROM properties ORDER BY name ASC;`);
    if (!res || res.length === 0 || !res[0].values) return [];

    return Promise.all(res[0].values.map((row) => this.enrichProperty(this.mapPropertyColumns(row, res[0].columns))));
  }

  async createProperty(payload: Partial<PropertyAsset>): Promise<PropertyAsset> {
    if (!this.db) await this.init();
    if (!this.db) throw new Error('Database not initialized');

    const id = payload.id ? String(payload.id) : `sq-prop-${Date.now()}`;

    this.db.run(
      `INSERT INTO properties (
         id, name, asset_category, property_type, purchase_date, purchase_price, current_market_value,
         mortgage_account_id, mortgage_account_name, color, notes,
         vehicle_make, vehicle_model, vehicle_year, vehicle_vin, vehicle_license_plate, vehicle_mileage,
         antique_era, maker_artist, condition_grade, insured_value, insurance_policy_number, storage_location,
         monthly_rental_income, monthly_property_tax, monthly_insurance, monthly_hoa_maintenance
       ) VALUES (
         :id, :name, :asset_category, :property_type, :purchase_date, :purchase_price, :current_market_value,
         :mortgage_account_id, :mortgage_account_name, :color, :notes,
         :vehicle_make, :vehicle_model, :vehicle_year, :vehicle_vin, :vehicle_license_plate, :vehicle_mileage,
         :antique_era, :maker_artist, :condition_grade, :insured_value, :insurance_policy_number, :storage_location,
         :monthly_rental_income, :monthly_property_tax, :monthly_insurance, :monthly_hoa_maintenance
       );`,
      {
        ':id': id,
        ':name': payload.name || 'New Property',
        ':asset_category': payload.asset_category || 'real_estate',
        ':property_type': payload.property_type || 'other',
        ':purchase_date': payload.purchase_date || null,
        ':purchase_price': payload.purchase_price !== undefined ? Number(payload.purchase_price) : null,
        ':current_market_value': Number(payload.current_market_value || 0),
        ':mortgage_account_id': payload.mortgage_account_id ? String(payload.mortgage_account_id) : null,
        ':mortgage_account_name': payload.mortgage_account_name || null,
        ':color': payload.color !== undefined ? Number(payload.color) : null,
        ':notes': payload.notes || null,
        ':vehicle_make': payload.vehicle_make || null,
        ':vehicle_model': payload.vehicle_model || null,
        ':vehicle_year': payload.vehicle_year !== undefined ? Number(payload.vehicle_year) : null,
        ':vehicle_vin': payload.vehicle_vin || null,
        ':vehicle_license_plate': payload.vehicle_license_plate || null,
        ':vehicle_mileage': payload.vehicle_mileage !== undefined ? Number(payload.vehicle_mileage) : null,
        ':antique_era': payload.antique_era || null,
        ':maker_artist': payload.maker_artist || null,
        ':condition_grade': payload.condition_grade || null,
        ':insured_value': payload.insured_value !== undefined ? Number(payload.insured_value) : null,
        ':insurance_policy_number': payload.insurance_policy_number || null,
        ':storage_location': payload.storage_location || null,
        ':monthly_rental_income': payload.monthly_rental_income !== undefined ? Number(payload.monthly_rental_income) : null,
        ':monthly_property_tax': payload.monthly_property_tax !== undefined ? Number(payload.monthly_property_tax) : null,
        ':monthly_insurance': payload.monthly_insurance !== undefined ? Number(payload.monthly_insurance) : null,
        ':monthly_hoa_maintenance':
          payload.monthly_hoa_maintenance !== undefined ? Number(payload.monthly_hoa_maintenance) : null,
      }
    );

    await this.persist();
    return (await this.fetchProperty(id)) || ({ id, ...payload } as PropertyAsset);
  }

  /**
   * Partial update via the load-merge-write approach, mirroring `updateGoal`.
   */
  async updateProperty(id: string | number, payload: Partial<PropertyAsset>): Promise<PropertyAsset> {
    if (!this.db) await this.init();
    if (!this.db) throw new Error('Database not initialized');

    const existing = this.db.exec(`SELECT * FROM properties WHERE id = :id;`, { ':id': String(id) });
    if (!existing || existing.length === 0 || !existing[0].values?.length) {
      throw new Error(`Property ${id} not found`);
    }
    const current = this.mapPropertyColumns(existing[0].values[0], existing[0].columns);

    this.db.run(
      `UPDATE properties SET
         name = :name, asset_category = :asset_category, property_type = :property_type,
         purchase_date = :purchase_date, purchase_price = :purchase_price,
         current_market_value = :current_market_value,
         mortgage_account_id = :mortgage_account_id, mortgage_account_name = :mortgage_account_name,
         color = :color, notes = :notes,
         vehicle_make = :vehicle_make, vehicle_model = :vehicle_model, vehicle_year = :vehicle_year,
         vehicle_vin = :vehicle_vin, vehicle_license_plate = :vehicle_license_plate,
         vehicle_mileage = :vehicle_mileage,
         antique_era = :antique_era, maker_artist = :maker_artist, condition_grade = :condition_grade,
         insured_value = :insured_value, insurance_policy_number = :insurance_policy_number,
         storage_location = :storage_location,
         monthly_rental_income = :monthly_rental_income, monthly_property_tax = :monthly_property_tax,
         monthly_insurance = :monthly_insurance, monthly_hoa_maintenance = :monthly_hoa_maintenance
       WHERE id = :id;`,
      {
        ':id': String(id),
        ':name': payload.name !== undefined ? payload.name : current.name,
        ':asset_category': payload.asset_category !== undefined ? payload.asset_category : current.asset_category,
        ':property_type': payload.property_type !== undefined ? payload.property_type : current.property_type,
        ':purchase_date':
          payload.purchase_date !== undefined
            ? payload.purchase_date || null
            : current.purchase_date || null,
        ':purchase_price':
          payload.purchase_price !== undefined
            ? payload.purchase_price !== null
              ? Number(payload.purchase_price)
              : null
            : current.purchase_price ?? null,
        ':current_market_value':
          payload.current_market_value !== undefined ? Number(payload.current_market_value) : current.current_market_value,
        ':mortgage_account_id':
          payload.mortgage_account_id !== undefined
            ? payload.mortgage_account_id
              ? String(payload.mortgage_account_id)
              : null
            : current.mortgage_account_id
              ? String(current.mortgage_account_id)
              : null,
        ':mortgage_account_name':
          payload.mortgage_account_name !== undefined
            ? payload.mortgage_account_name || null
            : current.mortgage_account_name || null,
        ':color': payload.color !== undefined ? payload.color : current.color ?? null,
        ':notes': payload.notes !== undefined ? payload.notes || null : current.notes || null,
        ':vehicle_make': payload.vehicle_make !== undefined ? payload.vehicle_make || null : current.vehicle_make || null,
        ':vehicle_model': payload.vehicle_model !== undefined ? payload.vehicle_model || null : current.vehicle_model || null,
        ':vehicle_year': payload.vehicle_year !== undefined ? payload.vehicle_year ?? null : current.vehicle_year ?? null,
        ':vehicle_vin': payload.vehicle_vin !== undefined ? payload.vehicle_vin || null : current.vehicle_vin || null,
        ':vehicle_license_plate':
          payload.vehicle_license_plate !== undefined
            ? payload.vehicle_license_plate || null
            : current.vehicle_license_plate || null,
        ':vehicle_mileage':
          payload.vehicle_mileage !== undefined ? payload.vehicle_mileage ?? null : current.vehicle_mileage ?? null,
        ':antique_era': payload.antique_era !== undefined ? payload.antique_era || null : current.antique_era || null,
        ':maker_artist': payload.maker_artist !== undefined ? payload.maker_artist || null : current.maker_artist || null,
        ':condition_grade':
          payload.condition_grade !== undefined ? payload.condition_grade || null : current.condition_grade || null,
        ':insured_value': payload.insured_value !== undefined ? payload.insured_value ?? null : current.insured_value ?? null,
        ':insurance_policy_number':
          payload.insurance_policy_number !== undefined
            ? payload.insurance_policy_number || null
            : current.insurance_policy_number || null,
        ':storage_location':
          payload.storage_location !== undefined ? payload.storage_location || null : current.storage_location || null,
        ':monthly_rental_income':
          payload.monthly_rental_income !== undefined
            ? payload.monthly_rental_income ?? null
            : current.monthly_rental_income ?? null,
        ':monthly_property_tax':
          payload.monthly_property_tax !== undefined ? payload.monthly_property_tax ?? null : current.monthly_property_tax ?? null,
        ':monthly_insurance':
          payload.monthly_insurance !== undefined ? payload.monthly_insurance ?? null : current.monthly_insurance ?? null,
        ':monthly_hoa_maintenance':
          payload.monthly_hoa_maintenance !== undefined
            ? payload.monthly_hoa_maintenance ?? null
            : current.monthly_hoa_maintenance ?? null,
      }
    );

    await this.persist();
    return (await this.fetchProperty(id)) || current;
  }

  async deleteProperty(id: string | number): Promise<boolean> {
    if (!this.db) await this.init();
    if (!this.db) return false;

    this.db.run(`DELETE FROM properties WHERE id = :id;`, { ':id': String(id) });
    await this.persist();
    return true;
  }

  /**
   * Records a valuation and lifts the property's `current_market_value` to the
   * appraised value, matching upstream's valuation action.
   */
  async addPropertyValuation(
    id: string | number,
    payload: { valuation_date: string; appraised_value: number; appraiser?: string; notes?: string }
  ): Promise<PropertyAsset> {
    if (!this.db) await this.init();
    if (!this.db) throw new Error('Database not initialized');

    const propertyId = String(id);
    const appraisedValue = Number(payload.appraised_value || 0);

    this.db.run(
      `INSERT INTO property_valuations (id, property_id, valuation_date, appraised_value, appraiser, notes)
       VALUES (:id, :property_id, :valuation_date, :appraised_value, :appraiser, :notes);`,
      {
        ':id': `sq-valu-${Date.now()}`,
        ':property_id': propertyId,
        ':valuation_date': payload.valuation_date || new Date().toISOString().split('T')[0],
        ':appraised_value': appraisedValue,
        ':appraiser': payload.appraiser || null,
        ':notes': payload.notes || null,
      }
    );

    this.db.run(`UPDATE properties SET current_market_value = :val WHERE id = :id;`, {
      ':val': appraisedValue,
      ':id': propertyId,
    });

    await this.persist();
    const updated = await this.fetchProperty(id);
    if (!updated) throw new Error(`Property ${id} not found`);
    return updated;
  }

  /**
   * Maps a `tenants` row to the persisted field shape. Lease status and rent
   * totals are derived on read by `getTenants` through propertyMath.ts.
   */
  private mapTenantColumns(
    row: any[],
    columns: string[]
  ): Omit<PropertyTenant, 'lease_status' | 'total_rent_collected' | 'total_rent_overdue'> {
    const raw: Record<string, any> = {};
    columns.forEach((col, idx) => (raw[col] = row[idx]));
    return {
      id: String(raw.id ?? ''),
      name: String(raw.name ?? ''),
      property_id: String(raw.property_id ?? ''),
      unit_number: raw.unit_number ? String(raw.unit_number) : undefined,
      email: raw.email ? String(raw.email) : undefined,
      phone: raw.phone ? String(raw.phone) : undefined,
      emergency_contact: raw.emergency_contact ? String(raw.emergency_contact) : undefined,
      lease_start_date: raw.lease_start_date ? String(raw.lease_start_date) : '',
      lease_end_date: raw.lease_end_date ? String(raw.lease_end_date) : '',
      monthly_rent_amount: Number(raw.monthly_rent_amount) || 0,
      rent_due_day: Number(raw.rent_due_day) || 1,
      security_deposit_held: Number(raw.security_deposit_held) || 0,
      security_deposit_refunded: Number(raw.security_deposit_refunded) || 0,
      deposit_status: (raw.deposit_status as PropertyTenant['deposit_status']) || 'held',
      notes: raw.notes ? String(raw.notes) : undefined,
    };
  }

  async getTenants(): Promise<PropertyTenant[]> {
    if (!this.db) await this.init();
    if (!this.db) return [];

    const propRes = this.db.exec(`SELECT id, name FROM properties;`);
    const propNames = new Map<string, string>();
    for (const r of propRes[0]?.values || []) propNames.set(String(r[0]), String(r[1] || ''));

    const payRes = this.db.exec(`SELECT * FROM rent_payments;`);
    const paymentsByTenant = new Map<string, RentPayment[]>();
    for (const row of payRes[0]?.values || []) {
      const p = this.mapRentPaymentColumns(row, payRes[0].columns);
      const tid = String(p.tenant_id);
      if (!paymentsByTenant.has(tid)) paymentsByTenant.set(tid, []);
      paymentsByTenant.get(tid)!.push(p);
    }

    const res = this.db.exec(`SELECT * FROM tenants ORDER BY name ASC;`);
    if (!res || res.length === 0 || !res[0].values) return [];

    return res[0].values.map((row) => {
      const t = this.mapTenantColumns(row, res[0].columns);
      return {
        ...t,
        property_name: propNames.get(String(t.property_id)),
        lease_status: computeLeaseStatus(t.lease_start_date, t.lease_end_date),
        ...computeRentTotals(paymentsByTenant.get(String(t.id)) || []),
      };
    });
  }

  async createTenant(payload: Partial<PropertyTenant>): Promise<PropertyTenant> {
    if (!this.db) await this.init();
    if (!this.db) throw new Error('Database not initialized');

    const id = payload.id ? String(payload.id) : `sq-tenant-${Date.now()}`;

    this.db.run(
      `INSERT INTO tenants (
         id, name, property_id, unit_number, email, phone, emergency_contact,
         lease_start_date, lease_end_date, monthly_rent_amount, rent_due_day,
         security_deposit_held, security_deposit_refunded, deposit_status, notes
       ) VALUES (
         :id, :name, :property_id, :unit_number, :email, :phone, :emergency_contact,
         :lease_start_date, :lease_end_date, :monthly_rent_amount, :rent_due_day,
         :security_deposit_held, :security_deposit_refunded, :deposit_status, :notes
       );`,
      {
        ':id': id,
        ':name': payload.name || 'New Tenant',
        ':property_id': payload.property_id ? String(payload.property_id) : '',
        ':unit_number': payload.unit_number || null,
        ':email': payload.email || null,
        ':phone': payload.phone || null,
        ':emergency_contact': payload.emergency_contact || null,
        ':lease_start_date': payload.lease_start_date || new Date().toISOString().split('T')[0],
        ':lease_end_date': payload.lease_end_date || new Date().toISOString().split('T')[0],
        ':monthly_rent_amount': Number(payload.monthly_rent_amount || 0),
        ':rent_due_day': payload.rent_due_day !== undefined ? Number(payload.rent_due_day) : 1,
        ':security_deposit_held': Number(payload.security_deposit_held ?? 0),
        ':security_deposit_refunded': Number(payload.security_deposit_refunded ?? 0),
        ':deposit_status': payload.deposit_status || 'held',
        ':notes': payload.notes || null,
      }
    );

    await this.persist();

    const tenants = await this.getTenants();
    return (
      tenants.find((t) => String(t.id) === id) || ({ id, name: payload.name || 'New Tenant' } as PropertyTenant)
    );
  }

  /**
   * Partial update via the load-merge-write approach, mirroring `updateGoal`.
   */
  async updateTenant(id: string | number, payload: Partial<PropertyTenant>): Promise<PropertyTenant> {
    if (!this.db) await this.init();
    if (!this.db) throw new Error('Database not initialized');

    const existing = this.db.exec(`SELECT * FROM tenants WHERE id = :id;`, { ':id': String(id) });
    if (!existing || existing.length === 0 || !existing[0].values?.length) {
      throw new Error(`Tenant ${id} not found`);
    }
    const current = this.mapTenantColumns(existing[0].values[0], existing[0].columns);

    this.db.run(
      `UPDATE tenants SET
         name = :name, property_id = :property_id, unit_number = :unit_number,
         email = :email, phone = :phone, emergency_contact = :emergency_contact,
         lease_start_date = :lease_start_date, lease_end_date = :lease_end_date,
         monthly_rent_amount = :monthly_rent_amount, rent_due_day = :rent_due_day,
         security_deposit_held = :security_deposit_held,
         security_deposit_refunded = :security_deposit_refunded,
         deposit_status = :deposit_status, notes = :notes
       WHERE id = :id;`,
      {
        ':id': String(id),
        ':name': payload.name !== undefined ? payload.name : current.name,
        ':property_id': payload.property_id !== undefined ? String(payload.property_id) : current.property_id,
        ':unit_number': payload.unit_number !== undefined ? payload.unit_number || null : current.unit_number || null,
        ':email': payload.email !== undefined ? payload.email || null : current.email || null,
        ':phone': payload.phone !== undefined ? payload.phone || null : current.phone || null,
        ':emergency_contact':
          payload.emergency_contact !== undefined ? payload.emergency_contact || null : current.emergency_contact || null,
        ':lease_start_date':
          payload.lease_start_date !== undefined ? payload.lease_start_date : current.lease_start_date,
        ':lease_end_date': payload.lease_end_date !== undefined ? payload.lease_end_date : current.lease_end_date,
        ':monthly_rent_amount':
          payload.monthly_rent_amount !== undefined
            ? Number(payload.monthly_rent_amount)
            : current.monthly_rent_amount,
        ':rent_due_day': payload.rent_due_day !== undefined ? Number(payload.rent_due_day) : current.rent_due_day,
        ':security_deposit_held':
          payload.security_deposit_held !== undefined
            ? Number(payload.security_deposit_held)
            : current.security_deposit_held ?? 0,
        ':security_deposit_refunded':
          payload.security_deposit_refunded !== undefined
            ? Number(payload.security_deposit_refunded)
            : current.security_deposit_refunded ?? 0,
        ':deposit_status':
          payload.deposit_status !== undefined ? payload.deposit_status : current.deposit_status,
        ':notes': payload.notes !== undefined ? payload.notes || null : current.notes || null,
      }
    );

    await this.persist();

    const tenants = await this.getTenants();
    return tenants.find((t) => String(t.id) === String(id)) || ({ ...current } as PropertyTenant);
  }

  async deleteTenant(id: string | number): Promise<boolean> {
    if (!this.db) await this.init();
    if (!this.db) return false;

    // A deleted tenant's rent roll is meaningless — drop it with the tenant.
    this.db.run(`DELETE FROM rent_payments WHERE tenant_id = :id;`, { ':id': String(id) });
    this.db.run(`DELETE FROM tenants WHERE id = :id;`, { ':id': String(id) });
    await this.persist();
    return true;
  }

  /**
   * Generates one rent payment per lease month via propertyMath.ts. Returns the
   * count of rows actually inserted — months that already have a payment are
   * skipped, so re-running is idempotent.
   */
  async generateRentSchedule(tenantId: string | number): Promise<number> {
    if (!this.db) await this.init();
    if (!this.db) return 0;

    const tRes = this.db.exec(`SELECT * FROM tenants WHERE id = :id;`, { ':id': String(tenantId) });
    if (!tRes || !tRes[0]?.values?.length) throw new Error(`Tenant ${tenantId} not found`);
    const tenant = this.mapTenantColumns(tRes[0].values[0], tRes[0].columns);
    const db = this.db;

    const existingRes = this.db.exec(`SELECT period_month FROM rent_payments WHERE tenant_id = :id;`, {
      ':id': String(tenantId),
    });
    const existingPeriodMonths = (existingRes[0]?.values || []).map((r) => String(r[0]));

    const generated = generateRentSchedule(
      {
        lease_start_date: tenant.lease_start_date,
        lease_end_date: tenant.lease_end_date,
        monthly_rent_amount: tenant.monthly_rent_amount,
        rent_due_day: tenant.rent_due_day,
      },
      existingPeriodMonths
    );

    const base = Date.now();
    generated.forEach((g, i) => {
      db.run(
        `INSERT INTO rent_payments (id, tenant_id, property_id, period_month, due_date, amount_due, amount_paid, paid_date, payment_status, memo, notes)
         VALUES (:id, :tenant_id, :property_id, :period_month, :due_date, :amount_due, :amount_paid, :paid_date, :payment_status, :memo, :notes);`,
        {
          ':id': `sq-rp-${base}-${i}`,
          ':tenant_id': String(tenantId),
          ':property_id': tenant.property_id ? String(tenant.property_id) : null,
          ':period_month': g.period_month,
          ':due_date': g.due_date,
          ':amount_due': g.amount_due,
          ':amount_paid': g.amount_paid,
          ':paid_date': null,
          ':payment_status': g.payment_status,
          ':memo': null,
          ':notes': null,
        }
      );
    });

    await this.persist();
    return generated.length;
  }

  /**
   * Maps a `rent_payments` row; `balance_due` and `payment_status` are placeholders,
   * always replaced through `computeBalanceDue` / `computeRentPaymentStatus` on read.
   */
  private mapRentPaymentColumns(row: any[], columns: string[]): RentPayment {
    const raw: Record<string, any> = {};
    columns.forEach((col, idx) => (raw[col] = row[idx]));
    return {
      id: String(raw.id ?? ''),
      tenant_id: String(raw.tenant_id ?? ''),
      property_id: raw.property_id ? String(raw.property_id) : undefined,
      period_month: String(raw.period_month ?? ''),
      due_date: String(raw.due_date ?? ''),
      amount_due: Number(raw.amount_due) || 0,
      amount_paid: Number(raw.amount_paid) || 0,
      balance_due: 0,
      paid_date: raw.paid_date ? String(raw.paid_date) : undefined,
      payment_status: (raw.payment_status as RentPayment['payment_status']) || 'pending',
      memo: raw.memo ? String(raw.memo) : undefined,
      notes: raw.notes ? String(raw.notes) : undefined,
    } as RentPayment;
  }

  async getRentPayments(tenantId?: string | number): Promise<RentPayment[]> {
    if (!this.db) await this.init();
    if (!this.db) return [];

    const tenantRes = this.db.exec(`SELECT id, name FROM tenants;`);
    const tenantNames = new Map<string, string>();
    for (const r of tenantRes[0]?.values || []) tenantNames.set(String(r[0]), String(r[1] || ''));

    const res = this.db.exec(
      tenantId
        ? `SELECT * FROM rent_payments WHERE tenant_id = :tid ORDER BY period_month DESC, id DESC;`
        : `SELECT * FROM rent_payments ORDER BY period_month DESC, id DESC;`,
      tenantId ? { ':tid': String(tenantId) } : undefined
    );
    if (!res || res.length === 0 || !res[0].values) return [];

    return res[0].values.map((row) => {
      const p = this.mapRentPaymentColumns(row, res[0].columns);
      return {
        ...p,
        tenant_name: tenantNames.get(String(p.tenant_id)),
        balance_due: computeBalanceDue(p.amount_due, p.amount_paid),
        payment_status: computeRentPaymentStatus(p),
      };
    });
  }

  async markRentPaid(paymentId: string | number): Promise<RentPayment> {
    if (!this.db) await this.init();
    if (!this.db) throw new Error('Database not initialized');

    const today = toDateOnlyString(todayDateOnly());
    this.db.run(
      `UPDATE rent_payments SET amount_paid = amount_due, paid_date = :today, payment_status = 'paid' WHERE id = :id;`,
      { ':today': today, ':id': String(paymentId) }
    );
    await this.persist();

    const payments = await this.getRentPayments();
    const updated = payments.find((r) => String(r.id) === String(paymentId));
    if (!updated) throw new Error(`Rent payment ${paymentId} not found`);
    return updated;
  }

  /**
   * Maps a `loan_scenarios` row. Every summary figure is derived on read by
   * `deriveLoanScenario` through `simulatePrepayment` — see loanMath.ts.
   */
  private mapLoanScenarioColumns(row: any[], columns: string[]): LoanScenario {
    const raw: Record<string, any> = {};
    columns.forEach((col, idx) => (raw[col] = row[idx]));
    return {
      id: String(raw.id ?? ''),
      name: String(raw.name ?? ''),
      account_id: raw.account_id ? String(raw.account_id) : undefined,
      account_name: raw.account_name ? String(raw.account_name) : undefined,
      principal_amount: Number(raw.principal_amount) || 0,
      annual_interest_rate: Number(raw.annual_interest_rate) || 0,
      loan_term_years: Number(raw.loan_term_years) || 0,
      loan_term_months: Number(raw.loan_term_months) || 0,
      start_date: raw.start_date ? String(raw.start_date) : '',
      extra_monthly_payment: Number(raw.extra_monthly_payment) || 0,
      lump_sum_payment: Number(raw.lump_sum_payment) || 0,
      lump_sum_date: raw.lump_sum_date ? String(raw.lump_sum_date) : undefined,
      rate_changes: [],
      monthly_payment: 0,
      total_payment_original: 0,
      total_interest_original: 0,
      original_payoff_date: '',
      total_payment_actual: 0,
      total_interest_actual: 0,
      actual_payoff_date: '',
      interest_saved: 0,
      months_saved: 0,
      years_saved: 0,
    } as LoanScenario;
  }

  private deriveLoanScenario(scenario: LoanScenario, rateChanges: LoanRateChange[]): LoanScenario {
    // One definition of the term, shared with the Mock adapter and the hub —
    // see `resolveTermMonths`. Summing years*12 + months double-counted: the
    // create form writes the total into loan_term_months while also sending
    // years, so a 25-year loan resolved to 600 months.
    const termMonths = resolveTermMonths(scenario);
    const sim = simulatePrepayment({
      principal: scenario.principal_amount,
      annualRatePct: scenario.annual_interest_rate,
      termMonths,
      startDate: scenario.start_date,
      extraMonthly: scenario.extra_monthly_payment,
      lumpSum: scenario.lump_sum_payment,
      lumpSumDate: scenario.lump_sum_date,
      rateChanges,
    });
    return {
      ...scenario,
      rate_changes: rateChanges,
      monthly_payment: sim.baseline.monthlyPayment,
      total_payment_original: sim.baseline.totalPaid,
      total_interest_original: sim.baseline.totalInterest,
      original_payoff_date: sim.baseline.payoffDate,
      total_payment_actual: sim.accelerated.totalPaid,
      total_interest_actual: sim.accelerated.totalInterest,
      actual_payoff_date: sim.accelerated.payoffDate,
      interest_saved: sim.interestSaved,
      months_saved: sim.monthsSaved,
      years_saved: sim.yearsSaved,
    };
  }

  async getLoanScenarios(): Promise<LoanScenario[]> {
    if (!this.db) await this.init();
    if (!this.db) return [];

    const res = this.db.exec(`SELECT * FROM loan_scenarios ORDER BY name ASC;`);
    if (!res || res.length === 0 || !res[0].values) return [];

    const rcRes = this.db.exec(`SELECT * FROM loan_rate_changes ORDER BY effective_date ASC;`);
    const changesByScenario = new Map<string, LoanRateChange[]>();
    for (const row of rcRes[0]?.values || []) {
      const raw: Record<string, any> = {};
      rcRes[0].columns.forEach((col, idx) => (raw[col] = row[idx]));
      const rc: LoanRateChange = {
        id: String(raw.id ?? ''),
        scenario_id: raw.scenario_id ? String(raw.scenario_id) : undefined,
        effective_date: String(raw.effective_date ?? ''),
        annual_rate: Number(raw.annual_rate) || 0,
        note: raw.note ? String(raw.note) : undefined,
      };
      const sid = String(rc.scenario_id ?? '');
      if (!changesByScenario.has(sid)) changesByScenario.set(sid, []);
      changesByScenario.get(sid)!.push(rc);
    }

    return res[0].values.map((row) => {
      const scenario = this.mapLoanScenarioColumns(row, res[0].columns);
      return this.deriveLoanScenario(scenario, changesByScenario.get(String(scenario.id)) || []);
    });
  }

  async createLoanScenario(payload: Partial<LoanScenario>): Promise<LoanScenario> {
    if (!this.db) await this.init();
    if (!this.db) throw new Error('Database not initialized');

    const id = payload.id ? String(payload.id) : `sq-loan-${Date.now()}`;
    const today = toDateOnlyString(todayDateOnly());

    this.db.run(
      `INSERT INTO loan_scenarios (
         id, name, account_id, account_name, principal_amount, annual_interest_rate,
         loan_term_years, loan_term_months, start_date, extra_monthly_payment,
         lump_sum_payment, lump_sum_date
       ) VALUES (
         :id, :name, :account_id, :account_name, :principal_amount, :annual_interest_rate,
         :loan_term_years, :loan_term_months, :start_date, :extra_monthly_payment,
         :lump_sum_payment, :lump_sum_date
       );`,
      {
        ':id': id,
        ':name': payload.name || 'New Loan Scenario',
        ':account_id': payload.account_id ? String(payload.account_id) : null,
        ':account_name': payload.account_name || null,
        ':principal_amount': Number(payload.principal_amount || 0),
        ':annual_interest_rate': Number(payload.annual_interest_rate || 0),
        ':loan_term_years': Number(payload.loan_term_years || 0),
        ':loan_term_months': Number(payload.loan_term_months || 0),
        ':start_date': payload.start_date || today,
        ':extra_monthly_payment': Number(payload.extra_monthly_payment || 0),
        ':lump_sum_payment': Number(payload.lump_sum_payment || 0),
        ':lump_sum_date': payload.lump_sum_date || null,
      }
    );

    await this.persist();

    const scenarios = await this.getLoanScenarios();
    return scenarios.find((s) => s.id === id) || (payload as LoanScenario);
  }

  /**
   * Partial update via the load-merge-write approach, mirroring `updateGoal`.
   */
  async updateLoanScenario(id: string | number, payload: Partial<LoanScenario>): Promise<LoanScenario> {
    if (!this.db) await this.init();
    if (!this.db) throw new Error('Database not initialized');

    const existing = this.db.exec(`SELECT * FROM loan_scenarios WHERE id = :id;`, { ':id': String(id) });
    if (!existing || existing.length === 0 || !existing[0].values?.length) {
      throw new Error(`Loan scenario ${id} not found`);
    }
    const current = this.mapLoanScenarioColumns(existing[0].values[0], existing[0].columns);

    this.db.run(
      `UPDATE loan_scenarios SET
         name = :name, account_id = :account_id, account_name = :account_name,
         principal_amount = :principal_amount, annual_interest_rate = :annual_interest_rate,
         loan_term_years = :loan_term_years, loan_term_months = :loan_term_months,
         start_date = :start_date, extra_monthly_payment = :extra_monthly_payment,
         lump_sum_payment = :lump_sum_payment, lump_sum_date = :lump_sum_date
       WHERE id = :id;`,
      {
        ':id': String(id),
        ':name': payload.name !== undefined ? payload.name : current.name,
        ':account_id':
          payload.account_id !== undefined
            ? payload.account_id
              ? String(payload.account_id)
              : null
            : current.account_id
              ? String(current.account_id)
              : null,
        ':account_name':
          payload.account_name !== undefined ? payload.account_name || null : current.account_name || null,
        ':principal_amount':
          payload.principal_amount !== undefined ? Number(payload.principal_amount) : current.principal_amount,
        ':annual_interest_rate':
          payload.annual_interest_rate !== undefined
            ? Number(payload.annual_interest_rate)
            : current.annual_interest_rate,
        ':loan_term_years':
          payload.loan_term_years !== undefined ? Number(payload.loan_term_years) : current.loan_term_years,
        ':loan_term_months':
          payload.loan_term_months !== undefined ? Number(payload.loan_term_months) : current.loan_term_months,
        ':start_date': payload.start_date !== undefined ? payload.start_date : current.start_date,
        ':extra_monthly_payment':
          payload.extra_monthly_payment !== undefined
            ? Number(payload.extra_monthly_payment)
            : current.extra_monthly_payment,
        ':lump_sum_payment':
          payload.lump_sum_payment !== undefined ? Number(payload.lump_sum_payment) : current.lump_sum_payment,
        ':lump_sum_date':
          payload.lump_sum_date !== undefined ? payload.lump_sum_date || null : current.lump_sum_date || null,
      }
    );

    await this.persist();

    const scenarios = await this.getLoanScenarios();
    return scenarios.find((s) => String(s.id) === String(id)) || current;
  }

  async deleteLoanScenario(id: string | number): Promise<boolean> {
    if (!this.db) await this.init();
    if (!this.db) return false;

    // Rate-change segments belong to the scenario; drop them with it.
    this.db.run(`DELETE FROM loan_rate_changes WHERE scenario_id = :id;`, { ':id': String(id) });
    this.db.run(`DELETE FROM loan_scenarios WHERE id = :id;`, { ':id': String(id) });
    await this.persist();
    return true;
  }

  /**
   * Infers historical rate segments from the linked account's interest
   * transactions, mirroring `loan.py::action_infer_rate_changes`: the first
   * segment becomes the scenario's opening rate, the rest become
   * `loan_rate_changes` rows. Existing segments for the scenario are replaced
   * so re-running reflects the current transaction history.
   */
  async inferLoanRateChanges(id: string | number): Promise<LoanRateChange[]> {
    if (!this.db) await this.init();
    if (!this.db) throw new Error('Database not initialized');

    const existing = this.db.exec(`SELECT * FROM loan_scenarios WHERE id = :id;`, { ':id': String(id) });
    if (!existing || existing.length === 0 || !existing[0].values?.length) {
      throw new Error(`Loan scenario ${id} not found`);
    }
    const scenario = this.mapLoanScenarioColumns(existing[0].values[0], existing[0].columns);
    if (!scenario.account_id) return [];
    const db = this.db;

    const txRes = this.db.exec(
      `SELECT date, amount, running_balance
       FROM transactions
       WHERE account_id = :acc AND LOWER(category_name) LIKE '%interest%'
       ORDER BY date ASC;`,
      { ':acc': String(scenario.account_id) }
    );

    const observations: RateObservation[] = [];
    for (const row of txRes[0]?.values || []) {
      const interest = Math.abs(Number(row[1]) || 0);
      const runningBalance = Number(row[2]) || 0;
      const balanceBefore = Math.abs(runningBalance) + interest;
      if (balanceBefore <= 500) continue;
      const rate = (interest / balanceBefore) * 12 * 100;
      if (rate < 0.1 || rate > 30) continue;
      observations.push({
        date: String(row[0] ?? ''),
        rate,
        interest,
        balance: balanceBefore,
      });
    }

    const segments = detectRateChanges(observations);
    if (segments.length === 0) return [];

    // Segment 0 is the loan's opening rate, not a change.
    this.db.run(`UPDATE loan_scenarios SET annual_interest_rate = :rate WHERE id = :id;`, {
      ':rate': segments[0].annual_rate,
      ':id': String(id),
    });

    this.db.run(`DELETE FROM loan_rate_changes WHERE scenario_id = :id;`, { ':id': String(id) });

    const created: LoanRateChange[] = [];
    const base = Date.now();
    segments.slice(1).forEach((seg, i) => {
      const rcId = `sq-rc-${base}-${i}`;
      const rcNote = `Inferred from ${seg.observation_count} interest payments`;
      const rateChange: LoanRateChange = {
        id: rcId,
        scenario_id: String(id),
        effective_date: seg.effective_date,
        annual_rate: seg.annual_rate,
        note: rcNote,
      };
      db.run(
        `INSERT INTO loan_rate_changes (id, scenario_id, effective_date, annual_rate, note)
         VALUES (:id, :scenario_id, :effective_date, :annual_rate, :note);`,
        {
          ':id': rcId,
          ':scenario_id': String(id),
          ':effective_date': seg.effective_date,
          ':annual_rate': seg.annual_rate,
          ':note': rcNote,
        }
      );
      created.push(rateChange);
    });

    await this.persist();
    return created;
  }

  // ---------------------------------------------------------------------------
  // Sync change tracking
  // ---------------------------------------------------------------------------

  /**
   * Locally-recorded changes not yet pushed to Moneta Cloud, in the order they
   * occurred — the change-log id is monotonic, so it doubles as the push order.
   */
  async getPendingChanges(limit: number = 500): Promise<SyncChange[]> {
    if (!this.db) await this.init();
    if (!this.db) return [];

    const res = this.db.exec(
      `SELECT id, entity, entity_id, op, changed_at, synced_at
         FROM sync_changes
        WHERE synced_at IS NULL
        ORDER BY id
        LIMIT :limit;`,
      { ':limit': limit }
    );
    if (!res || res.length === 0 || !res[0].values) return [];

    return res[0].values.map((row) => ({
      id: Number(row[0]),
      entity: String(row[1]),
      entity_id: String(row[2]),
      op: String(row[3]) as SyncOp,
      changed_at: String(row[4]),
      synced_at: row[5] ? String(row[5]) : undefined,
    }));
  }

  /** Number of changes awaiting push — cheap enough to drive a UI badge. */
  async getPendingChangeCount(): Promise<number> {
    if (!this.db) await this.init();
    if (!this.db) return 0;
    const res = this.db.exec(`SELECT COUNT(*) FROM sync_changes WHERE synced_at IS NULL;`);
    return Number(res?.[0]?.values?.[0]?.[0]) || 0;
  }

  /**
   * Marks changes as pushed.
   *
   * Safe precisely because the log is append-only: a later edit to the same row
   * inserts a new entry rather than reviving a marked one, so there is no
   * un-mark path to get wrong. Returns how many were marked.
   */
  async markChangesSynced(ids: number[]): Promise<number> {
    if (!this.db) await this.init();
    if (!this.db) return 0;

    // sql.js has no array binding for IN (...). These ids come from our own
    // append-only log and are coerced to finite numbers, so the interpolation
    // cannot carry anything but digits.
    const list = ids
      .map((i) => Number(i))
      .filter((i) => Number.isFinite(i))
      .join(',');
    if (!list) return 0;

    this.db.run(`UPDATE sync_changes SET synced_at = ${SYNC_NOW_EXPR} WHERE id IN (${list});`);
    await this.persist();
    return ids.length;
  }

  /**
   * Export the SQLite database as a binary Blob for backup or external analysis
   */
  exportDatabaseFile(): Blob | null {
    if (!this.db) return null;
    const data = this.db.export();
    return new Blob([data as unknown as BlobPart], { type: 'application/x-sqlite3' });
  }

  /**
   * Restore full database from binary SQLite bytes.
   * Validates header, checks schema integrity, swaps db instance, runs migrations, and flushes to IndexedDB.
   */
  async restoreDatabaseFromBytes(bytes: Uint8Array): Promise<{
    success: boolean;
    message?: string;
    counts?: Record<string, number>;
  }> {
    await this.init();
    if (!this.SQL) throw new Error('SQLite WASM not loaded');

    // 1. Validate SQLite 3 magic header (first 16 bytes: "SQLite format 3\000")
    if (bytes.length < 100) {
      throw new Error('File too small to be a valid SQLite database.');
    }
    const header = new TextDecoder().decode(bytes.slice(0, 15));
    if (!header.startsWith('SQLite format 3')) {
      throw new Error('Invalid file format: Not a valid SQLite 3 database file.');
    }

    // 2. Instantiate temporary database to audit table structure
    let tempDb: Database;
    try {
      tempDb = new this.SQL.Database(bytes);
    } catch (err: any) {
      throw new Error(`Failed to read database bytes: ${err?.message || err}`);
    }

    // 3. Verify required tables exist
    const masterRes = tempDb.exec(`SELECT name FROM sqlite_master WHERE type='table';`);
    const tableNames = (masterRes[0]?.values?.map((v) => String(v[0])) || []);
    if (!tableNames.includes('accounts') || !tableNames.includes('transactions')) {
      tempDb.close();
      throw new Error('Invalid database: Missing essential Moneta tables (accounts, transactions).');
    }

    // 4. Gather record counts
    const getCount = (table: string): number => {
      if (!tableNames.includes(table)) return 0;
      try {
        const cRes = tempDb.exec(`SELECT count(*) FROM ${table};`);
        return Number(cRes[0]?.values?.[0]?.[0]) || 0;
      } catch {
        return 0;
      }
    };

    const counts: Record<string, number> = {
      accounts: getCount('accounts'),
      transactions: getCount('transactions'),
      transaction_splits: getCount('transaction_splits'),
      budgets: getCount('budgets'),
      recurring_bills: getCount('recurring_bills'),
      payees: getCount('payees'),
      goals: getCount('goals'),
      securities: getCount('securities'),
      holdings: getCount('holdings'),
      properties: getCount('properties'),
      tenants: getCount('tenants'),
      loan_scenarios: getCount('loan_scenarios'),
    };

    // 5. Replace current database instance safely
    if (this.db) {
      try {
        this.db.close();
      } catch (e) {
        console.warn('Error closing previous database instance:', e);
      }
    }
    this.db = tempDb;

    // 6. Run migrations to ensure any newer triggers/tables are attached
    this.runMigrations();

    // 7. Persist restored binary bytes to IndexedDB
    await saveDatabaseBytes(bytes);

    return {
      success: true,
      message: `Database successfully restored (${counts.accounts} accounts, ${counts.transactions} transactions)`,
      counts,
    };
  }

  /**
   * Inspect local database file size and table statistics.
   */
  async getDatabaseInfo(): Promise<{
    sizeBytes: number;
    tables: { name: string; rowCount: number }[];
    totalRows: number;
  }> {
    await this.init();
    if (!this.db) return { sizeBytes: 0, tables: [], totalRows: 0 };

    const exported = this.db.export();
    const masterRes = this.db.exec(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';`);
    const tableNames = (masterRes[0]?.values?.map((v) => String(v[0])) || []);

    let totalRows = 0;
    const tables = tableNames.map((name) => {
      try {
        const cRes = this.db!.exec(`SELECT count(*) FROM ${name};`);
        const count = Number(cRes[0]?.values?.[0]?.[0]) || 0;
        totalRows += count;
        return { name, rowCount: count };
      } catch {
        return { name, rowCount: 0 };
      }
    });

    return {
      sizeBytes: exported.length,
      tables,
      totalRows,
    };
  }

  /**
   * Reset local SQLite database to fresh clean state.
   */
  async resetDatabase(): Promise<void> {
    await this.init();
    if (!this.SQL) return;
    if (this.db) {
      try {
        this.db.close();
      } catch (e) {
        console.warn('Error closing database during reset:', e);
      }
    }
    this.db = new this.SQL.Database();
    this.runMigrations();
    await this.persist();
  }
}
