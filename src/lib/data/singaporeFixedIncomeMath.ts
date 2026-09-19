/**
 * Singapore Fixed Income & UCITS Mathematical Engines
 *
 * Maintenance contract: mirrors Odoo backend logic in
 * `moneta_core/models/singapore_fixed_income.py`
 * (`MonetaSSBBond::_compute_yields`, `MonetaTBill::_compute_tbill_economics`,
 * `MonetaUCITSETFComparator::_compute_comparison`).
 *
 * Invariant: Never drift from Monetary Authority of Singapore (MAS) and SGX statutory calculations.
 */

export interface SSBYieldInputs {
  investmentAmount: number; // Multiples of $500, max $200,000
  stepUpRates: number[]; // Array of 10 annual coupon rates (% p.a.)
}

export interface SSBYieldMetrics {
  average10YrYield: number;
  totalInterestToMaturity: number;
  nextSemiAnnualCoupon: number;
  isValidAmount: boolean;
  validationError?: string;
}

/**
 * Computes Singapore Savings Bonds (SSB) 10-year step-up yield metrics.
 * Mirrors `singapore_fixed_income.py::MonetaSSBBond::_compute_yields`.
 */
export function computeSSBYields(inputs: SSBYieldInputs): SSBYieldMetrics {
  const amt = Math.max(inputs.investmentAmount || 0, 0);

  // Validation
  let isValid = true;
  let validationError: string | undefined;

  if (amt % 500 !== 0) {
    isValid = false;
    validationError = 'SSB investment amount must be in multiples of SGD $500.';
  } else if (amt > 200000) {
    isValid = false;
    validationError = 'Singapore Savings Bonds have an individual cap of SGD $200,000 across all issues.';
  }

  const rates = inputs.stepUpRates && inputs.stepUpRates.length === 10
    ? inputs.stepUpRates
    : [2.80, 2.85, 2.90, 2.95, 3.00, 3.05, 3.10, 3.15, 3.20, 3.30];

  const avgYield = rates.reduce((acc, r) => acc + (r || 0), 0) / 10.0;
  const totInterest = rates.reduce((acc, r) => acc + (amt * ((r || 0) / 100.0)), 0);
  const nextCoupon = amt * ((rates[0] || 0) / 100.0) / 2.0;

  return {
    average10YrYield: Math.round(avgYield * 100) / 100,
    totalInterestToMaturity: Math.round(totInterest * 100) / 100,
    nextSemiAnnualCoupon: Math.round(nextCoupon * 100) / 100,
    isValidAmount: isValid,
    validationError,
  };
}

export type TBillTenure = '6_month' | '1_year';
export type TBillFundingSource = 'cash' | 'cpf_oa' | 'cpf_sa' | 'srs';

export interface TBillInputs {
  faceValue: number; // Par value at maturity
  issuePricePerHundred: number; // Cut-off price per $100 face value (e.g. 98.15)
  tenureType: TBillTenure;
  fundingSource?: TBillFundingSource;
  issueDate?: string; // YYYY-MM-DD
}

export interface TBillMetrics {
  totalInvestmentCost: number;
  netDiscountProfit: number;
  cutOffYieldPA: number;
  maturityDate: string;
  daysToMaturity: number;
  cpfBufferCompliant: boolean;
  cpfBufferNotice?: string;
}

/**
 * Computes MAS Treasury Bill (T-Bill) auction economics and annualized yield.
 * Mirrors `singapore_fixed_income.py::MonetaTBill::_compute_tbill_economics`.
 */
export function computeTBillEconomics(inputs: TBillInputs): TBillMetrics {
  const face = Math.max(inputs.faceValue || 0, 0);
  const priceRatio = Math.max(inputs.issuePricePerHundred || 100.0, 0) / 100.0;
  const cost = face * priceRatio;
  const profit = Math.max(face - cost, 0.0);

  const days = inputs.tenureType === '6_month' ? 182 : 364;
  let yieldPA = 0.0;
  if (cost > 0 && days > 0) {
    yieldPA = (profit / cost) * (365.0 / days) * 100.0;
  }

  // Maturity date calculation
  const issue = inputs.issueDate ? new Date(inputs.issueDate) : new Date();
  const maturity = new Date(issue.getTime() + days * 24 * 60 * 60 * 1000);
  const maturityDateStr = maturity.toISOString().split('T')[0];

  const now = new Date();
  const diffDays = Math.ceil((maturity.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const daysToMaturity = Math.max(diffDays, 0);

  // CPF Buffer compliance checks
  let cpfBufferCompliant = true;
  let cpfBufferNotice: string | undefined;

  if (inputs.fundingSource === 'cpf_oa') {
    cpfBufferNotice = 'CPF OA requires a mandatory minimum balance of SGD $20,000 before surplus can be invested in T-Bills.';
  } else if (inputs.fundingSource === 'cpf_sa') {
    cpfBufferNotice = 'CPF SA requires a mandatory minimum balance of SGD $40,000 before surplus can be invested in T-Bills.';
  }

  return {
    totalInvestmentCost: Math.round(cost * 100) / 100,
    netDiscountProfit: Math.round(profit * 100) / 100,
    cutOffYieldPA: Math.round(yieldPA * 100) / 100,
    maturityDate: maturityDateStr,
    daysToMaturity,
    cpfBufferCompliant,
    cpfBufferNotice,
  };
}

export interface UCITSETFInputs {
  portfolioValue: number;
  dividendYieldPct?: number; // e.g. 1.5%
  expectedGrowthRatePct?: number; // e.g. 8.0%
  investmentHorizonYears?: number; // e.g. 20
  usWithholdingTaxPct?: number; // default 30%
  ucitsWithholdingTaxPct?: number; // default 15%
}

export interface UCITSETFMetrics {
  annualGrossDividend: number;
  usEtfAnnualTaxDrag: number;
  ucitsAnnualTaxDrag: number;
  annualTaxSavingsWithUCITS: number;
  cumulativeCompoundedTaxSavings: number;
  usEstateTaxExposureRisk: number; // 40% on amount exceeding $60k
  ucitsEstateTaxExposureRisk: number; // Always $0
}

/**
 * Computes Irish UCITS ETF (e.g. CSPX/VUAA) vs US-domiciled ETF (VOO/SPY) tax drag and estate tax risk.
 * Mirrors `singapore_fixed_income.py::MonetaUCITSETFComparator::_compute_comparison`.
 */
export function computeUCITSETFComparison(inputs: UCITSETFInputs): UCITSETFMetrics {
  const val = Math.max(inputs.portfolioValue || 0, 0);
  const divYield = Math.max(inputs.dividendYieldPct || 1.5, 0) / 100.0;
  const grossDiv = val * divYield;

  const usWHT = Math.max(inputs.usWithholdingTaxPct ?? 30.0, 0) / 100.0;
  const ucitsWHT = Math.max(inputs.ucitsWithholdingTaxPct ?? 15.0, 0) / 100.0;

  const usDrag = grossDiv * usWHT;
  const ucitsDrag = grossDiv * ucitsWHT;
  const annualSaved = usDrag - ucitsDrag;

  const horizon = Math.max(inputs.investmentHorizonYears || 20, 1);
  const growth = Math.max(inputs.expectedGrowthRatePct ?? 8.0, 0) / 100.0;

  let cumSavings = 0.0;
  for (let y = 0; y < horizon; y++) {
    cumSavings += annualSaved * Math.pow(1.0 + growth, y);
  }

  // US Estate Tax Exposure: Non-resident aliens face up to 40% US Estate Tax on US assets over $60k
  const taxableEstate = Math.max(val - 60000.0, 0.0);
  const usEstateTax = taxableEstate * 0.40;

  return {
    annualGrossDividend: Math.round(grossDiv * 100) / 100,
    usEtfAnnualTaxDrag: Math.round(usDrag * 100) / 100,
    ucitsAnnualTaxDrag: Math.round(ucitsDrag * 100) / 100,
    annualTaxSavingsWithUCITS: Math.round(annualSaved * 100) / 100,
    cumulativeCompoundedTaxSavings: Math.round(cumSavings * 100) / 100,
    usEstateTaxExposureRisk: Math.round(usEstateTax * 100) / 100,
    ucitsEstateTaxExposureRisk: 0.0,
  };
}
