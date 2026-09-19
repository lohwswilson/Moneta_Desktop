# Wealth Command Center & FIRE Analytics

The **Wealth Command Center** ([`src/lib/components/CommandCenter.svelte`](file:///opt/moneta_wealth/src/lib/components/CommandCenter.svelte)) is Moneta Desktop's executive overview screen, synthesizing balance sheets, cash flow ratios, and retirement progress into live financial metrics.

---

## 1. Executive Metric Cards

```
+---------------------------------------------------------------------------------------------------------+
| TOTAL NET WORTH                                                                                         |
| $131,050.00 SGD                          Liquid Cash: $47,500.00  •  Investments: $85,000.00            |
+------------------------------------+------------------------------------+-------------------------------+
| MONTHLY CASH FLOW                  | EMERGENCY RUNWAY                   | 4% FIRE PROGRESS              |
| Inflow:  +$6,500.00                | 14.8 Months                        | 14.6% ($131K of $900K)        |
| Outflow: -$3,228.45                | Liquid reserve vs $3.2K burn       | Target: 25x Annual Expenses   |
| Savings Rate: 50.3%                | Status: 🟢 Secure Reserve (>6 Mo)  | Trinity Rule Standard         |
+------------------------------------+------------------------------------+-------------------------------+
```

---

## 2. Balance Sheet Computations

### A. Net Worth
$$\text{Net Worth} = \text{Liquid Cash} + \text{Investments} - \text{Total Liabilities}$$

- **Liquid Cash**: Sum of checking, savings, cash balances, and liquid retirement reserves (`checking`, `savings`, `cash`, `cpf_oa`, `cpf_sa`, `cpf_ma`, `srs`).
- **Investments**: Equity brokerages and crypto assets (`brokerage`, `retirement`, `crypto`).
- **Total Liabilities**: Outstanding debt balances (`credit`, `loan`, `mortgage`).

### B. Monthly Cash Flow & Savings Rate
Calculated dynamically across current calendar month transactions:
- **Monthly Inflow**: Sum of positive transaction amounts recorded since the 1st of the active month.
- **Monthly Outflow**: Absolute sum of negative transaction amounts recorded since the 1st of the active month.
- **Savings Rate %**:
  $$\text{Savings Rate} = \max\left(0, \frac{\text{Inflow} - \text{Outflow}}{\text{Inflow}} \times 100\right)$$

---

## 3. FIRE Milestones & The 4% Rule

Moneta Desktop implements the **Trinity Study 4% Safe Withdrawal Rate (SWR)** framework:

### A. FIRE Target Amount
$$\text{FIRE Target} = \text{Monthly Burn Rate} \times 12 \times 25$$

- **Rationale**: Based on the 4% annual withdrawal rule, an individual requires an investment portfolio equal to 25 times their annual living expenses to sustain retirement indefinitely without depleting capital.
- **Baseline**: If historical expenses are low or unrecorded, Moneta Desktop uses a default floor burn rate of `$3,000 / month` ($900,000 FIRE Target).

### B. FIRE Progress Percentage
$$\text{FIRE Progress \%} = \min\left(100, \frac{\text{Net Worth}}{\text{FIRE Target}} \times 100\right)$$

- Visualized as an emerald progress bar in the Command Center.

---

## 4. Emergency Runway Indicator

The emergency runway measures how many months the household can survive on current liquid cash reserves without any new income:

$$\text{Runway (Months)} = \frac{\text{Liquid Cash}}{\text{Monthly Burn Rate}}$$

### Safety Thresholds
| Runway Range | Indicator Visual | Financial Health Interpretation |
| :--- | :--- | :--- |
| **> 6.0 Months** | 🟢 Emerald Green | **Fully Secure**: Exceeds standard financial resilience recommendations. |
| **3.0 – 6.0 Months** | 🟡 Amber Yellow | **Moderate**: Sufficient for short transitions; monitor discretionary spend. |
| **< 3.0 Months** | 🔴 Rose Red | **Vulnerable**: Reserve is below recommended emergency thresholds. |
