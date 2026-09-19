# Moneta Wealth: Product Roadmap & Feature Parity Plan

This roadmap defines the multi-phase engineering plan for **Moneta Wealth** — an offline-first desktop personal finance suite synthesizing the checkbook ledger precision of **Quicken Premier**, the proactive zero-based cash discipline of **YNAB**, and the modern financial architecture of **Monize** (`/opt/monize`).

---

## 📊 Executive Progress Scorecard

| Phase & Milestone | Domain Area | Status | Progress | Key Target / Deliverable |
| :--- | :--- | :---: | :---: | :--- |
| [**Phase 1**](#phase-1-foundation--local-sqlite-engine-100-complete) | Foundation & Local SQLite | ✅ Complete | **100%** (8/8) | Tauri v2, Svelte 5 runes, WASM SQLite, binary backup/restore, native accounts |
| [**Phase 2**](#phase-2-advanced-banking--register-ergonomics-75-complete) | Banking & Register Ergonomics | 🟡 Active | **75%** (6/8) | Split transactions, 33 SG rules, import wizard, payee directory, calendar view |
| [**Phase 3**](#phase-3-envelope-budgeting--cash-flow-planning-45-complete) | Envelope Budgeting & Cash Flow | 🟡 Active | **45%** (5/11) | Zero-based envelopes, "Can I Spend?", RTA banner, credit card shift, Sankey |
| [**Phase 4**](#phase-4-stock-portfolio--tax-lot-accounting-75-complete) | Stock Portfolio & Tax Lots | ✅ Core Done | **75%** (3/4) | Holdings, FIFO/LIFO/SpecID tax lots, TWR/XIRR returns, MS Money metrics |
| [**Phase 5**](#phase-5-real-estate-mortgages--landlord-hub-100-complete) | Real Estate, Loans & Rental | ✅ Complete | **100%** (4/4) | Net home equity, 360-month amortization, prepayment simulator, rent roll |
| [**Phase 6**](#phase-6-regional-financial-ecosystems-0-complete) | Regional Ecosystems (SG / MY) | ⬜ Planned | **0%** (0/2) | Singapore CPF (OA/SA/MA/RA, 2.5% accrued refund) & Malaysia EPF/KWSP Hub |
| [**Phase 7**](#phase-7-ai-advisor--stochastic-simulators-0-complete) | AI Advisor & Stochastic Sim | ⬜ Planned | **0%** (0/3) | 1,000-path Monte Carlo engine, 100-year historical crisis stress-tester, local AI |
| [**Phase 8**](#phase-8-moneta-cloud-sync--subscriptions-50-complete) | Cloud Sync & Subscriptions | 🔄 In Progress | **50%** (3/6) | Client SQLite triggers, conflict policy (ADR 0006), server write endpoints |
| [**Tooling & Docs**](#tooling-documentation--cicd-100-complete) | Documentation & CI/CD | ✅ Complete | **100%** (4/4) | 8-Chapter User Guide, Zensical static engine, GitHub Pages workflow |
| **TOTAL SUITE PROGRESS** | | | **66%** (33/50) | **Active Desktop Suite + Standalone Ledger** |

---

## 🏛️ Architectural Synthesis: Quicken + YNAB + Monize

```
+--------------------------------------------------------------------------------------------------------+
|                                    PERSONAL FINANCE SYNTHESIS                                          |
|                                                                                                        |
|   QUICKEN PREMIER          YNAB                      MONIZE (/opt/monize)      MONETA WEALTH           |
|   (Historical Ledger)      (Proactive Envelope)      (MS Money Successor)      (The Unified Synthesis) |
|   ───────────────────      ────────────────────      ────────────────────      ─────────────────────── |
|   • Meticulous register    • Zero-based envelopes    • Full balance sheet      • Offline-First WASM    |
|   • Tax-lot accounting     • Credit card reserves    • Calendar view ledger    • Quicken Ledger + Clr  |
|   • Loan amortizations     • Ready to Assign (RTA)   • Dense stock tables      • YNAB Envelopes + RTA  |
|   • Split transactions     • Roll with punches       • 30-yr MS Money parity   • Monize Calendar & MS  |
|   • Desktop privacy        • Strict cash-on-hand     • Postgres / Next.js      • SG/MY Regional Hubs   |
+--------------------------------------------------------------------------------------------------------+
```

---

## 🚀 Phase-by-Phase Parity Roadmap

### Phase 1: Foundation & Local SQLite Engine (100% Complete)
*Core offline-first storage, native window shell, and binary database management.*

- [x] **Project Scaffolding:** Tauri v2 + Svelte 5 (Runes-native) + Vite + TypeScript + Tailwind CSS v4.
- [x] **Pluggable Data Architecture:** `IMonetaRepository` interface with SQLite, Moneta Cloud, and Demo Sandbox drivers.
- [x] **Local SQLite Engine:** Embedded WebAssembly SQLite (`sql.js`) with persistent IndexedDB auto-save.
- [x] **Binary Backup & Restore Engine:**
  - 1-Click `.sqlite` binary snapshot export.
  - Byte-validated restore verifying the 16-byte SQLite 3 magic header (`SQLite format 3\000`), table schema integrity, and live in-memory hot-swap.
- [x] **Safe Ledger Reset:** Guaranteed clean slate resetting all accounts and transactions without unwanted cloud auto-bootstrap.
- [x] **Native Account Management (CRUD):** Creating, editing, and deleting Bank, Credit Card, Cash, Loan, and Brokerage accounts with auto-ledgering opening balances.
- [x] **Database & Backup Manager Modal (`ConnectionModal.svelte`):** Dedicated UI showing live database binary metrics, table row counts, export/restore tools, and guarded danger zone.
- [x] **Wealth Command Center (`CommandCenter.svelte`):** Real-time Net Worth aggregation, Liquid Cash reserves, Total Liabilities, Emergency Runway months, and 4% Rule FIRE milestone bar.

---

### Phase 2: Advanced Banking & Register Ergonomics (75% Complete)
*Checkbook ledger precision inspired by Quicken Premier and Monize.*

- [x] **Interactive Checkbook Register (`CheckbookRegister.svelte`):**
  - Point-in-time running balance calculation.
  - 1-Click `Clr` reconciliation lifecycle: `'unreconciled'` $\rightarrow$ `'cleared'` $\rightarrow$ `'reconciled'`.
- [x] **Split Transactions:**
  - Multi-category transaction allocation with live remainder calculation in [`QuickAddModal.svelte`](src/lib/components/QuickAddModal.svelte).
  - Register `[SPLIT (N)]` badges with nested breakdown views.
- [x] **Bank Statement Import Wizard (`StatementImportModal.svelte`):**
  - Drag-and-drop CSV and Quicken QIF statement parser.
  - Built-in recognition for Singapore banks (DBS/POSB, OCBC, UOB, StanChart).
  - Fingerprint-based duplicate transaction prevention.
- [x] **33 Singapore Merchant Auto-Categorization Rules:** Priority regex engine auto-categorizing FairPrice, Grab, Singtel, SP Group, foodpanda, Sheng Siong, Shopee, and insurance premiums.
- [x] **Payee Intelligence Directory (`PayeeDirectoryHub.svelte`):** Historical spend analytics, 180-day interval clustering, and cadence detection (`weekly`, `monthly`, `quarterly`, `yearly`).
- [x] **10-Second Statement Balance Verification (`VerifyBalanceModal.svelte`):** Register balance reconciliation against bank statement ending balances with auto-adjusting ledger entries.
- [ ] `[Monize / Quicken]` **Register Calendar View (Transactions & Balances):**
  - Month/Week/Day visual calendar grid toggle on the checkbook register.
  - Transactions and scheduled bills rendered as color-coded chips with pending/overdue markers.
  - **Projected end-of-day cash balance** displayed on every single calendar day tile (Monize parity).
- [ ] `[Quicken / Monize]` **In-App Receipt & Document Viewer:** Integrated preview modal for receipt photos (zoom/pan) and multi-page invoice PDFs attached to transactions.

---

### Phase 3: Envelope Budgeting & Cash Flow Planning (45% Complete)
*Proactive cash-on-hand envelope discipline inspired by YNAB and Monarch.*

- [x] **Zero-Based Envelope Budgeting (`BudgetHub.svelte`):** Monthly income allocation across **Needs (50%)**, **Wants (30%)**, and **Savings (20%)** envelopes with rollover mechanics.
- [x] **"Can I Spend?" Affordability Engine:** Instant purchase verdict calculator (🟢 Safe / 🟡 Caution / 🔴 Over Budget) factoring in remaining envelope buffers and month burn velocity.
- [x] **Recurring Bills & Subscription Radar (`RecurringBillsHub.svelte`):** 14-day and 30-day countdown radar, auto-pay badges, and 1-click **"Mark as Paid"** ledgering.
- [x] **Cash Flow Forecaster & Sankey Diagram (`CashFlowHub.svelte`):** 30/90/180/365-day balance trajectory area chart, minimum cash trough detection, and interactive personal finance Sankey flow.
- [x] **Financial Goals & Sinking Funds (`GoalsHub.svelte`):** Target amounts, milestone dates, dedicated account linkage, and monthly savings pace derivations via shared `goalMath.ts`.
- [ ] `[YNAB Discipline]` **Zero-Based "Ready to Assign" (RTA) Cash Guardrail Banner:**
  - Real-time liquid cash calculation: $\text{RTA} = \text{Total Liquid Cash} - \sum \text{Allocated Envelopes}$.
  - Visual top banner on Budget view displaying RTA status (Green when S$ 0.00, Yellow when positive cash unassigned, Red when over-allocated).
  - Strict cash guardrail mode: prevents budgeting unreceived/projected income to enforce true cash-on-hand discipline.
- [ ] `[YNAB Discipline]` **Automated Credit Card Payment Reserve & Shift Engine:**
  - When recording an expense on a credit card (e.g. S$ 50 on Groceries), automatically shift S$ 50 from the `Groceries` envelope into a dedicated `Credit Card Payment Reserve` envelope.
  - "Available for Payment" vs "Statement Balance" reconciliation indicator (Green = Paid-in-Full, Red = Carrying Debt).
  - 1-Click credit card payment transfer paying statement balance from reserved cash without impacting expense categories.
- [ ] `[YNAB Discipline]` **Smart Dynamic Target Types:**
  - **Needed for Spending**: Monthly spending ceiling deducting rollover surplus ($\text{Needed} = \text{Target} - \text{Rollover}$).
  - **Target Balance by Date**: Sinking fund auto-calculating monthly required contribution based on remaining months until target date ($\text{Monthly} = \frac{\text{Target} - \text{Current}}{\text{Months Remaining}}$).
  - **Monthly Savings Builder**: Fixed monthly allocation regardless of account balance.
- [ ] `[YNAB Discipline]` **"Roll with the Punches" Overspending Resolution Wizard:**
  - Visual overspending alert badge on negative categories ($< \text{S\$} 0.00$).
  - Interactive modal listing categories with surplus available funds for instant intra-period fund reallocation.
- [ ] `[YNAB Discipline]` **"Age of Money" (AOM) & Days of Buffer Engine:**
  - FIFO cash queue matching outgoing payments against historical deposit dates.
  - Real-time Age of Money metric ($< 30\text{ days}$ paycheck-to-paycheck vs. $\ge 30\text{ days}$ living on last month's income).
- [ ] `[Monarch / MS Money]` **12-Month Forward Cash Flow & "What-If" Scenario Forecaster:**
  - Interactive sandbox simulating milestone scenarios (car purchase, sabbatical, bonus payout) without modifying actual ledger records.
  - Baseline vs Alternative scenario net worth and liquidity curves.

---

### Phase 4: Stock Portfolio & Tax-Lot Accounting (75% Complete)
*Institutional-grade investment tracking and capital gains optimization.*

- [x] **Stock & ETF Holdings Register (`PortfolioHub.svelte`):** Multi-brokerage tracking (IBKR, Tiger, Moomoo, CDP) with symbol, shares, average cost basis, current market price, and unrealized gain/loss.
- [x] **Advanced Tax-Lot Accounting Engine (`portfolioMath.ts`):**
  - Multiple disposal strategies: **FIFO**, **LIFO**, **HIFO**, and **Specific Lot Identification (SpecID)**.
  - Lot purchase tracking with acquisition dates, holding days, and short-term ($< 365\text{ days}$) vs long-term ($\ge 365\text{ days}$) classification.
  - Realized capital gains schedule with disposal dates, proceeds, and cost basis sold.
- [x] **Portfolio Performance Metrics:** Time-Weighted Return (TWR via Modified Dietz) and Money-Weighted Return (MWR via XIRR bisection solver).
- [ ] `[Monize / MS Money]` **MS Money Density & Visuals:**
  - 52-Week visual price range sliders showing current quote position.
  - Dividend calendar schedule with projected monthly dividend income streams.
  - Portfolio rebalancing calculator determining exact share adjustments to match target asset allocation.

---

### Phase 5: Real Estate, Mortgages & Landlord Hub (100% Complete)
*Comprehensive home equity, debt payoff acceleration, and rental management.*

- [x] **Property Equity & Valuation Tracker (`PropertyHub.svelte`):** Real estate valuation tracking, Loan-to-Value (LTV) ratio, appraisal history, and net equity clamped at zero ($\max(\text{Value} - \text{Debt}, 0)$) mirroring Odoo.
- [x] **Mortgage Amortization Schedule (`LoanHub.svelte`):**
  - Full 360-month principal vs interest schedule derived via shared `loanMath.ts`.
  - Step-rate support: effective-date rate changes and historical interest rate inference.
  - Currency-rounded payment schedule ensuring clean 360-payment terms.
- [x] **Debt Prepayment Simulator:** Interactive extra-monthly and lump-sum prepayment inputs calculating exact interest saved and years shaved off loan term.
- [x] **Landlord Hub & Rent Roll (`LandlordHub.svelte`):**
  - Tenant and lease tracking with date-driven lease status.
  - Monthly rent roll collection schedule with overdue payment detection.
  - 1-Click rent posting to checking account register.
  - Net Rental Yield (NOI) calculation factoring in property tax, MCST maintenance fees, and repairs.

---

### Phase 6: Regional Financial Ecosystems (0% Complete — Target: Q3 2027)
*The regional competitive moat tailored for Southeast Asian wealth.*

- [ ] `[Regional Moat]` **Singapore CPF Hub:**
  - Full account spectrum: Ordinary Account (OA), Special Account (SA), MediSave Account (MA), Retirement Account (RA), and Supplementary Retirement Scheme (SRS).
  - Monthly CPF contribution calculator factoring in age tiers and Ordinary/Additional Wage ceilings (OW/AW).
  - **CPF Housing Refund & Accrued Interest Calculator**: Mandatory 2.5% compounded accrued interest refund simulation upon property sale.
  - Singapore Savings Bonds (SSB) and MAS 6-Month T-Bills ladder tracker.
  - IRAS Personal Income Tax relief optimizer.
- [ ] `[Regional Moat]` **Malaysia EPF / KWSP Hub:**
  - 3-Account structure: Akaun Persaraan (1), Akaun Sejahtera (2), Akaun Fleksibel (3).
  - LHDN Borang BE personal income tax relief planner.
  - Private Retirement Scheme (PRS) and ASNB investment tracking.

---

### Phase 7: AI Advisor & Stochastic Simulators (0% Complete — Target: Q4 2027)
*Institutional-grade wealth survivability modeling and private intelligence.*

- [ ] **1,000-Path Monte Carlo Wealth Simulator:**
  - Stochastic market return engine executed via Rust / WebAssembly Worker.
  - $P_{10} / P_{50} / P_{90}$ probability cones for retirement survival over 30–50 year horizons.
- [ ] **100-Year Historical Crisis Stress-Tester:**
  - Empirical stress-testing replaying portfolio survivability across landmark financial shocks:
    - **1929 Great Crash** ($-86\%$ equity drawdown + deflation)
    - **1973–1974 Stagflation** ($+12\%$ inflation spike with negative real returns)
    - **1987 Black Monday** ($-22.6\%$ single-day crash)
    - **2000–2002 Dot-Com Bust** (3-year sustained sequence risk)
    - **2008 Global Financial Crisis** ($-50\%$ global equity & real estate contraction)
    - **2020 Pandemic Shock & Inflationary Recovery**
  - Historical block bootstrapping preserving non-Gaussian fat tails.
- [ ] **Local AI Financial Advisor:**
  - 100% private, client-side financial audit identifying cash flow leaks and debt traps.
  - Native integration with local LLMs (Ollama) or private user API keys (Claude / OpenAI).

---

### Phase 8: Moneta Cloud Sync & Subscriptions (50% Complete)
*Cross-device synchronization and optional self-hosted cloud custody.*
*Governed by [ADR 0001](docs/adr/0001-subscription-tiers-and-cloud-sync.md) and [ADR 0006](docs/adr/0006-sync-conflict-policy.md).*

| Stage | Scope | Status | Notes |
| :--: | :--- | :---: | :--- |
| **Stage 1** | **Local-First SQLite Architecture** | ✅ Done | SQLite is always the primary source of truth; cloud is a sync target |
| **Stage 2** | **SQLite Change Tracking Triggers** | ✅ Done | Append-only `sync_changes` trigger log capturing inserts, updates, and delete tombstones |
| **Stage 3** | **Sync Conflict Resolution Policy** | ✅ Done | Server-arrival last-write-wins; unpushed local changes always win; ADR 0006 |
| **Stage 4** | **Odoo Server Write Endpoints & Tombstones** | ⬜ **In Progress** | **Current blocker:** Server endpoints for accounts, budgets, rent, and soft-delete tombstones |
| **Stage 5** | **Sync Engine Client** | ⬜ Blocked | Mutation queue processor and bidirectional pull cursor |
| **Stage 6** | **Cryptographic Licence Tokens** | ⬜ Planned | Server-signed JWT entitlement token with 30-day offline grace window |

- [ ] **Subscriber Cloud Custody Invariant:** When a paid subscription is activated, initiate full initial push of all local SQLite entities to Moneta Cloud (Odoo Backend), followed by continuous mutation replication for disaster recovery and mobile companion sync.

---

### Tooling, Documentation & CI/CD (100% Complete)

- [x] **Zensical Static Documentation Engine (`zensical.toml`):** Modern Rust-powered static site generator building the entire documentation suite in ~200ms.
- [x] **Comprehensive 8-Chapter User Guide (`docs/user-guide/`):** Practical walkthroughs for Banking, Statement Import, Budgeting, Bills, Cash Flow, Goals, Investments, and Database Backups.
- [x] **Automated GitHub Actions Deployment (`.github/workflows/docs.yml`):** Automated build and deployment to GitHub Pages (`https://lohwswilson.github.io/Moneta_Wealth/`).
- [x] **Automated Verification Suite:** 7 assertion test scripts (`scripts/verify_*.ts`) validating goal math, loan math, portfolio math, property math, sync change triggers, conflict policy, and SQLite binary backup/restore.
