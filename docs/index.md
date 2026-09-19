# Moneta Wealth

### **High-Performance, Offline-First Personal Finance & Wealth Desktop Application**

**Moneta Wealth** is a standalone, portable personal finance application combining the checkbook ledger precision of **Quicken Premier**, the zero-based budgeting discipline of **YNAB**, and modern fintech visuals. Built with **Tauri v2**, **Svelte 5 (Runes-native)**, **TypeScript**, **Tailwind CSS v4**, and **SQLite**.

It operates completely **100% offline-first** using an embedded WebAssembly SQLite database with persistent IndexedDB auto-save, while seamlessly offering a pluggable data adapter to synchronize with live self-hosted **Odoo 18 (`moneta_finance`)** servers via Personal Access Token (PAT) authentication.

---

## 🏛️ System Architecture

```
+-------------------------------------------------------------------------+
|                  MONETA DESKTOP (Tauri v2 + Svelte 5)                   |
|                                                                         |
|  [ Svelte 5 Reactive UI Layer ]                                         |
|  ├── Wealth Command Center (Net Worth, Runway, 4% FIRE Progress)        |
|  ├── Checkbook Register (1-Click Clr, Running Balance, Split Badges)    |
|  ├── Bank Statement Import Wizard (CSV & QIF Drag-and-Drop)             |
|  ├── Split Transaction Modal (Live Remainder Allocation Math)           |
|  ├── Envelope Budget Hub (Zero-Based, Can-I-Spend Calculator)           |
|  ├── Recurring Bills & Subscription Detector (14/30-Day Horizon)        |
|  ├── Cash Flow Forecaster & Sankey Diagram (30-365 Day Projection)      |
|  ├── Financial Goals Tracker (Milestones & Sinking Funds)               |
|  ├── Payee Intelligence Directory (Cadence & Spend Analytics)           |
|  ├── Stock Portfolio & Tax-Lot Hub (Holdings, Lots, Gains, Alloc)       |
|  ├── Property, Loans & Landlord Hubs (Equity, Payoff, Rent Roll)        |
|  └── Connection & Migration Modal (Odoo 18 / Local SQLite / Sandbox)    |
|                                                                         |
|  [ Pluggable Data Repository (IMonetaRepository) ]                      |
|  ├── Driver 1: Local SQLite Adapter (sql.js WASM + IndexedDB Store)     |
|  ├── Driver 2: Live Odoo 18 Adapter (/api/v1/mobile/* via Bearer PAT)   |
|  └── Driver 3: Demo Sandbox Adapter (In-Memory Mock Financial State)    |
|                                                                         |
|  [ Specialized Financial Engines ]                                      |
|  ├── Singapore Merchant Auto-Categorization Engine (33 default rules)   |
|  ├── Bank Statement Parser (DBS, OCBC, UOB, StanChart, Quicken QIF)     |
|  ├── Payee Cadence & Spend Aggregation Engine (180-day clustering)      |
|  ├── Cash Flow Projection & Sankey Graph Builder (30-365 day horizon)   |
|  ├── Goal Progress Engine (shared, mirrors Odoo relativedelta maths)    |
|  ├── Tax-Lot Disposal Engine (FIFO/LIFO/HIFO/SpecID) & TWR/MWR Engine   |
|  ├── Loan Amortization & Prepayment Engine (step-rate, 360-payment term)|
|  ├── Property Equity & Rental Yield Engine (LTV, NOI, rent roll)        |
|  └── Point-in-Time Running Balance Partition Engine                     |
+-------------------------------------------------------------------------+
```

---

## 🌟 Available Core Capabilities

### 1. 💎 Wealth Command Center
- **Consolidated Net Worth**: Real-time aggregation of liquid cash, savings, brokerage portfolios, and liabilities.
- **Liquid Cash Reserve**: Immediate visibility into liquid capital across checking, savings, and cash accounts.
- **Total Liabilities**: Tracking credit card balances, personal loans, and mortgages.
- **4% Rule FIRE Milestone**: Progress bar and milestone calculations based on current monthly burn rate.
- **Emergency Runway Months**: Live runway calculation based on liquid reserves divided by monthly burn.

### 2. 📋 Interactive Checkbook Register
- **Running Balances**: Chronologically ordered with credit-before-debit tiebreakers (`date desc, amount asc, id desc`) to prevent artificial negative balance dips on same-day funded purchases.
- **1-Click Interactive `Clr` Toggle**:
  Cycle reconciliation state directly from the table:
  `unreconciled` (UNC) $\rightarrow$ `cleared` (CLR) $\rightarrow$ `reconciled` (REC) $\rightarrow$ `unreconciled` (UNC).
- **Cleared vs Total Balance**: Live calculation of cleared balance based on cleared and reconciled transactions.
- **Real-Time Filtering & Search**: Instant filtering by status (All, Unreconciled, Cleared, Reconciled) and payee/category/memo text search.

### 3. ✂️ Multi-Category Split Transactions
- **Line-Item Category Allocations**: Split any single debit or credit across multiple budget categories and memos.
- **Live Allocation Math**: Form tracks allocated amount vs total transaction amount in real-time, displaying `Remaining to allocate: $X.XX` or `Fully Allocated ($Total)`.
- **Interactive Remainder Auto-Fill**: One-click `max` button automatically calculates and fills remaining unallocated balances.
- **Register Split Badges & Expansion**: Transactions containing splits display a purple `[SPLIT (N)]` badge in the register; clicking expands a nested breakdown row showing each split's category, individual amount, and memo.

### 4. 📥 Bank Statement Import Wizard
- **Universal CSV & QIF Parser**: Supports comma, semicolon, and tab delimiters, standardizing diverse date formats (`DD/MM/YYYY`, `DD Mon YYYY`, `YYYY-MM-DD`).
- **Singapore Bank Presets**: Tested recognition for **DBS/POSB**, **OCBC**, **UOB**, and **Standard Chartered**.
- **Intelligent Duplicate Detection**: Scans the active ledger and flags transactions with identical dates and amounts as potential duplicates, automatically deselecting them.
- **Batch Import to Ledger**: Live inflow/outflow tallies, inline category/payee editing, and one-click commit into SQLite or the active repository.

### 5. 🪄 Singapore Merchant Rules Engine
- **Priority-Based Substring Matching**: Matches merchant keywords against payee names and memos.
- **33 Default Singapore Rules**: Pre-loaded with patterns for FairPrice, Sheng Siong, Cold Storage, Grab, Gojek, Bacha Coffee, Toast Box, SP Services, Singtel, StarHub, Netflix, Apple, Salary, and Dividends.
- **Real-Time Pre-Classification**: Suggests categories dynamically while typing payees in QuickAdd and pre-classifies all imported bank statement rows.

### 6. 🗄️ Offline-First SQLite with 1-Click Odoo Migration
- **Zero-Server Standalone**: WebAssembly SQLite (`sql.js`) stores data locally with automatic persistence to browser IndexedDB.
- **Binary Backup Export**: 1-click `.sqlite` file export for external backups or analysis in SQLite tools.
- **1-Click Odoo Migration**: Seamlessly connects to a live Odoo 18 `moneta_finance` server, downloads all accounts and historical transactions, and populates local SQLite tables automatically.

### 7. 🎯 Zero-Based Envelope Budgets
- **Category Envelopes**: Monthly income allocation across Needs, Wants and Savings with a live burn-pace indicator.
- **Safe to Spend**: Remaining allowance computed after committed allocation.
- **"Can I Spend?" Calculator**: Evaluates a proposed purchase against the relevant envelope, warns on overdraft, and suggests donor envelopes to reallocate from.

### 8. 🔁 Recurring Bills & Subscription Detector
- **Countdown Calendar**: 14-day / 30-day horizons with `overdue`, `today`, `due_soon` and `upcoming` status badges.
- **1-Click Mark as Paid**: Posts the ledger expense and advances the due date in one action.
- **Subscription Detection**: Clusters 180 days of ledger history by payee and interval to surface recurring charges that were never explicitly scheduled.

### 9. 📈 Cash Flow Forecaster & Sankey Diagram
- **30–365 Day Projection**: Projected balance trajectory from scheduled income and recurring bills.
- **Daily Projected Ledger**: Opening balance, income, expense, net change and closing balance per day, with overdraft flags.
- **Interactive Sankey**: Income Sources → Liquid Cash Hub → Expenses & Savings envelopes.
- **Overdraft Risk**: Lowest projected balance, its date, and days-in-the-red count.

### 10. 🏆 Financial Goals Tracker
- **Milestone Goals**: Emergency fund, down payment, holiday and similar targets with progress bars and optional dedicated funding accounts.
- **Derived Contribution Targets**: Months remaining and the monthly contribution each goal needs, computed by one shared helper so every data source agrees.
- **Deposit / Withdraw Modal**: Live preview of the resulting balance.

### 11. 🏪 Payee Intelligence & Directory
- **Autocomplete with Memory**: Selecting a payee recalls its category and prefills the typical amount.
- **Cadence Detection**: `weekly`, `biweekly`, `monthly`, `quarterly`, `yearly` or `irregular`.
- **Spend Analytics**: Lifetime spend, transaction count and average ticket size per merchant.

### 12. 📊 Stock Portfolio & Tax-Lot Accounting
- **Holdings Register**: Multi-brokerage positions across four sub-views — holdings, lots, realized gains and allocation.
- **Tax-Lot Accounting**: FIFO, LIFO, HIFO and Specific Lot Identification with per-disposal short/long-term classification.
- **Performance Metrics**: TWR via Modified Dietz and MWR via XIRR, both in one shared engine.
- **Known boundary**: prices are maintained by hand (no quote provider), and a trade does not yet post to the cash ledger.

### 13. 🏡 Property, Mortgages & Landlord Hub
- **Property Equity & Valuation**: Real estate, vehicle and valuables tracking with linked mortgage accounts, derived equity and LTV, and a per-asset appraisal history.
- **Mortgage Amortization**: Month-by-month principal vs interest with step-rate support and rate inference from ledger interest payments.
- **Debt Prepayment Simulator**: Live extra-monthly and lump-sum modelling showing interest and time saved.
- **Landlord & Rent Roll**: Tenants, leases, idempotent rent-schedule generation, 1-click Mark Paid, and overdue detection.
- **Known boundaries**: equity is clamped at zero to match Odoo, and the property maintenance ledger has no upstream counterpart to mirror.

---

## 📊 Feature Comparison Matrix

| Feature / Capability | Moneta Wealth | Quicken Premier | YNAB | Monarch Money | Odoo moneta_finance |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **100% Offline Standalone** | **✔ Native SQLite** | ✖ Requires Login | ✖ Cloud Only | ✖ Cloud Only | ✖ Server Required |
| **Portable Single-Binary App** | **✔ Tauri v2 (~35 MB)** | ✖ Heavyweight (~500MB) | ✖ Electron (~300MB) | ✖ Electron (~250MB) | ✖ Web Browser |
| **Checkbook Running Balance** | **✔ Native** | ✔ Native | ✖ No | ✖ No | ✔ Native |
| **1-Click Clr Reconcile Toggle** | **✔ Native** | ✔ Native | Partial | ✖ No | ✔ Native |
| **Split Transactions with Nested View** | **✔ Native** | ✔ Native | ✔ Native | ✔ Native | ✔ Native |
| **Bank Statement CSV/QIF Import** | **✔ Built-in Wizard** | ✔ Native | ✔ Native | ✔ Native | ✔ Server Wizard |
| **Singapore Bank Recognition** | **✔ DBS/OCBC/UOB/SC** | ✖ US Only | ✖ US Focused | ✖ US Focused | ✔ Native |
| **Auto-Categorization Rules** | **✔ 33 SG Rules** | ✔ Rules | ✔ Rules | ✔ Rules | ✔ Server Rules |
| **Zero-Based Envelope Budgeting** | **✔ Native** | ✖ No | ✔ Native | ✔ Native | ✔ Native |
| **Recurring Bill Countdown** | **✔ Native** | ✔ Native | ✔ Native | ✔ Native | ✔ Native |
| **Cash Flow Sankey & Forecast** | **✔ 30–365 Days** | Partial | ✖ No | ✔ Native | ✔ Native |
| **Financial Goals & Sinking Funds** | **✔ Native** | ✔ Native | ✔ Native | ✔ Native | ✔ Native |
| **Stock & Tax-Lot Portfolio** | **✔ FIFO/LIFO/HIFO/SpecID** | ✔ Native | ✖ No | ✔ Native | ✔ Native |
| **TWR / MWR Performance Metrics** | **✔ Dietz + XIRR** | ✔ Native | ✖ No | ✔ Native | ✔ Native |
| **Property Equity & Property LTV** | **✔ Native** | ✔ Native | ✖ No | ✔ Native | ✔ Native |
| **Mortgage Amortization & Prepayment** | **✔ Native** | ✔ Native | ✖ No | Partial | ✔ Native |
| **Landlord Rent Roll & Tenants** | **✔ Native** | ✖ No | ✖ No | ✖ No | ✔ Satellite |
| **Direct Odoo 18 Server Sync** | **✔ Native (Bearer PAT)**| ✖ No | ✖ No | ✖ No | Host Backend |
| **Cost** | **✔ Free desktop app; Cloud S$9/mo** | ✖ $70+/yr | ✖ $109/yr | ✖ $100/yr | ✔ Free Self-Hosted |

---

## 📖 Documentation Index

1. **[Getting Started & Installation](01_GETTING_STARTED.md)**: Setup, running desktop vs browser mode, connection configuration, and Odoo migration.
2. **[Banking & Checkbook Register](02_BANKING_AND_CHECKBOOK_REGISTER.md)**: Register mechanics, running balance tiebreakers, reconciliation states, and split transactions.
3. **[Bank Statement Wizard & Rules Engine](03_BANK_STATEMENT_WIZARD_AND_RULES.md)**: Statement parsing, Singapore bank presets, duplicate detection, and categorization rules.
4. **[Local SQLite & Offline Storage](04_LOCAL_SQLITE_AND_OFFLINE_STORAGE.md)**: WebAssembly SQLite, IndexedDB persistence, the full DDL schema, and `.sqlite` export.
5. **[Odoo 18 Sync & API Integration](05_ODOO_SYNC_AND_API_INTEGRATION.md)**: Pluggable repository, `/api/v1/mobile/*` endpoints, Bearer PAT auth, and CORS handling.
6. **[Wealth Command Center & Analytics](06_COMMAND_CENTER_AND_FIRE_ANALYTICS.md)**: Net worth calculations, emergency runway, burn rates, and 4% FIRE tracking.
7. **[Product Roadmap & Parity Plan](07_ROADMAP_AND_FEATURE_PARITY.md)**: Phase-by-phase parity audit against Odoo `moneta_finance`.
8. **[Planning, Budgeting & Forecasting Hubs](08_PLANNING_AND_FORECASTING_HUBS.md)**: Envelope budgets, recurring bills, cash flow forecasting and financial goals.
9. **[Payee Intelligence & Directory](09_PAYEE_INTELLIGENCE_AND_DIRECTORY.md)**: Merchant memory, cadence detection and spend analytics.
10. **[Stock Portfolio & Tax-Lot Accounting](10_STOCK_PORTFOLIO_AND_TAX_LOTS.md)**: Holdings register, disposal strategies, TWR/MWR, and the two Phase 4 boundaries.
11. **[Property, Mortgages & Rental Income](11_PROPERTY_MORTGAGES_AND_RENTAL.md)**: Property equity, the amortization engine, the rent roll, and the Phase 5 divergences.

### Architecture Decision Records

| ADR | Decision |
| :--- | :--- |
| [0001](adr/0001-subscription-tiers-and-cloud-sync.md) | Subscription tiers and cloud sync — entitlement gating, licence tokens, local-first plus sync, and the supersession of Phase 8 |
| [0002](adr/0002-moneta-cloud-platform.md) | Moneta Cloud platform — stay on Odoo, narrowed to a sync store plus licensing and billing; shared instances, version pinning, LGPL position |
| [0003](adr/0003-licence-and-billing-topology.md) | Licence and billing topology — one licence database, local token verification, enforcement via the sync service, ANSIS accounting linkage |
| [0004](adr/0004-entitlement-matrix-and-lifecycle.md) | Entitlement matrix and customer lifecycle — what each tier can access, pricing, the upgrade path, and cancellation |
| [0005](adr/0005-open-source-and-licence.md) | Open source and licence choice — Apache-2.0 for the desktop app, proprietary server, and the reasoning for each |
| [0006](adr/0006-sync-conflict-policy.md) | Sync conflict policy — server-arrival last-write-wins, tombstones, and why the clock is not consulted |
