# Banking, Checkbook Registers & Split Transactions

Moneta Desktop incorporates the checkbook register architecture of **Quicken Premier**, featuring point-in-time running balance recalculation, 1-click `Clr` reconciliation toggles, and multi-category split transactions.

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
When multiple transactions share the exact same calendar date, Moneta Desktop enforces a **credit-before-debit tiebreaker ordering**:

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
