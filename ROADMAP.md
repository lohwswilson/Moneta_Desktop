# Moneta Desktop: Product Roadmap & Feature Parity Plan

This roadmap defines the multi-phase engineering plan to achieve full feature parity between the **Odoo `moneta_finance` suite** and the standalone, portable **Moneta Desktop** application built with **Tauri v2 + Svelte 5 + SQLite**.

---

## 🎯 Architecture Pillars

```
+-------------------------------------------------------------------------+
|                  MONETA DESKTOP (Tauri v2 + Svelte 5)                   |
|                                                                         |
|  [ Svelte 5 UI Layer ]                                                  |
|  ├── Fast Checkbook Registers (TanStack Table virtualized 120 FPS)      |
|  ├── Financial Dashboards & Charts (LayerChart / D3)                    |
|  └── Responsive Multi-Window Desktop Shell (Tauri Cocoa / Win32)        |
|                                                                         |
|  [ Pluggable Data Repository (IMonetaRepository) ]                      |
|  ├── Driver A: Standalone Local SQLite (100% Offline, Microsecond Speed)|
|  ├── Driver B: Live Odoo 18 Server (/api/v1/mobile/* with Bearer PAT)   |
|  └── Driver C: Supabase Cloud Sync (Pro Subscription Multi-Device Sync) |
|                                                                         |
|  [ Native Financial Computation Core (Rust / TypeScript) ]              |
|  ├── 1,000-Path Monte Carlo Wealth Simulator Worker                     |
|  ├── Tax-Lot Accounting Engine (FIFO / LIFO / Specific ID / Avg Cost)   |
|  ├── Loan & Mortgage Amortization Math Engine                           |
|  └── Singapore CPF & Malaysia EPF Regional Calculations                 |
+-------------------------------------------------------------------------+
```

---

## 📊 Phase-by-Phase Parity Roadmap

### Phase 1: Foundation & Core Ledger (Shipped & Active)
- [x] **Project Scaffolding:** Tauri v2 + Svelte 5 + Vite + TypeScript + Tailwind CSS v4.
- [x] **Pluggable Data Adapter:** `IMonetaRepository` supporting Live Odoo 18, Local SQLite, and Demo Sandbox.
- [x] **Local SQLite Engine:** WebAssembly SQLite (`sql.js`) with persistent IndexedDB auto-save and `.sqlite` export/backup.
- [x] **Wealth Command Center:** Total Net Worth, Liquid Cash, Investments, Liabilities, and 4% FIRE milestone target.
- [x] **Interactive Checkbook Register:** 1-Click `Clr` reconciliation toggle (`unreconciled` → `cleared` → `reconciled`), status filter tabs, and running balances.
- [x] **1-Click Odoo Migration:** One-click data migration from live Odoo server into local SQLite.

---

### Phase 2: Advanced Banking & Transaction Management (Completed & Active)
*Parity with Odoo `account.py`, `transaction.py`, `transaction_rule.py`, `payee.py`*

- [x] **Split Transactions:** Support splitting a single expense or deposit across multiple categories with live balance calculation, interactive remainder auto-fill, `[SPLIT (N)]` register badges, and expandable nested breakdown.
- [x] **Bank Statement Import Wizard:**
  - Import bank statements supporting CSV (comma/semicolon/tab) and Quicken QIF formats.
  - Built-in recognition for Singapore banks (DBS/POSB, OCBC, UOB, StanChart).
  - Intelligent duplicate detection preventing duplicate ledger imports.
  - Interactive preview table with mass select/deselect and category override.
- [x] **Automated Categorization Rules Engine:**
  - Priority-based substring matching on payees and memos.
  - 33 out-of-the-box Singapore merchant rules (FairPrice, Grab, Singtel, Bacha Coffee, SP Services, Netflix, etc.).
  - Real-time prediction pre-filling in QuickAdd and Import Wizard.
- [x] **Payee Intelligence & Directory:**
  - Auto-complete payees with historical category memory in QuickAdd transaction capture.
  - Dedicated Payee Intelligence Hub with cadence detection (`weekly`, `biweekly`, `monthly`, `quarterly`, `yearly`, `irregular`), historical spend analytics, average transaction ticket size, and category memory overrides.
  - Pluggable across Odoo 18 REST endpoints (`/api/v1/mobile/payees/*`) and offline SQLite WASM aggregation engine.
- [x] **Multi-Currency Engine:**
  - Built-in FX conversion table (USD, MYR, SGD parity rates).
  - Automatic base currency normalization across live Odoo API and offline SQLite.

---

### Phase 3: Planning, Envelope Budgets & Cash Flow (Completed & Active)
*Parity with Odoo `budget.py`, `recurring.py`, `cashflow_calendar.py`, `subscription_detector.py`*

- [x] **Zero-Based Envelope Budgeting (YNAB Paradigm):**
  - Monthly income allocation to category envelopes.
  - Real-time "Safe to Spend" and remaining allowance calculations.
  - Category breakdown by Needs, Wants, and Savings with visual burn pace indicator.
  - Interactive "Can I Spend?" Affordability Calculator modal with real-time envelope overdraft warning and donor reallocation suggestions.
  - Pluggable across Live Odoo 18 Server (`/api/v1/mobile/budgets/list`) and Standalone SQLite with live transaction spending aggregation.
- [x] **Recurring Bills & Subscription Detector:**
  - 14-Day & 30-Day recurring bill countdown calendar with visual status badges (`overdue`, `today`, `due_soon`, `upcoming`).
  - 1-Click "Mark as Paid" action creating checkbook ledger expense and advancing next due date.
  - Automated interval clustering detection of recurring charges from past 180 days (Netflix, Spotify, utilities, gym) with 1-click tracking.
  - Pluggable across Live Odoo 18 Server (`/api/v1/mobile/bills/*`), Standalone SQLite WASM (`recurring_bills` table), and Mock Sandbox.
- [x] **Cash Flow Forecaster & Sankey Diagram:**
  - 30/90/180/365-Day Quicken-style projected cash flow simulation and balance trajectory area chart.
  - Interactive personal finance Sankey diagram mapping Income Sources $\rightarrow$ Liquid Cash Hub $\rightarrow$ Expenses & Savings Envelopes.
  - Daily projected cash calendar ledger with running balances and overdraft risk warning.
  - Pluggable across Live Odoo 18 Server (`/api/v1/mobile/cashflow/projection`), Standalone SQLite WASM, and Mock Sandbox.
- [x] **Financial Goals Tracker:**
  - Milestone goals (Emergency Fund, Down Payment, Vacation, Wedding) with progress bars and an overall funding summary.
  - Computed progress, remaining amount, months remaining, and the monthly contribution each goal needs to land on its target date — derived through one shared helper (`goalMath.ts`) so the SQLite and Mock adapters cannot drift from the Odoo server.
  - Dedicated-account linkage, emoji icons, notes, and a deposit/withdraw fund modal with a live resulting-balance preview.
  - Pluggable across Live Odoo 18 Server (`/api/v1/mobile/goals/{list,create,update,delete,fund}`), Standalone SQLite WASM (`goals` table), and Mock Sandbox.

---

### Phase 4: Stock Portfolio & Tax-Lot Accounting (Target: Q2 2027)
*Parity with Odoo `investment.py`, `tax_lot.py`, `portfolio_analytics.py`, `quote_provider.py`*

- [ ] **Stock & ETF Holdings Register:**
  - Multi-brokerage portfolio tracking (IBKR, Tiger, Moomoo, CDP).
  - Ticker lookup and live market quotes via Yahoo Finance (using native Tauri HTTP client).
- [ ] **Advanced Tax-Lot Accounting:**
  - Multiple cost basis methods: FIFO, LIFO, HIFO, Average Cost Basis, and Specific Lot Identification.
  - Realized gain/loss calculations per lot sold.
  - Unrealized gain/loss analytics with cost basis vs current market value.
- [ ] **Portfolio Performance Metrics:**
  - Time-Weighted Return (TWR) and Money-Weighted Return (MWR / IRR).
  - Dividend tracking and forward annual dividend yield projection.
  - Asset allocation donut chart (Equities, Fixed Income, Cash, Alternatives).

---

### Phase 5: Real Estate, Mortgages & Debt Payoff (Target: Q3 2027)
*Parity with Odoo `property.py`, `loan.py`*

- [ ] **Property Equity & Valuation Tracker:**
  - Real estate market valuation tracking with mortgage linkage.
  - Net Home Equity calculation ($\text{Property Value} - \text{Remaining Loan}$).
- [ ] **Mortgage Amortization Schedule:**
  - Full monthly principal vs interest breakdown schedule.
  - Step-rate interest support (fixed period $\rightarrow$ floating SORA/SIBOR rate).
- [ ] **Debt Prepayment Simulator:**
  - Interactive sliders: "What if I pay an extra $500/month towards principal?"
  - Computes total interest saved and brings forward the payoff date.
- [ ] **Landlord Rental Property Hub:**
  - Tenant lease tracking, monthly rent roll receivables, and property maintenance ledger.

---

### Phase 6: Regional Financial Ecosystems (Singapore & Malaysia) (Target: Q3 2027)
*Parity with Odoo `moneta_finance_singapore` and `moneta_finance_malaysia`*

- [ ] **Singapore CPF Hub:**
  - Full support for OA, SA, MA, RA, and SRS accounts.
  - Monthly CPF contribution calculator based on age and wage ceiling (OW/AW).
  - CPF Housing Refund & Accrued Interest calculator (2.5% compounded).
  - Singapore Savings Bonds (SSB) and MAS 6-Month T-Bills ladder.
  - IRAS Personal Income Tax relief optimizer.
- [ ] **Malaysia EPF/KWSP Hub:**
  - 3-Account structure: Akaun Persaraan (Akaun 1), Akaun Sejahtera (Akaun 2), Akaun Fleksibel (Akaun 3).
  - LHDN Borang BE personal income tax relief calculator.
  - PRS (Private Retirement Scheme) and ASNB tracking.

---

### Phase 7: AI Financial Advisor & Stochastic Simulators (Target: Q4 2027)
*Parity with Odoo `monte_carlo.py`, `insight.py`, `moneta_finance_ai_advisor`*

- [ ] **1,000-Path Monte Carlo Wealth Simulator:**
  - Stochastic market return engine executed via Rust / Web Worker.
  - $P_{10} / P_{50} / P_{90}$ probability bands for retirement survival over 30–50 years.
- [ ] **Local AI Financial Advisor:**
  - Privacy-preserving local financial health audit (cash flow leak detection, high-interest debt alert).
  - Integration with local LLM (Ollama) or private API keys (Claude / OpenAI).

---

### Phase 8: Cloud Sync, Multi-Device & Subscriptions (Target: Q1 2028)
- [ ] **Supabase Cloud Sync Engine:**
  - Seamless background synchronization between local SQLite and remote Supabase PostgreSQL.
  - Bi-directional conflict resolution and offline mutation queue.
- [ ] **End-to-End Encryption (E2EE):**
  - Zero-knowledge encryption for cloud backups (user master password never touches the server).
- [ ] **Stripe Subscription Billing:**
  - Pro Tier unlocks automated live cloud sync across multiple desktop and mobile devices.
