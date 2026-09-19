# Moneta Wealth

<div align="center">

**Your Private Wealth Command Center**

*A High-Performance, Portable, Offline-First Personal Finance & Wealth Application*

Built with **Tauri v2**, **Svelte 5 (Runes-Native)**, **TypeScript**, **Tailwind CSS v4**, and **SQLite**.

</div>

---

## 🌟 Executive Highlights

- 🗄️ **Offline-First SQLite Architecture:** Zero server dependencies. Fast microsecond queries with single-file backup and export.
- ⚡ **Tauri v2 + Svelte 5:** Instant native launch, minimal RAM (~35 MB), compiled down to native macOS (`.dmg`) and Windows (`.msi`).
- 💎 **Wealth Command Center:** Real-time Net Worth, Liquid Cash reserve, Investment totals, Total Liabilities, and 4% FIRE milestone target.
- 📋 **Quicken-Style Interactive Ledger:** Checkbook registers with 1-click `Clr` toggles (`unreconciled` → `cleared` → `reconciled`), live running balances, and status filtering.
- ✂️ **Split Transactions:** Multi-category split allocations with real-time balance remainder checks, interactive auto-fill, `[SPLIT (N)]` register badges, and expandable nested breakdown rows.
- 📥 **Bank Statement Import Wizard:** Drag-and-drop CSV and Quicken QIF statement parser with Singapore bank recognition (DBS, OCBC, UOB, StanChart), automatic duplicate detection, and batch import.
- 🪄 **Singapore Rules Engine:** Automated categorization with 33 out-of-the-box merchant rules (FairPrice, Grab, Singtel, Bacha Coffee, SP Services, Netflix, etc.).
- 🎯 **Zero-Based Envelope Budgeting:** Category envelopes across Needs, Wants and Savings with burn-pace indicators, Safe-to-Spend, and a "Can I Spend?" affordability calculator.
- 🔁 **Recurring Bills & Subscription Detector:** 14/30-day countdown with `overdue` / `today` / `due_soon` badges, 1-click Mark-as-Paid, and interval-clustering detection of charges you never explicitly scheduled.
- 📈 **Cash Flow Forecaster & Sankey:** 30–365 day projected balance trajectory, a daily projected ledger with overdraft flags, and an interactive Income → Cash → Expenses Sankey.
- 🏆 **Financial Goals Tracker:** Milestone goals and sinking funds with progress bars and the monthly contribution each one needs, computed by a single shared engine so every data source agrees.
- 🏪 **Payee Intelligence:** Autocomplete that recalls a merchant's category and typical amount, plus cadence detection and lifetime spend analytics.
- 📊 **Stock Portfolio & Tax-Lot Accounting:** Multi-brokerage holdings across four sub-views, with FIFO/LIFO/HIFO/Specific-ID disposal and TWR/MWR performance metrics from one shared engine.
- 🏡 **Property, Mortgages & Landlord Hub:** Property equity and LTV with appraisal history, month-by-month mortgage amortization with step-rate support, a prepayment simulator, and a full tenant rent roll.
- 🔄 **Pluggable Data Engine:** Seamlessly connects to live Odoo 18 instances via REST API with Personal Access Token (PAT), or runs completely standalone on local SQLite.
- 🚀 **1-Click Odoo Migration:** One-click data migration tool to export accounts, categories, and historical registers from Odoo directly into local SQLite.

---

## 🛠️ Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Desktop Wrapper** | [Tauri v2](https://v2.tauri.app/) (Rust + Native Cocoa/WebKit) |
| **Frontend Framework** | [Svelte 5](https://svelte.dev/) (Runes-native reactivity: `$state`, `$derived`, `$props`) |
| **Styling** | [Tailwind CSS v4](https://tailwindcss.com/) + Custom Fintech Dark Theme |
| **Icons** | [Lucide Svelte](https://lucide.dev/) |
| **Database** | Embedded SQLite (WASM / Persistent IndexedDB) |
| **Backend Connectors** | Odoo 18 REST / JSON-RPC (`api_mobile.py` with Bearer PAT) |

---

## 🚀 Getting Started

### Prerequisites
- **Node.js:** `v20+` or `v26+`
- **npm:** `v10+`

### Quickstart (Development Mode)
```bash
git clone https://github.com/lohwswilson/Moneta_Wealth.git
cd Moneta_Wealth
npm install

# Run as standalone desktop app window
npm start

# Or run in standard browser development mode
npm run dev
```

### Running Native Tauri Desktop App
```bash
# Requires Rust toolchain installed (brew install rust)
npm run desktop:dev

# Build standalone distribution installer (.dmg / .msi)
npm run desktop:build
```

---

## 🗺️ Product Roadmap

See [`ROADMAP.md`](ROADMAP.md) for the detailed feature parity roadmap.

| Phase | Scope | Status |
| :--- | :--- | :---: |
| **1** | Foundation & Core Ledger | ✅ Complete |
| **2** | Advanced Banking, Split Transactions & Statement Reconciliation | ✅ Complete |
| **3** | Envelope Budgets, Recurring Bills, Cash Flow Sankey & Financial Goals | ✅ Complete |
| **4** | Stock Portfolio, Tax-Lot Accounting (FIFO/LIFO/HIFO/SpecID) & TWR/MWR | ✅ Complete |
| **5** | Property Equity, Mortgage Amortization, Prepayment Simulator & Landlord Hub | ✅ Complete |
| **6** | Regional Financial Packs (Singapore CPF Hub & Malaysia EPF/KWSP) | Planned |
| **7** | Monte Carlo Wealth Simulator & Local AI Advisor | Planned |
| **8** | Cloud Synchronization (Supabase + Stripe Subscription) | Planned |

---

## 📖 Documentation

Full documentation lives in [`docs/`](docs/index.md):

| # | Document | Covers |
| :--- | :--- | :--- |
| 01 | [Getting Started](docs/01_GETTING_STARTED.md) | Setup, desktop vs browser mode, Odoo migration |
| 02 | [Banking & Checkbook Register](docs/02_BANKING_AND_CHECKBOOK_REGISTER.md) | Register mechanics, tiebreakers, reconciliation, splits |
| 03 | [Statement Wizard & Rules Engine](docs/03_BANK_STATEMENT_WIZARD_AND_RULES.md) | CSV/QIF parsing, SG bank presets, duplicate detection |
| 04 | [Local SQLite & Offline Storage](docs/04_LOCAL_SQLITE_AND_OFFLINE_STORAGE.md) | WASM SQLite, IndexedDB persistence, full schema DDL |
| 05 | [Odoo 18 Sync & API Integration](docs/05_ODOO_SYNC_AND_API_INTEGRATION.md) | Pluggable repository, `/api/v1/mobile/*`, Bearer PAT |
| 06 | [Command Center & FIRE Analytics](docs/06_COMMAND_CENTER_AND_FIRE_ANALYTICS.md) | Net worth, runway, burn rate, 4% FIRE |
| 07 | [Roadmap & Feature Parity](docs/07_ROADMAP_AND_FEATURE_PARITY.md) | Phase-by-phase parity audit vs Odoo |
| 08 | [Planning & Forecasting Hubs](docs/08_PLANNING_AND_FORECASTING_HUBS.md) | Budgets, bills, cash flow, goals |
| 09 | [Payee Intelligence & Directory](docs/09_PAYEE_INTELLIGENCE_AND_DIRECTORY.md) | Merchant memory, cadence, spend analytics |
| 10 | [Stock Portfolio & Tax-Lot Accounting](docs/10_STOCK_PORTFOLIO_AND_TAX_LOTS.md) | Holdings, disposal strategies, TWR/MWR |
| 11 | [Property, Mortgages & Rental Income](docs/11_PROPERTY_MORTGAGES_AND_RENTAL.md) | Equity, amortization, prepayment, rent roll |

---

## ✅ Verification

```bash
npm run check    # svelte-check + tsc — must be 0 errors, 0 warnings
npm run build    # production bundle

# Goal progress maths (relativedelta month borrowing, overfunding, edge cases)
node --experimental-strip-types scripts/verify_goal_math.ts

# Portfolio maths (lot metrics, disposal ordering, TWR/MWR convergence)
node --experimental-strip-types scripts/verify_portfolio_math.ts

# Loan maths (360-vs-361 installments, payoff date, prepayment, rate steps)
node --experimental-strip-types scripts/verify_loan_math.ts

# Property maths (equity clamping, LTV, rent roll, schedule idempotency)
node --experimental-strip-types scripts/verify_property_math.ts
```

---

## 📄 License

Moneta Desktop is licensed under the **Apache License 2.0** — see [`LICENSE`](LICENSE).

**The desktop application is free and open source, permanently.** Use it offline, unmodified and unrestricted: no account, no login, no subscription, no telemetry. Fork it, audit it, build on it.

**Moneta Cloud is the paid tier** (S$9/month) and covers multi-device sync, Moneta Mobile, cloud backup and partner sharing. The subscription buys a **hosted service**, not the software — every feature runs in the free app; what you pay for is having your data on every device and backed up.

The two are separable by design. See [ADR 0001](docs/adr/0001-subscription-tiers-and-cloud-sync.md) and [ADR 0004](docs/adr/0004-entitlement-matrix-and-lifecycle.md) for the reasoning.

`moneta_finance`, the Odoo 18 backend module, is licensed separately under [LGPL-3.0](https://github.com/lohwswilson/moneta_finance).
