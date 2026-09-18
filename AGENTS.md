# AGENTS.md: Developer & AI Assistant Operating Guide

This document defines the canonical architecture rules, coding standards, and operational workflows for AI coding assistants (Antigravity, Claude Code, Hermes, Cursor) working within the **`Moneta_Desktop`** repository at `/opt/moneta_desktop`.

---

## 1. Core Operating Invariants

1. **Offline-First by Default**:
   Every feature must be fully operational without an internet connection when using the `SqliteAdapter`. Never introduce mandatory external network calls or telemetry.
2. **Svelte 5 Runes Only**:
   Do **not** use legacy Svelte 3/4 stores (`writable()`, `derived()`, `subscribe()`). State management must use native Svelte 5 Runes:
   - `$state(...)` for reactive mutable state.
   - `$derived(...)` for computed properties.
   - `$props(...)` for component input properties.
   - `$effect(...)` for reactive side effects.
3. **Strict Lowercase Reconciliation States**:
   Reconciliation states must strictly adhere to lowercase string literals:
   `'unreconciled' | 'cleared' | 'reconciled' | 'void'`.
4. **No Mermaid Diagrams in Chat**:
   Per user operating rules, never output Mermaid syntax in chat responses. Visualizations must use clean Markdown tables and ASCII flowcharts.
5. **No Tag Pollution**:
   Wrap all task IDs, reminder numbers, and hex codes in backticks (e.g. `#63`, `#220`, `#3b82f6`) so Obsidian never parses them as tags.
6. **Permission & Mutation Gate**:
   Always present proposed plans and diffs before performing file modifications, deletions, or structural changes.

---

## 2. Directory Layout & Key Files

```
/opt/moneta_desktop/
├── ARCHITECTURE.md                  # Detailed system architecture specification
├── AGENTS.md                        # This developer guide
├── README.md                        # Repository overview & quickstart
├── ROADMAP.md                       # Phase-by-phase feature parity roadmap
├── docs/                            # Numbered documentation suite
│   ├── index.md                     # Documentation overview
│   ├── 01_GETTING_STARTED.md        # Setup, dev & desktop launch options
│   ├── 02_BANKING_AND_CHECKBOOK...  # Checkbook register & split transactions
│   ├── 03_BANK_STATEMENT_WIZARD...  # Statement parser & rules engine
│   ├── 04_LOCAL_SQLITE_AND_OFFLINE..# SQLite WASM & IndexedDB persistence
│   ├── 05_ODOO_SYNC_AND_API_INTEG.. # Odoo 18 REST & CORS architecture
│   ├── 06_COMMAND_CENTER_AND_FIRE.. # Net worth & financial metrics
│   └── 07_ROADMAP_AND_FEATURE_PA..  # Parity matrix against moneta_finance
├── src/
│   ├── App.svelte                   # Root application shell & modal bindings
│   ├── lib/
│   │   ├── types/moneta.ts          # Central domain TypeScript interfaces
│   │   ├── api/client.ts            # Axios client with Tauri Rust adapter
│   │   ├── stores/
│   │   │   └── financeStore.svelte.ts # Runes-based reactive finance store
│   │   ├── data/
│   │   │   ├── repository.ts        # IMonetaRepository interface
│   │   │   ├── sqliteAdapter.ts     # SQLite 3 WASM + IndexedDB driver
│   │   │   ├── odooAdapter.ts       # Odoo 18 REST / JSON-RPC driver
│   │   │   ├── mockAdapter.ts       # In-memory Singapore sandbox driver
│   │   │   ├── rulesEngine.ts       # 33 Singapore merchant rules engine
│   │   │   └── importers/
│   │   │       └── bankStatementParser.ts # CSV & QIF statement parser
│   │   └── components/
│   │       ├── Sidebar.svelte       # Navigation & color-coded accounts
│   │       ├── CommandCenter.svelte # Net worth & FIRE progress hero
│   │       ├── CheckbookRegister.svelte # Ledger table & 1-click Clr toggle
│   │       ├── QuickAddModal.svelte # Transaction capture & split allocations
│   │       ├── StatementImportModal.svelte # Drag-and-drop statement wizard
│   │       └── ConnectionModal.svelte # Mode switcher & Odoo migration
└── src-tauri/                       # Tauri v2 native Rust desktop wrapper
```

---

## 3. SQLite Schema Evolution Protocol

When modifying or extending the SQLite database:
1. Update table creation DDL in the `runMigrations()` method in [`src/lib/data/sqliteAdapter.ts`](file:///opt/moneta_desktop/src/lib/data/sqliteAdapter.ts).
2. Ensure new tables include `IF NOT EXISTS`.
3. If seeding new default records, check table row counts first before inserting.
4. Always invoke `await this.persist()` after executing write transactions to flush binary database buffers into IndexedDB.

---

## 4. Verification & Testing Workflow

Before committing any code changes:

```bash
# 1. Verify TypeScript & Svelte compiler diagnostics (Must return 0 errors, 0 warnings)
npm run check

# 2. Verify production bundle compilation
npm run build

# 3. Check git status
git status
```
