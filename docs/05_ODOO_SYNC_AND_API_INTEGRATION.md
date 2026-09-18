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

When connected to Odoo, Moneta Desktop interfaces with [`moneta_finance/controllers/api_mobile.py`](file:///opt/PW/PW_ADDONS.18.0/moneta_finance/controllers/api_mobile.py):

| Endpoint | Method | Purpose | Payload Parameters |
| :--- | :--- | :--- | :--- |
| `/api/v1/mobile/ping` | `POST` | Connection test & user identity | None |
| `/api/v1/mobile/dashboard/summary` | `POST` | Consolidated metrics | `period` (optional) |
| `/api/v1/mobile/accounts/list` | `POST` | Fetch all active accounts | `include_inactive` (boolean) |
| `/api/v1/mobile/transactions/list` | `POST` | Account register rows | `account_id`, `limit`, `offset` |
| `/api/v1/mobile/transactions/reconcile` | `POST` | Toggle reconciliation state | `transaction_id`, `reconciliation_state` |
| `/api/v1/mobile/transactions/create` | `POST` | Create new transaction | `account_id`, `date`, `payee_name`, `amount`, `memo` |

All requests follow Odoo 18 JSON-RPC specification:
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
