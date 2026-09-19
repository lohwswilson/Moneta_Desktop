# Zero-Based Budgeting & Scheduled Bills

This chapter covers the two core planning modules in Moneta Wealth: the **Envelope Budget Hub** (YNAB-style zero-based budgeting) and the **Recurring Bills & Subscription Radar**.

---

## ✉️ Zero-Based Envelope Budgeting (`BudgetHub.svelte`)

Moneta Wealth adopts the zero-based budgeting principle: **"Give every dollar a job before the month begins."** 

Access the budget center by selecting **Planning $\rightarrow$ Budgets** in [`TopMenuBar.svelte`](file:///opt/moneta_wealth/src/lib/components/TopMenuBar.svelte).

```
+-------------------------------------------------------------------------------+
|  Budget Month: September 2026                 [ Ready to Assign: S$ 0.00 ]     |
|  Income: S$ 8,200.00  |  Budgeted: S$ 8,200.00  |  Actual Spend: S$ 4,120.40  |
+-------------------------------------------------------------------------------+
|  Category Envelope        | Budgeted    | Spent       | Remaining   | Status  |
+---------------------------+-------------+-------------+-------------+---------+
|  ▼ NEEDS (Essential - 50%)                                                   |
|    Rent / Mortgage        | S$ 2,200.00 | S$ 2,200.00 | S$ 0.00     | 🟢 Paid  |
|    Groceries & Food Mart  | S$ 800.00   | S$ 512.40   | S$ 287.60   | 🟢 Safe  |
|    Utilities & Broadband  | S$ 250.00   | S$ 210.00   | S$ 40.00    | 🟢 Safe  |
|  ▼ WANTS (Lifestyle - 30%)                                                   |
|    Dining & Cafes         | S$ 600.00   | S$ 580.00   | S$ 20.00    | 🟡 Close |
|    Entertainment & Subscr | S$ 150.00   | S$ 165.00   | -S$ 15.00   | 🔴 Over  |
|  ▼ SAVINGS & INVEST (20%)                                                    |
|    Emergency Sinking Fund | S$ 1,000.00 | S$ 1,000.00 | S$ 0.00     | 🟢 Done  |
+---------------------------+-------------+-------------+-------------+---------+
```

### 1. Ready to Assign Bar
At the top of [`BudgetHub.svelte`](file:///opt/moneta_wealth/src/lib/components/BudgetHub.svelte), the **Ready to Assign** banner tracks all unallocated monthly income:
- If positive: You have surplus funds that need to be allocated to an envelope or sinking fund.
- If zero: You have achieved a balanced zero-based budget.
- If negative: You have over-allocated funds beyond your available monthly income.

### 2. Envelope Rollover Mechanics
- Unspent balances in positive envelopes roll over into the next calendar month, allowing you to accumulate funds for irregular or seasonal expenses (e.g., insurance premiums or home repairs).
- Negative envelope balances (over-spending) prompt you to move funds from another category to balance the month.

---

## 🎯 "Can I Spend?" Affordability Engine

Before making a major or discretionary purchase, use the **"Can I Spend?" Affordability Engine** integrated directly into the Budget Hub:

1. Select a budget category (e.g. `Dining & Entertainment`).
2. Enter the contemplated purchase price (e.g. `S$ 85.00`).
3. The engine computes your remaining category allocation, trailing daily spend rate, and remaining days in the month:

| Verdict | Color Indicator | Meaning & Guidance |
| :--- | :--- | :--- |
| **Safe** | 🟢 Green | The purchase fits comfortably within your envelope without exceeding your monthly plan. |
| **Caution** | 🟡 Yellow | The purchase leaves less than 15% of your remaining category buffer for the remainder of the month. |
| **Over Budget** | 🔴 Red | The purchase exceeds available funds in this envelope and requires reallocating funds from another category. |

---

## 📅 Recurring Bills & Subscription Detector (`RecurringBillsHub.svelte`)

Subscription creep and missed bill due dates can derail your finances. Open **Planning $\rightarrow$ Recurring Bills** to view [`RecurringBillsHub.svelte`](file:///opt/moneta_wealth/src/lib/components/RecurringBillsHub.svelte).

### Key Features of the Bills Hub
- **Upcoming Horizon**: Filters bills due within the next **14 Days** (immediate priority) or **30 Days** (monthly planning).
- **Auto-Pay Indicators**: Highlights bills set to automatic bank GIRO or credit card recurring charge vs. those requiring manual payment.
- **Cadence Frequency**: Accommodates Monthly (Broadband, Netflix), Quarterly (Conservancy / Town Council fees), Semi-Annual (Motor Insurance), and Annual dues (Road Tax, Club memberships).

### 1-Click "Mark as Paid"
When a bill is paid:
1. Click the **Mark as Paid** button on the bill row.
2. Moneta Wealth automatically:
   - Posts a corresponding transaction to your selected bank or credit card account register.
   - Clears the bill from your immediate upcoming due list.
   - Advances the bill's next scheduled due date to the subsequent billing cycle.
