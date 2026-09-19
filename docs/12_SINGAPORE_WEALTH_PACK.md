# Singapore Regional Wealth Pack (CPF, LIFE, Housing Accrued Interest, Stamp Duty & IRAS Tax)

The **Singapore Regional Wealth Pack** equips Moneta Wealth with comprehensive, statutory-accurate financial planning engines tailored specifically to the Singapore regulatory and tax landscape.

It integrates seamlessly with the local-first SQLite engine and mirrors the calculation mechanics of the Odoo `moneta_core` backend models (`cpf.py`, `singapore_property.py`, `iras_tax.py`, `srs.py`).

---

## 🏛️ Architecture & Cross-System Parity Contract

In accordance with **AGENTS.md Rule 7 (*One Derivation, One Place*)** and **Rule 9 (*Headless Engine & Single-Surface UX*)**, all calculations are implemented in shared TypeScript modules that strictly mirror their Python counterparts in `moneta_core`:

| Desktop Module | Odoo Counterpart | Statutory Authority / Benchmark |
| :--- | :--- | :--- |
| `cpfMath.ts` | `cpf.py::_compute_cpf_interest` | Central Provident Fund Board (CPF Act) |
| `cpfMath.ts` | `cpf.py::_compute_cpf_life_projection` | CPF LIFE Actuarial Payout Tables |
| `cpfMath.ts` | `cpf.py::_compute_contribution_rates` | CPF Board Statutory Contribution Rates (2026 OW Ceiling: S$8,000) |
| `cpfMath.ts` | `singapore_property.py::_compute_cpf_refund` | CPF Board Housing Scheme (2.5% p.a. compounded) |
| `cpfMath.ts` | `singapore_property.py::_compute_stamp_duties` | Inland Revenue Authority of Singapore (IRAS BSD & ABSD) |
| `cpfMath.ts` | `singapore_property.py::_compute_mas_affordability` | Monetary Authority of Singapore (MAS TDSR 55% & MSR 30%) |
| `singaporeFixedIncomeMath.ts` | `singapore_fixed_income.py::_compute_yields` | MAS Singapore Savings Bonds (SSB 10-Yr Step-Up & S$200k Cap) |
| `singaporeFixedIncomeMath.ts` | `singapore_fixed_income.py::_compute_tbill_economics` | MAS Treasury Bills (6-Month & 1-Year Discount Auctions) |
| `singaporeFixedIncomeMath.ts` | `singapore_fixed_income.py::_compute_comparison` | US-Ireland Double Tax Treaty (15% WHT & 0% US Estate Tax) |
| `srsMath.ts` | `srs.py::_compute_srs_metrics` | IRAS Supplementary Retirement Scheme (S$15.3k/S$35.7k Caps) |
| `srsMath.ts` | `srs.py::_compute_withdrawal_plan` | IRAS SRS 10-Year 50% Concession Penalty-Free Withdrawal Rules |
| `irasMath.ts` | `iras_tax.py::_compute_iras_tax` | IRAS Personal Income Tax Act (YA 2024–2026) |

---

## 🇸🇬 Core Capabilities

### 1. CPF Multi-Account Hub & Monthly Interest Engine
- **Account Structures**: Tracks Ordinary Account (OA @ 2.5%), Special Account (SA @ 4.0%), MediSave Account (MA @ 4.0%), and Retirement Account (RA @ 4.0%).
- **Statutory Interest Engine**:
  - Base interest calculated monthly and credited annually in December.
  - **Extra 1% Interest Pool**: The Singapore Government pays an extra 1.0% interest on the first S$60,000 of combined CPF balances (capped at S$20,000 for OA). The extra interest earned on OA flows directly into the SA (or RA after age 55) to accelerate retirement compounding.
  - **Age 55+ Senior Extra 1%**: For members aged 55 and above, an additional 1.0% interest is paid on the first S$30,000 of combined balances (up to 6.0% total on RA/SA/MA).

### 2. CPF LIFE Actuarial Retirement Simulator
- **Retirement Sum Benchmarks**:
  - **Basic Retirement Sum (BRS)**: S$106,500
  - **Full Retirement Sum (FRS)**: S$213,000 (2x BRS)
  - **Enhanced Retirement Sum (ERS)**: S$426,000 (4x BRS - 2025/2026 4x multiple)
- **Annuity Plan Options**:
  - **Standard Plan**: Default CPF LIFE plan providing level, steady monthly payouts for life.
  - **Escalating Plan**: Payouts start ~20% lower but increase by 2.0% every year for life to buffer against inflation.
  - **Basic Plan**: Lower monthly payouts with higher bequest leftover for beneficiaries.
- **Retirement Milestone Ladder**: Real-time visual progress meter illustrating whether the member's RA balance achieves BRS, FRS, or ERS benchmarks.

### 3. CPF Housing Scheme & 2.5% Accrued Interest Calculator
- **Principal & Compounding Refund**:
  - Calculates total OA principal withdrawn for downpayment, monthly mortgage payments, and CPF housing grants.
  - Compounds accrued interest at **2.5% per annum** compounded monthly over the holding duration.
- **Net Cash Proceeds on Sale**:
  - Computes:
    $$\text{Net Cash Proceeds} = \max(\text{Sale Price} - \text{Outstanding Bank Loan} - \text{CPF Refund Due}, 0)$$
  - Prevents shortfall surprises by clearly alerting the homeowner to the exact liquid cash they will receive in bank accounts after full CPF restitution.

### 4. Singapore Stamp Duty Calculator (BSD & ABSD)
- **Buyer's Stamp Duty (BSD)**: Tiered statutory schedule on residential property:
  - First S$180,000: 1%
  - Next S$180,000: 2%
  - Next S$640,000: 3%
  - Next S$500,000: 4%
  - Next S$1,500,000: 5%
  - Above S$3,000,000: 6%
- **Additional Buyer's Stamp Duty (ABSD)**: Full support across all buyer profiles:
  - Singapore Citizen (1st: 0%, 2nd: 20%, 3rd+: 30%)
  - Permanent Resident (1st: 5%, 2nd: 30%, 3rd+: 35%)
  - Foreigner (60% flat across all purchases)
  - Entity / Corporate / Trust (65% flat)

### 5. IRAS Personal Income Tax Planner (Borang / Tax Assessment)
- **Progressive Tax Brackets (YA 2024–2026)**:
  - S$0 – S$20,000: 0%
  - S$20,001 – S$30,000: 2%
  - S$30,001 – S$40,000: 3.5%
  - S$40,001 – S$80,000: 7%
  - S$80,001 – S$120,000: 11.5%
  - S$120,001 – S$160,000: 15%
  - S$160,001 – S$200,000: 18%
  - S$200,001 – S$240,000: 19%
  - S$240,001 – S$280,000: 19.5%
  - S$280,001 – S$320,000: 20%
  - S$320,001 – S$500,000: 22%
  - S$500,001 – S$1,000,000: 23%
  - Above S$1,000,000: 24%
- **Statutory S$80,000 Personal Relief Cap**:
  - Enforces the strict S$80,000 statutory cap across all personal tax reliefs (Earned Income, CPF, SRS, RSTU, NSman, Child, Parent, Donations).
  - Provides a real-time relief headroom gauge.
- **SRS & RSTU Tax Shield Optimization**:
  - Identifies the taxpayer's top marginal tax bracket.
  - Recommends the exact Supplementary Retirement Scheme (SRS) contribution (up to S$15,300 for citizens/PRs) and Retirement Sum Topping-Up (RSTU, up to S$8,000 self + S$8,000 family) to legally minimize income tax liabilities.

### 6. Singapore Savings Bonds (SSB) & MAS T-Bills Discount Ladder
- **Singapore Savings Bonds (SSB)**:
  - 10-year step-up interest rates guaranteed by the Singapore Government.
  - S$200,000 individual ceiling enforcement across all active bond issues.
  - Flexible monthly redemption with fixed S$2 MAS processing fee and zero capital loss.
- **MAS Treasury Bills (T-Bills)**:
  - 6-month and 1-year tenors issued at auction discount to par value (S$100).
  - Annualized cut-off yield calculations and par maturity profit tracking.
  - **CPF Buffer Compliance Guard**: Automates CPF Investment Scheme rules requiring a liquid buffer of S$20,000 in Ordinary Account and S$40,000 in Special Account before deploying funds into T-Bills.

### 7. SRS Tax Shield & Irish UCITS vs US ETF Comparator
- **Supplementary Retirement Scheme (SRS)**:
  - Annual statutory caps: S$15,300 for Singapore Citizens/PRs; S$35,700 for Foreigners.
  - Instant dollar-for-dollar personal tax relief by marginal tax bracket.
  - **10-Year Penalty-Free 50% Concession Strategy**: Demonstrates that spreading withdrawals up to S$40,000/year across the 10-year window yields **100% tax-free retirement cashflow** ($0 IRAS tax payable).
- **Irish UCITS (CSPX / VUAA) vs US-Domiciled ETF (VOO / SPY)**:
  - Quantifies the 15% dividend withholding tax treaty savings (15% vs 30% standard non-resident tax).
  - Eliminates exposure to the catastrophic ~40% US Estate Tax levied on US assets exceeding US$60,000.
  - Simulates compounding tax drag savings over 10, 20, and 30-year investment horizons.

---

## 💻 UI / Component Layout

The user interface lives in [`src/lib/components/SingaporeWealthHub.svelte`](file:///opt/moneta_wealth/src/lib/components/SingaporeWealthHub.svelte) and is accessible via:
1. **Sidebar Shortcut**: 🇸🇬 Singapore Wealth Hub under Wealth Overview.
2. **Top Menu Bar**: Regional $\rightarrow$ 🇸🇬 Singapore Wealth Pack (`Ctrl+Shift+S`).

The hub features a clean 5-tab layout:
- **Tab 1: CPF Accounts & LIFE Simulator**: Visual balance cards for OA, SA, MA, RA, interest income ticker, interactive CPF LIFE annuity calculator, and statutory monthly contribution rate calculator with the 2026 S$8,000 Ordinary Wage ceiling.
- **Tab 2: Housing Accrued & TDSR**: Mortgage restitution calculator, 2.5% accrued interest ledger, BSD/ABSD stamp duty estimator, and MAS TDSR (55%) & MSR (30%) mortgage affordability simulator.
- **Tab 3: IRAS Tax Planner**: Interactive Year of Assessment (YA) selector, gross income items, personal reliefs breakdown, statutory S$80,000 cap headroom meter, and tax savings advisor.
- **Tab 4: SSB & T-Bills Ladder**: Singapore Savings Bonds portfolio with S$200k individual cap gauge, 10-year step-up yield curve, and MAS 6-month / 1-year Treasury Bills discount ladder with CPFIS buffer compliance guard.
- **Tab 5: SRS & Irish UCITS**: SRS annual contribution tracker, 10-year 50% concession penalty-free withdrawal schedule ($40k/yr 0% tax strategy), and Irish UCITS vs US ETF dividend withholding & US Estate Tax comparator.

---

## 🧪 Verification & Testing

The mathematical derivations are guarded by automated assertion test suites:

```bash
# Run CPF and Singapore Housing math assertions
node --experimental-strip-types scripts/verify_cpf_math.ts

# Run IRAS Tax planner and bracket assertions
node --experimental-strip-types scripts/verify_iras_math.ts

# Run Singapore Fixed Income (SSB, T-Bills, UCITS) assertions
node --experimental-strip-types scripts/verify_singapore_fixed_income.ts

# Run SRS Tax Shield, CPF Contribution Rates & MAS Affordability assertions
node --experimental-strip-types scripts/verify_srs_math.ts
```

All 6 CPF assertions, 3 IRAS assertions, 3 Fixed Income assertions, and 4 SRS/MAS assertions pass with 100% precision.
