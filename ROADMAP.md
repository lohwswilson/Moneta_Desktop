# Moneta Wealth: Product Roadmap & Feature Parity Plan

This roadmap defines the multi-phase engineering plan to achieve full feature parity between the **Odoo `moneta_core` suite** and the standalone, portable **Moneta Wealth** application built with **Tauri v2 + Svelte 5 + SQLite**.

---

## 🎯 Architecture Pillars

```
+-------------------------------------------------------------------------+
|                  MONETA WEALTH (Tauri v2 + Svelte 5)                    |
|                                                                         |
|  [ Svelte 5 UI Layer ]                                                  |
|  ├── Fast Checkbook Registers (TanStack Table virtualized 120 FPS)      |
|  ├── Financial Dashboards & Charts (LayerChart / D3)                    |
|  └── Responsive Multi-Window Desktop Shell (Tauri Cocoa / Win32)        |
|                                                                         |
|  [ Pluggable Data Repository (IMonetaRepository) ]                      |
|  ├── Driver A: Local SQLite — The Ledger (100% Offline)                 |
|  ├── Driver B: Moneta Cloud Adapter — Sync & Migration Only             |
|  └── Driver C: Demo Sandbox — In-Memory, Never Syncs                    |
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
- [x] **Pluggable Data Adapter:** `IMonetaRepository` with SQLite, Moneta Cloud and Demo Sandbox adapters.
- [x] **Local SQLite Engine:** WebAssembly SQLite (`sql.js`) with persistent IndexedDB auto-save and `.sqlite` export/backup.
- [x] **Wealth Command Center:** Total Net Worth, Liquid Cash, Investments, Liabilities, and 4% FIRE milestone target.
- [x] **Interactive Checkbook Register:** 1-Click `Clr` reconciliation toggle (`unreconciled` → `cleared` → `reconciled`), status filter tabs, and running balances.
- [x] **1-Click Moneta Cloud Migration:** One-click data migration from Moneta Cloud into local SQLite.

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
- [ ] **Register Calendar View (Transactions & Investments):**
  - Month/Week/Day visual calendar grid toggle on both checkbook and investment registers.
  - Transactions layer: transactions and scheduled occurrences as color-coded chips with pending/overdue markers, plus end-of-day balances.
  - Investments layer: portfolio market value + daily change overlay ($ and %).
  - Day panel with occurrence highlight and one free-text note per date.
- [ ] **In-App Receipt & Document Attachment Viewer:**
  - Integrated preview modal for images (Fit / Actual size zoom) and PDFs with multi-page navigation.

---

### Phase 3: Planning, Envelope Budgets & Cash Flow (Completed & Active)
*Parity with Odoo `budget.py`, `recurring.py`, `cashflow_calendar.py`, `subscription_detector.py`*

- [x] **Zero-Based Envelope Budgeting (YNAB Paradigm):**
  - Monthly income allocation to category envelopes.
  - Real-time "Safe to Spend" and remaining allowance calculations.
  - Category breakdown by Needs, Wants, and Savings with visual burn pace indicator.
  - Interactive "Can I Spend?" Affordability Calculator modal with real-time envelope overdraft warning and donor reallocation suggestions.
  - Pluggable across the Moneta Cloud adapter (`/api/v1/mobile/budgets/list`) and Standalone SQLite with live transaction spending aggregation.
- [x] **Recurring Bills & Subscription Detector:**
  - 14-Day & 30-Day recurring bill countdown calendar with visual status badges (`overdue`, `today`, `due_soon`, `upcoming`).
  - 1-Click "Mark as Paid" action creating checkbook ledger expense and advancing next due date.
  - Automated interval clustering detection of recurring charges from past 180 days (Netflix, Spotify, utilities, gym) with 1-click tracking.
  - Pluggable across the Moneta Cloud adapter (`/api/v1/mobile/bills/*`), Standalone SQLite WASM (`recurring_bills` table), and Mock Sandbox.
- [x] **Cash Flow Forecaster & Sankey Diagram:**
  - 30/90/180/365-Day Quicken-style projected cash flow simulation and balance trajectory area chart.
  - Interactive personal finance Sankey diagram mapping Income Sources $\rightarrow$ Liquid Cash Hub $\rightarrow$ Expenses & Savings Envelopes.
  - Daily projected cash calendar ledger with running balances and overdraft risk warning.
  - Pluggable across the Moneta Cloud adapter (`/api/v1/mobile/cashflow/projection`), Standalone SQLite WASM, and Mock Sandbox.
- [x] **Financial Goals Tracker:**
  - Milestone goals (Emergency Fund, Down Payment, Vacation, Wedding) with progress bars and an overall funding summary.
  - Computed progress, remaining amount, months remaining, and the monthly contribution each goal needs to land on its target date — derived through one shared helper (`goalMath.ts`) so the SQLite and Mock adapters cannot drift from the Odoo server.
  - Dedicated-account linkage, emoji icons, notes, and a deposit/withdraw fund modal with a live resulting-balance preview.
  - Pluggable across the Moneta Cloud adapter (`/api/v1/mobile/goals/{list,create,update,delete,fund}`), Standalone SQLite WASM (`goals` table), and Mock Sandbox.
- [ ] **Zero-Based "Ready to Assign" (RTA) Cash Guardrail & Banner (YNAB Discipline):**
  - Real-time liquid cash calculation: $\text{Ready to Assign} = \text{Total Checking/Savings Cash} - \sum \text{Allocated Envelopes}$.
  - Visual top banner on Budget view displaying RTA status (Green when $0.00, Yellow when positive cash unassigned, Red when over-allocated).
  - Strict cash guardrail mode: prevents budgeting unreceived/projected income to enforce true cash-on-hand discipline.
  - Payday income intake pipeline auto-incrementing RTA balance on bank deposit.
- [ ] **Automated Credit Card Payment Reserve & Shift Engine:**
  - Automated cash envelope shift on credit card spending: moving available funds from budgeted category (e.g. Groceries) directly into dedicated Credit Card Payment reserve category.
  - "Available for Payment" vs. "Credit Card Statement Balance" reconciliation indicator (Green = Paid-in-Full, Yellow/Red = Carrying Balance / Debt).
  - Credit card payment transfer wizard paying statement balance from reserved funds without affecting expense categories.
- [ ] **Smart Dynamic Target Types ("Needed for Spending", "Target by Date", "Monthly Builder"):**
  - Needed for Spending (Monthly Refill): Sets monthly spending ceiling, deducting rollover surplus from required monthly funding ($\text{Needed} = \text{Target} - \text{Rollover}$).
  - Target Balance by Date (Sinking Fund): Automatically computes monthly required contribution based on remaining months until target date ($\text{Monthly} = \frac{\text{Target} - \text{Current}}{\text{Months Remaining}}$).
  - Monthly Savings Builder: Fixed monthly allocation regardless of account balance.
  - Auto-calculation of `underfunded_amount` across all categories for the active period.
- [ ] **"Roll with the Punches" 1-Click Overspending Resolution Wizard:**
  - Visual overspending alert badge on overspent categories ($< 0.00$).
  - Interactive modal listing categories with surplus available funds for instant intra-period fund reallocation.
- [ ] **"Age of Money" (AOM) & Days of Cash Buffer Engine:**
  - FIFO cash queue engine matching outgoing transaction payments against historical deposit dates.
  - Real-time "Age of Money" (AOM) metric ($< 30\text{ days}$ Paycheck-to-paycheck vs. $\ge 30\text{ days}$ Living on last month's income).
  - "Days of Buffer" metric estimating how many days current liquid cash sustains average historical spending velocity without new income, with 12-month progression chart.
- [ ] **1-Click "Auto-Assign" / Quick Budget Engine:**
  - Selectable distribution strategies: Underfunded, Assigned Last Month, Average Spent, and Priority Allocation down category tiers.
- [ ] **Monarch-Style Interactive Cash Flow Sankey & Drill-Down:**
  - Multi-stage dynamic Sankey flow: Income Streams $\rightarrow$ Master Groups (Fixed, Variable, Savings) $\rightarrow$ Detailed Categories $\rightarrow$ Net Savings & Investments.
  - 1-Click node drill-down: clicking any Sankey node opens the filtered checkbook ledger for those underlying transactions.
  - Gross vs. Net Cash Flow toggle (including/excluding internal transfers and credit card settlements).
- [ ] **12-Month Forward Cash Flow & "What-If" Scenario Forecaster:**
  - Projected daily and monthly account balance trajectory curve across all liquid checking and savings accounts.
  - Interactive "What-If" scenario sandbox: simulate financial milestones (car purchase, bonus payout, sabbatical, home down payment) without modifying actual ledger records.
  - Scenario comparison view: baseline trajectory vs. alternative scenario net worth and liquidity curves.
- [ ] **Subscription "Price Creep" & Amount Variance Detector:**
  - Statistical baseline price tracking on detected subscriptions with automated price creep alerts whenever an imported recurring charge increases by $>5\%$.
  - Dedicated Price Change History log per recurring subscription merchant.
- [ ] **Collaborative "Needs Review" Inbox & Household Transaction Triage:**
  - Transaction review lifecycle state (`needs_review`, `reviewed`) with dedicated badge counter and quick filter on the checkbook ledger.
  - In-line discussion chatter enabling comments and internal notes per transaction.
- [ ] **Modular Drag-and-Drop Customizable Dashboard:**
  - User-configurable widget layout engine with drag-and-drop card reordering, column resizing, and toggling visibility of dashboard widgets.

---

### Phase 4: Stock Portfolio & Tax-Lot Accounting (Target: Q2 2027) — COMPLETED
*Parity with Odoo `investment.py`, `tax_lot.py`, `portfolio_analytics.py`, `quote_provider.py`*

- [x] **Stock & ETF Holdings Register:**
  - Multi-brokerage portfolio tracking (IBKR, Tiger, Moomoo, CDP) with responsive holdings ledger.
  - Position metrics: symbol, name, brokerage account, shares, average cost, current price, day change ($/%), market value, unrealized gain ($/%), and portfolio weight percentage.
  - Svelte 5 Runes UI (`PortfolioHub.svelte`) with sub-view tabs, trade modal, and real-time rebalancing filters.
- [x] **Advanced Tax-Lot Accounting:**
  - Multiple cost basis disposal strategies: FIFO, LIFO, HIFO, and Specific Lot Identification (SpecID).
  - Lot-level purchase tracking (`TaxLot`) with acquisition date, remaining shares, cost basis, current market value, holding days, and short-term (`< 365 days`) vs long-term (`≥ 365 days`) classification.
  - Realized capital gains schedule (`TaxLotDisposal`) with disposal date, quantity sold, cost basis sold, gross proceeds, realized P/L, term type, and strategy badge.
- [x] **Portfolio Performance Metrics:**
  - Time-Weighted Return (TWR) via Modified Dietz and Money-Weighted Return (MWR) via XIRR bisection solver.
  - Derived through one shared helper (`portfolioMath.ts`) shared across all adapters (Rule 7: One Derivation, One Place).
  - Pluggable data layer across the Moneta Cloud adapter (`/api/v1/mobile/investments/*`), Standalone SQLite WASM (`securities`, `holdings`, `security_lots`, `lot_disposals`), and Mock Sandbox.

---

### Phase 5: Real Estate, Mortgages & Debt Payoff (Completed ✅)
*Parity with Odoo `property.py`, `loan.py`, and the `moneta_core` landlord hub*

- [x] **Property Equity & Valuation Tracker:**
  - Real estate, vehicle and valuables tracking with a linked mortgage account.
  - Derived net equity and loan-to-value, with an appraised-valuation history per asset.
  - Equity is **clamped at zero**, mirroring Odoo's `max(value − debt, 0)` — see the note below.
- [x] **Mortgage Amortization Schedule:**
  - Full month-by-month principal vs interest schedule, derived through one shared engine (`loanMath.ts`).
  - Step-rate support: rate changes apply from their effective date, and historical rate shifts can be inferred from interest payments already in the ledger.
  - The schedule is built from the currency-rounded payment, so a 30-year loan is 360 payments rather than 361.
- [x] **Debt Prepayment Simulator:**
  - Interactive extra-monthly and lump-sum inputs with a live baseline-vs-accelerated comparison.
  - Reports interest saved and time saved, measured against the computed baseline schedule.
- [x] **Landlord & Rent Roll Hub:**
  - Tenant and lease tracking with date-driven lease status, and a rent roll with per-payment status.
  - Idempotent rent-schedule generation keyed by rental month, and 1-click Mark Paid.
  - Overdue detection that upstream leaves unimplemented — see the note below.
  - **Not implemented:** the "property maintenance ledger" named in the original scope. Upstream has no maintenance model, so there is nothing to mirror; rental expenses are recorded through ordinary categorized transactions instead.

**Two deliberate notes, recorded so they are not mistaken for defects:**

1. **Equity floors at zero.** An underwater property (owing more than it is worth) reports `0` equity rather than a negative figure, matching Odoo numerically. The debt remains fully visible in `mortgage_balance`, and LTV reports above 100% — that ratio is the signal a property is under water.
2. **Overdue is a Desktop addition.** Upstream's rent-payment compute only ever assigns `paid` or `partial` and leaves `overdue` to logic that exists nowhere in the module. A rent roll that cannot say "overdue" is not a rent roll, so the Desktop derives it: a payment past its due date with a balance outstanding is overdue, whether or not part of it has been paid.

---

### Phase 6: Regional Financial Ecosystems (Singapore & Malaysia) (Target: Q3 2027)
*Parity with Odoo `moneta_core` regional domain models*

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
*Parity with Odoo `monte_carlo.py`, `insight.py` and the AI advisor in `moneta_core`*

- [ ] **1,000-Path Monte Carlo Wealth Simulator:**
  - Stochastic market return engine executed via Rust / Web Worker.
  - $P_{10} / P_{50} / P_{90}$ probability bands for retirement survival over 30–50 years.
- [ ] **100-Year Historical Crisis Stress-Tester:**
  - Replay simulation testing retirement survivability across landmark historical financial shocks:
    - **1929 Great Crash & Depression** ($-86\%$ equity drawdown + prolonged deflation)
    - **1973–1974 Stagflation** ($+12\%$ inflation spike with negative real asset returns)
    - **1987 Black Monday** ($-22.6\%$ single-day liquidity shock)
    - **2000–2002 Dot-Com Bust** (3 consecutive years of equity downturn / sequence risk)
    - **2008 Global Financial Crisis** ($-50\%$ global equity drawdown + real estate contraction)
    - **2020 Pandemic Shock & Inflationary Recovery**
  - Historical block bootstrapping randomly sampling empirical return blocks to preserve non-Gaussian "fat tails".
  - Interactive mode toggle: Theoretical Monte Carlo (GBM) vs. Empirical Holdings Calibration vs. Historical Crisis Backtesting.
- [ ] **Local AI Financial Advisor:**
  - Privacy-preserving local financial health audit (cash flow leak detection, high-interest debt alert).
  - Integration with local LLM (Ollama) or private API keys (Claude / OpenAI).

---

### Phase 8: Moneta Cloud Sync, Multi-Device & Subscriptions (In Progress)
**See [ADR 0001](docs/adr/0001-subscription-tiers-and-cloud-sync.md) and [ADR 0006](docs/adr/0006-sync-conflict-policy.md).** The original scope below was replaced on 2026-09-19: Supabase is dropped in favour of syncing to the existing Moneta Cloud (Odoo) backend, and E2EE is dropped deliberately because it is mutually exclusive with server-side feature enforcement.

**Sync platform — six stages, each independently useful and verifiable:**

| Stage | Scope | Status |
| :--: | :--- | :--- |
| 1 | **Local-first refactor** — SQLite always the local store; Odoo a sync target, never a data source | ✅ Done |
| 2 | **Change tracking** — trigger-written append-only log, with tombstones for deletes | ✅ Done |
| 3 | **Conflict policy** — server-arrival last-write-wins; an unpushed local change always wins | ✅ Done |
| 4 | **Server write endpoints** — accounts, budgets, rent, payee-create, **plus deletion tombstones** | ⬜ Required before sync |
| 5 | **Sync engine** — mutation queue and pull cursor | ⬜ Blocked on Stage 4 |
| 6 | **Licence token** — issuance, local verification, 30-day offline grace | ⬜ Needs infrastructure |

**Stage 4 is the blocker.** Several entities are read-only over `/api/v1/mobile/*` and cannot be pushed from the client; and Odoo's `unlink` makes deletions invisible to a query, so a record deleted on one device is resurrected by the next pull from a device that still has it. See [ADR 0006 §4](docs/adr/0006-sync-conflict-policy.md).

**Why this order.** Stages 1–3 are client-side, testable offline and cost nothing to run. They were built *before* any cloud infrastructure deliberately: the app could ship and be validated without hosting anything. Stage 4 is the first server work and a hard prerequisite for anything that actually syncs.

**Deliberately dropped:**

- [x] ~~Supabase Cloud Sync Engine~~ — the Odoo backend already models every synced entity; a second backend would duplicate the schema and add a third sync target.
- [x] ~~End-to-End Encryption~~ — incompatible with the server running premium feature logic.

**Also part of this phase:**

- [ ] **Subscriber Cloud Custody Invariant:** When a paid subscription is activated, initiate full initial push of all local SQLite entities (accounts, transactions, categories, budgets, recurring bills, properties, loans, holdings, tax-lots) to Moneta Cloud (Odoo Backend), followed by continuous mutation and tombstone replication so the backend remains the complete, authoritative remote store for disaster recovery and multi-device sync.
- [ ] **Subscription Tiers & Licence Tokens:** entitlement gating with a server-signed token, locally verified, carrying a 30-day offline grace window. See [ADR 0001](docs/adr/0001-subscription-tiers-and-cloud-sync.md) §3–4 and [ADR 0003](docs/adr/0003-licence-and-billing-topology.md).
- [ ] **Licence Billing:** subscription purchase and renewal against Moneta Cloud.
- [ ] **Moneta Mobile:** the sync client that carries the multi-device story (separate initiative).
