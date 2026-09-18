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
9. **Two-Sided Feature Delivery (Full Parity)**:
   Every feature ships on **both** sides — `Moneta_Desktop` and the `moneta_finance` Odoo module — implementing the same behaviour and deriving the same figures. A Desktop-only feature is **incomplete**, because subscribers log into the Odoo backend directly and must find a complete system there (see [ADR 0001](docs/adr/0001-subscription-tiers-and-cloud-sync.md)).

   This is a deliberate, accepted cost: each feature has two implementations to keep in step. [`docs/07`](docs/07_ROADMAP_AND_FEATURE_PARITY.md) tracks the state of each.

   **Cross-system parity contract.** Where a Desktop shared module mirrors an Odoo computation, its docstring names the Odoo function — that citation is a **maintenance contract, not a comment**. Changing one obliges you to change the other. Existing pairs:

   | Desktop module | Odoo counterpart |
   | :--- | :--- |
   | `goalMath.ts` | `goal.py::_compute_goal_progress` |
   | `portfolioMath.ts` | `investment.py`, `tax_lot.py` (`_modified_dietz`, `_xirr`) |
   | `loanMath.ts` | `loan.py` (amortization, `action_generate_schedule`, `action_infer_rate_changes`) |
   | `propertyMath.ts` | `property.py::_compute_equity`, `rental_property.py::_compute_rental_metrics` |

   A figure that can silently disagree — amortization, tax lots, goal progress, rental yield — is the highest-risk kind, because a wrong number still renders. These are the pairs that most need the assertions in `scripts/`.

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
│   ├── 09_PAYEE_INTELLIGENCE_A...   # Merchant memory & spend analytics
│   ├── 10_STOCK_PORTFOLIO_AND_T...  # Holdings, disposal strategies, TWR/MWR
│   └── 11_PROPERTY_MORTGAGES_AN...  # Equity, amortization, prepayment, rent roll
├── scripts/
│   ├── verify_goal_math.ts          # Goal progress maths assertions
│   ├── verify_portfolio_math.ts     # Lot / disposal / TWR-MWR assertions
│   ├── verify_loan_math.ts          # Amortization & prepayment assertions
│   └── verify_property_math.ts      # Equity / rental / rent-roll assertions
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
│   │   │   ├── portfolioMath.ts     # Shared lot / disposal / TWR-MWR derivation
│   │   │   ├── loanMath.ts          # Shared amortization / prepayment derivation
│   │   │   ├── propertyMath.ts      # Shared equity / rental / rent-roll derivation
│   │   │   └── importers/
│   │   │       └── bankStatementParser.ts # CSV & QIF statement parser
│   │   └── components/
│   │       ├── TopMenuBar.svelte    # Domain-center navigation bar
│   │       ├── Sidebar.svelte       # Accounts, quick actions & hub navigation
│   │       ├── CommandCenter.svelte # Net worth & FIRE progress hero
│   │       ├── CheckbookRegister.svelte # Ledger table & 1-click Clr toggle
│   │       ├── BudgetHub.svelte     # Zero-based envelope budgets
│   │       ├── RecurringBillsHub.svelte # Bills & subscription detector
│   │       ├── CashFlowHub.svelte   # Projection & Sankey diagram
│   │       ├── PayeeDirectoryHub.svelte # Merchant intelligence directory
│   │       ├── GoalsHub.svelte      # Financial goals & sinking funds
│   │       ├── PortfolioHub.svelte  # Holdings, tax lots, realized & allocation
│   │       ├── PropertyHub.svelte   # Property equity, LTV & valuation history
│   │       ├── LoanHub.svelte       # Amortization schedule & prepayment simulator
│   │       ├── LandlordHub.svelte   # Tenants, leases & rent roll
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

## 4. Feature Delivery Checklist

Invariant 9 requires every feature on both sides. Work the list top to bottom — the Odoo side first, because the client is typed against its wire contract.

| # | Step | Where |
| :--: | :--- | :--- |
| 1 | **Models** — fields, computed values, constraints | `moneta_finance/models/` |
| 2 | **Endpoints + serializer** | `moneta_finance/controllers/api_mobile.py` |
| 3 | **Views** — list/form, when subscriber-visible | `moneta_finance/views/` |
| 4 | **Types, repository methods, all three adapters** | `src/lib/types/`, `src/lib/data/` |
| 5 | **Shared math module**, if anything is derived — Rule 7 | `src/lib/data/*Math.ts` |
| 6 | **Store state, component, navigation** | `src/lib/stores/`, `src/lib/components/` |
| 7 | **Math assertions**, if step 5 applied | `scripts/verify_*.ts` |
| 8 | **Route parity** | both repos |
| 9 | **Doc pass** | `docs/` |

**Step 4 catches the most common miss.** Every new repository method must be implemented in `sqliteAdapter.ts`, `mockAdapter.ts` *and* `odooAdapter.ts`. The interface declares methods optional (`?`) so a missing implementation degrades to an empty list rather than failing loudly — which means an adapter left behind looks like "no data", not "not implemented".

**Steps 8 and 9 are the two that have actually bitten.** Step 8 exists because a client refactor once renamed a call without the server following, and the register 404'd in Live Odoo mode only. Step 9 exists because four consecutive features shipped without documentation, each time surfacing later as drift.

---

## 5. Verification & Testing Workflow

Before committing any code changes:

```bash
# 1. Verify TypeScript & Svelte compiler diagnostics (Must return 0 errors, 0 warnings)
npm run check

# 2. Verify production bundle compilation
npm run build

# 3. Run domain-maths assertions
node --experimental-strip-types scripts/verify_goal_math.ts
node --experimental-strip-types scripts/verify_portfolio_math.ts
node --experimental-strip-types scripts/verify_loan_math.ts
node --experimental-strip-types scripts/verify_property_math.ts

# 4. Route parity — every client call must have a server route.
#    Client calls:   src/lib/api/odooApi.ts
#    Server routes:  moneta_finance/controllers/api_mobile.py
grep -o "mobile/[a-z_/]*" src/lib/api/odooApi.ts | sort -u

# 5. Doc references — every component and endpoint must appear in docs/
for f in src/lib/components/*.svelte; do n=$(basename "$f"); \
  grep -rq "$n" docs/ README.md AGENTS.md ARCHITECTURE.md || echo "UNDOCUMENTED: $n"; done

# 6. Check git status
git status
```

**Why step 4 matters:** a client endpoint with no matching server route fails only at runtime, and only in Live Odoo mode — offline and Mock modes will not surface it. Exactly that regression shipped once.

**Why step 5 matters:** a component nobody can find is a component nobody maintains. The check is cheap and mechanical.

**A gap worth knowing about:** there is currently no automated check that `npm run start` actually launches, and no test exercising the UI. Compilation and assertions cover *logic*; they cannot catch a view that renders blank, a modal that will not close, or a layout that breaks. Run the app before declaring a UI change done.
