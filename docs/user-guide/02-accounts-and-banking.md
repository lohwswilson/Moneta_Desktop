# Accounts, Checkbook Register & Reconciliation

This chapter details how to configure accounts, maintain daily transaction registers, capture multi-split entries, and reconcile your ledgers with bank statements.

---

## 🏦 Managing Accounts

Moneta Wealth supports comprehensive account classifications to handle Singapore and global financial structures:

| Account Type | Real-World Examples | Balance Treatment |
| :--- | :--- | :--- |
| **Bank (Checking / Savings)** | DBS Multiplier, OCBC 360, UOB One | Asset (Positive) |
| **Credit Card** | Citi Cash Back, DBS Altitude, Standard Chartered Simply Cash | Liability (Negative) |
| **Cash Wallet** | Physical Cash, PayNow float, Petty Cash | Asset (Positive) |
| **Loan / Mortgage** | HDB Concessionary Loan, Bank Home Loan | Liability (Negative) |
| **Brokerage** | Interactive Brokers, Tiger Brokers, FSMOne, CDP | Asset (Positive) |

### Creating an Account (`AddAccountModal.svelte`)
1. Click the **`+`** icon next to the **Accounts** header in [`Sidebar.svelte`](file:///opt/moneta_wealth/src/lib/components/Sidebar.svelte).
2. The [`AddAccountModal.svelte`](file:///opt/moneta_wealth/src/lib/components/AddAccountModal.svelte) opens:
   - **Account Name**: e.g., `DBS Multiplier Account`.
   - **Type**: Select from `Bank`, `Credit Card`, `Cash`, `Loan`, or `Brokerage`.
   - **Currency**: Default `SGD` (or `USD`, `EUR`, `MYR`, `GBP`).
   - **Starting Balance**: Enter your current balance. The engine automatically creates an opening balance transaction in the ledger.
   - **Institution / Bank**: Specify the financial institution.
   - **Optional Settings**: Set credit limits for cards or annual interest rates for savings accounts.
3. Click **Save Account**. The new account appears immediately in the sidebar and updates your Net Worth.

---

## 📝 The Checkbook Register (`CheckbookRegister.svelte`)

The [`CheckbookRegister.svelte`](file:///opt/moneta_wealth/src/lib/components/CheckbookRegister.svelte) provides the traditional ledger grid that financial power users rely on:

```
+------------+-------------------------+----------------------+------------+------------+-------+
| Date       | Payee                   | Category             | Amount     | Balance    | Clr   |
+------------+-------------------------+----------------------+------------+------------+-------+
| 2026-09-18 | NTUC FairPrice          | Groceries            | -S$ 64.20  | S$ 5,210.80| [Clr] |
| 2026-09-17 | SP Services Ltd         | Utilities: Electricity| -S$ 142.50 | S$ 5,275.00| [Rec] |
| 2026-09-15 | Monthly Salary Deposit  | Income: Salary       | +S$ 6,500.0| S$ 5,417.50| [Rec] |
+------------+-------------------------+----------------------+------------+------------+-------+
```

### Key Register Features
- **Running Balance**: Calculates the true point-in-time chronological balance after every transaction.
- **Payee & Category Search**: Filter transactions instantly across thousands of records.
- **Split Transaction Badges**: Transactions with multiple allocations display a distinct `Split` tag.
- **In-Line Notes**: Click any transaction to edit memos, check numbers, or tags.

---

## ⚡ Quick Transaction Capture & Splits (`QuickAddModal.svelte`)

To record new spending on the fly, click the top **`+ Transaction`** button to open [`QuickAddModal.svelte`](file:///opt/moneta_wealth/src/lib/components/QuickAddModal.svelte).

### Recording a Standard Transaction
1. Choose **Expense** or **Income**.
2. Select the **Account** (e.g., `OCBC 365 Card`).
3. Enter the **Amount** and **Date**.
4. Type or select the **Payee** (e.g., `GrabFood`).
5. Choose a primary **Category** (e.g., `Dining & Takeaway`).
6. Click **Save Transaction**.

### Multi-Category Split Allocations
When a single receipt spans multiple budget categories (such as a grocery trip that includes both household supplies and food):
1. In [`QuickAddModal.svelte`](file:///opt/moneta_wealth/src/lib/components/QuickAddModal.svelte), click **`+ Add Split`**.
2. Allocate amounts to distinct categories:
   - Line 1: `Groceries` $\rightarrow$ `S$ 85.00`
   - Line 2: `Household & Cleaning` $\rightarrow$ `S$ 25.50`
   - Line 3: `Personal Care` $\rightarrow$ `S$ 14.50`
3. The modal features **Live Remainder Math**: a reactive indicator displays how much of the total receipt remains unallocated. Once the remainder reaches `S$ 0.00`, the transaction can be saved.

---

## 🔄 1-Click Reconciliation Workflow

Moneta Wealth follows a strict three-state reconciliation lifecycle:

```
[ Unreconciled ]  ──( Click Clr )──>  [ Cleared ]  ──( Verify Statement )──>  [ Reconciled ]
```

- **`'unreconciled'`**: The transaction is recorded in your register but has not yet appeared on your bank's posted statement.
- **`'cleared'`**: You have verified the transaction appeared in your bank's online banking or pending activity. Simply click the **Clr** button in the register row to toggle it to Cleared.
- **`'reconciled'`**: The transaction has been formally matched and locked against an official monthly bank statement.

---

## ⏱️ 10-Second Balance Verification (`VerifyBalanceModal.svelte`)

Instead of tedious manual statement matching, use the **10-Second Balance Verification** tool:

1. Click **`Verify Balance`** above the register to open [`VerifyBalanceModal.svelte`](file:///opt/moneta_wealth/src/lib/components/VerifyBalanceModal.svelte).
2. Look at your bank's mobile app or paper statement and type the **Statement Ending Balance**.
3. Moneta Wealth instantly compares your entered balance against the **Cleared Register Balance**:
   - **Difference = S$ 0.00**: Your register is perfectly balanced! Click **Reconcile Now** to lock all cleared transactions into `'reconciled'` state.
   - **Difference $\neq$ S$ 0.00**: The discrepancy is clearly highlighted. You can inspect un-cleared items, or click **Create Adjustment Transaction** to automatically post an entry balancing the ledger.
