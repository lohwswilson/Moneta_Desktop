# Moneta Desktop: Technical Architecture Specification

This document defines the software engineering architecture, state management patterns, and data layer abstractions of the **Moneta Desktop** application.

---

## 1. Architectural Philosophy

1. **100% Offline-First by Default**: The application must launch instantly and execute all operations (register updates, running balance calculations, statement imports, searches) without internet access.
2. **Deterministic Financial Accuracy**: Floating-point balance drifts are prevented using rounding constraints and chronological tiebreaker algorithms.
3. **Pluggable Data Decoupling**: Business logic and UI components interact exclusively with an abstract repository interface, decoupling presentation from whether data resides in local SQLite, a remote Odoo 18 instance, or a cloud sync database.
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

Moneta Desktop is built natively using **Svelte 5 Runes**, avoiding legacy Svelte 3/4 stores in favor of fine-grained reactive primitives:

### Reactive State in `FinanceStore` ([`src/lib/stores/financeStore.svelte.ts`](file:///opt/moneta_desktop/src/lib/stores/financeStore.svelte.ts))
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

  // View routing — one discriminant, one branch per view in App.svelte
  activeView = $state<'command_center' | 'register' | 'budgets' | 'bills'
                     | 'cashflow' | 'payees' | 'goals'>('command_center');

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

All data operations are defined by a strict contract in [`src/lib/data/repository.ts`](file:///opt/moneta_desktop/src/lib/data/repository.ts):

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

Derived figures that Odoo also computes are implemented **once** in a shared module and called by every adapter, rather than reimplemented per adapter. See [`src/lib/data/goalMath.ts`](file:///opt/moneta_desktop/src/lib/data/goalMath.ts), which mirrors `goal.py::_compute_goal_progress` and is used by both the SQLite and Mock adapters.

```typescript
// Both adapters do this — neither defines its own maths
return { ...persisted, ...computeGoalMetrics(persisted) };
```

The alternative — each adapter deriving its own numbers — produces a record that reads differently depending on which data source is active. The Odoo roadmap documents this failure mode in its scheduled-occurrence contract track as the largest single architectural gap in the upstream module; Moneta Desktop does not reintroduce it.

---

## 5. Security & Isolation Model

1. **Local Isolation**: SQLite files and IndexedDB records are scoped exclusively to the application origin. No third-party tracking, analytics, or external telemetry scripts are loaded.
2. **Credential Security**: When connecting to Odoo 18, Bearer Personal Access Tokens (PAT) are stored locally in the user's browser `localStorage` and sent strictly across HTTPS with zero plain-text logging.
3. **Rust Network Sandbox**: When running under Tauri, outbound HTTP requests are processed through Tauri's native Rust HTTP core, avoiding WebKit browser sandboxing constraints while maintaining strict OS-level process isolation.