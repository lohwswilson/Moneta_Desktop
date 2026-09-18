# Planning, Budgeting & Forecasting Hubs

This document covers the four **Phase 3** planning hubs in Moneta Desktop — Envelope Budgets, Recurring Bills, Cash Flow Forecasting and Financial Goals — plus the shared conventions that keep them consistent across data sources.

---

## 1. Common Architecture

The **Phase 3** planning hubs share one pluggable pattern; the Phase 4 portfolio hub follows it too and is documented separately in [`10_STOCK_PORTFOLIO_AND_TAX_LOTS.md`](10_STOCK_PORTFOLIO_AND_TAX_LOTS.md). Each hub is a standalone Svelte 5 component that reads from `financeStore`, which delegates to whichever `IMonetaRepository` adapter is active:

```
+---------------------------------------------------------------------------+
|  Svelte 5 Hub Component   (BudgetHub / RecurringBillsHub /                |
|                            CashFlowHub / GoalsHub)                        |
+-----------------------------------+---------------------------------------+
                                    |  reads state, calls actions
                                    v
+---------------------------------------------------------------------------+
|  FinanceStore  (Svelte 5 Runes: $state / $derived)                        |
+-----------------------------------+---------------------------------------+
                                    |  IMonetaRepository
              +---------------------+---------------------+
              v                     v                     v
    +-------------------+ +-------------------+ +-------------------+
    |  SqliteAdapter    | |   OdooAdapter     | |   MockAdapter     |
    |  WASM SQLite      | |  /api/v1/mobile/* | |  In-memory        |
    |  (offline-first)  | |  Bearer PAT       | |  (demo sandbox)   |
    +-------------------+ +-------------------+ +-------------------+
```

Every repository method added for these hubs is **optional** on `IMonetaRepository` (declared with `?`), so an adapter that does not implement a capability degrades to an empty list rather than throwing. The store guards each call:

```typescript
if (this.repository.getGoals) {
  this.goals = await this.repository.getGoals();
} else {
  this.goals = [];
}
```

### Navigation

Moneta Desktop has two navigation surfaces, both driven by `financeStore.activeView`, rendered in `App.svelte`.

**`TopMenuBar.svelte`** groups the eleven views into **domain centers** and derives the active center from `activeView`:

| Domain center | Contains |
| :--- | :--- |
| Overview | Command Center |
| Spending | Register, Payee Directory |
| Planning | Budgets, Bills, Cash Flow, Goals |
| Investing | Portfolio |
| Property & Debt | Property, Loans, Landlord |
| Regional | CPF / EPF packs (Phase 6) |

Center dropdowns carry contextual actions — capture a transaction, import a statement, record a trade, download a SQLite backup — alongside the view links.

**`Sidebar.svelte`** carries the account list (grouped cash, investments, assets, credit, loans), quick actions for Record and Import, and a direct hub link per view.

| `activeView` | Component | Sidebar label |
| :--- | :--- | :--- |
| `command_center` | `CommandCenter.svelte` | Wealth Overview |
| `register` | `CheckbookRegister.svelte` | *(selecting an account)* |
| `budgets` | `BudgetHub.svelte` | Envelope Budgets |
| `bills` | `RecurringBillsHub.svelte` | Recurring & Bills |
| `cashflow` | `CashFlowHub.svelte` | Cash Flow & Sankey |
| `payees` | `PayeeDirectoryHub.svelte` | Payees & Directory |
| `goals` | `GoalsHub.svelte` | Financial Goals |
| `portfolio` | `PortfolioHub.svelte` | Portfolio — see [`10_STOCK_PORTFOLIO_AND_TAX_LOTS.md`](10_STOCK_PORTFOLIO_AND_TAX_LOTS.md) |
| `property` | `PropertyHub.svelte` | Property & Equity — see [`11_PROPERTY_MORTGAGES_AND_RENTAL.md`](11_PROPERTY_MORTGAGES_AND_RENTAL.md) |
| `loans` | `LoanHub.svelte` | Loans & Payoff — see [`11_PROPERTY_MORTGAGES_AND_RENTAL.md`](11_PROPERTY_MORTGAGES_AND_RENTAL.md) |
| `landlord` | `LandlordHub.svelte` | Landlord & Rent Roll — see [`11_PROPERTY_MORTGAGES_AND_RENTAL.md`](11_PROPERTY_MORTGAGES_AND_RENTAL.md) |

---

## 2. Envelope Budgets (`BudgetHub.svelte`)

*Parity with Odoo `budget.py`*

Zero-based (YNAB-paradigm) budgeting: income is allocated into named category envelopes, and spending draws them down.

- **Envelope allocation** per category for a monthly, annual or weekly period.
- **Safe to Spend** — remaining allowance after committed allocation, surfaced live.
- **Needs / Wants / Savings grouping** with a visual burn-pace indicator, so an envelope that is pacing ahead of the month is visible before it is exhausted.
- **"Can I Spend?" affordability modal** — evaluates a proposed purchase against the relevant envelope in real time, warns on overdraft, and suggests donor envelopes to reallocate from.

**Data shape** (`EnvelopeBudget` in `src/lib/types/moneta.ts`):

| Field | Notes |
| :--- | :--- |
| `id`, `name`, `category_name` | Identity |
| `allocated_amount`, `spent_amount`, `remaining_amount` | Core envelope maths |
| `spent_percent` | Burn pace |
| `period` | `monthly` \| `annual` \| `weekly` |
| `category_group` | `need` \| `want` \| `saving` |
| `rollover`, `color_code`, `alert_level` | Presentation & carry-over |

**Sources:** `/api/v1/mobile/budgets/list` · SQLite `budgets` table · Mock sandbox.

---

## 3. Recurring Bills & Subscriptions (`RecurringBillsHub.svelte`)

*Parity with Odoo `recurring.py` and `subscription_detector.py`*

- **Countdown calendar** with a 14-day / 30-day / all horizon filter.
- **Status badges** derived from days-until-due: `overdue`, `today`, `due_soon` (≤ 7 days), `upcoming`.
- **1-Click Mark as Paid** — posts a ledger expense against the bill's account and advances `next_due_date` by the cadence in a single action.
- **Subscription detection** — clusters the past 180 days of ledger expenses by payee and interval to surface recurring charges (Netflix, Spotify, utilities, gym) that were never explicitly scheduled, each promotable to a tracked bill with one click.

**Cadences** (`BillFrequency`): `weekly`, `biweekly`, `monthly`, `quarterly`, `semiannual`, `yearly`.

**Detected subscriptions** (`DetectedSubscription`) report the inferred `detected_frequency`, `average_amount`, `charge_count` and `last_charge_date`, so the inference is auditable rather than opaque — a detection you cannot inspect is one you cannot trust.

**Sources:** `/api/v1/mobile/bills/{upcoming,create,update,delete,mark_paid}` and `/api/v1/mobile/subscriptions/detect` · SQLite `recurring_bills` table · Mock sandbox.

---

## 4. Cash Flow Forecasting (`CashFlowHub.svelte`)

*Parity with Odoo `cashflow_calendar.py`*

- **Horizon switcher**: 30 / 90 / 180 / 365 days.
- **Projected balance trajectory** built from scheduled income and the recurring bills above.
- **Daily projected ledger** with opening balance, income, expense, net change, closing balance, and an `is_overdraft` flag per day.
- **Overdraft risk summary** — the lowest projected balance and its date, the count of days in the red, and total projected income vs expenses.
- **Interactive Sankey diagram**: Income Sources → Liquid Cash Hub → Expenses & Savings envelopes, with `inflow` / `hub` / `outflow` / `saving` node tiers.

**Data shape** (`CashflowForecast`):

```
CashflowForecast
├── summary
│   ├── starting_balance          lowest_projected_balance
│   ├── lowest_balance_date       ending_projected_balance
│   ├── total_projected_income    total_projected_expenses
│   ├── net_projected_cashflow    overdraft_days_count
│   └── has_overdraft_risk
├── daily_points[]  → CashflowDailyPoint
└── sankey
    ├── nodes[]     → SankeyNode  (id, name, tier, value, color)
    └── links[]     → SankeyLink  (source, target, value)
```

**Sources:** `/api/v1/mobile/cashflow/projection` · SQLite aggregation · Mock sandbox.

> **Currency caveat:** a projection total that mixes currencies is only honest if every component could actually be converted. Upstream guards this with a `rate_known` flag and withholds a total containing an unconverted component rather than reporting it at par. Treat any future multi-currency projection work as requiring the same guard.

---

## 5. Financial Goals (`GoalsHub.svelte`)

*Parity with Odoo `goal.py`*

Milestone goals and sinking funds — an emergency fund, a down payment, a holiday — each showing progress and the monthly contribution required to land on its target date.

- **Milestone cards** with progress bars, status badges, and an optional dedicated funding account.
- **Summary strip**: total target, total saved, combined progress, and the total monthly contribution required across active goals.
- **Deposit / Withdraw modal** with a live preview of the resulting balance, including an inline "goal reached" acknowledgement.
- **Achieved goals** sink to the bottom of the list so active goals stay in view.

### The shared goal-maths contract

Every derived figure is computed by **one** helper — `src/lib/data/goalMath.ts::computeGoalMetrics()` — which both the SQLite and Mock adapters call. Odoo computes the same figures in `goal.py::_compute_goal_progress`.

This is a deliberate architectural constraint, not incidental reuse. When two surfaces derive the same number independently they drift, and a goal then reads differently on two screens. The Odoo roadmap names this failure mode in its *scheduled-occurrence contract* track as the largest single architectural gap in the upstream module; the Desktop app avoids reintroducing it.

| Derived field | Rule |
| :--- | :--- |
| `remaining_amount` | `max(target − current, 0)` |
| `progress_percent` | `min(current / target × 100, 100)`, or `0` when target is zero |
| `status` | `achieved` once `current ≥ target` (and `target > 0`); otherwise `paused` is preserved, else `in_progress` |
| `months_remaining` | Calendar months to `target_date`; `0` once the date has passed |
| `monthly_contribution_required` | `remaining / months`, or the full remaining amount when no time is left |

`months_remaining` mirrors Python's `dateutil.relativedelta(end, start)` — whole calendar years and months, with the leftover days **borrowed from the month preceding the target date**, and a floor of 1 month. A naive month difference disagrees with Odoo on cases such as 2026-09-18 → 2027-06-30, which is 9 months and 12 days, reported as 10 months.

The maths is covered by assertions in [`scripts/verify_goal_math.ts`](../scripts/verify_goal_math.ts):

```bash
node --experimental-strip-types scripts/verify_goal_math.ts
```

Cases covered: month borrowing, overfunding caps, past target dates, paused preservation, achieved-wins-over-paused, zero-target division guards, and the 1-month floor. **22 assertions, 0 failures** at the time of writing.

### Why there is no pause control

`moneta.goal` declares a `paused` status, but **nothing can set it**. `status` is a stored computed field with no `inverse`, so the ORM rejects a write and recomputes over any value passed; no action writes it, and the upstream statusbar omits it (`goal.py:32-36`, `:62`; `views/goal_views.xml:11`).

The Desktop app therefore ships **no pause button**. A control that worked in SQLite mode and silently did nothing against Odoo would be a worse outcome than its absence. If pausing is ever wanted, the upstream fix is a separate stored boolean (e.g. `is_paused`) that `_compute_goal_progress` reads — not a write to the computed `status`.

**Sources:** `/api/v1/mobile/goals/{list,create,update,delete,fund}` · SQLite `goals` table · Mock sandbox.

---

## 6. Adding a New Hub

1. Add the domain type to `src/lib/types/moneta.ts`.
2. Declare optional methods on `IMonetaRepository` in `src/lib/data/repository.ts`.
3. Implement in **all three** adapters — `sqliteAdapter.ts`, `mockAdapter.ts`, `odooAdapter.ts` — plus the matching route in `moneta_finance/controllers/api_mobile.py`.
4. Add `$state` fields and `navigateTo*` / `load*` actions to `financeStore.svelte.ts`.
5. Create the component, then add a branch in `App.svelte` and a button in `Sidebar.svelte`.
6. If the hub derives any figure that Odoo also computes, put that derivation in **one** shared module rather than reimplementing it per adapter.
7. Verify with `npm run check`, `npm run build`, and by diffing the client's called routes against the server's served routes.
