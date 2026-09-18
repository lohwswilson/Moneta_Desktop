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
7. **One Derivation, One Place**:
   If a figure is derived from stored data and Odoo also computes it, implement that derivation **once** in a shared module and call it from every adapter. Never reimplement it per adapter. Two independent derivations drift, and the same record then reads differently on two screens — the failure mode the Odoo roadmap names in its scheduled-occurrence contract (Track 2.25). Current example: `goalMath.ts::computeGoalMetrics()`, which mirrors `goal.py::_compute_goal_progress` and is shared by the SQLite and Mock adapters.
8. **Wire Names, Not ORM Names**:
   The Odoo mobile API translates field names. The ORM field is `transaction_date`; the JSON key is `date`. A client type must match the **wire** name — see [`docs/07`](docs/07_ROADMAP_AND_FEATURE_PARITY.md) for the layer table. "Correcting" a client field to match the ORM breaks it.

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
│   ├── 04_LOCAL_SQLITE_AND_OFFLINE..# SQLite WASM, IndexedDB & full DDL
│   ├── 05_ODOO_SYNC_AND_API_INTEG.. # Odoo 18 REST & CORS architecture
│   ├── 06_COMMAND_CENTER_AND_FIRE.. # Net worth & financial metrics
│   ├── 07_ROADMAP_AND_FEATURE_PA..  # Parity audit against moneta_finance
│   ├── 08_PLANNING_AND_FORECASTI... # Budgets, bills, cash flow & goals hubs
│   └── 09_PAYEE_INTELLIGENCE_A...   # Merchant memory & spend analytics
├── scripts/
│   └── verify_goal_math.ts          # Goal progress maths assertions
├── src/
│   ├── App.svelte                   # Root application shell & view routing
│   ├── lib/
│   │   ├── types/moneta.ts          # Central domain TypeScript interfaces
│   │   ├── api/client.ts            # Axios client with Tauri Rust adapter
│   │   ├── api/odooApi.ts           # /api/v1/mobile/* endpoint definitions
│   │   ├── stores/
│   │   │   └── financeStore.svelte.ts # Runes-based reactive finance store
│   │   ├── data/
│   │   │   ├── repository.ts        # IMonetaRepository interface
│   │   │   ├── sqliteAdapter.ts     # SQLite 3 WASM + IndexedDB driver
│   │   │   ├── odooAdapter.ts       # Odoo 18 REST / JSON-RPC driver
│   │   │   ├── mockAdapter.ts       # In-memory Singapore sandbox driver
│   │   │   ├── rulesEngine.ts       # 33 Singapore merchant rules engine
│   │   │   ├── goalMath.ts          # Shared goal-progress derivation
│   │   │   └── importers/
│   │   │       └── bankStatementParser.ts # CSV & QIF statement parser
│   │   └── components/
│   │       ├── Sidebar.svelte       # Navigation & color-coded accounts
│   │       ├── CommandCenter.svelte # Net worth & FIRE progress hero
│   │       ├── CheckbookRegister.svelte # Ledger table & 1-click Clr toggle
│   │       ├── BudgetHub.svelte     # Zero-based envelope budgets
│   │       ├── RecurringBillsHub.svelte # Bills & subscription detector
│   │       ├── CashFlowHub.svelte   # Projection & Sankey diagram
│   │       ├── PayeeDirectoryHub.svelte # Merchant intelligence directory
│   │       ├── GoalsHub.svelte      # Financial goals & sinking funds
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

# 3. Run domain-maths assertions
node --experimental-strip-types scripts/verify_goal_math.ts

# 4. Confirm every client route exists on the server
#    (client calls are in src/lib/api/odooApi.ts; routes in the Odoo
#     module's controllers/api_mobile.py)
grep -o "mobile/[a-z_/]*" src/lib/api/odooApi.ts | sort -u

# 5. Check git status
git status
```

A client endpoint with no matching server route fails only at runtime, and only in Live Odoo mode — offline and Mock modes will not surface it. Step 4 exists because exactly that regression shipped once.
