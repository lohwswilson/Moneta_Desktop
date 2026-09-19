# Moneta Wealth: Product Roadmap & Feature Parity Plan

This roadmap defines the engineering plan for **Moneta Wealth** — the exclusive consumer-facing desktop client for the **`moneta_core`** headless finance engine. It synthesizes the checkbook ledger precision of **Quicken Premier**, the proactive zero-based cash discipline of **YNAB**, the modern financial architecture of **Monize** (`/opt/monize`), and the Southeast Asian wealth engines of **`moneta_core`**.

---

## 📊 Executive Progress Scorecard

| Phase & Milestone | Domain Area | Status | Progress | Key Target / Deliverable |
| :--- | :--- | :---: | :---: | :--- |
| [**Phase 1**](#phase-1-foundation--local-sqlite-engine-100-complete) | Foundation & Local SQLite | ✅ Complete | **100%** (8/8) | Tauri v2, Svelte 5 runes, WASM SQLite, binary backup/restore, native accounts CRUD |
| [**Phase 2**](#phase-2-advanced-banking--register-ergonomics-60-complete) | Banking & Register Ergonomics | 🟡 Active | **60%** (6/10) | Split transactions, 33 SG rules, import wizard, payee directory, calendar view, undo |
| [**Phase 3**](#phase-3-envelope-budgeting--cash-flow-planning-45-complete) | Envelope Budgeting & Cash Flow | 🟡 Active | **45%** (5/11) | Zero-based envelopes, "Can I Spend?", RTA banner, credit card shift, Sankey |
| [**Phase 4**](#phase-4-stock-portfolio--quantitative-markets-43-complete) | Stock Portfolio & Quant Markets | 🟡 Active | **43%** (3/7) | Holdings, FIFO/LIFO/SpecID tax lots, TWR/XIRR, RSI/MACD, GEM momentum, DCF |
| [**Phase 5**](#phase-5-real-estate-mortgages--landlord-hub-100-complete) | Real Estate, Loans & Rental | ✅ Complete | **4/4** (100%) | Net home equity, 360-month amortization, prepayment simulator, rent roll |
| [**Phase 6**](#phase-6-singapore-regional-wealth-pack-100-complete) | Singapore Regional Wealth Pack | ✅ Complete | **100%** (5/5) | CPF Hub, CPF LIFE Simulator, CPF Housing Accrued Interest (2.5%), IRAS Tax, SRS |
| [**Phase 7**](#phase-7-malaysia-regional-wealth-pack-0-complete) | Malaysia Regional Wealth Pack | ⬜ Planned | **0%** (0/4) | KWSP 3-Account Hub, LHDN Borang BE Tax, Flexi-Loan SBR Offset, PRS/ASNB |
| [**Phase 8**](#phase-8-autonomous-intelligence-simulation--safety-0-complete) | Simulation, AI & Safety | ⬜ Planned | **0%** (0/6) | 1,000-Path Monte Carlo, 100-Yr Crisis Stress-Tester, Insights, Digital Will, AI |
| [**Phase 9**](#phase-9-moneta-cloud-sync--subscriptions-50-complete) | Cloud Sync & Subscriptions | 🔄 In Progress | **50%** (3/6) | Client SQLite triggers, conflict policy, server write endpoints |
| [**Tooling & Docs**](#tooling-documentation--cicd-100-complete) | Documentation & CI/CD | ✅ Complete | **100%** (4/4) | 8-Chapter User Guide, Zensical static engine, GitHub Pages workflow |
| **TOTAL SUITE PROGRESS** | | | **56%** (33/59) | **Active Desktop Suite + Standalone Ledger** |

---

## 🏛️ Comprehensive Architecture & Domain Crosswalk

```
+────────────────────────────────────────────────────────────────────────────────────────────────────────+
|                             MONETA WEALTH (Desktop Client) & MONETA_CORE                               |
+────────────────────────────────────────────────────────────────────────────────────────────────────────+
|                                                                                                        |
|  [ CORE DOMAINS ]                                                                                      |
|  • Phase 1: Local SQLite WASM, IndexedDB, Binary Backup & Restore Engine, Wealth Command Center        |
|  • Phase 2: Checkbook Register, Split Transactions, Statement Import, 33 SG Rules, Payee Directory     |
|  • Phase 3: Zero-Based Envelope Budgeting, "Can I Spend?", Bills Radar, 365d Cash Flow & Sankey        |
|  • Phase 4: Stock Holdings, Tax Lots (FIFO/LIFO/HIFO/SpecID), Realized Gains, TWR/XIRR                 |
|  • Phase 5: Property Equity, 360-Mo Amortization Schedule, Prepayment Simulator, Landlord Rent Roll   |
|                                                                                                        |
|  [ INCOMING PORTS FROM MONETA_CORE ]                                                                   |
|  • Phase 6 (Singapore): cpf.py, singapore_property.py, iras_tax.py, singapore_fixed_income.py, srs.py  |
|  • Phase 7 (Malaysia):  epf.py, lhdn_tax.py, malaysia_property_loan.py, malaysia_investments.py        |
|  • Phase 8 (Quant & AI):monte_carlo.py, gem_strategy.py, technical_indicators.py, security_analysis.py|
|  • Phase 8 (Safety):    action_history.py, emergency_access.py, account_share.py, insight.py           |
|  • Phase 9 (Cloud):     api_mobile.py write endpoints, deletion tombstones, sync cursors    |
+────────────────────────────────────────────────────────────────────────────────────────────────────────+
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

### Phase 2: Advanced Banking & Register Ergonomics (60% Complete)
*Checkbook ledger precision inspired by Quicken Premier and Monize (`/opt/monize`).*

- [x] **Interactive Checkbook Register (`CheckbookRegister.svelte`):** Point-in-time running balance calculation and 1-click `Clr` reconciliation (`unreconciled` $\rightarrow$ `cleared` $\rightarrow$ `reconciled`).
- [x] **Split Transactions:** Multi-category transaction allocation with live remainder calculation in [`QuickAddModal.svelte`](src/lib/components/QuickAddModal.svelte) and register `[SPLIT (N)]` badges.
- [x] **Bank Statement Import Wizard (`StatementImportModal.svelte`):** Drag-and-drop CSV/QIF statement parser, Singapore bank recognition (DBS/POSB, OCBC, UOB, StanChart), and duplicate prevention.
- [x] **33 Singapore Merchant Auto-Categorization Rules:** Priority regex engine auto-categorizing FairPrice, Grab, Singtel, SP Group, foodpanda, Sheng Siong, Shopee, and insurance premiums.
- [x] **Payee Intelligence Directory (`PayeeDirectoryHub.svelte`):** Historical spend analytics, 180-day interval clustering, and cadence detection.
- [x] **10-Second Statement Balance Verification (`VerifyBalanceModal.svelte`):** Register balance reconciliation against bank statement ending balances with auto-adjusting ledger entries.
- [ ] `[Monize / Quicken]` **Register Calendar View (Transactions & Balances):**
  - Month/Week/Day visual calendar grid toggle on the checkbook register (`models/cashflow_calendar.py`).
  - Transactions and scheduled bills rendered as color-coded chips with pending/overdue markers.
  - **Projected end-of-day cash balance** displayed on every single calendar day tile (Monize parity).
- [ ] `[Quicken / Monize]` **In-App Receipt & Document Viewer:** Integrated preview modal for receipt photos (zoom/pan) and multi-page invoice PDFs attached to transactions (`moneta_core Track 2.28`).
- [ ] `[moneta_core Track 2.4]` **Action History & 1-Click Undo Buffer (`action_history.py`):** Mutation audit log supporting 1-click Undo / Redo for accidental deletions, bulk edits, or statement imports.
- [ ] `[moneta_core Track 2.24]` **Collaborative "Needs Review" Inbox & Household Triage:** Review lifecycle (`needs_review` $\rightarrow$ `reviewed`) and in-line transaction comments.

---

### Phase 3: Envelope Budgeting & Cash Flow Planning (45% Complete)
*Proactive cash-on-hand envelope discipline inspired by YNAB and Monarch.*

- [x] **Zero-Based Envelope Budgeting (`BudgetHub.svelte`):** Monthly income allocation across **Needs (50%)**, **Wants (30%)**, and **Savings (20%)** envelopes with rollover mechanics.
- [x] **"Can I Spend?" Affordability Engine:** Instant purchase verdict calculator (🟢 Safe / 🟡 Caution / 🔴 Over Budget) factoring in remaining envelope buffers and month burn velocity.
- [x] **Recurring Bills & Subscription Radar (`RecurringBillsHub.svelte`):** 14-day and 30-day countdown radar, auto-pay badges, and 1-click **"Mark as Paid"** ledgering.
- [x] **Cash Flow Forecaster & Sankey Diagram (`CashFlowHub.svelte`):** 30/90/180/365-day balance trajectory area chart, minimum cash trough detection, and interactive personal finance Sankey flow.
- [x] **Financial Goals & Sinking Funds (`GoalsHub.svelte`):** Target amounts, milestone dates, dedicated account linkage, and monthly savings pace derivations via shared `goalMath.ts`.
- [ ] `[YNAB Discipline]` **Zero-Based "Ready to Assign" (RTA) Cash Guardrail Banner:** Enforcing strict cash-on-hand discipline ($\text{RTA} = \text{Cash} - \sum \text{Envelopes}$).
- [ ] `[YNAB Discipline]` **Automated Credit Card Payment Reserve & Shift Engine:** Shifting available cash from budgeted envelopes into the credit card payment reserve upon credit card swipe.
- [ ] `[YNAB Discipline]` **Dynamic Sinking Fund Target Types:** "Needed for Spending" (monthly refill), "Target Balance by Date" (sinking funds), and "Monthly Savings Builder".
- [ ] `[YNAB Discipline]` **"Roll with the Punches" Overspending Resolution Wizard:** 1-click intra-period fund reallocation from surplus categories.
- [ ] `[YNAB Discipline]` **"Age of Money" (AOM) & Days of Buffer Engine:** FIFO cash queue estimating liquidity buffer.
- [ ] `[Monarch / MS Money]` **12-Month Forward Cash Flow & "What-If" Scenario Forecaster:** Interactive sandbox simulating milestone scenarios without altering real ledger records.

---

### Phase 4: Stock Portfolio & Quantitative Markets (43% Complete)
*Parity with `moneta_core`: `investment.py`, `tax_lot.py`, `technical_indicators.py`, `security_analysis.py`, `gem_strategy.py`.*

- [x] **Stock & ETF Holdings Register (`PortfolioHub.svelte`):** Multi-brokerage tracking (IBKR, Tiger, Moomoo, CDP) with symbol, shares, average cost basis, current market price, and unrealized gain/loss.
- [x] **Advanced Tax-Lot Accounting Engine (`portfolioMath.ts`):** FIFO, LIFO, HIFO, and Specific Lot Identification (SpecID) disposal strategies with realized gain schedules.
- [x] **Portfolio Performance Metrics:** Time-Weighted Return (TWR via Modified Dietz) and Money-Weighted Return (MWR via XIRR bisection solver).
- [ ] `[moneta_core]` **Technical Indicators Overlay (`technical_indicators.py`):**
  - 14-Day RSI (Overbought $>70$, Oversold $<30$).
  - MACD (12, 26, 9) signal line & histogram.
  - 50-Day & 200-Day SMA Golden Cross / Death Cross detection.
  - Bollinger Bands ($20\text{-day SMA} \pm 2\sigma$).
- [ ] `[moneta_core]` **Fundamental Security Analysis (`security_analysis.py`):** MS Money metrics: Trailing P/E, Forward P/E, PEG ratio, EPS, Price-to-Book, Dividend Yield, Payout Ratio, Beta, and DCF fair value model.
- [ ] `[moneta_core]` **Global Equity Momentum / GEM Strategy (`gem_strategy.py`):** Gary Antonacci quantitative model comparing 12-month trailing returns between US Equities (S&P 500), Non-US Equities (All-World), and Aggregate Bonds to generate monthly asset allocation signals.
- [ ] `[Monize / MS Money]` **MS Money 52-Week Range Sliders & Portfolio Rebalancer:** Visual price range sliders, dividend schedule, and portfolio rebalancing calculator.

---

### Phase 5: Real Estate, Mortgages & Landlord Hub (100% Complete)
*Comprehensive home equity, debt payoff acceleration, and rental management (`property.py`, `loan.py`, `rental_property.py`).*

- [x] **Property Equity & Valuation Tracker (`PropertyHub.svelte`):** Real estate valuation tracking, Loan-to-Value (LTV) ratio, appraisal history, and net equity clamped at zero ($\max(\text{Value} - \text{Debt}, 0)$) mirroring Odoo.
- [x] **Mortgage Amortization Schedule (`LoanHub.svelte`):** Full 360-month principal vs interest schedule derived via shared `loanMath.ts`, with step-rate support and currency-rounded payments.
- [x] **Debt Prepayment Simulator:** Interactive extra-monthly and lump-sum prepayment inputs calculating exact interest saved and years shaved off loan term.
- [x] **Landlord Hub & Rent Roll (`LandlordHub.svelte`):** Tenant and lease tracking, monthly rent roll collection schedule with overdue payment detection, and Net Rental Yield (NOI) calculation.

---

### Phase 6: Singapore Regional Wealth Pack (100% Complete)
*Full parity with `moneta_core` Singapore models: `cpf.py`, `singapore_property.py`, `iras_tax.py`, `singapore_fixed_income.py`, `srs.py`.*

- [x] `[moneta_core]` **CPF Hub & CPF LIFE Retirement Simulator (`cpf.py`):**
  - Specialized accounts: Ordinary Account (OA - 2.5%), Special Account (SA - 4.0%), MediSave Account (MA - 4.0%), Retirement Account (RA - 4.0%).
  - Monthly lowest-balance interest derivation + extra 1% on first $60,000 combined balances (capped at $20k OA), plus extra 1% on first $30k for age 55+.
  - **CPF LIFE Simulator**: Basic Retirement Sum (BRS: $106.5k), Full Retirement Sum (FRS: $213k), Enhanced Retirement Sum (ERS: $426k) with Standard, Basic, and Escalating (+2%/yr) plans, calculating monthly payouts and bequests to age 95.
- [x] `[moneta_core]` **CPF Housing Accrued Interest Engine (`singapore_property.py`):**
  - Computes exact monthly 2.5% compounded interest on downpayment, monthly OA mortgage deductions, and housing grants to determine total mandatory CPF refund due upon property sale.
  - Net cash proceeds simulator: $\text{Net Cash} = \max(\text{Sale Price} - \text{Outstanding Mortgage} - \text{CPF Principal} - \text{CPF Accrued Interest}, 0)$.
- [x] `[moneta_core]` **Singapore Stamp Duties & MAS Affordability (`singapore_property.py`):**
  - Tiered Buyer's Stamp Duty (BSD) from 1% up to 6% on properties $> \$3\text{M}$.
  - Additional Buyer's Stamp Duty (ABSD) for Singapore Citizens (0%/20%/30%), PRs (5%/30%/35%), Foreigners (60%), and Entities/Trusts (65%).
- [x] `[moneta_core]` **IRAS Personal Income Tax Planner & Optimizer (`iras_tax.py`):**
  - Singapore progressive tax brackets (0% to 24%).
  - **$80,000 Personal Relief Cap** enforcement across Earned Income Relief, CPF Mandatory ($20,400 cap), RSTU cash top-ups ($8k self + $8k loved ones), SRS ($15,300), NSman ($1.5k–$5k), Child QCR ($4k/child), Parent relief ($5.5k–$9k), and donations (250%).
  - Year-end tax optimization advisory showing exact dollar tax savings for top-up decisions and SRS headroom.
- [x] `[moneta_core]` **Singapore Fixed Income & SRS Hub (`singapore_fixed_income.py`, `srs.py`):**
  - Integrated CPF/SRS tax relief optimization and voluntary contribution guidance.

---

### Phase 7: Malaysia Regional Wealth Pack (0% Complete)
*Full parity with `moneta_core` Malaysia models: `epf.py`, `lhdn_tax.py`, `malaysia_property_loan.py`, `malaysia_investments.py`.*

- [ ] `[moneta_core]` **KWSP / EPF 3-Account Hub (`epf.py`):**
  - 3-Account restructuring: Akaun Persaraan (75%), Akaun Sejahtera (15%), Akaun Fleksibel (10%).
  - Monthly contribution calculator (11% employee, 12–13% employer) and annual dividend growth modeling (5%–6% p.a.).
- [ ] `[moneta_core]` **LHDN Borang BE Personal Income Tax Planner (`lhdn_tax.py`):**
  - Malaysian Borang BE progressive personal income tax brackets (0% to 30%).
  - Full relief checklists: Individual (RM 9k), Medical (RM 10k), Lifestyle (RM 2.5k), EPF + Life Insurance (RM 7k), PRS (RM 3k), SSPN (RM 8k), SOCSO/EIS, and child reliefs.
- [ ] `[moneta_core]` **Malaysian Flexi-Home Loan SBR Offset Simulator (`malaysia_property_loan.py`):**
  - Standardized Base Rate (SBR) interest offset calculator: depositing surplus cash in current account reduces daily loan principal interest, calculating interest saved and loan tenure shortened.
  - Real Property Gains Tax (RPGT) holding period bands (0% to 30%).
- [ ] `[moneta_core]` **PRS & ASNB Tracker (`malaysia_investments.py`):**
  - Private Retirement Scheme (PRS) tax deduction tracker.
  - ASNB (Amanah Saham Nasional Berhad) fixed-price and variable unit trust tracking.

---

### Phase 8: Autonomous Intelligence, Simulation & Safety (0% Complete)
*Full parity with `moneta_core`: `monte_carlo.py`, `insight.py`, `emergency_access.py`, `account_share.py`, `ai_chat.py`.*

- [ ] `[moneta_core]` **1,000-Path Monte Carlo Wealth Simulator (`monte_carlo.py`):**
  - Stochastic market return engine executed client-side via Web Worker / WASM.
  - $P_{10} / P_{50} / P_{90}$ probability cones for retirement survival over 30–50 year horizons.
  - Dynamic inflation, safe withdrawal rates (SWR 3.0%–4.5%), and portfolio longevity survivability score.
- [ ] `[moneta_core Track 1.1]` **100-Year Historical Crisis Stress-Tester:**
  - Empirical return replays across landmark financial shocks: 1929 Great Crash, 1973 Stagflation, 1987 Black Monday, 2000 Dot-Com, 2008 GFC, and 2020 Pandemic.
  - Historical block bootstrapping preserving non-Gaussian fat tails.
- [ ] `[moneta_core]` **Financial Health Audit & Insights (`insight.py`):**
  - Automated anomaly detection for fee gouging, high-interest debt traps ($>6\%$), subscription price creep, and depleted runway ($<3\text{ months}$).
- [ ] `[moneta_core Track 2.5]` **Time-Delayed Emergency Digital Estate Access (`emergency_access.py`):**
  - Trusted contact legacy claim with configurable cooling-off period (14/30 days) and owner cancellation override (dead-man switch).
- [ ] `[moneta_core]` **Household Privacy & Account Sharing (`account_share.py`):** Multi-user permission levels (View-only, Editor, Admin).
- [ ] `[moneta_core]` **Local AI Financial Assistant (`ai_chat.py`, `ai_client.py`):** Privacy-preserving AI assistant integrating local Ollama LLM or user private API keys.

---

### Phase 9: Moneta Cloud Sync, Multi-Device & Subscriptions (50% Complete)
*Cross-device synchronization and optional self-hosted cloud custody.*

| Stage | Scope | Status | Notes |
| :--: | :--- | :---: | :--- |
| **Stage 1** | **Local-First SQLite Architecture** | ✅ Done | SQLite is always the primary source of truth; cloud is a sync target |
| **Stage 2** | **SQLite Change Tracking Triggers** | ✅ Done | Append-only `sync_changes` trigger log capturing inserts, updates, and delete tombstones |
| **Stage 3** | **Sync Conflict Resolution Policy** | ✅ Done | Server-arrival last-write-wins; unpushed local changes always win |
| **Stage 4** | **Odoo Server Write Endpoints & Tombstones** | ⬜ **In Progress** | **Current blocker:** Server endpoints for accounts, budgets, rent, and soft-delete tombstones |
| **Stage 5** | **Sync Engine Client** | ⬜ Blocked | Mutation queue processor and bidirectional pull cursor |

- [ ] **Subscriber Cloud Custody Invariant:** When a paid subscription is activated, initiate full initial push of all local SQLite entities to Moneta Cloud (Odoo Backend), followed by continuous mutation replication for disaster recovery and mobile companion sync.

---

### Tooling, Documentation & CI/CD (100% Complete)

- [x] **Zensical Static Documentation Engine (`zensical.toml`):** Modern Rust-powered static site generator building the entire documentation suite in ~200ms.
- [x] **Comprehensive 8-Chapter User Guide (`docs/user-guide/`):** Practical walkthroughs for Banking, Statement Import, Budgeting, Bills, Cash Flow, Goals, Investments, and Database Backups.
- [x] **Automated GitHub Actions Deployment (`.github/workflows/docs.yml`):** Automated build and deployment to GitHub Pages (`https://lohwswilson.github.io/Moneta_Wealth/`).
- [x] **Automated Verification Suite:** 7 assertion test scripts (`scripts/verify_*.ts`) validating goal math, loan math, portfolio math, property math, sync change triggers, conflict policy, and SQLite binary backup/restore.
