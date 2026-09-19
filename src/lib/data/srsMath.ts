/**
 * Singapore Supplementary Retirement Scheme (SRS) Mathematical Engines
 *
 * Maintenance contract: mirrors Odoo backend logic in
 * `moneta_core/models/srs.py` (`_compute_srs_metrics`, `_compute_withdrawal_plan`).
 *
 * Invariant: Never drift from IRAS SRS statutory contribution caps and 50% concession rules.
 */

export type SRSRestatatus = 'citizen_pr' | 'foreigner';

export interface SRSMetricsInputs {
  residencyStatus: SRSRestatatus;
  totalContributedYTD: number;
  marginalTaxRatePct?: number; // e.g. 15.0%
}

export interface SRSMetrics {
  annualCap: number;
  totalContributedYTD: number;
  remainingAllowance: number;
  estimatedTaxSavings: number;
  isCapReached: boolean;
}

/**
 * Computes SRS annual contribution cap, remaining allowance, and tax savings.
 * Mirrors `srs.py::_compute_srs_metrics`.
 */
export function computeSRSMetrics(inputs: SRSMetricsInputs): SRSMetrics {
  const cap = inputs.residencyStatus === 'citizen_pr' ? 15300.0 : 35700.0;
  const contrib = Math.max(inputs.totalContributedYTD || 0, 0);
  const remaining = Math.max(cap - contrib, 0.0);
  const rate = Math.max(inputs.marginalTaxRatePct || 0, 0) / 100.0;
  const taxSavings = contrib * rate;

  return {
    annualCap: cap,
    totalContributedYTD: Math.round(contrib * 100) / 100,
    remainingAllowance: Math.round(remaining * 100) / 100,
    estimatedTaxSavings: Math.round(taxSavings * 100) / 100,
    isCapReached: contrib >= cap,
  };
}

export interface SRSWithdrawalPlanInputs {
  currentBalance: number;
  spreadYears?: number; // Statutory default: 10 years
}

export interface SRSWithdrawalPlan {
  currentBalance: number;
  spreadYears: number;
  annualWithdrawalTarget: number;
  monthlyWithdrawalTarget: number;
  annualTaxablePortion: number; // 50% statutory concession
  isTaxFreeStrategy: boolean; // true if taxable portion <= $20,000 (0% IRAS tax)
  estimatedAnnualTax: number;
}

/**
 * Computes the 10-Year Penalty-Free SRS Withdrawal Schedule and tax concession.
 * Mirrors `srs.py::_compute_withdrawal_plan`.
 */
export function computeSRSWithdrawalPlan(inputs: SRSWithdrawalPlanInputs): SRSWithdrawalPlan {
  const bal = Math.max(inputs.currentBalance || 0, 0);
  const years = Math.max(inputs.spreadYears || 10, 1);

  const annualTarget = bal / years;
  const monthlyTarget = annualTarget / 12.0;
  const taxablePortion = annualTarget * 0.50; // 50% concession rule under Singapore Income Tax Act

  // In Singapore, first S$20,000 of personal chargeable income is taxed at 0%
  const isTaxFree = taxablePortion <= 20000.0;

  // Approximate tax on excess if > $20k:
  // $20,001 - $30,000 @ 2%
  // $30,001 - $40,000 @ 3.5%
  let estTax = 0;
  if (taxablePortion > 20000.0) {
    const excess = taxablePortion - 20000.0;
    if (excess <= 10000.0) {
      estTax = excess * 0.02;
    } else {
      estTax = 10000.0 * 0.02 + (excess - 10000.0) * 0.035;
    }
  }

  return {
    currentBalance: Math.round(bal * 100) / 100,
    spreadYears: years,
    annualWithdrawalTarget: Math.round(annualTarget * 100) / 100,
    monthlyWithdrawalTarget: Math.round(monthlyTarget * 100) / 100,
    annualTaxablePortion: Math.round(taxablePortion * 100) / 100,
    isTaxFreeStrategy: isTaxFree,
    estimatedAnnualTax: Math.round(estTax * 100) / 100,
  };
}
