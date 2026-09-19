import initSqlJs from 'sql.js';
import {
  SYNC_TRACKED_TABLES,
  buildSyncSchemaDDL,
  buildSyncTriggerDDL,
} from '../src/lib/data/syncSchema.ts';

/**
 * Verifies the change-tracking schema against a **real SQLite engine** using
 * the same DDL the app runs. A test that re-declared its own copy of the schema
 * would prove nothing about the database the app actually creates.
 */

let pass = 0;
let fail = 0;
const check = (label: string, actual: unknown, expected: unknown) => {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) { pass++; console.log(`  ✅ ${label}: ${a}`); }
  else { fail++; console.log(`  ❌ ${label}: got ${a}, expected ${e}`); }
};

const SQL = await initSqlJs({
  locateFile: (f: string) => `/opt/moneta_wealth/node_modules/sql.js/dist/${f}`,
});

/** Minimal stand-ins. The triggers only reference `NEW.id` / `OLD.id`. */
function makeDb() {
  const db = new SQL.Database();
  db.run(
    SYNC_TRACKED_TABLES.map((t) => `CREATE TABLE ${t} (id TEXT PRIMARY KEY, name TEXT);`).join('\n') +
      // Deliberately present but untracked — proves exclusion works.
      `\nCREATE TABLE app_settings (key TEXT PRIMARY KEY, value TEXT);
       CREATE TABLE currency_rates (currency_code TEXT PRIMARY KEY, rate_to_base REAL);`
  );
  db.run(buildSyncSchemaDDL());
  return db;
}

const rows = (db: any, sql: string) => {
  const r = db.exec(sql);
  return r.length ? r[0].values : [];
};

console.log('\n1. Schema applies and is idempotent');
{
  const db = makeDb();
  // runMigrations() runs on every launch, so this must not error or duplicate.
  db.run(buildSyncSchemaDDL());
  db.run(buildSyncSchemaDDL());
  const triggers = rows(db, `SELECT name FROM sqlite_master WHERE type='trigger' ORDER BY name;`);
  check('trigger count == 3 per tracked table', triggers.length, SYNC_TRACKED_TABLES.length * 3);
  const idx = rows(db, `SELECT name FROM sqlite_master WHERE type='index' AND name='idx_sync_changes_pending';`);
  check('pending-queue index exists', idx.length, 1);
  check('change log starts empty', rows(db, 'SELECT COUNT(*) FROM sync_changes;')[0][0], 0);
}

console.log('\n2. Inserts, updates and deletes are all captured');
{
  const db = makeDb();
  db.run(`INSERT INTO goals (id, name) VALUES ('g1', 'Emergency Fund');`);
  db.run(`UPDATE goals SET name = 'Emergency Fund (6mo)' WHERE id = 'g1';`);
  db.run(`DELETE FROM goals WHERE id = 'g1';`);

  const log = rows(db, `SELECT entity, entity_id, op FROM sync_changes ORDER BY id;`);
  check('three writes → three entries', log.length, 3);
  check('insert logged as upsert', log[0], ['goals', 'g1', 'upsert']);
  check('update logged as upsert', log[1], ['goals', 'g1', 'upsert']);
  // The load-bearing one: without this, a deleted row is resurrected by the
  // next pull because the server never learns it went away.
  check('delete logged as a tombstone', log[2], ['goals', 'g1', 'delete']);
}

console.log('\n3. The delete survives the row being gone');
{
  const db = makeDb();
  db.run(`INSERT INTO tenants (id, name) VALUES ('t1', 'Tan Ah Kow');`);
  db.run(`DELETE FROM tenants WHERE id = 't1';`);
  check('row is gone', rows(db, 'SELECT COUNT(*) FROM tenants;')[0][0], 0);
  check(
    'but its deletion is recorded',
    rows(db, `SELECT op FROM sync_changes WHERE entity='tenants' ORDER BY id;`).map((r: any[]) => r[0]),
    ['upsert', 'delete']
  );
}

console.log('\n4. Untracked tables stay silent');
{
  const db = makeDb();
  // Settings are canonical on the server and pulled down — a local edit is not
  // something to push.
  db.run(`INSERT INTO app_settings (key, value) VALUES ('base_currency', 'SGD');`);
  db.run(`UPDATE app_settings SET value='USD' WHERE key='base_currency';`);
  db.run(`INSERT INTO currency_rates (currency_code, rate_to_base) VALUES ('MYR', 3.18);`);
  check('no entries from untracked tables', rows(db, 'SELECT COUNT(*) FROM sync_changes;')[0][0], 0);
}

console.log('\n5. Every tracked table is wired');
{
  const db = makeDb();
  for (const t of SYNC_TRACKED_TABLES) {
    db.run(`INSERT INTO ${t} (id, name) VALUES ('x-${t}', 'probe');`);
  }
  const logged = rows(db, `SELECT DISTINCT entity FROM sync_changes;`).map((r: any[]) => r[0]);
  const missing = SYNC_TRACKED_TABLES.filter((t) => !logged.includes(t));
  check(`${SYNC_TRACKED_TABLES.length} tables all report a change`, missing, []);
}

console.log('\n6. Pending queue semantics');
{
  const db = makeDb();
  db.run(`INSERT INTO goals (id, name) VALUES ('g1','a'), ('g2','b');`);
  check('everything starts pending', rows(db, 'SELECT COUNT(*) FROM sync_changes WHERE synced_at IS NULL;')[0][0], 2);

  // Draining: mark the first entry as pushed.
  db.run(`UPDATE sync_changes SET synced_at = datetime('now') WHERE id = 1;`);
  const pending = rows(db, `SELECT entity_id FROM sync_changes WHERE synced_at IS NULL ORDER BY id;`);
  check('only unmarked entries remain pending', pending, [['g2']]);

  // A later change to an already-synced row re-queues it — this is why the log
  // is append-only rather than a per-row flag.
  db.run(`UPDATE goals SET name='c' WHERE id='g1';`);
  const requeued = rows(db, `SELECT entity_id FROM sync_changes WHERE synced_at IS NULL ORDER BY id;`);
  check('editing a synced row re-queues it', requeued, [['g2'], ['g1']]);
}

console.log(`\n${'='.repeat(55)}\n${pass} passed, ${fail} failed\n${'='.repeat(55)}`);
process.exit(fail === 0 ? 0 : 1);
