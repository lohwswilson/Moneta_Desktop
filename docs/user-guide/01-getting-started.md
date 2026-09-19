# Getting Started & Interface Tour

This chapter guides you through launching Moneta Wealth, understanding its dual-runtime architecture, and navigating the core interface components.

---

## 🚀 Launching the Application

Moneta Wealth can be run in two modes: as a native desktop application using Tauri v2, or directly in any modern web browser.

=== "Native Desktop App (Tauri v2)"
    To launch the native desktop application with system tray integration and hardware acceleration:
    ```bash
    npm run start
    ```
    This invokes `run_desktop.sh`, which starts the local Vite engine and attaches the native Tauri window.

=== "Browser / Mobile Web Mode"
    To access the application in standard browser mode (useful for testing, headless setups, or local network access):
    ```bash
    npm run dev
    ```
    Open your browser and navigate to `http://127.0.0.1:5173`. The application automatically binds to your local IndexedDB storage driver with 100% full offline capability.

---

## 🖥️ User Interface Tour

Moneta Wealth is designed with a cohesive, focused personal finance layout consisting of four primary UI zones:

```
+-----------------------------------------------------------------------------------+
|  [TopMenuBar] Moneta Wealth  |  Banking  Planning  Investments  Real Estate  ...  |
+-----------------------------------------------------------------------------------+
|  [CommandCenter]                                                                  |
|  Net Worth: $485,210  |  Liquid: $62,400  |  Liabilities: $14,200  |  Runway: 14mo  |
+---------------------+-------------------------------------------------------------+
| [Sidebar]           |  [Active Main View / Hub]                                   |
|                     |                                                             |
| + Add Account       |  • Checkbook Register                                       |
| DBS Multiplier      |  • Zero-Based Budget Hub                                    |
| OCBC 365 Card       |  • Cash Flow & Sankey Hub                                   |
| CPF Ordinary        |  • Portfolio & Tax Lots                                     |
| Cash Wallet         |  • Property, Mortgages & Landlord Hub                       |
|                     |                                                             |
| Data & Backups ⚙️    |                                                             |
+---------------------+-------------------------------------------------------------+
```

### 1. Top Navigation Bar (`TopMenuBar.svelte`)
Located at the very top of the window, the `TopMenuBar.svelte` component provides category-level routing:
- **Banking**: Jump directly to checking, savings, and credit card registers.
- **Planning**: Switch between **Budgets** (zero-based envelopes), **Recurring Bills** (subscription radar), and **Cash Flow** (forward projections).
- **Investments**: Open the **Portfolio Hub** (equities, ETFs, and tax lots).
- **Real Estate**: Access **Property & Mortgages** or the **Landlord Hub** (tenants & rent roll).
- **System Actions**: Launch QuickAdd (`+`), Statement Import, and Database Manager.

### 2. Wealth Command Center (`CommandCenter.svelte`)
The `CommandCenter.svelte` banner gives you an instantaneous cockpit view of your complete financial vitality:
- **Net Worth**: Real-time sum of liquid cash, savings, CPF balances, and investment valuations minus credit cards and loans.
- **Liquid Cash**: Immediate capital available in checking, savings, and physical cash.
- **Total Liabilities**: Outstanding balances across credit cards, short-term debt, and mortgages.
- **Emergency Runway**: Number of months your liquid reserves can sustain your household at your current trailing average burn rate.
- **4% Rule FIRE Progress Bar**: Your progress toward the standard Financial Independence Number ($25 \times$ annual expenditures).

### 3. Navigation Sidebar (`Sidebar.svelte`)
The `Sidebar.svelte` panel resides on the left:
- **Account Groups**: Categorized listing of Banking, Credit Cards, Cash, Mortgages, and Brokerage accounts with live balances.
- **New Account Creation**: Dedicated `+` button in the header triggering [`AddAccountModal.svelte`](file:///opt/moneta_wealth/src/lib/components/AddAccountModal.svelte).
- **Hub Shortcuts**: Fast links to Payee Directory, Goals Hub, and Settings.
- **Database Status Indicator**: Live pill displaying current storage mode (`Local SQLite` or `Moneta Cloud`).

---

## ⚡ Keyboard Shortcuts & Quick Actions

| Shortcut / Action | Target Component | Description |
| :--- | :--- | :--- |
| Click **`+ Transaction`** | [`QuickAddModal.svelte`](file:///opt/moneta_wealth/src/lib/components/QuickAddModal.svelte) | Open quick entry modal with split allocations |
| Click **`Import Statement`** | [`StatementImportModal.svelte`](file:///opt/moneta_wealth/src/lib/components/StatementImportModal.svelte) | Open drag-and-drop CSV/QIF statement wizard |
| Click **`Verify Balance`** | [`VerifyBalanceModal.svelte`](file:///opt/moneta_wealth/src/lib/components/VerifyBalanceModal.svelte) | 10-second register reconciliation & balance adjustment |
| Click **`Database & Backups`** | [`ConnectionModal.svelte`](file:///opt/moneta_wealth/src/lib/components/ConnectionModal.svelte) | Export `.sqlite` backups, restore database, or reset ledger |
