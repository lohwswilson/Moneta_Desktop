# Moneta Desktop

<div align="center">

**A High-Performance, Portable, Offline-First Personal Finance & Wealth Desktop Application**

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
git clone https://github.com/lohwswilson/Moneta_Desktop.git
cd Moneta_Desktop
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

See [`ROADMAP.md`](ROADMAP.md) for our detailed feature parity roadmap covering:
- Phase 2: Advanced Banking, Split Transactions & Statement Reconciliation Wizard
- Phase 3: Zero-Based Envelope Budgeting & 12-Month Cash Flow Sankey Forecaster
- Phase 4: Stock & ETF Portfolio, Real-time Yahoo Quotes & Tax-Lot Accounting (FIFO/HIFO)
- Phase 5: Real Estate, Mortgage Amortization & Debt Prepayment Simulator
- Phase 6: Regional Financial Packs (Singapore CPF Hub & Malaysia EPF/KWSP)
- Phase 7: 1,000-Path Monte Carlo Stochastic Wealth Simulator & Local AI Advisor
- Phase 8: Cloud Synchronization (Supabase PostgreSQL + Stripe Subscription)

---

## 📄 License
This project is licensed under the MIT License.
