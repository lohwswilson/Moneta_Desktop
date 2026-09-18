# Local SQLite & Offline-First Storage

Moneta Desktop implements a true **offline-first storage model** using an embedded WebAssembly compilation of SQLite 3 via `sql.js`, paired with persistent browser IndexedDB storage.

---

## 1. Storage Architecture

```
+-------------------------------------------------------------------------+
|                    OFFLINE-FIRST STORAGE PIPELINE                       |
|                                                                         |
|  [ In-Memory WebAssembly Execution ]                                    |
|  ├── High-performance SQLite 3 WASM engine (sql.js)                    |
|  ├── Microsecond relational SQL queries (SELECT, INSERT, UPDATE, JOIN)  |
|  └── Foreign keys & transaction safety                                  |
|         │                                                               |
|         ▼ Binary Snapshot Export (db.export() -> Uint8Array)            |
|                                                                         |
|  [ Persistent Local Storage ]                                           |
|  ├── Browser IndexedDB Store: "moneta_sqlite_db"                        |
|  ├── Object Store: "sqlite_storage"                                     |
|  └── Storage Key: "moneta_main_db"                                      |
|                                                                         |
|  [ External Portability ]                                               |
|  └── 1-Click Binary Export: "moneta-backup-YYYY-MM-DD.sqlite"            |
+-------------------------------------------------------------------------+
```

### Key Offline Guarantees
- **Zero Server Requirement**: Moneta Desktop does not depend on cloud servers, external databases, or network connections.
- **Air-Gapped Privacy**: Your financial accounts, balances, and transaction history never leave your personal computer.
- **Persistence Across Restarts**: Database bytes are written to IndexedDB after every ledger mutation, ensuring instant state recovery when restarting the application.

---

## 2. Relational Database Schemas (DDL)

Moneta Desktop executes automatic DDL migrations upon database initialization ([`src/lib/data/sqliteAdapter.ts`](file:///opt/moneta_desktop/src/lib/data/sqliteAdapter.ts)):

### Table: `accounts`
Stores financial accounts, current balances, and institutional metadata:

```sql
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
```

### Table: `transactions`
Primary checkbook ledger rows:

```sql
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
```

### Table: `transaction_splits`
Stores sub-allocations for split transactions:

```sql
CREATE TABLE IF NOT EXISTS transaction_splits (
  id TEXT PRIMARY KEY,
  transaction_id TEXT NOT NULL,
  category_name TEXT NOT NULL,
  amount REAL NOT NULL,
  memo TEXT,
  FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE
);
```

### Table: `categorization_rules`
Merchant matching rules for automated categorization:

```sql
CREATE TABLE IF NOT EXISTS categorization_rules (
  id TEXT PRIMARY KEY,
  priority INTEGER DEFAULT 10,
  match_field TEXT NOT NULL,
  match_pattern TEXT NOT NULL,
  category_name TEXT NOT NULL
);
```

### Table: `budgets`
Zero-based envelope budget allocations. Spending is aggregated from `transactions` at read time rather than stored, so an envelope cannot drift from the ledger it summarises. See [`08_PLANNING_AND_FORECASTING_HUBS.md`](08_PLANNING_AND_FORECASTING_HUBS.md).

```sql
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
```

### Table: `app_settings`
Key/value store for canonical settings synced from the Odoo server (base currency, company name, and similar scalars):

```sql
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

### Table: `currency_rates`
FX rates normalized to the base currency, used for offline multi-currency net worth conversion:

```sql
CREATE TABLE IF NOT EXISTS currency_rates (
  currency_code TEXT PRIMARY KEY,
  rate_to_base REAL NOT NULL,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

### Table: `recurring_bills`
Scheduled bills and detected subscriptions. `active` is a soft-delete flag; `next_due_date` is advanced when a bill is marked paid:

```sql
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
```

### Table: `payees`
Merchant memory. Lifetime figures (`total_spend`, `transaction_count`, `avg_amount`) are aggregated from `transactions` at read time, not stored here. `name` is unique — the adapter upserts `ON CONFLICT(name)` so edits merge rather than duplicate. See [`09_PAYEE_INTELLIGENCE_AND_DIRECTORY.md`](09_PAYEE_INTELLIGENCE_AND_DIRECTORY.md).

```sql
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
```

### Table: `goals`
Financial goals and sinking funds. Only the goal's **own** fields are stored — `status`, `progress_percent`, `remaining_amount`, `months_remaining` and `monthly_contribution_required` are derived on read by [`src/lib/data/goalMath.ts`](file:///opt/moneta_desktop/src/lib/data/goalMath.ts) so the SQLite, Mock and Odoo surfaces cannot diverge. See [`08_PLANNING_AND_FORECASTING_HUBS.md`](08_PLANNING_AND_FORECASTING_HUBS.md).

```sql
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
```

> **Note on `goals.status`:** the column exists so a paused goal survives a round-trip, but nothing in the UI sets it. Upstream `moneta.goal` cannot write it either — the field is computed without an inverse. It is read, not written.

### Migration Protocol

When extending the schema:

1. Add table creation DDL to the `runMigrations()` method in [`src/lib/data/sqliteAdapter.ts`](file:///opt/moneta_desktop/src/lib/data/sqliteAdapter.ts).
2. Every table must use `CREATE TABLE IF NOT EXISTS`.
3. Before seeding default rows, check the table's row count first.
4. Call `await this.persist()` after any write transaction to flush the binary buffer into IndexedDB.

---

## 3. IndexedDB Persistence Implementation

IndexedDB is used as a high-capacity binary blob store to preserve the SQLite database file:

```typescript
// Save binary database buffer to IndexedDB
const saveDatabaseBytes = (data: Uint8Array): Promise<void> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('moneta_sqlite_db', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('sqlite_storage');
    request.onsuccess = () => {
      const idb = request.result;
      const tx = idb.transaction('sqlite_storage', 'readwrite');
      tx.objectStore('sqlite_storage').put(data, 'moneta_main_db');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    };
    request.onerror = () => reject(request.error);
  });
};
```

On launch, Moneta Desktop queries `moneta_main_db`. If an existing database is found, it instantiates `new SQL.Database(savedBytes)`. If no database exists, it provisions a fresh database and seeds initial accounts.

---

## 4. Backups & Database Portability

### Exporting `.sqlite` Files
Clicking **Download .sqlite Backup** triggers:
```typescript
const blob = financeStore.sqliteAdapter.exportDatabaseFile();
// Creates downloadable standard SQLite 3 binary file
```

### Inspecting Backups Locally
Exported `.sqlite` files are standard SQLite 3 databases compatible with any SQLite tool:

```bash
sqlite3 moneta-backup-2026-09-18.sqlite

sqlite> SELECT name, current_balance, currency_code FROM accounts;
Main Checking (Local)|12500.0|SGD
High-Yield Savings|35000.0|SGD
Brokerage Equity Portfolio|85000.0|USD
Everyday Rewards Card|-1450.0|SGD
```
