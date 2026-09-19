/**
 * Local change tracking for sync.
 *
 * Every write to a synced table is recorded in `sync_changes` by **SQLite
 * triggers**, not by application code. Three reasons:
 *
 * 1. **Deletes.** The app hard-deletes rows. Without a record, a sync engine
 *    cannot tell the server that a goal was deleted — it would simply be
 *    resurrected by the next pull. A trigger captures the tombstone.
 * 2. **It cannot be bypassed.** There are 20 tables and dozens of write
 *    methods; a single path that forgets to log is a silent data-loss bug.
 *    Triggers fire regardless of which code performs the write.
 * 3. **No changes to existing adapter code.** The alternative — adding
 *    `updated_at` to every table and soft-deleting everything — would touch
 *    ~17 tables and every `DELETE`.
 *
 * The DDL lives here rather than inside `sqliteAdapter.runMigrations()` so the
 * verification script can execute **the same schema** the app does. A test that
 * re-declares its own copy proves nothing about the real database.
 */

/**
 * Tables whose changes are tracked.
 *
 * `app_settings` and `currency_rates` are deliberately excluded: they are
 * canonical on the server and pulled *down* by `syncSettingsFromOdoo()`, so a
 * local edit to them is not something to push.
 *
 * `accounts` is included even though `/api/v1/mobile/accounts/*` has no write
 * endpoint yet — the log records what actually changed locally, and it is the
 * sync engine's job (Stage 5) to decide what it can push. Excluding it here
 * would hide a real gap rather than surface it.
 */
export const SYNC_TRACKED_TABLES = [
  'accounts',
  'transactions',
  'transaction_splits',
  'categorization_rules',
  'budgets',
  'recurring_bills',
  'payees',
  'goals',
  'securities',
  'holdings',
  'security_lots',
  'lot_disposals',
  'properties',
  'property_valuations',
  'tenants',
  'rent_payments',
  'loan_scenarios',
  'loan_rate_changes',
] as const;

export type SyncTrackedTable = (typeof SYNC_TRACKED_TABLES)[number];

// `SyncOp` and `SyncChange` are domain types and live in types/moneta.ts.
export type { SyncOp } from '../types/moneta';

/**
 * The change log and its pending-queue index.
 *
 * `synced_at` is NULL until the change has been pushed. The index is on
 * `(synced_at, id)` so draining the queue reads in insertion order without a
 * sort.
 */
export const SYNC_TABLE_DDL = `
  CREATE TABLE IF NOT EXISTS sync_changes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    op TEXT NOT NULL,
    changed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    synced_at TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_sync_changes_pending
    ON sync_changes (synced_at, id);
`;

/**
 * SQLite expression for the current time, in ISO-8601 with **milliseconds**.
 *
 * `datetime('now')` has one-second resolution, so two changes in the same
 * second compare equal and a timestamp tie-break decides arbitrarily. Conflict
 * resolution orders by timestamp (ADR 0006 §1), so the log must be able to
 * distinguish changes within a second. The trailing `Z` marks the value UTC,
 * and the format sorts lexicographically — plain string comparison is correct.
 */
export const SYNC_NOW_EXPR = `strftime('%Y-%m-%dT%H:%M:%fZ','now')`;

/**
 * One insert, update and delete trigger per tracked table.
 *
 * `IF NOT EXISTS` makes this idempotent — `runMigrations()` runs on every
 * launch, and re-creating triggers would either error or duplicate them.
 */
export function buildSyncTriggerDDL(): string {
  return SYNC_TRACKED_TABLES.flatMap((table) => [
    `CREATE TRIGGER IF NOT EXISTS trg_${table}_insert AFTER INSERT ON ${table}
       BEGIN
         INSERT INTO sync_changes (entity, entity_id, op)
         VALUES ('${table}', NEW.id, 'upsert');
       END;`,
    `CREATE TRIGGER IF NOT EXISTS trg_${table}_update AFTER UPDATE ON ${table}
       BEGIN
         INSERT INTO sync_changes (entity, entity_id, op)
         VALUES ('${table}', NEW.id, 'upsert');
       END;`,
    `CREATE TRIGGER IF NOT EXISTS trg_${table}_delete AFTER DELETE ON ${table}
       BEGIN
         INSERT INTO sync_changes (entity, entity_id, op)
         VALUES ('${table}', OLD.id, 'delete');
       END;`,
  ]).join('\n');
}

/** Complete sync schema — table, index and triggers. */
export function buildSyncSchemaDDL(): string {
  return `${SYNC_TABLE_DDL}\n${buildSyncTriggerDDL()}`;
}
