/**
 * Shared IRAS Singapore Personal Income Tax Mathematical Derivations
 *
 * Maintenance contract: mirrors Odoo models in moneta_core:
 *   - models/iras_tax.py (IRAS progressive tax brackets, relief cap & optimization)
 *
 * Adheres to AGENTS.md Rule 7: One Derivation, One Place.
 */

export interface IRASTaxInputs {
  taxYear: number; // e.g. 2025 (YA 2026)
  employmentIncome: number;
  bonusAWS: number;
  businessTradeIncome?: number;
  netRentalIncome?: number;
  otherTaxableIncome?: number;

  // Personal Reliefs
  ageGroup: 'under_55' | '55_to_59' | '60_and_above';
  cpfEmployeeMandatoryRelief: number; // Max $20,400
  rstuSelfTopUp: number; // Max $8,000
  rstuFamilyTopUp: number; // Max $8,000
  srsContribution: number; // Max $15,300 for citizen/PR, $35,700 for foreigner
  nsmanReliefType: 'none' | 'general' | 'active_ict_ippt' | 'key_appointment';
  nsmanParentWifeRelief?: number; // $750
  qualifyingChildrenCount: number; // $4,000 per child
  parentReliefType: 'none' | 'non_staying' | 'staying'; // $5,500 vs $9,000
  courseFeesRelief?: number; // Max $5,500
  lifeInsuranceRelief?: number; // Max $5,000 if CPF < $5k
  donationsToIPCs?: number; // 250% tax deduction
}

export interface IRASTaxResult {
  yearOfAssessment: number;
  totalAssessableIncome: number;
  uncappedTotalReliefs: number;
  cappedTotalReliefs: number;
  isReliefCapApplied: boolean;
  chargeableIncome: number;
  grossTaxPayable: number;
  taxRebateAmount: number;
  netTaxPayable: number;
  effectiveTaxRate: number;
  marginalTaxRate: number;
  optimizationAdvice: {
    rstuPotentialSavings: number;
    srsPotentialSavings: number;
    donationPotentialSavings: number;
  };
}

/**
 * Computes progressive tax for Singapore tax residents based on IRAS tax brackets (YA 2024–2026).
 */
export function computeProgressiveResidentTax(chargeableIncome: number): { tax: number; marginalRate: number } {
  let income = Math.max(chargeableIncome || 0, 0);
  let tax = 0;
  let marginalRate = 0;

  const brackets = [
    { limit: 20000, rate: 0.0 },
    { limit: 10000, rate: 0.02 }, // $20k - $30k
    { limit: 10000, rate: 0.035 }, // $30k - $40k
    { limit: 40000, rate: 0.07 }, // $40k - $80k
    { limit: 40000, rate: 0.115 }, // $80k - $120k
    { limit: 40000, rate: 0.15 }, // $120k - $160k
    { limit: 40000, rate: 0.18 }, // $160k - $200k
    { limit: 40000, rate: 0.19 }, // $200k - $240k
    { limit: 40000, rate: 0.195 }, // $240k - $280k
    { limit: 40000, rate: 0.2 }, // $280k - $320k
    { limit: 180000, rate: 0.22 }, // $320k - $500k
    { limit: 500000, rate: 0.23 }, // $500k - $1,000,000
    { limit: Infinity, rate: 0.24 }, // > $1,000,000
  ];

  for (const b of brackets) {
    if (income <= 0) break;
    const taxableInChunk = Math.min(income, b.limit);
    tax += taxableInChunk * b.rate;
    if (taxableInChunk > 0) {
      marginalRate = b.rate;
    }
    income -= taxableInChunk;
  }

  return {
    tax: Number(tax.toFixed(2)),
    marginalRate: Number((marginalRate * 100).toFixed(1)),
  };
}

/**
 * Computes full Singapore IRAS Personal Income Tax Assessment & Optimization.
 * Mirrors models/iras_tax.py in moneta_core.
 */
export function computeIRASTaxAssessment(inputs: IRASTaxInputs): IRASTaxResult {
  const ya = inputs.taxYear + 1;

  // 1. Total Assessable Income
  const gross =
    Math.max(inputs.employmentIncome || 0, 0) +
    Math.max(inputs.bonusAWS || 0, 0) +
    Math.max(inputs.businessTradeIncome || 0, 0) +
    Math.max(inputs.netRentalIncome || 0, 0) +
    Math.max(inputs.otherTaxableIncome || 0, 0);

  // 2. Personal Reliefs
  // Earned Income Relief (EIR)
  let eir = 1000;
  if (inputs.ageGroup === '55_to_59') eir = 6000;
  else if (inputs.ageGroup === '60_and_above') eir = 8000;

  // CPF Mandatory Relief (Cap: $20,400)
  const cpfRelief = Math.min(Math.max(inputs.cpfEmployeeMandatoryRelief || 0, 0), 20400);

  // RSTU Cash Top-Up (Max $8k self + $8k family)
  const rstuSelf = Math.min(Math.max(inputs.rstuSelfTopUp || 0, 0), 8000);
  const rstuFamily = Math.min(Math.max(inputs.rstuFamilyTopUp || 0, 0), 8000);

  // SRS (Max $15,300)
  const srsRelief = Math.min(Math.max(inputs.srsContribution || 0, 0), 15300);

  // NSman Relief
  let nsman = 0;
  if (inputs.nsmanReliefType === 'general') nsman = 1500;
  else if (inputs.nsmanReliefType === 'active_ict_ippt') nsman = 3000;
  else if (inputs.nsmanReliefType === 'key_appointment') nsman = 3500;
  nsman += Math.max(inputs.nsmanParentWifeRelief || 0, 0);

  // Child Relief ($4,000 per qualifying child)
  const childRelief = Math.max(inputs.qualifyingChildrenCount || 0, 0) * 4000;

  // Parent Relief
  let parentRelief = 0;
  if (inputs.parentReliefType === 'non_staying') parentRelief = 5500;
  else if (inputs.parentReliefType === 'staying') parentRelief = 9000;

  const courseFees = Math.min(Math.max(inputs.courseFeesRelief || 0, 0), 5500);
  const lifeInsurance = Math.min(Math.max(inputs.lifeInsuranceRelief || 0, 0), 5000);

  // 250% Donation Deduction (Deducted before tax calculation)
  const donationDeduction = Math.max(inputs.donationsToIPCs || 0, 0) * 2.5;

  const uncappedReliefs =
    eir + cpfRelief + rstuSelf + rstuFamily + srsRelief + nsman + childRelief + parentRelief + courseFees + lifeInsurance;

  // Enforce Singapore statutory $80,000 Personal Relief Cap
  const cappedReliefs = Math.min(uncappedReliefs, 80000);
  const isCapApplied = uncappedReliefs > 80000;

  // 3. Chargeable Income
  const chargeableIncome = Math.max(gross - cappedReliefs - donationDeduction, 0);

  // 4. Gross Tax
  const { tax: grossTax, marginalRate } = computeProgressiveResidentTax(chargeableIncome);

  // 5. Personal Income Tax Rebate (e.g. 50% capped at $200 for YA 2024)
  const rebate = Math.min(grossTax * 0.5, 200);
  const netTax = Math.max(grossTax - rebate, 0);

  const effectiveTaxRate = gross > 0 ? (netTax / gross) * 100 : 0;

  // Optimization potential: calculate tax savings at current marginal tax rate
  const marginalRatio = marginalRate / 100.0;
  const remainingReliefCap = Math.max(80000 - uncappedReliefs, 0);

  const rstuRoom = Math.min(8000 - rstuSelf, remainingReliefCap);
  const srsRoom = Math.min(15300 - srsRelief, remainingReliefCap);

  return {
    yearOfAssessment: ya,
    totalAssessableIncome: Number(gross.toFixed(2)),
    uncappedTotalReliefs: Number(uncappedReliefs.toFixed(2)),
    cappedTotalReliefs: Number(cappedReliefs.toFixed(2)),
    isReliefCapApplied: isCapApplied,
    chargeableIncome: Number(chargeableIncome.toFixed(2)),
    grossTaxPayable: Number(grossTax.toFixed(2)),
    taxRebateAmount: Number(rebate.toFixed(2)),
    netTaxPayable: Number(netTax.toFixed(2)),
    effectiveTaxRate: Number(effectiveTaxRate.toFixed(2)),
    marginalTaxRate: marginalRate,
    optimizationAdvice: {
      rstuPotentialSavings: Number((rstuRoom * marginalRatio).toFixed(2)),
      srsPotentialSavings: Number((srsRoom * marginalRatio).toFixed(2)),
      donationPotentialSavings: Number((1000 * 2.5 * marginalRatio).toFixed(2)), // $1k donation saves $2.5k * marginal
    },
  };
}

export interface SimpleSingaporeTaxParams {
  employmentIncome: number;
  tradeIncome?: number;
  rentalIncome?: number;
  otherIncome?: number;
  reliefs?: {
    cpfEmployee?: number;
    earnedIncome?: number;
    srs?: number;
    rstuSelf?: number;
    rstuFamily?: number;
    nsman?: number;
    child?: number;
    parent?: number;
    donations250Pct?: number;
  };
}

export function computeSingaporeTax(params: SimpleSingaporeTaxParams) {
  const eir = params.reliefs?.earnedIncome || 0;
  const ageGroup: 'under_55' | '55_to_59' | '60_and_above' =
    eir >= 8000 ? '60_and_above' : eir >= 6000 ? '55_to_59' : 'under_55';

  const assessment = computeIRASTaxAssessment({
    taxYear: 2024,
    employmentIncome: params.employmentIncome || 0,
    bonusAWS: 0,
    businessTradeIncome: params.tradeIncome || 0,
    netRentalIncome: params.rentalIncome || 0,
    otherTaxableIncome: params.otherIncome || 0,
    ageGroup,
    cpfEmployeeMandatoryRelief: params.reliefs?.cpfEmployee || 0,
    rstuSelfTopUp: params.reliefs?.rstuSelf || 0,
    rstuFamilyTopUp: params.reliefs?.rstuFamily || 0,
    srsContribution: params.reliefs?.srs || 0,
    nsmanReliefType: (params.reliefs?.nsman || 0) > 0 ? 'general' : 'none',
    qualifyingChildrenCount: Math.round((params.reliefs?.child || 0) / 4000),
    parentReliefType: (params.reliefs?.parent || 0) >= 9000 ? 'staying' : (params.reliefs?.parent || 0) > 0 ? 'non_staying' : 'none',
    donationsToIPCs: params.reliefs?.donations250Pct || 0,
  });

  return {
    totalIncome: assessment.totalAssessableIncome,
    totalReliefs: assessment.cappedTotalReliefs,
    uncappedReliefs: assessment.uncappedTotalReliefs,
    reliefsCapped: assessment.isReliefCapApplied,
    chargeableIncome: assessment.chargeableIncome,
    grossTaxPayable: assessment.grossTaxPayable,
    netTaxPayable: assessment.netTaxPayable,
    effectiveTaxRatePct: assessment.effectiveTaxRate,
    marginalTaxRatePct: assessment.marginalTaxRate,
    srsPotentialTaxSavings: assessment.optimizationAdvice.srsPotentialSavings,
    rstuPotentialTaxSavings: assessment.optimizationAdvice.rstuPotentialSavings,
  };
}
