# Moneta Wealth: Technical Architecture Specification

This document defines the software engineering architecture, state management patterns, and data layer abstractions of the **Moneta Wealth** application.

---

## 1. Architectural Philosophy

1. **100% Offline-First by Default**: The application must launch instantly and execute all operations (register updates, running balance calculations, statement imports, searches) without internet access.
2. **Deterministic Financial Accuracy**: Floating-point balance drifts are prevented using rounding constraints and chronological tiebreaker algorithms.
3. **Local-First with Cloud Custody on Subscription**: Business logic and UI components interact exclusively with an abstract repository interface backed by local SQLite. For free users, all data remains 100% private and offline on their machine. For paid subscribers, **all financial records must be kept in Moneta Cloud (Odoo Backend)** via continuous bidirectional sync, providing automated cloud disaster recovery and seamless multi-device sync with Moneta Mobile. See §6.
4. **Lightweight Native Desktop Footprint**: Leveraging **Tauri v2** and **Svelte 5** ensures minimal RAM consumption (~35 MB) and instantaneous UI response times.

---

## 2. Technology Stack

```
+-------------------------------------------------------------------------+
| Layer                  | Technology                  | Purpose          |
+------------------------+-----------------------------+------------------+
| Desktop Wrapper        | Tauri v2 (Rust)             | OS window, native|
|                        |                             | HTTP networking  |
| Frontend Framework     | Svelte 5 (Runes-native)     | Reactive UI      |
| Build Tool             | Vite 6                      | Fast HMR & bundler|
| Language               | TypeScript 5.7              | Strict type safety|
| Styling & Theme        | Tailwind CSS v4             | Dark fintech UI  |
| Icons                  | Lucide Svelte               | Feather icons    |
| Local Database         | sql.js (SQLite 3 WASM)      | Relational engine|
| Local Storage          | Browser IndexedDB           | Binary blob store|
| HTTP Client            | Axios + Tauri HTTP Adapter  | Cross-platform   |
+------------------------+-----------------------------+------------------+
```

---

## 3. Svelte 5 Runes State Management

Moneta Wealth is built natively using **Svelte 5 Runes**, avoiding legacy Svelte 3/4 stores in favor of fine-grained reactive primitives:

### Reactive State in `FinanceStore` ([`src/lib/stores/financeStore.svelte.ts`](file:///opt/moneta_wealth/src/lib/stores/financeStore.svelte.ts))
```typescript
class FinanceStore {
  // Reactive configuration and authentication
  config = $state<ConnectionConfig>({ ... });
  isConnected = $state<boolean>(false);

  // Core financial state
  metrics = $state<DashboardMetrics | null>(null);
  accounts = $state<MonetaAccount[]>([]);
  selectedAccountId = $state<string | number | null>(null);
  transactions = $state<MonetaTransaction[]>([]);
  filterState = $state<'all' | 'unreconciled' | 'cleared' | 'reconciled'>('all');

  // Planning-domain state
  budgets = $state<EnvelopeBudget[]>([]);
  bills = $state<RecurringBill[]>([]);
  detectedSubscriptions = $state<DetectedSubscription[]>([]);
  cashflowForecast = $state<CashflowForecast | null>(null);
  cashflowHorizon = $state<30 | 90 | 180 | 365>(90);
  payees = $state<PayeeIntelligence[]>([]);
  goals = $state<FinancialGoal[]>([]);

  // Portfolio state (Phase 4)
  holdings = $state<PortfolioHolding[]>([]);
  taxLots = $state<TaxLot[]>([]);
  taxLotDisposals = $state<TaxLotDisposal[]>([]);
  portfolioSummary = $state<PortfolioSummary | null>(null);

  // Property, rental & loan state (Phase 5)
  properties = $state<PropertyAsset[]>([]);
  tenants = $state<PropertyTenant[]>([]);
  rentPayments = $state<RentPayment[]>([]);
  loanScenarios = $state<LoanScenario[]>([]);

  // View routing — one discriminant, one branch per view in App.svelte
  activeView = $state<'command_center' | 'register' | 'budgets' | 'bills'
                     | 'cashflow' | 'payees' | 'goals' | 'portfolio'
                     | 'property' | 'loans' | 'landlord'>('command_center');

  // Modal visibility
  isQuickAddOpen = $state<boolean>(false);
  isImportModalOpen = $state<boolean>(false);
  isSettingsOpen = $state<boolean>(false);
  isGoalModalOpen = $state<boolean>(false);
  isFundGoalOpen = $state<boolean>(false);
}
```

### Derived Computation & Effects
- **Reactive Derived Values**: Filtered transactions and account sums use `$derived(...)` for automatic memoization without manual re-computation:
  ```typescript
  let currentAccount = $derived(
    financeStore.accounts.find((a) => a.id === financeStore.selectedAccountId)
  );
  ```
- **Side Effects**: `$effect(...)` handlers keep inputs synchronized when user selections change.

---

## 4. Data Repository Layer (`IMonetaRepository`)

All data operations are defined by a strict contract in [`src/lib/data/repository.ts`](file:///opt/moneta_wealth/src/lib/data/repository.ts):

```
                       ┌─────────────────────────┐
                       │   IMonetaRepository     │
                       │       (Interface)       │
                       └────────────┬────────────┘
                                    │
           ┌────────────────────────┼────────────────────────┐
           ▼                        ▼                        ▼
┌──────────────────────┐ ┌──────────────────────┐ ┌──────────────────────┐
│    SqliteAdapter     │ │     OdooAdapter      │ │     MockAdapter      │
│  - WASM SQLite       │ │  - /api/v1/mobile/*  │ │  - In-Memory State   │
│  - IndexedDB Store   │ │  - Bearer PAT Auth   │ │  - Demo Sandbox      │
│  - Binary Backup     │ │  - Rust reqwest      │ │  - Zero Dependencies │
└──────────────────────┘ └──────────────────────┘ └──────────────────────┘
```

### Capability-Optional Methods

Beyond the core ledger contract, the interface declares **optional** capabilities with `?`:

```typescript
getGoals?(): Promise<FinancialGoal[]>;
createGoal?(payload: Partial<FinancialGoal>): Promise<FinancialGoal>;
fundGoal?(id, amount, actionType: 'deposit' | 'withdraw'): Promise<FinancialGoal>;
```

The `?` is load-bearing. It lets an adapter legitimately not support a capability without breaking the type contract, and it forces callers to guard:

```typescript
if (this.repository.getGoals) {
  this.goals = await this.repository.getGoals();
} else {
  this.goals = [];   // degrade to empty, never throw
}
```

The trade-off is that a **missing** implementation degrades silently to an empty list rather than failing loudly. For that reason every new capability must be implemented in **all three** adapters — a method added to two of them will look like "no data" rather than "not implemented" in the third.

### Shared Derivation (Anti-Drift Rule)

Derived figures that Odoo also computes are implemented **once** in a shared module and called by every adapter, rather than reimplemented per adapter. Four modules follow this rule today:

- [`src/lib/data/goalMath.ts`](file:///opt/moneta_wealth/src/lib/data/goalMath.ts) — mirrors `goal.py::_compute_goal_progress`
- [`src/lib/data/portfolioMath.ts`](file:///opt/moneta_wealth/src/lib/data/portfolioMath.ts) — mirrors `investment.py` / `tax_lot.py` (`_modified_dietz`, `_xirr`)
- [`src/lib/data/loanMath.ts`](file:///opt/moneta_wealth/src/lib/data/loanMath.ts) — mirrors `loan.py` (amortization, prepayment, rate inference)
- [`src/lib/data/propertyMath.ts`](file:///opt/moneta_wealth/src/lib/data/propertyMath.ts) — mirrors `property.py` and `rental_property.py` (equity, rental metrics, rent roll)

```typescript
// Both adapters do this — neither defines its own maths
import { computeLotMetrics, disposeTaxLots, computeModifiedDietz, computeXIRR } from './portfolioMath';
import { computePropertyMetrics, computeLeaseStatus, computeRentTotals } from './propertyMath';
import { simulatePrepayment, detectRateChanges } from './loanMath';
```

Each module has a matching assertion suite under `scripts/` — 175 assertions in total across the four at the time of writing. They exist because the maths is the part that fails *silently*: a wrong amortization figure still renders, and nothing else in the stack would catch it.

The alternative — each adapter deriving its own numbers — produces a record that reads differently depending on which data source is active. The Odoo roadmap documents this failure mode in its scheduled-occurrence contract track as the largest single architectural gap in the upstream module; Moneta Wealth does not reintroduce it.

---

## 5. Security & Isolation Model

1. **Local Isolation**: SQLite files and IndexedDB records are scoped exclusively to the application origin. No third-party tracking, analytics, or external telemetry scripts are loaded.
2. **Credential Security**: When connecting to Odoo 18, Bearer Personal Access Tokens (PAT) are stored locally in the user's browser `localStorage` and sent strictly across HTTPS with zero plain-text logging.
3. **Rust Network Sandbox**: When running under Tauri, outbound HTTP requests are processed through Tauri's native Rust HTTP core, avoiding WebKit browser sandboxing constraints while maintaining strict OS-level process isolation.

---

## 6. Sync Architecture

Moneta Cloud sync is built in stages, each independently useful and verifiable. This section describes the model; the decisions and their reasoning live in [ADR 0001](docs/adr/0001-subscription-tiers-and-cloud-sync.md) and [ADR 0006](docs/adr/0006-sync-conflict-policy.md).

### 6.1 The model: local-first, mandatory cloud custody on subscription

```
SQLite is ALWAYS the local store          (offline-first, free tier)
Paid subscription activates Cloud Custody (ALL subscriber data kept in Moneta Cloud)
```

For free users, all data remains strictly local in embedded SQLite with zero network transmission. When a user subscribes to Moneta Cloud, the client initiates continuous replication so that **all subscriber financial records are kept in Moneta Cloud (Odoo Backend)** as the authoritative master repository for disaster recovery, background processing, and multi-device sync with Moneta Mobile.

`ConnectionConfig` expresses this directly:

```typescript
interface ConnectionConfig {
  dataSource: 'local' | 'sandbox';   // which LOCAL store
  serverUrl: string;                 // Moneta Cloud — optional, for sync
  apiToken: string;
}
```

`cloudConfigured` is **derived** from the credentials rather than being a mode. `updateAdapter()` points `repository` at SQLite or the sandbox and **never** at `OdooAdapter`; `refreshAll()` never returns early on an unreachable server, so an offline launch shows the local ledger rather than a blank screen.

### 6.2 Change tracking

Every write to a synced table is recorded in `sync_changes` by **SQLite triggers** — declared in [`src/lib/data/syncSchema.ts`](file:///opt/moneta_wealth/src/lib/data/syncSchema.ts), applied at the *end* of `runMigrations()` so seeded defaults are not queued as user changes.

Triggers rather than application logging, because (a) the app hard-deletes, so a delete needs a **tombstone** to be reportable at all, and (b) with 20 tables and dozens of write methods, one path that forgets to log is silent data loss.

The log is **append-only**: editing an already-synced row inserts a new entry rather than reviving a marked one, so there is no un-mark path to get wrong. Timestamps carry milliseconds — second resolution would make same-second changes compare equal.

### 6.3 Conflict resolution

**Server-arrival last-write-wins, with one overriding rule: an unpushed local change always wins.** Implemented as a pure function in [`src/lib/data/syncConflict.ts`](file:///opt/moneta_wealth/src/lib/data/syncConflict.ts), so the whole policy is testable without a database or a server.

Ordering uses a **server-assigned** timestamp. Comparing the client's clock would make ordering depend on every subscriber's system clock, letting one badly-set device silently overwrite good data.

Deletion is an explicit signal, never inferred from absence — a record missing from a server response means "not pushed yet", not "deleted", and confusing the two either destroys unsynced data or resurrects deleted rows.

### 6.4 Stage status

| Stage | Scope | Status |
| :--: | :--- | :--- |
| 1 | Local-first refactor — SQLite always local, Odoo a sync target | ✅ Done |
| 2 | Change tracking — trigger-written append-only log | ✅ Done |
| 3 | Conflict policy — server-arrival LWW, tombstones | ✅ Done |
| 4 | **Missing server write endpoints** — accounts, budgets, rent, payee-create, **plus deletion tombstones** | ⬜ Required before sync |
| 5 | Sync engine — mutation queue and pull cursor | ⬜ Blocked on 4 |
| 6 | Licence token — issuance, local verification, grace window | ⬜ Needs infrastructure |

**Stage 4 is the blocker.** Several entities are read-only over `/api/v1/mobile/*` today and cannot be pushed, and Odoo's `unlink` makes deletions invisible — so a record deleted on one device is resurrected by the next pull from a device that still has it. See [ADR 0006 §4](docs/adr/0006-sync-conflict-policy.md).