# Database Management, Backups & Cloud Sync

Moneta Wealth puts you in absolute control of your financial data. This chapter explains how your local SQLite database functions, how to export timestamped binary backups, how to restore from previous snapshots, and how to connect to optional Moneta Cloud sync.

---

## 🔒 The Local SQLite Engine (`sqliteAdapter.ts`)

Unlike cloud-only personal finance software that stores your financial life on external servers, Moneta Wealth runs an embedded **SQLite 3 WebAssembly engine** directly inside your client application:

- **100% Client-Side**: All transactions, accounts, budgets, and tax lots exist exclusively on your device.
- **IndexedDB Auto-Persistence**: The database buffer is persisted locally into browser/desktop IndexedDB after every ledger transaction.
- **Standard Format**: The data is stored in the universal SQLite 3 format, readable by standard database tools (e.g., DB Browser for SQLite, DBeaver, `sqlite3` CLI).

---

## 💾 Database & Backup Manager (`ConnectionModal.svelte`)

Click the **`Data & Backups`** button at the bottom of [`Sidebar.svelte`](file:///opt/moneta_wealth/src/lib/components/Sidebar.svelte) or the database status badge in [`TopMenuBar.svelte`](file:///opt/moneta_wealth/src/lib/components/TopMenuBar.svelte) to open [`ConnectionModal.svelte`](file:///opt/moneta_wealth/src/lib/components/ConnectionModal.svelte).

```
+-------------------------------------------------------------------------------+
|  Database & Backup Manager                                                [X] |
+-------------------------------------------------------------------------------+
|  [ 💾 Local SQLite Database ]    [ ☁️ Moneta Cloud Sync ]                      |
+-------------------------------------------------------------------------------+
|  LOCAL STORAGE METRICS:                                                       |
|  • Storage Mode:  Local SQLite (WebAssembly + IndexedDB)                      |
|  • Binary Size:   448.0 KB                                                    |
|  • Active Rows:   184 accounts & transactions across 11 tables                |
|                                                                               |
|  BACKUP & RESTORE:                                                            |
|  [ ⬇️ Export Database Backup (.sqlite) ]                                       |
|  Save a complete, unencrypted binary snapshot of your financial ledger.       |
|                                                                               |
|  [ ⬆️ Restore from Backup (.sqlite) ]                                         |
|  Overwrites current local database with an uploaded backup file.              |
|                                                                               |
|  ⚠️ DANGER ZONE:                                                              |
|  [ 🗑️ Reset Local Database ]                                                  |
|  Clears all accounts and transactions, restoring the blank default ledger.   |
+-------------------------------------------------------------------------------+
```

---

## ⬇️ Exporting a Binary Database Backup

To create a full snapshot of your financial state:
1. Open [`ConnectionModal.svelte`](file:///opt/moneta_wealth/src/lib/components/ConnectionModal.svelte).
2. Click **Export Database Backup (.sqlite)**.
3. Your system immediately downloads a timestamped backup file:
   ```
   moneta-wealth-backup-2026-09-19T09-30-00.sqlite
   ```
4. **Cold Storage Recommendation**: Store this file on an encrypted USB drive, private NAS, or personal cloud vault (e.g., iCloud Drive, Proton Drive) for disaster recovery.

---

## ⬆️ Restoring a Database from Backup

If you are migrating to a new computer or recovering from an accidental deletion:
1. Open [`ConnectionModal.svelte`](file:///opt/moneta_wealth/src/lib/components/ConnectionModal.svelte).
2. Click **Restore from Backup (.sqlite)**.
3. Select your `.sqlite` backup file.
4. Moneta Wealth executes an automated safety audit:
   - **Magic Header Check**: Confirms the initial 16 bytes match the SQLite 3 specification (`SQLite format 3\000`).
   - **Schema Audit**: Verifies that essential tables (`accounts`, `transactions`, `budgets`) exist and are structurally sound.
   - **Hot-Swap Engine**: Swaps the in-memory database instance, commits the binary buffers to IndexedDB, and updates all reactive UI stores in real time.
5. Your register, net worth, and hubs immediately reflect the restored snapshot.

---

## 🗑️ Resetting the Local Database

If you wish to wipe test data and begin a fresh financial year:
1. In [`ConnectionModal.svelte`](file:///opt/moneta_wealth/src/lib/components/ConnectionModal.svelte), scroll to the **Danger Zone**.
2. Click **Reset Local Database**.
3. A confirmation dialog prompts you to confirm.
4. Once confirmed:
   - All transactions, accounts, and custom payee associations are purged.
   - Default Singapore categories and clean structures are initialized.
   - IndexedDB is flushed clean, presenting a pristine starting register.

---

## ☁️ Optional Moneta Cloud Sync (Odoo 18 Backend)

For multi-device synchronization across desktop and mobile companion apps:
1. Click the **Moneta Cloud Sync** tab in [`ConnectionModal.svelte`](file:///opt/moneta_wealth/src/lib/components/ConnectionModal.svelte).
2. Enter your self-hosted Odoo 18 server credentials:
   - **Server URL**: `https://finance.yourdomain.com`
   - **Database**: e.g., `odoo_finance`
   - **Personal Access Token (PAT)**: Generated from your Odoo user profile.
3. **Migrate Local Data to Cloud**: Click to push your local SQLite accounts and history into the Odoo headless personal finance engine.
4. **Change-Tracking Triggers**: Changes made offline in Moneta Wealth are queued locally in `sync_changes` and push-synchronized whenever a network connection is established.
