# Banking, Checkbook Registers & Split Transactions

Moneta Wealth incorporates the checkbook register architecture of **Quicken Premier**, featuring point-in-time running balance recalculation, 1-click `Clr` reconciliation toggles, and multi-category split transactions.

---

## 1. Register Layout & Columns

Selecting an account from the sidebar opens the **Checkbook Register**:

```
+-------------------------------------------------------------------------------------------------------------------------+
| DBS High Interest Checking ••••1234                                    Cleared Balance: $12,500.00 | Total: $12,500.00  |
+-------------------------------------------------------------------------------------------------------------------------+
| [ All (42) ] [ Unreconciled ] [ Cleared (C) ] [ Reconciled (R) ]          [🔍 Filter payee...] [📥 Import] [+ Add Entry] |
+------------+---------------------------+-------------------+-------------+------------+------------+--------+-----------+
| Date       | Payee / Description       | Category          | Memo        | Debit (-)  | Credit (+) | Status | Balance   |
+------------+---------------------------+-------------------+-------------+------------+------------+--------+-----------+
| 2026-09-17 | FairPrice Finest          | [SPLIT (2) ▼]     | Groceries   | $85.50     |            |  CLR   | $12,500.00|
|            | └─ Groceries: $65.50 (Food & pantry)                                                                       |
|            | └─ Household Supplies: $20.00 (Detergent)                                                                  |
| 2026-09-14 | Tech Consulting Client    | Income & Salary   | Retainer    |            | $6,500.00  |  REC   | $12,585.50|
| 2026-09-12 | SP Utilities Services     | Utilities         | Power/Water | $145.20    |            |  UNC   |  $6,085.50|
+------------+---------------------------+-------------------+-------------+------------+------------+--------+-----------+
```

### Table Columns
1. **Date**: Formatted as `YYYY-MM-DD`.
2. **Payee / Description**: Merchant or transaction party name.
3. **Category**: Expense/income category, or an interactive purple `[SPLIT (N)]` toggle button for multi-line transactions.
4. **Memo**: User-provided notes or bank transaction reference tags.
5. **Debit (-)**: Outflows / expenses highlighted in rose red.
6. **Credit (+)**: Inflows / deposits highlighted in emerald green.
7. **Status (Clr)**: Interactive 1-click reconciliation toggle.
8. **Running Balance**: Exact account balance following this transaction.

---

## 2. Running Balance Engine & Tiebreaker Sorting

Running balances are calculated dynamically from transaction history.

### Chronological Tiebreaker Ordering
When multiple transactions share the exact same calendar date, Moneta Wealth enforces a **credit-before-debit tiebreaker ordering**:

$$\text{ORDER BY: } \text{date DESC}, \quad \text{amount ASC}, \quad \text{id DESC}$$

- Because deposits and credits have positive amounts and debits have negative amounts, deposits are processed before payments occurring on the same date.
- **Why this matters**: Prevents your register's running balance from dipping negative on same-day funded purchases (e.g. depositing a $5,000 paycheck and writing a $3,000 rent check on the 1st of the month).

---

## 3. 1-Click Interactive `Clr` Reconciliation

Clicking the badge in the **Status** column cycles its state:

```
[ UNC ] (Unreconciled)  ──────►  [ CLR ] (Cleared)  ──────►  [ REC ] (Reconciled)  ──────►  [ UNC ]
```

| State | Badge Visual | Definition | Ledger Impact |
| :--- | :--- | :--- | :--- |
| **Unreconciled** | Zinc border (`UNC`) | Newly recorded; has not appeared on bank statement | Excluded from Cleared Balance |
| **Cleared** | Emerald green (`CLR`) | Transaction has cleared the bank or card issuer | Included in Cleared Balance |
| **Reconciled** | Sky blue (`REC`) | Formally reconciled against a monthly statement | Included in Cleared Balance & Locked |

### Cleared vs Total Balance
- **Total Balance**: Sum of all recorded transactions in the account.
- **Cleared Balance**: Sum of only transactions marked as `cleared` (`CLR`) or `reconciled` (`REC`).
- The difference between Total and Cleared balance represents outstanding checks or pending charges.

---

## 4. Multi-Category Split Transactions

Split transactions allow a single receipt or bank charge to be allocated across multiple expense and income categories.

### Recording a Split Transaction
1. Click **+ Add Transaction** (or press `N`).
2. Enter the **Total Amount** (e.g., `$100.00`).
3. Click **Split Across Categories** to activate split mode.
4. Add line items:
   - Category (e.g., `Groceries`)
   - Amount (e.g., `$75.00`)
   - Memo (e.g., `Organic pantry groceries`)
5. If an unallocated remainder exists, the form displays:
   ```
   Remaining: $25.00 to allocate
   ```
6. Click the **`max`** button on any sub-row to auto-fill the exact remaining balance.
7. Once the allocated sum equals the total amount, a green indicator confirms:
   ```
   ✔ Fully Allocated ($100.00)
   ```
8. Click **Record Entry** to commit.

### Register Split Breakdown View
- Transactions containing splits display a purple `[SPLIT (N) ▼]` button in the register's Category column.
- Clicking this badge toggles an indented breakdown drawer showing each sub-allocation:
  - Sub-category name
  - Sub-memo
  - Individual split amount

---

## 5. Filtering & Search

- **Status Tabs**:
  - `All`: View all transactions.
  - `Unreconciled`: Focus on pending or un-cleared items.
  - `Cleared (C)`: Review cleared transactions awaiting statement reconciliation.
  - `Reconciled (R)`: Review locked historical records.
- **Instant Search**: Type into the search input to filter simultaneously across payee names, category names, and memo strings.

---

## 6. Editing & Deleting Transactions

Clicking a register **row** opens a detail edit modal for that transaction.

**Editable fields:** date, payee, category, amount, memo, and reconciliation state — the same set the capture modal collects, pre-populated from the existing record.

**Saving** issues `transactions/update` with the transaction id plus only the changed fields. The register reloads after the write, so running balances and cleared totals are recomputed from the ledger rather than patched in place — a balance corrected by hand would otherwise disagree with the rows that sum to it.

**Deleting** issues `transactions/delete` and is confirmed before it runs. It is irreversible: the ledger row is removed, not voided or soft-deleted, so a deleted transaction no longer contributes to any balance, report, or reconciliation total.

| Action | Endpoint | Notes |
| :--- | :--- | :--- |
| Save edits | `/api/v1/mobile/transactions/update` | Partial — sends only changed fields |
| Delete | `/api/v1/mobile/transactions/delete` | Irreversible; confirmed first |

Both endpoints are implemented in all three adapters (`sqliteAdapter`, `mockAdapter`, `odooAdapter`), so the modal behaves identically offline, in the sandbox, and against Live Odoo.

> **A note on deleting vs voiding.** The reconciliation model supports a `'void'` state (see §3), which preserves the row and excludes it from balances — the accounting-correct way to reverse a posted entry. Deletion removes the row entirely. If auditability ever matters for a given account, voiding is the safer operation; deletion is offered because a mis-keyed entry is better removed than left in the ledger as a permanent artefact.

---

## 7. 10-Second "Verify Balance" Workflow (`VerifyBalanceModal.svelte`)

For personal finance and wealth management, traditional corporate double-entry bank reconciliation (matching line-by-line bank statement fees against corporate ledgers) creates excessive friction. Moneta Wealth implements the modern **10-Second Balance Verification** workflow popularized by YNAB:

### Workflow Paths
1. **Header Trigger**: Clicking **Verify Balance** in the register header displays the account's cleared balance and the count of cleared items awaiting lock.
2. **Path A: Yes, Balance Matches**:
   - The user glances at their banking mobile app or web portal.
   - If the cleared figure matches, clicking **"Yes, It Matches"** bulk-promotes all `cleared` (`CLR`) items to `reconciled` (`REC`), locking them in under 2 seconds.
3. **Path B: No, It's Different**:
   - If a discrepancy exists (e.g. unrecorded interest, small bank fees, cash tips), clicking **"No, It's Different"** prompts for the actual bank balance.
   - Moneta Wealth computes the discrepancy and offers a 1-click **"Create Adjustment & Lock"** action.
   - A 1-line transaction titled `Reconciliation Balance Adjustment` is created with status `reconciled` for the exact difference, bringing the ledger into 100% agreement.
   - All `cleared` items are promoted to `reconciled`.

