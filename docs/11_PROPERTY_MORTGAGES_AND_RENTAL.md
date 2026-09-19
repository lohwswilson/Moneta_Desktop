# Property, Mortgages & Rental Income

This document covers the **Phase 5** hubs: property equity and valuation, mortgage amortization and prepayment modelling, and the landlord rent roll.

*Parity with Odoo `property.py`, `loan.py`, and the `moneta_core` landlord hub (`rental_property.py`).*

---

## 1. Two shared engines

Phase 5 follows the same Rule 7 contract as every phase before it (see [`08_PLANNING_AND_FORECASTING_HUBS.md`](08_PLANNING_AND_FORECASTING_HUBS.md) §5 and [`10_STOCK_PORTFOLIO_AND_TAX_LOTS.md`](10_STOCK_PORTFOLIO_AND_TAX_LOTS.md) §6): every derived figure is computed in **one** shared module that every adapter calls, never reimplemented per adapter.

| Module | Owns | Mirrors |
| :--- | :--- | :--- |
| `src/lib/data/loanMath.ts` | Annuity payment, amortization schedule, prepayment simulation, rate-change inference | `loan.py` |
| `src/lib/data/propertyMath.ts` | Equity, LTV, rental yield, NOI, cashflow, lease status, rent roll | `property.py`, `rental_property.py` |

`propertyMath.ts` imports its calendar helpers from `loanMath.ts` at **runtime** — that is the one place in the codebase using an explicit `.ts` import specifier. It is required: the `node --experimental-strip-types` verification scripts must resolve it without a bundler, and type-only imports elsewhere are stripped before resolution. `allowImportingTsExtensions` in `tsconfig.app.json` permits it; Vite resolves it natively.

```bash
node --experimental-strip-types scripts/verify_loan_math.ts      # 55 assertions
node --experimental-strip-types scripts/verify_property_math.ts  # 69 assertions
```

---

## 2. The Amortization Engine

Four behaviours in `loanMath.ts` are deliberate, and each corresponds to a defect that a naive reimplementation reproduces. Upstream's own comments record the same reasoning.

### 2.1 The schedule is built from the currency-rounded payment

`monthly_payment` is a `Monetary` field, so Odoo rounds it to the currency's 2dp precision on write, and the amortization table reads that stored value — not the full-precision annuity. A payment a fraction of a cent smaller needs an extra installment to clear the balance:

| | 300k / 6% / 30y |
| :--- | :--- |
| Full-precision annuity | 361 payments |
| **Currency-rounded payment** | **360 payments** |

`buildSchedule()` therefore returns both: `monthlyPayment` at full precision for display, and `scheduledPayment` — the 2dp figure the table is actually built from. Every loop uses the latter.

### 2.2 The payoff date is read from the loop

An N-payment schedule advances **N−1** intervals from the first payment. So neither `start + N months` nor `start + (N−1) months` is correct on its own once rounding adds a final installment — one form is a period late where there was no residue, the other a period early where there was. `payoffDate` is therefore read from the last line the loop produced, and is guaranteed to equal `lines[lines.length - 1].payment_date`.

### 2.3 A remainder smaller than one payment is absorbed

A sub-cent residue would otherwise leave a 360-month loan scheduling 361 payments. When the schedule reaches its term and the outstanding balance is **smaller than the payment just made**, it is absorbed into the final installment:

```typescript
if (monthIdx >= termMonths && endBalance > 0 && endBalance < totalPrincipal) {
  extraTotal = 0;
  schedPrincipal = balance;
  totalPrincipal = balance;
  endBalance = 0;
}
```

A **genuine shortfall** — more owed than one payment covers — is left alone, so the schedule keeps running and `ranPastTerm` reports `true` rather than the debt being silently written off. A 6%-based payment against a 30% rate is the test case: the balance grows instead of clearing, and the loan runs to the 1200-month safety cap with the balance still outstanding.

### 2.4 Months saved is measured against the computed baseline

`monthsSaved` compares against the **computed** baseline schedule, not the nominal term. The two differ by one whenever a residue adds an installment, so measuring against the term would overstate the saving.

### 2.5 One deliberate divergence from upstream

`loan.py` applies the remainder absorption in its baseline summary loop and in `action_generate_schedule`, but **not** in its accelerated summary loop — so upstream's accelerated totals and its own displayed table can disagree by one installment.

`loanMath.ts` uses a **single** schedule builder for both, and derives every summary figure from the schedule it describes. The figures therefore always match the table on screen. This is the one intentional numerical divergence from Odoo in Phase 5, and it is a divergence *toward* internal consistency.

### 2.6 Prepayment simulation

```typescript
simulatePrepayment({ principal, annualRatePct, termMonths, startDate,
                     extraMonthly, lumpSum, lumpSumDate, rateChanges })
// → { baseline, accelerated, interestSaved, monthsSaved, yearsSaved }
```

The baseline is the same loan with **no** prepayments. Building it from the same options object would carry the extra payment it is meant to measure against, and every saving would compute as zero — a defect the verification suite catches.

Worked example, 300k / 6% / 30y with $500/month extra: **148 months and $160,295.72 of interest saved**.

A lump sum applies in its month only, matched on year and month, and behaves identically to extra principal in that month.

### 2.7 Rate changes

`rateChanges` are ordered by `effective_date` and applied for every period where `payment_date >= effective_date`; because the list is ascending, the latest applicable rate wins. A step from 6% to 9% mid-loan raises the monthly interest ratio by 1.5× and extends the loan past its original term, since the payment itself does not change.

### 2.8 Rate-change inference

`detectRateChanges()` mirrors `loan.py::action_infer_rate_changes`. Historical interest payments are annualised:

```
annual_rate = (interest_amount / balance_before) × 12 × 100
```

with `balance_before = abs(running_balance) + abs(amount)`, ignoring observations under a 500 balance or outside a 0.1–30% sanity band. A **new segment begins when an observation deviates from the current segment's median by at least 15 basis points** — below that, noise is absorbed into the plateau. The first segment is the loan's opening rate (written to the scenario), and subsequent segments become rate-change rows.

---

## 3. Property Equity

`computePropertyMetrics()` derives everything `moneta.property` reports:

| Field | Rule |
| :--- | :--- |
| `mortgage_balance` | `abs(linked account current_balance)` — a liability balance is negative, so equity compares magnitudes |
| `equity_value` | `max(market_value − debt, 0)` |
| `loan_to_value_ratio` | `debt / market_value × 100`, rounded to 1dp; `0` when the value is zero |
| `occupancy_rate_pct` | `100` if any active tenant, else `0` |
| `gross_annual_rental_income` | `monthly_rent × 12` |
| `gross_rental_yield_pct` | `annual rent / market_value × 100`, 2dp |
| `net_operating_income` | `annual rent − (tax + insurance + HOA) × 12` |
| `net_monthly_cashflow` | `monthly rent − monthly opex − mortgage monthly payment` |

### Equity is clamped at zero — deliberately

```typescript
const equity_value = Math.max(marketValue - debt, 0);
```

A property worth $500k carrying $600k of debt reports **$0 equity, not −$100k**. This mirrors upstream exactly, and was a conscious choice: the Desktop app stays numerically identical to Odoo.

The cost is real and worth stating plainly — an underwater property reads as though it is fully paid off on the equity line. Nothing else hides it: the debt is fully visible in `mortgage_balance`, and `loan_to_value_ratio` reports **120%**, so the LTV bar is the signal that a property is under water. If negative equity is ever wanted, this is the one line to change.

### Rental income falls back to the base field

Monthly rent is the **sum of active tenants' `monthly_rent_amount`** where an active lease exists. A vacant or not-yet-let property falls back to the user-entered `monthly_rental_income`. Only tenants whose lease is `active` contribute — an expired lease earns nothing.

---

## 4. Leases and the Rent Roll

### Lease status

| Condition | Status |
| :--- | :--- |
| `today < lease_start_date` | `upcoming` |
| `lease_start_date ≤ today ≤ lease_end_date` | `active` |
| `today > lease_end_date` | `expired` |
| either date missing | `active` (upstream's default) |

Both boundaries are **inclusive**: a lease starting today is already active, and one ending today is still active until the day passes.

`terminated` is a valid status that is **never produced** — upstream cannot reach it either, since no compute or action assigns it. It is a manual state, and the Desktop app mirrors that rather than inventing a rule for it.

### Payment status

Upstream's `_compute_balance_due` only ever assigns `paid` or `partial`, and leaves `overdue` and `waived` to logic that does not exist anywhere in `rental_property.py` (verified — neither value is assigned in the module). A rent roll that cannot say "overdue" is not a rent roll, so the Desktop derivation adds it:

| Condition | Status |
| :--- | :--- |
| `payment_status` is already `waived` | `waived` — preserved, because waiving is a decision not an inference |
| `amount_paid ≥ amount_due` and `amount_due > 0` | `paid` |
| past due and `amount_due > amount_paid` | `overdue` |
| `amount_paid > 0` | `partial` |
| otherwise | `pending` |

**Timing is checked before part-payment.** A payment that is partly paid and past its due date reads `overdue`, not `partial`. The two are orthogonal in reality — an amount state and a timing state — and with one field the missed deadline is the more actionable fact: it is what a rent roll chases, and `amount_paid` still carries the part-payment detail.

`balance_due` is `max(amount_due − amount_paid, 0)`, so an overpayment never reads as a credit.

`total_rent_overdue` counts **only** unsettled past-due balances. A waived payment is excluded entirely; an unpaid payment that is not yet due is not overdue.

### Schedule generation

`generateRentSchedule()` produces one payment per lease month, keyed by `period_month` — the **first day of the rental month**. That key is what makes regeneration idempotent: re-running skips months that already have a payment rather than duplicating them, so "0 created" means the schedule was already complete.

The due day is capped at **28**, so a due day of 29–31 can never overflow into the following month. A lease starting on the 31st still produces contiguous months.

---

## 5. Verification

Both engines are pinned by assertions:

| Suite | Assertions | Covers |
| :--- | :---: | :--- |
| `scripts/verify_loan_math.ts` | 55 | 360-vs-361 installment count, loop-derived payoff date, remainder absorption, genuine shortfall running past term, prepayment savings, lump-sum month matching, step-rate application, calendar clamping, the 15bp step detector, degenerate inputs |
| `scripts/verify_property_math.ts` | 69 | Equity clamping (including underwater and exactly-fully-mortgaged), LTV edges, rental metrics, vacant fallback, lease boundaries (both inclusive), payment status ordering, rent roll totals, schedule idempotency, due-day capping, portfolio aggregation |

Both suites caught real defects during development rather than merely confirming working code — the prepayment baseline bug (every saving computing as zero) and the payment-status ordering bug (a partly-paid overdue payment not counting as overdue) were both found by these assertions.
