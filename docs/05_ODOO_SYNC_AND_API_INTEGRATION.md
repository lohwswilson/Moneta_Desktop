# Moneta Cloud Sync & API Integration

Moneta Wealth runs completely standalone — a local SQLite database on your machine — or optionally connects to a **Moneta Cloud** backend (a self-hosted Odoo 18 server running the [`moneta_core`](https://github.com/lohwswilson/moneta_core) module).

---

## 1. Local-First Data Layer

All data access is mediated through the [`IMonetaRepository`](file:///opt/moneta_wealth/src/lib/data/repository.ts) interface, but **the repository is always the local store**:

| Adapter | Role |
| :--- | :--- |
| `SqliteAdapter` | The real ledger. Embedded WebAssembly SQLite, persisted to IndexedDB. |
| `MockAdapter` | In-memory sandbox, selected by `dataSource: 'sandbox'`. Never syncs. |
| `OdooAdapter` | **Not a repository driver.** Reached only by explicit operations — settings sync and the one-time migration. |

`OdooAdapter` is never the source of ordinary reads and writes. That is the local-first model; see [ADR 0001 §5](adr/0001-subscription-tiers-and-cloud-sync.md) and [ARCHITECTURE.md §6](../ARCHITECTURE.md).

The interface declares optional capabilities with `?`, so an adapter that does not implement one degrades to an empty list rather than throwing:

```typescript
export interface IMonetaRepository {
  // Core ledger — required
  getAccounts(): Promise<MonetaAccount[]>;
  getAccountTransactions(accountId: string | number, limit?: number): Promise<MonetaTransaction[]>;
  createTransaction(payload: Partial<MonetaTransaction>): Promise<MonetaTransaction>;

  // Optional capabilities
  getGoals?(): Promise<FinancialGoal[]>;
  createGoal?(payload: Partial<FinancialGoal>): Promise<FinancialGoal>;
  getProperties?(): Promise<PropertyAsset[]>;
  getPendingChanges?(limit?: number): Promise<SyncChange[]>;
  // …51 endpoints across the domains documented in §3
}
```

---

## 2. Sync Direction & the Write-Endpoint Gap

Odoo was originally reached as a **query target**: the app asked it for data and displayed it. Sync requires the opposite — Odoo as a **replication target**, with SQLite as the always-present local copy that is periodically pushed to and pulled from.

That inversion has a consequence the endpoint list makes visible: **the API was built for a read-mostly client, and sync is bidirectional.** Every entity the client can change locally needs a *push* path.

| Entity | Server write endpoints | Can sync? |
| :--- | :--- | :---: |
| transactions, bills, goals, property, tenants, loans, budgets | `create` · `update` · `delete` | ✅ |
| **accounts** | `list`, `verify_balance` only | ❌ |
| **rent payments** | `list`, `mark_paid` only | ❌ |
| **payees** | `list`, `update` — no create | ⚠️ |
| investments | read + `trade` only | ⚠️ |

Full parity has been achieved for budgets (`createBudget`, `updateBudget`, `deleteBudget`) and batch transaction operations across the Odoo REST API and client adapters.

**Deletions need explicit support too.** Odoo's `unlink` removes rows, so a deleted record is simply absent from a query — indistinguishable from one never pushed from this client. Without server-side tombstones, a record deleted on one device is **resurrected** by the next pull from a device that still has it. Odoo's built-in `active` flag (archive rather than unlink) is the natural mechanism. See [ADR 0006 §4](adr/0006-sync-conflict-policy.md).

---

## 3. Odoo 18 REST Controller Endpoints

All 51 endpoints live in `moneta_core/controllers/api_mobile.py`. The authoritative list of what the client calls is [`src/lib/api/odooApi.ts`](../src/lib/api/odooApi.ts) — **route parity between the two is a verification step** (`AGENTS.md` §5 step 4), because a client call with no server route fails only when connected to Moneta Cloud.

### Core

| Endpoint | Purpose | Key parameters |
| :--- | :--- | :--- |
| `/api/v1/mobile/ping` | Connection test & user identity | — |
| `/api/v1/mobile/dashboard/summary` | Consolidated wealth & FIRE metrics | — |
| `/api/v1/mobile/accounts/list` | All accounts, including tangible properties | — |
| `/api/v1/mobile/accounts/verify_balance` | Recompute and verify account running balance | `account_id` |
| `/api/v1/mobile/settings` | Base currency, FX rates, categorization rules | — |

### Transactions

| Endpoint | Purpose | Key parameters |
| :--- | :--- | :--- |
| `/api/v1/mobile/transactions/register` | Account register rows | `account_id`, `limit` |
| `/api/v1/mobile/transactions/create` | Create a transaction | `account_id`, `date`, `payee_name`, `amount`, `memo` |
| `/api/v1/mobile/transactions/batch_create` | Atomic batch transaction creation | `transactions` (list) |
| `/api/v1/mobile/transactions/update` | Edit an existing transaction | `id`, plus any changed fields |
| `/api/v1/mobile/transactions/delete` | Delete a transaction | `id` |
| `/api/v1/mobile/transactions/reconcile` | Cycle reconciliation state | `transaction_id`, `reconciliation_state` |

> Note the register endpoint is `register`, **not** `list`. An earlier revision of this document recorded `transactions/list`, which has never existed on the server — the same error that once shipped in the client and 404'd the register when connected to Moneta Cloud.

### Bills, budgets & subscriptions

| Endpoint | Purpose | Key parameters |
| :--- | :--- | :--- |
| `/api/v1/mobile/budgets/list` · `create` · `update` · `delete` | Envelope budget CRUD | budget fields · `budget_id` |
| `/api/v1/mobile/bills/upcoming` | Bills due within N days | `days` |
| `/api/v1/mobile/bills/create` · `update` · `delete` | Recurring bill CRUD | bill fields · `bill_id` |
| `/api/v1/mobile/bills/mark_paid` | Post the expense and advance the due date | `bill_id`, `account_id`, `date` |
| `/api/v1/mobile/subscriptions/detect` | Infer recurring charges from history | — |

### Goals, investments, property, loans

| Endpoint | Purpose | Key parameters |
| :--- | :--- | :--- |
| `/api/v1/mobile/goals/list` · `create` · `update` · `delete` | Financial goal CRUD | goal fields · `goal_id` |
| `/api/v1/mobile/goals/fund` | Deposit into or withdraw from a goal | `goal_id`, `amount`, `action_type` |
| `/api/v1/mobile/investments/holdings` | Portfolio positions | `account_id` (optional) |
| `/api/v1/mobile/investments/lots` | Open tax lots | `symbol`, `account_id`, `state` |
| `/api/v1/mobile/investments/disposals` | Realized capital-gains schedule | `year` |
| `/api/v1/mobile/investments/trade` | Execute a buy or sell | account, symbol, action, quantity, price, strategy |
| `/api/v1/mobile/investments/summary` | Totals, TWR/MWR, allocation | `account_id` (optional) |
| `/api/v1/mobile/property/list` · `create` · `update` · `delete` | Property CRUD | property fields · `property_id` |
| `/api/v1/mobile/property/valuation` | Record an appraisal | `property_id`, `valuation_date`, `appraised_value` |
| `/api/v1/mobile/tenants/list` · `create` · `update` · `delete` | Tenant & lease CRUD | tenant fields · `tenant_id` |
| `/api/v1/mobile/tenants/generate_rent` | Generate the rent schedule (idempotent) | `tenant_id` |
| `/api/v1/mobile/rent/list` | Rent roll | `tenant_id` (optional) |
| `/api/v1/mobile/rent/mark_paid` | Settle a rent payment | `payment_id` |
| `/api/v1/mobile/loans/list` · `create` · `update` · `delete` | Loan scenario CRUD | scenario fields · `scenario_id` |
| `/api/v1/mobile/loans/infer_rates` | Infer rate changes from interest payments | `scenario_id` |

### Payees

| Endpoint | Purpose | Key parameters |
| :--- | :--- | :--- |
| `/api/v1/mobile/payees/list` | Merchant intelligence | — |
| `/api/v1/mobile/payees/update` | Update payee metadata | `payee_id`, plus changed fields |

> **One server route has no client caller:** `/api/v1/mobile/action/undo`, which exposes the Odoo action-history undo engine. It is intentionally unused — there is no Desktop UI for it yet.

All requests follow the Odoo 18 JSON-RPC envelope:

```json
{
  "jsonrpc": "2.0",
  "params": {
    "account_id": 14,
    "limit": 100
  }
}
```

---

## 4. Bearer PAT Authentication

Authentication uses Odoo's native **Personal Access Token (PAT)** system (`res.users.apikeys`):

1. **Headers**: Requests pass the authorization header:
   ```http
   Authorization: Bearer <API_KEY>
   ```
2. **Scoping**: Odoo scopes every database query to `request.env.user` corresponding to the token owner, applying all multi-tenant security rules.
3. **Prefix Normalization**: Moneta Wealth's API client ([`src/lib/api/client.ts`](file:///opt/moneta_wealth/src/lib/api/client.ts)) automatically strips redundant `"Bearer "` prefixes to prevent malformed auth headers.

---

## 5. Cross-Origin (CORS) & Network Architecture

Connecting a desktop webview or browser app to an external Odoo server faces browser Cross-Origin Resource Sharing (CORS) restrictions. Moneta Wealth solves this with a **dual-architecture network bridge**:

```
+-------------------------------------------------------------------------+
|                  DUAL-ARCHITECTURE NETWORK BRIDGE                       |
|                                                                         |
|  [ Environment A: Local Development (Vite Dev Server) ]                |
|  ├── Requests route to relative path: "/api/v1/mobile/..."             |
|  ├── Vite reverse proxy forwards traffic to remote server               |
|  └── Same-origin request: Bypasses browser CORS preflight entirely      |
|                                                                         |
|  [ Environment B: Standalone Tauri Desktop App (Production) ]          |
|  ├── Axios configured with Tauri HTTP Plugin (@tauri-apps/plugin-http)  |
|  ├── HTTP calls execute via native Rust reqwest networking core         |
|  └── Native OS execution: Zero CORS restrictions or preflight blocks    |
+-------------------------------------------------------------------------+
```

### Vite Dev Proxy Configuration
In [`vite.config.ts`](file:///opt/moneta_wealth/vite.config.ts):
```typescript
server: {
  proxy: {
    '/api': {
      target: 'https://weeseng.dev8.ansis.com.sg',
      changeOrigin: true,
      secure: false,
    },
  },
}
```

### Tauri Native Rust Adapter
In [`src/lib/api/client.ts`](file:///opt/moneta_wealth/src/lib/api/client.ts):
```typescript
if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
  // Use Tauri's native Rust HTTP client to bypass browser CORS
  client.defaults.adapter = createTauriAdapter();
}
```
