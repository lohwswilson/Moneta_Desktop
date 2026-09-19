# Roadmap & Feature Parity Plan

This document details the feature parity comparison between the **Odoo `moneta_finance`** backend suite and the standalone **Moneta Wealth App**.

> **Phase numbering note:** Moneta Wealth and the Odoo `moneta_finance` module maintain **separate** roadmaps with **different** phase numbering. Desktop Phase 3 is not Odoo Phase 3. Where a Desktop feature mirrors an upstream track, this document names the Odoo track explicitly (e.g. *Odoo Track 5.7*). The authoritative Desktop roadmap is [`ROADMAP.md`](../ROADMAP.md); this page is the parity audit against it.

---

## 📊 Feature Parity Audit Matrix

| Domain / Capability | Odoo moneta_finance | Moneta Wealth Status | Parity State |
| :--- | :--- | :--- | :---: |
| **Checkbook Register** | Window-partitioned running balances | Interactive register with credit-before-debit tiebreaker | **100% Parity** |
| **Reconciliation Toggles** | 1-Click `Clr` (`UNC`, `CLR`, `REC`) | 1-Click interactive `Clr` badge cycling | **100% Parity** |
| **Split Transactions** | Multi-line `moneta.transaction.split` | Live allocation math, `max` auto-fill, nested view | **100% Parity** |
| **Statement Import Wizard** | CSV/QIF bank reconciliation wizard | Drag-and-drop CSV/QIF parser with SG bank presets | **100% Parity** |
| **Duplicate Detection** | Date + amount collision matching | Automatic duplicate flagging & auto-uncheck | **100% Parity** |
| **Auto-Categorization Rules** | Regex / keyword rules engine | Priority substring rules with 33 SG merchant rules | **100% Parity** |
| **Payee Intelligence** | `moneta.payee` analytics & cadence | Autocomplete with category memory, cadence detection, spend analytics | **100% Parity** |
| **Offline Storage** | PostgreSQL database | WebAssembly SQLite 3 with IndexedDB auto-save | **100% Parity** |
| **Multi-Currency** | `res.currency` conversion with `rate_known` guard | Built-in FX table, base-currency normalization offline & live | **100% Parity** |
| **Zero-Based Budgeting** | `moneta.budget` category envelopes | Envelope hub with Can-I-Spend affordability modal | **100% Parity** |
| **Recurring Bills** | `moneta.recurring.transaction` cadences | 14/30-day countdown, mark-as-paid, subscription detection | **100% Parity** |
| **Cash Flow Forecasting** | `moneta.cashflow.calendar` projection | 30–365 day simulation, Sankey diagram, overdraft risk | **100% Parity** |
| **Financial Goals** | `moneta.goal` sinking funds | Milestone goals with derived contribution targets | **100% Parity** |
| **Linked Transfers** | Two-legged atomic pair-wide VOID engine | Single-leg transactions per account | *Phase 5* |
| **Stock Holdings Register** | `moneta.security` / `moneta.holding` | Multi-brokerage register with per-lot detail | **100% Parity** |
| **Tax-Lot Accounting** | FIFO / LIFO / HIFO / Specific ID | Shared disposal engine, per-disposal term classification | **100% Parity** |
| **Portfolio Metrics (TWR/MWR)** | `_modified_dietz` / `_xirr` | Modified Dietz and XIRR bisection in one shared module | **100% Parity** |
| **Live Market Quotes** | Hourly Yahoo Finance quote sync | Prices maintained by hand, `last_quote_date` only | *Phase 4 remainder* |
| **Property Equity & Valuation** | `moneta.property` + valuation log | Equity, LTV and appraisal history per asset | **100% Parity** |
| **Mortgage Amortization** | `moneta.loan.scenario` | Shared engine, step-rate and rate inference | **100% Parity** |
| **Debt Prepayment Simulator** | Extra monthly + lump sum | Live baseline-vs-accelerated comparison | **100% Parity** |
| **Landlord & Rent Roll** | `moneta_finance_property` satellite | Tenants, leases, rent roll, overdue detection | **100% Parity** |
| **Property Maintenance Ledger** | — none upstream | Not implemented | *Not in scope* |
| **Regional Packs (CPF/EPF)** | `moneta_finance_singapore` / `_malaysia` | Not implemented | *Phase 6* |
| **Monte Carlo Simulation** | 1,000-path stochastic FIRE engine | Deterministic 4% rule & runway calculation | *Phase 7* |
| **Cloud Sync & Billing** | Self-hosted server | Not implemented | *Phase 8* |

---

## 🧭 Multi-Phase Implementation Roadmap

### Phase 1: Foundation & Core Ledger (Completed ✅)
- [x] **Desktop Scaffolding**: Tauri v2 + Svelte 5 + Vite + TypeScript + Tailwind CSS v4.
- [x] **Pluggable Data Architecture**: `IMonetaRepository` supporting Local SQLite, Odoo 18, and Demo Sandbox.
- [x] **Embedded SQLite Engine**: WebAssembly SQLite (`sql.js`) with persistent IndexedDB auto-save and `.sqlite` export.
- [x] **Wealth Command Center**: Net Worth, Liquid Cash, Investments, Liabilities, and 4% FIRE milestone target.
- [x] **Interactive Checkbook Register**: 1-Click `Clr` reconciliation toggle (`unreconciled` → `cleared` → `reconciled`), status filter tabs, and running balances.
- [x] **1-Click Moneta Cloud Migration**: Instant data migration from Moneta Cloud into local SQLite.

---

### Phase 2: Advanced Banking & Transaction Management (Completed ✅)
*Parity with Odoo `transaction.py`, `payee.py`, `transaction_rule.py`*

- [x] **Split Transactions**: Multi-category allocations with live remainder math and `[SPLIT (N)]` register badges.
- [x] **Bank Statement Import Wizard**: CSV (comma/semicolon/tab) and Quicken QIF parsing, DBS/POSB, OCBC, UOB and StanChart recognition, duplicate detection, and batch commit.
- [x] **Automated Categorization Rules Engine**: Priority-based substring matching over payees and memos, with 33 out-of-the-box Singapore merchant rules.
- [x] **Payee Intelligence & Directory**: Autocomplete with historical category memory, a dedicated directory hub with cadence detection (`weekly` / `biweekly` / `monthly` / `quarterly` / `yearly` / `irregular`), total historical spend, average ticket size, and category memory overrides.
- [x] **Multi-Currency Engine**: Built-in FX conversion table (USD, MYR, SGD parity rates) with base-currency normalization across the live Odoo API and offline SQLite.

See [`08_PLANNING_AND_FORECASTING_HUBS.md`](08_PLANNING_AND_FORECASTING_HUBS.md) and [`09_PAYEE_INTELLIGENCE_AND_DIRECTORY.md`](09_PAYEE_INTELLIGENCE_AND_DIRECTORY.md).

---

### Phase 3: Planning, Envelope Budgets & Cash Flow (Completed ✅)
*Parity with Odoo `budget.py`, `recurring.py`, `cashflow_calendar.py`, `subscription_detector.py`, `goal.py`*

- [x] **Zero-Based Envelope Budgeting (YNAB Paradigm)**: Monthly income allocation to category envelopes, Safe-to-Spend and remaining allowance, Needs/Wants/Savings grouping with a burn-pace indicator, and a Can-I-Spend affordability calculator with donor reallocation suggestions.
- [x] **Recurring Bills & Subscription Detector**: 14-day and 30-day countdown calendars with `overdue` / `today` / `due_soon` / `upcoming` status badges, 1-click Mark-as-Paid posting a ledger expense and advancing the due date, and interval-clustering detection of recurring charges across 180 days.
- [x] **Cash Flow Forecaster & Sankey Diagram**: 30/90/180/365-day projected balance trajectory, an interactive Income → Liquid Cash → Expenses & Savings Sankey, a daily projected calendar ledger, and overdraft risk warnings.
- [x] **Financial Goals Tracker**: Milestone goals with progress bars, dedicated-account linkage, and derived progress, remaining amount, months remaining and required monthly contribution.

See [`08_PLANNING_AND_FORECASTING_HUBS.md`](08_PLANNING_AND_FORECASTING_HUBS.md).

---

### Phase 4: Stock Portfolio & Tax-Lot Accounting (Completed ✅)
*Parity with Odoo `investment.py`, `tax_lot.py`, `portfolio_analytics.py`*

- [x] **Stock & ETF Holdings Register**: Multi-brokerage tracking (IBKR, Tiger, Moomoo, CDP) with a four-tab hub (holdings, lots, realized, allocation) and a buy/sell trade modal.
- [x] **Advanced Tax-Lot Accounting**: FIFO, LIFO, HIFO and Specific Lot Identification, with realized gain per lot sold and short/long-term classification at the 365-day boundary.
- [x] **Portfolio Performance Metrics**: TWR via Modified Dietz and MWR via XIRR bisection, both in the shared `portfolioMath.ts`.
- [ ] **Live Market Quotes**: Prices are maintained by hand — no quote provider is wired yet. See [`10_STOCK_PORTFOLIO_AND_TAX_LOTS.md`](10_STOCK_PORTFOLIO_AND_TAX_LOTS.md) §1 for the two boundaries that did not ship.

See [`10_STOCK_PORTFOLIO_AND_TAX_LOTS.md`](10_STOCK_PORTFOLIO_AND_TAX_LOTS.md).

---

### Phase 5: Real Estate, Mortgages & Debt Payoff (Completed ✅)
*Parity with Odoo `property.py`, `loan.py`, and the `moneta_finance_property` satellite*

- [x] **Property Equity & Valuation Tracker**: Real estate, vehicle and valuables tracking with linked mortgage accounts, derived equity and LTV, and a per-asset appraisal history.
- [x] **Mortgage Amortization Schedule**: Month-by-month principal vs interest from one shared engine, with step-rate application and rate inference from ledger interest payments.
- [x] **Debt Prepayment Simulator**: Live extra-monthly and lump-sum modelling reporting interest and time saved.
- [x] **Landlord & Rent Roll Hub**: Tenant and lease tracking, idempotent rent-schedule generation, 1-click Mark Paid, and overdue detection.
- [ ] **Property Maintenance Ledger**: Not implemented — upstream has no maintenance model to mirror. Rental expenses flow through ordinary categorized transactions.

**Two divergences from upstream, both deliberate** — see [`11_PROPERTY_MORTGAGES_AND_RENTAL.md`](11_PROPERTY_MORTGAGES_AND_RENTAL.md):

1. **Equity is clamped at zero**, matching Odoo's `max(value − debt, 0)`. An underwater property reads as zero equity; LTV above 100% is the signal that it is under water.
2. **Overdue detection is a Desktop addition.** Upstream assigns only `paid`/`partial` and leaves `overdue` to logic present nowhere in the module. The Desktop derives it from the due date and outstanding balance.
3. **The amortization engine is the one numerical divergence.** Upstream's baseline and accelerated summary loops disagree with each other by one installment because only one applies the remainder absorption. The Desktop uses a single builder for both, so its figures always match the table on screen.

---

### Phase 6: Regional Financial Ecosystems — Singapore & Malaysia (Target: Q3 2027)
*Parity with Odoo `moneta_finance_singapore` and `moneta_finance_malaysia`*

- [ ] **Singapore CPF Hub**: OA/SA/MA/RA and SRS accounts, contribution calculator by age and wage ceiling, CPF Housing Refund with accrued interest, SSB and MAS T-Bill ladders, and an IRAS relief optimizer.
- [ ] **Malaysia EPF/KWSP Hub**: The 3-account structure (Persaraan, Sejahtera, Fleksibel), LHDN Borang BE relief calculator, and PRS/ASNB tracking.

---

### Phase 7: AI Financial Advisor & Stochastic Simulators (Target: Q4 2027)
*Parity with Odoo `monte_carlo.py`, `insight.py`, `moneta_finance_ai_advisor`*

- [ ] **1,000-Path Monte Carlo Wealth Simulator**: Stochastic return engine via Rust/Web Worker with P10/P50/P90 bands over 30–50 year horizons.
- [ ] **Local AI Financial Advisor**: Privacy-preserving cash-flow leak detection and high-interest debt alerts, via Ollama or a private API key.

---

### Phase 8: Cloud Sync, Multi-Device & Subscriptions (Target: Q1 2028)

- [ ] **Supabase Cloud Sync Engine**: Background SQLite ↔ PostgreSQL synchronization with conflict resolution and an offline mutation queue.
- [ ] **End-to-End Encryption**: Zero-knowledge cloud backup where the master password never reaches the server.
- [ ] **Stripe Subscription Billing**: A Pro tier unlocking multi-device sync.

---

## 🔗 Cross-Repository Contract

Moneta Wealth consumes the Odoo **mobile REST surface**, not the ORM. This distinction matters when reading the two codebases side by side:

| Layer | Naming | Example |
| :--- | :--- | :--- |
| Odoo **ORM** (models) | `transaction_date`, `current_market_value` | `models/transaction.py:18` |
| Odoo **mobile API** (wire) | `date`, `payee_name` | `controllers/api_mobile.py:211-212` |

The controller translates between the two. A Desktop type field must match the **wire** name, not the ORM name — the two are deliberately different and correcting one to match the other breaks the client.

Endpoint parity is verified by diffing the routes in `controllers/api_mobile.py` against the calls in [`src/lib/api/odooApi.ts`](../src/lib/api/odooApi.ts). At the time of writing every client call has a matching server route.
