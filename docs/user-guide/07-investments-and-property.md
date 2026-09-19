# Investments, Mortgages & Landlord Hub

This chapter explains how to track stock portfolios, optimize tax-lot disposals, model mortgage amortization with prepayment scenarios, and manage rental properties.

---

## 📈 Stock Portfolio & Tax-Lot Hub (`PortfolioHub.svelte`)

Select **Investments $\rightarrow$ Portfolio** in [`TopMenuBar.svelte`](file:///opt/moneta_wealth/src/lib/components/TopMenuBar.svelte) to open [`PortfolioHub.svelte`](file:///opt/moneta_wealth/src/lib/components/PortfolioHub.svelte).

The Portfolio Hub delivers institutional-grade investment accounting with full tax-lot tracking:

```
+-------------------------------------------------------------------------------+
|  Stock Portfolio Overview                 [ Total Value: S$ 184,520.00 ]       |
|  Cost Basis: S$ 142,000.00  |  Unrealized Gain: +S$ 42,520.00 (+29.9%)        |
+-------------------------------------------------------------------------------+
|  Ticker     | Shares  | Avg Cost   | Current Price | Market Value | Return    |
+-------------+---------+------------+---------------+--------------+-----------+
|  DBS.SI     | 2,000   | S$ 32.50   | S$ 38.20      | S$ 76,400.00 | +17.5% 🟢 |
|  VWRA.L     | 400     | US$ 115.00 | US$ 142.50    | S$ 76,950.00 | +23.9% 🟢 |
|  CSPX.L     | 50      | US$ 480.00 | US$ 590.00    | S$ 39,825.00 | +22.9% 🟢 |
+-------------+---------+------------+---------------+--------------+-----------+
```

### Tax-Lot Disposal Strategies (`portfolioMath.ts`)
When selling shares of a stock or ETF held in multiple acquisition batches:
1. Click **Record Sell / Disposal** on the holding.
2. Select your preferred lot disposal strategy:
   - **FIFO (First In, First Out)**: Sells the oldest acquired shares first.
   - **LIFO (Last In, First Out)**: Sells the most recently purchased shares first.
   - **Specific Identification (Specific ID)**: Hand-pick exact lots to optimize capital gains and minimize tax obligations.
3. The system calculates realized gains and updates remaining lot cost bases instantly.

---

## 🏠 Property & Equity Valuation (`PropertyHub.svelte`)

Select **Real Estate $\rightarrow$ Properties** to view [`PropertyHub.svelte`](file:///opt/moneta_wealth/src/lib/components/PropertyHub.svelte).

For homeowners and property investors, Moneta Wealth models true net equity:

$$\text{Net Property Equity} = \text{Current Property Valuation} - \text{Outstanding Loan Principal}$$

$$\text{Loan-to-Value (LTV)} = \left( \frac{\text{Outstanding Mortgage Balance}}{\text{Current Property Valuation}} \right) \times 100$$

### Key Capabilities
- **Valuation History**: Log updated bank valuations or desktop appraisals over time to track home appreciation.
- **LTV Risk Alerts**: Visual indicators highlight conservative ($<50\%$), moderate ($50\%-75\%$), and leveraged ($>75\%$) loan exposure.
- **CPF Housing Accrued Interest**: For Singapore homeowners, track CPF Ordinary Account funds utilized alongside mandatory $2.5\%$ accrued interest refund liabilities upon sale.

---

## 🏦 Mortgage Amortization & Prepayment Simulator (`LoanHub.svelte`)

Access loan schedules by clicking **Real Estate $\rightarrow$ Loans** to open [`LoanHub.svelte`](file:///opt/moneta_wealth/src/lib/components/LoanHub.svelte).

The loan engine (`src/lib/data/loanMath.ts`) models standard fixed-rate, variable-rate, and Singapore step-up mortgage packages:

```
+-------------------------------------------------------------------------------+
|  HDB / Bank Home Loan (30 Years)                  [ Balance: S$ 420,000.00 ]   |
|  Interest Rate: 2.60% p.a.  |  Monthly Payment: S$ 1,682.40                   |
+-------------------------------------------------------------------------------+
|  Prepayment Simulator:                                                        |
|  • Extra Monthly Prepayment:  [ S$ 500.00 ]                                   |
|  • Lump-Sum Prepayment:       [ S$ 20,000.00 ] on Month 24                    |
|                                                                               |
|  SIMULATION RESULTS:                                                          |
|  🎉 Interest Saved:           S$ 48,240.00                                    |
|  ⏱️ Loan Term Reduced By:     6 Years, 4 Months                               |
+-------------------------------------------------------------------------------+
```

- **Full 360-Month Amortization Grid**: View month-by-month breakdowns of Principal, Interest, and Remaining Balance.
- **Interactive Prepayment Scenarios**: Test the compounding financial impact of extra monthly principal payments or annual bonus lump sums before making payments to your bank.

---

## 🏢 Landlord Hub & Rent Roll (`LandlordHub.svelte`)

Select **Real Estate $\rightarrow$ Landlord Hub** to open [`LandlordHub.svelte`](file:///opt/moneta_wealth/src/lib/components/LandlordHub.svelte).

If you lease out an investment property, apartment, or room:
- **Tenant Management**: Record tenant names, contact details, lease start/end dates, and security deposit amounts held in escrow.
- **Rent Roll Schedule**: View monthly rent collection status (Paid, Pending, Overdue).
- **1-Click Rent Posting**: When rent is received, 1-click ledgering records the deposit in your checking account register and marks the month's invoice as settled.
- **Net Rental Yield (NOI)**:
  $$\text{Net Yield} = \frac{\text{Annual Gross Rent} - \text{Property Tax} - \text{Condo Maintenance / MCST} - \text{Repairs}}{\text{Property Valuation}} \times 100$$
