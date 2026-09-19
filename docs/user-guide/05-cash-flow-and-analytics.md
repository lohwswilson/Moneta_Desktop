# Cash Flow Trajectory & Payee Intelligence

Understanding where your money goes is helpful, but knowing where your cash balance will be 30, 90, or 365 days from today is critical for avoiding overdrafts and optimizing savings.

---

## 📈 Cash Flow Forecaster (`CashFlowHub.svelte`)

Access the cash flow engine by navigating to **Planning $\rightarrow$ Cash Flow** in [`TopMenuBar.svelte`](file:///opt/moneta_wealth/src/lib/components/TopMenuBar.svelte).

The [`CashFlowHub.svelte`](file:///opt/moneta_wealth/src/lib/components/CashFlowHub.svelte) projects your combined liquid cash balance into the future by combining:
1. **Current Liquid Balances**: Point-in-time cash from all checking, savings, and cash accounts.
2. **Scheduled Future Inflows**: Salary deposits, freelance invoices, rental income, and dividend payments.
3. **Committed Outflows**: Upcoming recurring bills, loan amortizations, credit card statements, and rent.
4. **Baseline Daily Discretionary Burn**: Trailing average daily living expenses.

```
Liquid Balance (SGD)
$70,000 |                                                 * * *
$60,000 |             * * * *                           *
$50,000 |   * * * * *         *       * * * * * * * * *
$40,000 | *                     * * * 
$30,000 |                               <-- Cash Trough: $34,200 on Oct 28
        +------------------------------------------------------------>
        Today       30 Days        90 Days        180 Days     365 Days
```

### Key Forecasting Metrics
- **Projection Horizons**: Switch dynamically between **30 Days**, **90 Days**, **180 Days**, and **1 Year (365 Days)**.
- **Minimum Cash Trough**: Pinpoints the lowest projected cash point across the timeline. This warns you in advance if an upcoming insurance payment or tax bill will cause your checking account to dip below your target safety buffer.
- **Net Trajectory Change**: Shows whether your aggregate liquidity is expanding or contracting over the selected horizon.

---

## 🌊 Interactive Sankey Diagram (`CashFlowHub.svelte`)

Within [`CashFlowHub.svelte`](file:///opt/moneta_wealth/src/lib/components/CashFlowHub.svelte), click the **Sankey Flow** tab to visualize the direct transmission of money through your financial system:

```
+----------------+      +-------------------+      +----------------------+
| Inflows        | ---> | Accounts / Hubs   | ---> | Outflows & Savings   |
+----------------+      +-------------------+      +----------------------+
| Salary         |      | DBS Checking      |      | Rent & Mortgage      |
| Rental Income  |      | OCBC Savings      |      | Groceries & Dining   |
| Dividends      |      | Petty Cash Float  |      | Utilities & Bills    |
|                |      |                   |      | Stock Investments    |
|                |      |                   |      | Emergency Sinking    |
+----------------+      +-------------------+      +----------------------+
```

- **Visual Proportionality**: Node widths correspond directly to the dollar magnitude of cash flowing across categories.
- **Leak Detection**: Instantly identifies oversized outflow channels where cash is being diverted before reaching your savings goals.

---

## 🏪 Payee Intelligence Directory (`PayeeDirectoryHub.svelte`)

Open **Planning $\rightarrow$ Payee Directory** or click **Payees** in [`Sidebar.svelte`](file:///opt/moneta_wealth/src/lib/components/Sidebar.svelte) to open [`PayeeDirectoryHub.svelte`](file:///opt/moneta_wealth/src/lib/components/PayeeDirectoryHub.svelte).

The Payee Intelligence module automatically aggregates all historical transactions associated with individual merchants:

| Payee / Vendor | Primary Category | Cadence | Total Lifetime | Last Transaction |
| :--- | :--- | :--- | :--- | :--- |
| **NTUC FairPrice** | Groceries | Weekly (avg 4.2 days) | S$ 4,820.50 | 2026-09-18 |
| **SP Services Ltd** | Utilities: Electricity | Monthly (~30 days) | S$ 1,740.00 | 2026-09-17 |
| **Grab Singapore** | Transport / Food | Multi-day (avg 2.1 days) | S$ 1,290.40 | 2026-09-16 |
| **Singtel Broadband** | Utilities: Telecom | Monthly (~30 days) | S$ 780.00 | 2026-09-02 |
| **Prudential Assurance** | Insurance: Life | Annual (365 days) | S$ 3,600.00 | 2026-06-15 |

### Merchant Cadence & Memory
- **Cadence Clustering**: Moneta Wealth analyzes the date gaps between transactions for each merchant to infer recurring intervals (Weekly, Monthly, Quarterly, Annual).
- **Default Category Assignment**: Changing the default category on a payee updates future imports and auto-categorization suggestions.
- **Payee Merge**: Consolidate duplicate vendor entries (e.g. `Grab Taxi` and `GrabFood`) into a unified `Grab Singapore` profile.
