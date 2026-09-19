# Roadmap & Feature Parity Plan

This document details the feature parity audit between the **Odoo `moneta_core`** backend suite and the standalone **Moneta Wealth** desktop application.

> **Phase numbering note:** Moneta Wealth and the Odoo `moneta_core` module maintain coordinated roadmaps. Where a Desktop feature mirrors an upstream model or track, this document names the Odoo model explicitly (e.g. `cpf.py`, `iras_tax.py`, `monte_carlo.py`). The authoritative Desktop roadmap is [`ROADMAP.md`](../ROADMAP.md); this page is the technical parity audit against it.

---

## 📊 Complete Feature Parity Audit Matrix

| Domain / Capability | Odoo moneta_core Model | Moneta Wealth Status | Parity State |
| :--- | :--- | :--- | :---: |
| **Checkbook Register** | `models/account.py`, `transaction.py` | Interactive register with credit-before-debit tiebreaker | **100% Parity** |
| **Reconciliation Toggles** | `models/transaction.py` (`state`) | 1-Click interactive `Clr` badge cycling (`unreconciled` $\rightarrow$ `cleared` $\rightarrow$ `reconciled`) | **100% Parity** |
| **Split Transactions** | `models/transaction.py` (splits) | Live remainder math, `max` auto-fill, nested split view | **100% Parity** |
| **Statement Import Wizard** | CSV/QIF parser wizards | Drag-and-drop CSV/QIF parser with SG bank presets | **100% Parity** |
| **Duplicate Detection** | Fingerprint collision matching | Fingerprint `(date, amount, payee)` duplicate filtering | **100% Parity** |
| **Auto-Categorization Rules** | `models/transaction_rule.py` | Priority substring rules with 33 SG merchant presets | **100% Parity** |
| **Payee Intelligence** | `models/payee.py` | Autocomplete with category memory, 180d cadence detection | **100% Parity** |
| **Offline Storage Engine** | PostgreSQL database | WebAssembly SQLite 3 with IndexedDB auto-save | **100% Parity** |
| **Binary Backup / Restore** | Database dump | 1-Click `.sqlite` binary export and header-validated restore | **100% Parity** |
| **Multi-Currency** | `models/res_currency.py` | Built-in FX table, base-currency normalization offline & live | **100% Parity** |
| **Zero-Based Budgeting** | `models/budget.py` | Envelope hub (Needs 50%, Wants 30%, Savings 20%) | **100% Parity** |
| **"Can I Spend?" Calculator** | — Desktop addition | Real-time envelope affordability engine (🟢 / 🟡 / 🔴) | **Desktop Feature** |
| **Recurring Bills Radar** | `models/recurring.py` | 14/30-day countdown, 1-click Mark Paid, subscription detector | **100% Parity** |
| **Cash Flow Trajectory** | `models/cashflow_calendar.py` | 30–365 day simulation, minimum cash trough detection | **100% Parity** |
| **Sankey Cash Visualizer** | OWL Sankey diagram | Interactive LayerChart / SVG personal finance Sankey | **100% Parity** |
| **Financial Goals** | `models/goal.py` | Milestone goals with shared `goalMath.ts` pace derivation | **100% Parity** |
| **Stock Holdings Register** | `models/investment.py` | Multi-brokerage register with per-lot detail | **100% Parity** |
| **Tax-Lot Accounting** | `models/tax_lot.py` | FIFO, LIFO, HIFO, Specific ID via shared `portfolioMath.ts` | **100% Parity** |
| **Portfolio Returns (TWR/MWR)**| `models/portfolio_analytics.py` | Modified Dietz TWR and XIRR bisection solver in `portfolioMath.ts` | **100% Parity** |
| **Property Equity & Valuation** | `models/property.py` | Equity (clamped at 0), LTV and appraisal history per asset | **100% Parity** |
| **Mortgage Amortization** | `models/loan.py` | 360-month schedule, step-rates, rate inference in `loanMath.ts`| **100% Parity** |
| **Debt Prepayment Simulator** | `models/loan.py` | Live baseline-vs-accelerated comparison with interest/time saved | **100% Parity** |
| **Landlord & Rent Roll** | `models/rental_property.py` | Tenants, leases, rent roll schedule, overdue detection, NOI | **100% Parity** |
| **Register Calendar View** | `models/cashflow_calendar.py` | Planned: Month/Week/Day grid with projected EOD balances | *Phase 2 Backlog* |
| **In-App Receipt Viewer** | `moneta_core Track 2.28` | Planned: Image zoom/pan and multi-page PDF invoice preview | *Phase 2 Backlog* |
| **Action History Undo Buffer** | `models/action_history.py` | Planned: 1-Click Undo / Redo for accidental deletes and imports | *Phase 2 Backlog* |
| **Ready to Assign (RTA) Banner**| YNAB paradigm | Planned: Strict cash-on-hand guardrail ($\text{RTA} = \text{Cash} - \text{Envelopes}$) | *Phase 3 Backlog* |
| **Credit Card Shift Engine** | YNAB paradigm | Planned: Auto-shift cash from expense envelope to card reserve | *Phase 3 Backlog* |
| **Technical Indicators** | `models/technical_indicators.py`| Planned: 14-day RSI, MACD, 50/200 SMA Cross, Bollinger Bands | *Phase 4 Backlog* |
| **Security Analysis & DCF** | `models/security_analysis.py` | Planned: MS Money P/E, PEG, Beta, DCF fair value model | *Phase 4 Backlog* |
| **GEM Dual Momentum** | `models/gem_strategy.py` | Planned: 12-month Gary Antonacci momentum allocation signals | *Phase 4 Backlog* |
| **Singapore CPF Hub** | `models/cpf.py` | Full OA, SA, MA, RA ledger, monthly interest, extra 1% pool logic in `cpfMath.ts` & `SingaporeWealthHub.svelte` | **100% Parity** |
| **CPF LIFE Simulator** | `models/cpf.py` | BRS ($106.5k), FRS ($213k), ERS ($426k) Standard/Escalating/Basic payout models | **100% Parity** |
| **CPF Housing Accrued Interest**| `models/singapore_property.py` | 2.5% compounded interest on OA/grants, refund calculation, net cash proceeds | **100% Parity** |
| **Singapore Stamp Duties** | `models/singapore_property.py` | Tiered BSD (1%–6%) and ABSD (Citizen/PR/Foreigner/Entity up to 65%) | **100% Parity** |
| **IRAS Personal Tax Planner** | `models/iras_tax.py` | YA 2024–2026 progressive tax (0%–24%), $80k relief cap, SRS optimization advisor | **100% Parity** |
| **Singapore Fixed Income** | `models/singapore_fixed_income.py`| Planned: SSB 10-year step-up coupon curve, MAS T-Bills ladder | *Phase 6 Port* |
| **Malaysia EPF/KWSP Hub** | `models/epf.py` | Planned: Akaun Persaraan (75%), Sejahtera (15%), Fleksibel (10%) | *Phase 7 Port* |
| **LHDN Borang BE Tax Planner** | `models/lhdn_tax.py` | Planned: Borang BE tax brackets (0%–30%), reliefs (RM 9k, etc.) | *Phase 7 Port* |
| **Flexi-Home Loan SBR Offset** | `models/malaysia_property_loan.py`| Planned: Current account cash offset reducing loan interest | *Phase 7 Port* |
| **Monte Carlo 1,000-Path** | `models/monte_carlo.py` | Planned: Stochastic wealth simulator ($P_{10}/P_{50}/P_{90}$ cones) | *Phase 8 Port* |
| **100-Year Crisis Stress-Tester**| `moneta_core Track 1.1` | Planned: Historical replays (1929, 1973, 1987, 2000, 2008, 2020) | *Phase 8 Port* |
| **Financial Health Audit** | `models/insight.py` | Planned: Anomaly detector, fee audits, runway alerts | *Phase 8 Port* |
| **Emergency Digital Will** | `models/emergency_access.py` | Planned: Time-delayed legacy access with cancellation override | *Phase 8 Port* |
| **Cloud Sync & Subscriptions** | — | Client triggers done; Stage 4 write endpoints in progress | *Phase 9 Sync* |

---

## 🔗 Cross-Repository Contract

Moneta Wealth consumes the Odoo **mobile REST surface**, not the ORM. This distinction matters when reading the two codebases side by side:

| Layer | Naming | Example |
| :--- | :--- | :--- |
| Odoo **ORM** (models) | `transaction_date`, `current_market_value` | `models/transaction.py:18` |
| Odoo **mobile API** (wire) | `date`, `payee_name` | `controllers/api_mobile.py:211-212` |

The controller translates between the two. A Desktop type field must match the **wire** name, not the ORM name — the two are deliberately different and correcting one to match the other breaks the client.
