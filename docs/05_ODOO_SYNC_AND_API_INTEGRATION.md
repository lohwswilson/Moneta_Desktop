# Odoo 18 Sync & API Integration

Moneta Desktop can operate completely standalone or connect directly to a live, self-hosted **Odoo 18 server** running the [`moneta_finance`](https://github.com/lohwswilson/moneta_finance) module.

---

## 1. Pluggable Repository Pattern

All data access is mediated through the [`IMonetaRepository`](file:///opt/moneta_desktop/src/lib/data/repository.ts) interface:

```typescript
export interface IMonetaRepository {
  testConnection(): Promise<{ success: boolean; message: string; user?: string }>;
  getDashboardSummary(): Promise<DashboardMetrics>;
  getAccounts(): Promise<MonetaAccount[]>;
  getAccountTransactions(accountId: string | number, limit?: number): Promise<MonetaTransaction[]>;
  updateReconciliationState(
    transactionId: string | number,
    state: ReconcileState
  ): Promise<{ success: boolean; cleared_balance?: number }>;
  createTransaction(payload: Partial<MonetaTransaction>): Promise<MonetaTransaction>;
  batchCreateTransactions?(
    accountId: string | number,
    transactions: Partial<MonetaTransaction>[]
  ): Promise<MonetaTransaction[]>;
}
```

The active driver is switched on the fly without page reloads:
- `SqliteAdapter`: Embedded WebAssembly SQLite with IndexedDB storage.
- `OdooAdapter`: Remote Odoo 18 REST / JSON-RPC server with Bearer PAT auth.
- `MockAdapter`: In-memory sandbox for demonstration and offline testing.

---

## 2. Odoo 18 REST Controller Endpoints

All 46 endpoints live in `moneta_finance/controllers/api_mobile.py`. The authoritative list of what the client calls is [`src/lib/api/odooApi.ts`](../src/lib/api/odooApi.ts) — **route parity between the two is a verification step** (`AGENTS.md` §5 step 4), because a client call with no server route fails only in Live Odoo mode.

### Core

| Endpoint | Purpose | Key parameters |
| :--- | :--- | :--- |
| `/api/v1/mobile/ping` | Connection test & user identity | — |
| `/api/v1/mobile/dashboard/summary` | Consolidated wealth & FIRE metrics | — |
| `/api/v1/mobile/accounts/list` | All accounts, including tangible properties | — |
| `/api/v1/mobile/settings` | Base currency, FX rates, categorization rules | — |

### Transactions

| Endpoint | Purpose | Key parameters |
| :--- | :--- | :--- |
| `/api/v1/mobile/transactions/register` | Account register rows | `account_id`, `limit` |
| `/api/v1/mobile/transactions/create` | Create a transaction | `account_id`, `date`, `payee_name`, `amount`, `memo` |
| `/api/v1/mobile/transactions/update` | Edit an existing transaction | `id`, plus any changed fields |
| `/api/v1/mobile/transactions/delete` | Delete a transaction | `id` |
| `/api/v1/mobile/transactions/reconcile` | Cycle reconciliation state | `transaction_id`, `reconciliation_state` |

> Note the register endpoint is `register`, **not** `list`. An earlier revision of this document recorded `transactions/list`, which has never existed on the server — the same error that once shipped in the client and 404'd the register in Live Odoo mode.

### Bills, budgets & subscriptions

| Endpoint | Purpose | Key parameters |
| :--- | :--- | :--- |
| `/api/v1/mobile/budgets/list` | Envelope budgets | — |
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

## 3. Bearer PAT Authentication

Authentication uses Odoo's native **Personal Access Token (PAT)** system (`res.users.apikeys`):

1. **Headers**: Requests pass the authorization header:
   ```http
   Authorization: Bearer <API_KEY>
   ```
2. **Scoping**: Odoo scopes every database query to `request.env.user` corresponding to the token owner, applying all multi-tenant security rules.
3. **Prefix Normalization**: Moneta Desktop's API client ([`src/lib/api/client.ts`](file:///opt/moneta_desktop/src/lib/api/client.ts)) automatically strips redundant `"Bearer "` prefixes to prevent malformed auth headers.

---

## 4. Cross-Origin (CORS) & Network Architecture

Connecting a desktop webview or browser app to an external Odoo server faces browser Cross-Origin Resource Sharing (CORS) restrictions. Moneta Desktop solves this with a **dual-architecture network bridge**:

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
In [`vite.config.ts`](file:///opt/moneta_desktop/vite.config.ts):
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
In [`src/lib/api/client.ts`](file:///opt/moneta_desktop/src/lib/api/client.ts):
```typescript
if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
  // Use Tauri's native Rust HTTP client to bypass browser CORS
  client.defaults.adapter = createTauriAdapter();
}
```
