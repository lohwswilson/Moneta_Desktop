# Net Worth, FIRE Progress & Financial Goals

This chapter explains the long-term wealth building features of Moneta Wealth, including the **Wealth Command Center**, the **4% Rule FIRE Milestone Tracker**, and the **Financial Goals Hub**.

---

## 💎 Wealth Command Center (`CommandCenter.svelte`)

The [`CommandCenter.svelte`](file:///opt/moneta_wealth/src/lib/components/CommandCenter.svelte) banner sits prominently across the top of the application, serving as your executive financial dashboard:

```
+-----------------------------------------------------------------------------------------------+
|  NET WORTH          LIQUID RESERVES       TOTAL LIABILITIES     RUNWAY        FIRE TARGET     |
|  S$ 485,210.00      S$ 62,400.00          S$ 14,200.00          14.2 Months   48.5% of Goal   |
|  ▲ +2.4% this mo    ▲ S$ 4,500 vs target  ▼ Credit & Loans      Safe Buffer   [█████░░░░░]    |
+-----------------------------------------------------------------------------------------------+
```

### Core Financial Formulas

$$\text{Net Worth} = \sum(\text{Liquid Cash} + \text{Brokerage Investments} + \text{Property Equity} + \text{CPF}) - \sum(\text{Liabilities})$$

1. **Liquid Reserves**:
   - Aggregates all readily spendable funds (Checking, High-Yield Savings, Petty Cash).
   - Excludes illiquid assets like CPF Retirement balances, locked fixed deposits, or physical property equity.
2. **Total Liabilities**:
   - Aggregates short-term credit card balances, personal lines of credit, and amortizing loan balances.
3. **Emergency Runway**:
   $$\text{Runway (Months)} = \frac{\text{Liquid Reserves}}{\text{Monthly Trailing Living Expenses}}$$
   - A runway above **6.0 Months** is highlighted in 🟢 Green.
   - A runway between **3.0 and 6.0 Months** displays in 🟡 Yellow.
   - A runway under **3.0 Months** displays in 🔴 Red.

---

## 🔥 4% Rule FIRE Milestone Tracker

The **Financial Independence, Retire Early (FIRE)** progress bar calculates your proximity to self-sustaining wealth:

$$\text{FIRE Target (SGD)} = \text{Annual Living Expenses} \times 25$$

$$\text{FIRE Progress (\%)} = \left( \frac{\text{Investable Net Worth}}{\text{FIRE Target}} \right) \times 100$$

- **Investable Net Worth**: Includes liquid cash, stocks, and bond holdings that generate compound returns (excludes primary residence equity).
- **Annual Expenses**: Derived automatically from your trailing 12-month budget outlays or customized in settings.
- **Progress Milestones**: Visual notches celebrate milestones at **25%** (Quarter-FI), **50%** (Half-FI), **75%** (Lean-FI), and **100%** (Full Financial Independence).

---

## 🎯 Financial Goals & Sinking Funds (`GoalsHub.svelte`)

Access your financial milestones by clicking **Goals** in [`Sidebar.svelte`](file:///opt/moneta_wealth/src/lib/components/Sidebar.svelte) or opening [`GoalsHub.svelte`](file:///opt/moneta_wealth/src/lib/components/GoalsHub.svelte).

Sinking funds protect your daily checking account from unexpected lump-sum expenses by accumulating small amounts every month.

```
+-------------------------------------------------------------------------------+
|  Financial Goals & Sinking Funds                            [ + New Goal ]    |
+-------------------------------------------------------------------------------+
|  Goal Name             | Target (SGD) | Current (SGD)| Target Date | Progress |
+------------------------+--------------+--------------+-------------+----------+
|  🛡️ Emergency Fund     | S$ 30,000.00 | S$ 30,000.00 | 2026-12-31  | 100.0% 🟢|
|  🏠 HDB Renovation     | S$ 50,000.00 | S$ 32,500.00 | 2027-06-30  |  65.0% 🟢|
|  ✈️ Japan Vacation    | S$  6,000.00 | S$  4,200.00 | 2026-11-15  |  70.0% 🟢|
|  🚗 Car Downpayment    | S$ 40,000.00 | S$ 12,000.00 | 2028-01-01  |  30.0% 🟡|
+------------------------+--------------+--------------+-------------+----------+
```

### Creating & Managing Goals
1. Click **`+ New Goal`** in [`GoalsHub.svelte`](file:///opt/moneta_wealth/src/lib/components/GoalsHub.svelte).
2. Enter the **Goal Name**, **Target Amount**, and desired **Target Completion Date**.
3. Choose whether to link the goal to a dedicated bank account (e.g. an OCBC 360 sub-account) or track it virtually as an envelope.
4. The goal progress engine (`src/lib/data/goalMath.ts`) calculates the **Required Monthly Savings Rate**:
   $$\text{Monthly Savings Needed} = \frac{\text{Target Amount} - \text{Current Amount}}{\text{Months Remaining}}$$
5. Click **Record Deposit** or **Record Withdrawal** to adjust goal progress whenever you transfer funds into or out of the sinking fund.
