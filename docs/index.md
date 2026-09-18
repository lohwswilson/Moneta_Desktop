# Moneta Desktop

### **High-Performance, Offline-First Personal Finance & Wealth Desktop Application**

**Moneta Desktop** is a standalone, portable personal finance application combining the checkbook ledger precision of **Quicken Premier**, the zero-based budgeting discipline of **YNAB**, and modern fintech visuals. Built with **Tauri v2**, **Svelte 5 (Runes-native)**, **TypeScript**, **Tailwind CSS v4**, and **SQLite**.

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
|  └── Connection & Migration Modal (Odoo 18 / Local SQLite / Sandbox)    |
|                                                                         |
|  [ Pluggable Data Repository (IMonetaRepository) ]                      |
|  ├── Driver 1: Local SQLite Adapter (sql.js WASM + IndexedDB Store)     |
|  ├── Driver 2: Live Odoo 18 Adapter (/api/v1/mobile/* via Bearer PAT)   |
|  └── Driver 3: Demo Sandbox Adapter (In-Memory Mock Financial State)   |
|                                                                         |
|  [ Specialized Financial Engines ]                                      |
|  ├── Singapore Merchant Auto-Categorization Engine (33 default rules)   |
|  ├── Bank Statement Parser (DBS, OCBC, UOB, StanChart, Quicken QIF)     |
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

---

## 📊 Feature Comparison Matrix

| Feature / Capability | Moneta Desktop | Quicken Premier | YNAB | Monarch Money | Odoo moneta_finance |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **100% Offline Standalone** | **✔ Native SQLite** | ✖ Requires Login | ✖ Cloud Only | ✖ Cloud Only | ✖ Server Required |
| **Portable Single-Binary App** | **✔ Tauri v2 (~35 MB)** | ✖ Heavyweight (~500MB) | ✖ Electron (~300MB) | ✖ Electron (~250MB) | ✖ Web Browser |
| **Checkbook Running Balance** | **✔ Native** | ✔ Native | ✖ No | ✖ No | ✔ Native |
| **1-Click Clr Reconcile Toggle** | **✔ Native** | ✔ Native | Partial | ✖ No | ✔ Native |
| **Split Transactions with Nested View** | **✔ Native** | ✔ Native | ✔ Native | ✔ Native | ✔ Native |
| **Bank Statement CSV/QIF Import** | **✔ Built-in Wizard** | ✔ Native | ✔ Native | ✔ Native | ✔ Server Wizard |
| **Singapore Bank Recognition** | **✔ DBS/OCBC/UOB/SC** | ✖ US Only | ✖ US Focused | ✖ US Focused | ✔ Native |
| **Auto-Categorization Rules** | **✔ 33 SG Rules** | ✔ Rules | ✔ Rules | ✔ Rules | ✔ Server Rules |
| **Direct Odoo 18 Server Sync** | **✔ Native (Bearer PAT)**| ✖ No | ✖ No | ✖ No | Host Backend |
| **Zero Subscription Cost** | **✔ Free & Open-Source** | ✖ $70+/yr | ✖ $109/yr | ✖ $100/yr | ✔ Free Self-Hosted |

---

## 📖 Documentation Index

1. **[Getting Started & Installation](01_GETTING_STARTED.md)**: Setup, running desktop vs browser mode, connection configuration, and Odoo migration.
2. **[Banking & Checkbook Register](02_BANKING_AND_CHECKBOOK_REGISTER.md)**: Register mechanics, running balance tiebreakers, reconciliation states, and split transactions.
3. **[Bank Statement Wizard & Rules Engine](03_BANK_STATEMENT_WIZARD_AND_RULES.md)**: Statement parsing, Singapore bank presets, duplicate detection, and categorization rules.
4. **[Local SQLite & Offline Storage](04_LOCAL_SQLITE_AND_OFFLINE_STORAGE.md)**: WebAssembly SQLite, IndexedDB persistence, database schemas, and `.sqlite` export.
5. **[Odoo 18 Sync & API Integration](05_ODOO_SYNC_AND_API_INTEGRATION.md)**: Pluggable repository, `/api/v1/mobile/*` endpoints, Bearer PAT auth, and CORS handling.
6. **[Wealth Command Center & Analytics](06_COMMAND_CENTER_AND_FIRE_ANALYTICS.md)**: Net worth calculations, emergency runway, burn rates, and 4% FIRE tracking.
7. **[Product Roadmap & Parity Plan](07_ROADMAP_AND_FEATURE_PARITY.md)**: Detailed phase-by-phase parity roadmap with Odoo `moneta_finance`.
