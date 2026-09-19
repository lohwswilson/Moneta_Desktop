# Stock Portfolio & Tax-Lot Accounting

This document covers the **Phase 4** portfolio hub: the holdings register, tax-lot disposal accounting, and the performance metrics derived from them.

*Parity with Odoo `investment.py`, `tax_lot.py`, `portfolio_analytics.py`.*

---

## 1. Two boundaries, stated up front

Two things the original Phase 4 specification hoped for did **not** ship, and both are documented here rather than buried:

### No quote provider

Prices are not fetched. There is no Yahoo Finance call, no quote provider, and no scheduled refresh anywhere in the portfolio path. A security's price lives in the `securities` table:

```sql
current_price REAL DEFAULT 0.0,
last_quote_date TEXT
```

`current_price` is written by hand (the adapter runs a plain `UPDATE securities SET current_price = :price`), and `last_quote_date` records when that happened. Upstream `moneta_finance` syncs quotes hourly via Yahoo; until the Desktop gains a quote provider, every price is only as fresh as the last time someone typed it.

The consequence is specific rather than vague: unrealized gain, day change, portfolio value, TWR and MWR are all functions of `current_price`. **None of those figures is more current than the price behind it.** `PortfolioSummary` deliberately does not carry a "prices are stale" flag — treat that as a known gap, not as a guarantee of freshness.

### A trade does not move cash

`executeInvestmentTrade` writes lots, holdings and disposals — and **no ledger transaction**. This is verified on *both* sides:

- `sqliteAdapter.ts` — writes `security_lots`, `holdings`, `lot_disposals`; no `INSERT INTO transactions`
- `moneta_core/controllers/api_mobile.py` (`investments/trade`) — creates/updates `moneta.security` and holdings; no `moneta.transaction.create`

So a trade adjusts a position but leaves the funding account's cash balance untouched. Selling shares increases realized gain on paper while the cash that sale generated appears nowhere in the checkbook register. This is parity, not a Desktop defect — but it means the register and the portfolio are **two ledgers that do not yet reconcile against each other**. Closing that gap is the natural next Phase 4 increment.

---

## 2. The Hub

`PortfolioHub.svelte` is the eighth view, reached from the sidebar as **Portfolio**. It has four sub-views:

| Tab | Contents |
| :--- | :--- |
| `holdings` | The open positions ledger, across brokerage accounts |
| `lots` | Open tax lots, with per-lot cost basis and holding duration |
| `realized` | The realized capital-gains schedule — every disposal ever recorded |
| `allocation` | Asset-class breakdown derived from current market values |

A **trade modal** handles buys and sells. On a sell it offers the disposal strategy; under `SpecID` it also offers specific lot selection.

---

## 3. Data Shapes

`src/lib/types/moneta.ts`:

| Type | Represents |
| :--- | :--- |
| `PortfolioHolding` | One position: shares, average cost, current price, unrealized P/L, portfolio weight |
| `TaxLot` | One acquisition: purchase date, quantity, cost basis, remaining shares, holding days, term type |
| `TaxLotDisposal` | One sale against a lot: quantity sold, cost basis sold, proceeds, realized gain, strategy used |
| `PortfolioSummary` | Aggregates: total value, cost basis, unrealized P/L, realized P/L YTD, TWR, MWR, allocation |

Short-term vs long-term is classified at **365 days** — `holding_days >= 365` is `long_term`, anything less `short_term`.

---

## 4. The Tax-Lot Disposal Engine

Implemented in [`src/lib/data/portfolioMath.ts::disposeTaxLots()`](../src/lib/data/portfolioMath.ts). Given a sale quantity, it orders the open lots by strategy, consumes them in order until the quantity is satisfied, and emits one `TaxLotDisposal` per lot touched.

| Strategy | Ordering | Rationale |
| :--- | :--- | :--- |
| `FIFO` | Earliest `purchase_date` first | Default; matches real acquisition order |
| `LIFO` | Latest `purchase_date` first | Matches recent cost to current price |
| `HIFO` | Highest `purchase_price` first | Maximises cost basis, **minimises taxable gain** |
| `SpecID` | Selected lots first, then the rest | Point-of-sale lot choice |

Each disposal records the term type at the moment of disposal, so a lot straddling the 365-day boundary between purchase and sale is classified correctly per disposal rather than per lot.

### SpecID is a preference, not a restriction

Read the ordering rule carefully. SpecID sorts the *selected* lots to the front but keeps the unselected ones behind them:

```typescript
sortedLots = [...selected, ...others];
```

The disposal loop then sells in that order until the quantity is exhausted. **If the selected lots do not cover the sale, the remainder is taken from lots you did not select** — silently, with no warning in the resulting `TaxLotDisposal` records beyond their lot ids.

That is a defensible default (it avoids refusing a trade over a mis-sized selection), but it is *not* what "specific identification" means for tax purposes, where the chosen lots are supposed to be exactly the ones disposed. Two implications worth knowing before relying on it:

- A SpecID sale whose selection is too small produces a **partially specified** disposal, and nothing in the result says so.
- `SpecID` with **no** selection at all falls through to the `else` branch and consumes lots in arbitrary storage order — not FIFO. That is the least predictable of the four behaviours.

If strict lot identification is ever wanted, the fix is to refuse (or explicitly confirm) a sale whose selected lots do not cover the quantity, rather than falling through.

---

## 5. Performance Metrics

Both metrics come from `portfolioMath.ts` and are shared by every adapter (see §6).

| Metric | Function | Method |
| :--- | :--- | :--- |
| Time-Weighted Return | `computeModifiedDietz()` | Modified Dietz — time-weighted cashflows |
| Money-Weighted Return | `computeXIRR()` | XIRR, solved by bisection on the NPV function |

Both return `null` rather than a number when they cannot produce a meaningful result — an empty cashflow set, a single cashflow, all-same-sign cashflows, or a degenerate weighted-capital denominator. A `null` is not a zero: it means "not computable", and the UI should say so rather than render `0.0%`.

### ⚠️ Opposite cashflow sign conventions

The two functions expect **contrary** signs, by design:

| | Buys | Sells / dividends | Terminal value |
| :--- | :--- | :--- | :--- |
| `computeModifiedDietz` | **positive** | negative | passed separately as `endValue` |
| `computeXIRR` | **negative** | positive | positive, as a cashflow dated today |

`sqliteAdapter.ts` shows the correct handling, and why it matters:

```typescript
const twr = computeModifiedDietz(cashflows, totVal);        // buys positive
const xirrCfs = [
  ...cashflows.map((c) => ({ date: c.date, amount: -c.amount })),  // negated
  { date: today, amount: totVal },                                  // terminal value
];
const xirr = computeXIRR(xirrCfs);
```

The same array **cannot** be passed to both. Feeding TWR's cashflows straight into XIRR — or vice versa — silently produces a wrong number rather than an error, because both functions accept either sign convention and simply return a value with the opposite meaning. Any new caller must construct its own array and state which convention it is using.

---

## 6. The Shared-Derivation Contract

`portfolioMath.ts` is the single source of truth for lot valuation, disposal allocation and return mathematics. Both the SQLite and Mock adapters import it and call it; neither defines its own:

```typescript
// sqliteAdapter.ts and mockAdapter.ts alike
import { computeLotMetrics, disposeTaxLots, computeModifiedDietz, computeXIRR } from './portfolioMath';
```

This is `AGENTS.md` invariant 7 ("One Derivation, One Place") applied to Phase 4, exactly as `goalMath.ts` was for Phase 3. Deriving the figures per adapter would let the same lot report a different gain depending on which data source was active.

The mathematics is covered by assertions in [`scripts/verify_portfolio_math.ts`](../scripts/verify_portfolio_math.ts):

```bash
node --experimental-strip-types scripts/verify_portfolio_math.ts
```

**29 assertions, 0 failures** at the time of writing, covering lot metrics, disposal ordering under each strategy, realized-gain arithmetic, term classification, Modified Dietz and XIRR convergence.

---

## 7. SQLite Schema

Four tables back the portfolio. Only each record's **own** fields are stored — every derived figure is recomputed through `portfolioMath.ts` on read, so a lot cannot carry a stale gain.

```sql
CREATE TABLE IF NOT EXISTS securities (
  id TEXT PRIMARY KEY,
  symbol TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  security_type TEXT DEFAULT 'stock',
  currency_code TEXT DEFAULT 'USD',
  current_price REAL DEFAULT 0.0,
  last_quote_date TEXT,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS holdings (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  security_id TEXT NOT NULL,
  symbol TEXT NOT NULL,
  quantity REAL DEFAULT 0.0,
  average_cost REAL DEFAULT 0.0,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(account_id, security_id)
);

CREATE TABLE IF NOT EXISTS security_lots (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  security_id TEXT NOT NULL,
  symbol TEXT NOT NULL,
  purchase_date TEXT NOT NULL,
  initial_quantity REAL NOT NULL,
  remaining_quantity REAL NOT NULL,
  purchase_price REAL NOT NULL,
  commission_paid REAL DEFAULT 0.0,
  state TEXT DEFAULT 'open',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS lot_disposals (
  id TEXT PRIMARY KEY,
  lot_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  symbol TEXT NOT NULL,
  disposal_date TEXT NOT NULL,
  quantity_sold REAL NOT NULL,
  cost_basis_sold REAL NOT NULL,
  proceeds REAL NOT NULL,
  realized_gain REAL NOT NULL,
  term_type TEXT NOT NULL,
  disposal_strategy TEXT DEFAULT 'FIFO',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

`holdings` is keyed `UNIQUE(account_id, security_id)` — one aggregated position per security per account, with `average_cost` maintained on trade. The lot-level detail lives in `security_lots`; `lot_disposals` is an append-only realized-gains journal.

---

## 8. Sources & Endpoint Parity

| Capability | Odoo route | SQLite | Mock |
| :--- | :--- | :---: | :---: |
| Holdings | `/api/v1/mobile/investments/holdings` | ✅ | ✅ |
| Tax lots | `/api/v1/mobile/investments/lots` | ✅ | ✅ |
| Realized disposals | `/api/v1/mobile/investments/disposals` | ✅ | ✅ |
| Execute trade | `/api/v1/mobile/investments/trade` | ✅ | ✅ |
| Summary + TWR/MWR | `/api/v1/mobile/investments/summary` | ✅ | ✅ |

All five client calls have matching server routes. The server's `investments/*` handlers were added in `d3087fa`; the Desktop client in `8f1f8da`.

See [`04_LOCAL_SQLITE_AND_OFFLINE_STORAGE.md`](04_LOCAL_SQLITE_AND_OFFLINE_STORAGE.md) for the full DDL and [`08_PLANNING_AND_FORECASTING_HUBS.md`](08_PLANNING_AND_FORECASTING_HUBS.md) for the shared-derivation rule these both follow.