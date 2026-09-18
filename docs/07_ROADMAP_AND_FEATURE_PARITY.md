# Roadmap & Feature Parity Plan

This document details the feature parity comparison between the **Odoo `moneta_finance`** backend suite and the standalone **Moneta Desktop App**.

---

## 📊 Feature Parity Audit Matrix

| Domain / Capability | Odoo moneta_finance | Moneta Desktop Status | Parity State |
| :--- | :--- | :--- | :---: |
| **Checkbook Register** | Window-partitioned running balances | Interactive register with credit-before-debit tiebreaker | **100% Parity** |
| **Reconciliation Toggles** | 1-Click `Clr` (`UNC`, `CLR`, `REC`) | 1-Click interactive `Clr` badge cycling | **100% Parity** |
| **Split Transactions** | Multi-line `moneta.transaction.split` | Live allocation math, `max` auto-fill, nested view | **100% Parity** |
| **Statement Import Wizard** | CSV/QIF bank reconciliation wizard | Drag-and-drop CSV/QIF parser with SG bank presets | **100% Parity** |
| **Duplicate Detection** | Date + amount collision matching | Automatic duplicate flagging & auto-uncheck | **100% Parity** |
| **Auto-Categorization Rules** | Regex / keyword rules engine | Priority substring rules with 33 SG merchant rules | **100% Parity** |
| **Offline Storage** | PostgreSQL database | WebAssembly SQLite 3 with IndexedDB auto-save | **100% Parity** |
| **Zero-Based Budgeting** | Envelope budgeting (YNAB paradigm) | Planned (Phase 3) | *Phase 3* |
| **Multi-Currency Transfers** | Two-legged linked transfer engine | Single currency per account (Phase 5) | *Phase 5* |
| **Stock Market Tracking** | Hourly Yahoo Finance quote sync | Static brokerage balance (Phase 6) | *Phase 6* |
| **Monte Carlo Simulation** | 1,000-path stochastic FIRE engine | Deterministic 4% rule & runway calculation | *Phase 8* |

---

## 🧭 Multi-Phase Implementation Roadmap

### Phase 1: Foundation & Core Ledger (Shipped & Active)
- [x] **Desktop Scaffolding**: Tauri v2 + Svelte 5 + Vite + TypeScript + Tailwind CSS v4.
- [x] **Pluggable Data Architecture**: `IMonetaRepository` supporting Local SQLite, Odoo 18, and Demo Sandbox.
- [x] **Embedded SQLite Engine**: WebAssembly SQLite (`sql.js`) with persistent IndexedDB auto-save and `.sqlite` export.
- [x] **Wealth Command Center**: Net Worth, Liquid Cash, Investments, Liabilities, and 4% FIRE milestone target.
- [x] **Interactive Checkbook Register**: 1-Click `Clr` reconciliation toggle (`unreconciled` $\rightarrow$ `cleared` $\rightarrow$ `reconciled`), status filter tabs, and running balances.
- [x] **1-Click Odoo Migration**: Instant data migration from live Odoo server into local SQLite.

---

### Phase 2: Advanced Banking & Statement Import (Shipped & Active)
- [x] **Split Transactions**: Support splitting a single expense or deposit across multiple categories with live balance calculation, interactive remainder auto-fill, `[SPLIT (N)]` register badges, and expandable nested breakdown rows.
- [x] **Bank Statement Import Wizard**:
  - Drag-and-drop CSV and Quicken QIF statement parser.
  - Built-in recognition for Singapore banks (DBS/POSB, OCBC, UOB, StanChart).
  - Intelligent duplicate detection preventing duplicate ledger imports.
  - Interactive preview table with mass select/deselect and inline category override.
- [x] **Automated Categorization Rules Engine**:
  - Priority-based substring matching on payees and memos.
  - 33 default Singapore merchant rules (FairPrice, Grab, Singtel, Bacha Coffee, SP Services, Netflix, etc.).
  - Real-time prediction pre-filling in QuickAdd and Import Wizard.

---

### Phase 3: Zero-Based Envelope Budgeting & Bills (Target: Q4 2026)
- [ ] **Zero-Based Envelope Budgeting (YNAB Paradigm)**:
  - Monthly income allocation to category envelopes.
  - Real-time "Ready to Assign" calculation.
  - Category rollover and overspending protection.
- [ ] **Recurring Bill Horizon**:
  - 14-day upcoming bill calendar.
  - Subscription price creep detection.

---

### Phase 4: Cash Flow & Scenario Forecasting (Target: Q1 2027)
- [ ] **Interactive Cash Flow Sankey Diagrams**:
  - Visual money flow from income sources through fixed expenses, debt service, and savings.
- [ ] **12-Month Forward Projection**:
  - Projected account balances taking into account recurring bills and salary schedules.

---

### Phase 5: Multi-Currency & Linked Transfers (Target: Q2 2027)
- [ ] **Two-Legged Linked Transfers**:
  - Creating a transfer in Account A automatically creates and links the counterpart in Account B.
- [ ] **Cross-Currency Remittance**:
  - Native support for transferring between different currencies (e.g. `SGD` $\rightarrow$ `USD`).
  - Wire fee and realized bank spread adjustments.

---

### Phase 6: Investments & Tax-Lot Accounting (Target: Q3 2027)
- [ ] **Live Market Quotes**:
  - Background stock quote synchronization via Yahoo Finance.
- [ ] **Composite Brokerage Accounts**:
  - Unified view of uninvested cash vs equity market value.
- [ ] **Tax-Lot Matching**:
  - FIFO, LIFO, and Specific ID capital gains calculation.

---

### Phase 7: Real Estate, Mortgages & Amortization (Target: Q4 2027)
- [ ] **Loan Amortization Engine**:
  - Principal vs interest schedules.
  - Early payoff extra payment calculator.
- [ ] **Property Equity Tracker**:
  - Market valuation tracking against outstanding mortgage principal.

---

### Phase 8: FIRE & Monte Carlo Wealth Simulator (Target: Q1 2028)
- [ ] **Stochastic Simulation Engine**:
  - 1,000-path Monte Carlo wealth simulation worker.
  - $P_{10}$, $P_{50}$, $P_{90}$ percentile survival curves.
  - Sequence of Returns Risk (SRR) testing.
