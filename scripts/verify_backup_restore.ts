import initSqlJs from 'sql.js';
import {
  SYNC_TRACKED_TABLES,
  buildSyncSchemaDDL,
} from '../src/lib/data/syncSchema.ts';

let pass = 0;
let fail = 0;
const check = (label: string, actual: unknown, expected: unknown) => {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    pass++;
    console.log(`  ✅ ${label}: ${a}`);
  } else {
    fail++;
    console.log(`  ❌ ${label}: got ${a}, expected ${e}`);
  }
};

console.log('\n--- 1. Testing SQLite Binary Export & Magic Header ---');
const SQL = await initSqlJs({
  locateFile: (f: string) => `/opt/moneta_wealth/node_modules/sql.js/dist/${f}`,
});

const originalDb = new SQL.Database();

// Create schema
originalDb.run(`
  CREATE TABLE accounts (
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

  CREATE TABLE transactions (
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

  CREATE TABLE budgets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    allocated_amount REAL NOT NULL
  );
`);

// Insert initial test records
originalDb.run(`
  INSERT INTO accounts (id, name, account_type, institution_name, current_balance)
  VALUES ('acc-1', 'DBS Multiplier', 'checking', 'DBS', 15420.50),
         ('acc-2', 'OCBC 365 Card', 'credit_card', 'OCBC', -850.00);

  INSERT INTO transactions (id, account_id, date, payee_name, amount, transaction_type)
  VALUES ('tx-1', 'acc-1', '2026-09-19', 'FairPrice Finest', -68.40, 'expense'),
         ('tx-2', 'acc-1', '2026-09-19', 'Salary Payroll', 7500.00, 'income');

  INSERT INTO budgets (id, name, allocated_amount)
  VALUES ('bgt-1', 'Groceries', 650.0);
`);

// Export database
const exportedBytes = originalDb.export();
check('Export produced non-empty bytes', exportedBytes.length > 0, true);

// Verify SQLite 3 magic header
const headerStr = new TextDecoder().decode(exportedBytes.slice(0, 15));
check('SQLite 3 magic header', headerStr, 'SQLite format 3');

console.log('\n--- 2. Testing Database Restoration into New Instance ---');
const restoredDb = new SQL.Database(exportedBytes);

// Check tables exist
const tableRes = restoredDb.exec(`SELECT name FROM sqlite_master WHERE type='table';`);
const restoredTables = tableRes[0]?.values?.map((v) => String(v[0])) || [];
check('Accounts table restored', restoredTables.includes('accounts'), true);
check('Transactions table restored', restoredTables.includes('transactions'), true);
check('Budgets table restored', restoredTables.includes('budgets'), true);

// Check record counts
const accRes = restoredDb.exec(`SELECT count(*) FROM accounts;`);
const txRes = restoredDb.exec(`SELECT count(*) FROM transactions;`);
const bgtRes = restoredDb.exec(`SELECT count(*) FROM budgets;`);

check('Accounts count matches', Number(accRes[0]?.values?.[0]?.[0]), 2);
check('Transactions count matches', Number(txRes[0]?.values?.[0]?.[0]), 2);
check('Budgets count matches', Number(bgtRes[0]?.values?.[0]?.[0]), 1);

// Check data integrity
const dbsAcc = restoredDb.exec(`SELECT name, current_balance FROM accounts WHERE id='acc-1';`);
check('Account name matches', dbsAcc[0]?.values?.[0]?.[0], 'DBS Multiplier');
check('Account balance matches', Number(dbsAcc[0]?.values?.[0]?.[1]), 15420.50);

console.log('\n--- 3. Testing Corrupt & Non-SQLite Validation ---');
const corruptBytes = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
const corruptHeader = new TextDecoder().decode(corruptBytes.slice(0, 15));
check('Corrupt bytes rejected by header check', corruptHeader.startsWith('SQLite format 3'), false);

const fakeDb = new SQL.Database();
fakeDb.run(`CREATE TABLE some_random_table (id INT);`);
const fakeBytes = fakeDb.export();
const fakeInstance = new SQL.Database(fakeBytes);
const fakeTables = fakeInstance.exec(`SELECT name FROM sqlite_master WHERE type='table';`)[0]?.values?.map(v => String(v[0])) || [];
check('Non-Moneta SQLite rejected by table check', fakeTables.includes('accounts'), false);

console.log('\n=======================================================');
console.log(`${pass} passed, ${fail} failed`);
console.log('=======================================================');

if (fail > 0) process.exit(1);
