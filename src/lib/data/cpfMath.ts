/**
 * Shared CPF & Singapore Housing Mathematical Derivations
 *
 * Maintenance contract: mirrors Odoo models in moneta_core:
 *   - models/cpf.py (CPF interest & MonetaCPFLifeSimulator)
 *   - models/singapore_property.py (CPF accrued interest, BSD/ABSD, TDSR/MSR)
 *
 * Adheres to AGENTS.md Rule 7: One Derivation, One Place.
 */

export interface CPFAccountBalances {
  oa: number; // Ordinary Account (2.50% p.a.)
  sa: number; // Special Account (4.00% p.a.)
  ma: number; // MediSave Account (4.00% p.a.)
  ra: number; // Retirement Account (4.00% p.a., age 55+)
  age?: number;
}

export interface CPFInterestBreakdown {
  oaInterest: number;
  saInterest: number;
  maInterest: number;
  raInterest: number;
  extraInterest: number; // Extra 1% on first $60k combined (max $20k from OA)
  extraInterestTotal: number;
  totalAnnualInterest: number;
}

/**
 * Computes annual CPF interest with the Singapore extra 1% interest rule.
 * - Base Rates: OA = 2.5%, SA/MA/RA = 4.0%
 * - Extra 1%: Paid on first $60,000 of combined balances (capped at $20,000 from OA).
 * - Extra 1% (Age 55+): Additional 1% on first $30,000 of retirement balances.
 */
export function computeCPFInterest(balances: CPFAccountBalances): CPFInterestBreakdown {
  const oaBase = Math.max(balances.oa, 0) * 0.025;
  const saBase = Math.max(balances.sa, 0) * 0.04;
  const maBase = Math.max(balances.ma, 0) * 0.04;
  const raBase = Math.max(balances.ra, 0) * 0.04;

  // Extra 1% interest calculation on first $60,000 combined (max $20,000 from OA)
  // Non-OA balances (SA, RA, MA) take priority for the $60k pool
  const nonOaTotal = Math.max(balances.sa, 0) + Math.max(balances.ma, 0) + Math.max(balances.ra, 0);
  const nonOaEligible = Math.min(nonOaTotal, 60000);
  const remainingPool = Math.max(60000 - nonOaEligible, 0);
  const oaEligible = Math.min(Math.max(balances.oa, 0), 20000, remainingPool);

  const extraInterest = (nonOaEligible + oaEligible) * 0.01;
  const ageBonus = (balances.age && balances.age >= 55) ? Math.min(nonOaTotal, 30000) * 0.01 : 0;
  const totalExtra = extraInterest + ageBonus;
  const totalAnnual = oaBase + saBase + maBase + raBase + totalExtra;

  return {
    oaInterest: Number(oaBase.toFixed(2)),
    saInterest: Number(saBase.toFixed(2)),
    maInterest: Number(maBase.toFixed(2)),
    raInterest: Number(raBase.toFixed(2)),
    extraInterest: Number(extraInterest.toFixed(2)),
    extraInterestTotal: Number(totalExtra.toFixed(2)),
    totalAnnualInterest: Number(totalAnnual.toFixed(2)),
  };
}

export type CPFLifePlan = 'standard' | 'escalating' | 'basic';

export interface CPFLifeSimulationParams {
  raBalanceAt55?: number;
  raBalance?: number;
  gender?: 'male' | 'female';
  payoutStartAge?: number;
  startAge?: number;
  planType?: CPFLifePlan;
  plan?: CPFLifePlan;
  brsAmount?: number;
  frsAmount?: number;
  ersAmount?: number;
}

export interface CPFLifeSimulationResult {
  raBalance: number;
  retirementTier: 'below_brs' | 'brs' | 'frs' | 'ers' | 'above_ers';
  monthlyPayoutEstimated: number;
  monthlyPayoutMin: number;
  monthlyPayoutMax: number;
  annualPayoutEstimated: number;
  payoutAt80: number;
  payoutAt90: number;
  cumulativePayout85: number;
  cumulativePayout95: number;
  estimatedBequest75: number;
  estimatedBequest85: number;
  bequest75: number;
  bequest85: number;
}

/**
 * Computes CPF LIFE retirement payouts and bequests mirroring MonetaCPFLifeSimulator in cpf.py.
 */
export function computeCPFLifeSimulation(params: CPFLifeSimulationParams): CPFLifeSimulationResult {
  const ra = Math.max(params.raBalanceAt55 ?? params.raBalance ?? 0, 0);
  const startAge = Math.min(Math.max(params.payoutStartAge ?? params.startAge ?? 65, 65), 70);
  const deferralYears = startAge - 65;
  const deferralMultiplier = 1.0 + deferralYears * 0.07; // ~7% payout increase per year of deferral
  const plan = params.planType ?? params.plan ?? 'standard';

  const brs = params.brsAmount ?? 106500;
  const frs = params.frsAmount ?? 213000;
  const ers = params.ersAmount ?? 426000;

  let retirementTier: 'below_brs' | 'brs' | 'frs' | 'ers' | 'above_ers' = 'below_brs';
  if (ra < brs) retirementTier = 'below_brs';
  else if (ra < frs) retirementTier = 'brs';
  else if (ra < ers) retirementTier = 'frs';
  else if (ra === ers) retirementTier = 'ers';
  else retirementTier = 'above_ers';

  // Base factor: ~$1,650/mo per $213,000 FRS on Standard Plan at age 65
  const baseRatio = 1650.0 / 213000.0;

  let monthly = 0;
  let payoutAt80 = 0;
  let payoutAt90 = 0;
  let cum85 = 0;
  let cum95 = 0;
  let bequest75 = 0;
  let bequest85 = 0;

  const yearsTo85 = Math.max(85 - startAge, 0);
  const yearsTo95 = Math.max(95 - startAge, 0);

  if (plan === 'standard') {
    monthly = ra * baseRatio * deferralMultiplier;
    payoutAt80 = monthly;
    payoutAt90 = monthly;
    cum85 = monthly * 12.0 * yearsTo85;
    cum95 = monthly * 12.0 * yearsTo95;
    bequest75 = Math.max(ra - monthly * 12.0 * Math.max(75 - startAge, 0), 0);
    bequest85 = Math.max(ra - monthly * 12.0 * yearsTo85, 0);
  } else if (plan === 'escalating') {
    // Starting payout is ~20% lower, but increases 2% every year
    monthly = ra * baseRatio * 0.8 * deferralMultiplier;
    payoutAt80 = monthly * Math.pow(1.02, Math.max(80 - startAge, 0));
    payoutAt90 = monthly * Math.pow(1.02, Math.max(90 - startAge, 0));

    for (let y = 0; y < yearsTo85; y++) {
      cum85 += monthly * 12.0 * Math.pow(1.02, y);
    }
    for (let y = 0; y < yearsTo95; y++) {
      cum95 += monthly * 12.0 * Math.pow(1.02, y);
    }

    let paid75 = 0;
    for (let y = 0; y < Math.max(75 - startAge, 0); y++) {
      paid75 += monthly * 12.0 * Math.pow(1.02, y);
    }
    bequest75 = Math.max(ra - paid75, 0);
    bequest85 = Math.max(ra - cum85, 0);
  } else {
    // Basic plan: ~10% lower than standard, higher bequest
    monthly = ra * baseRatio * 0.9 * deferralMultiplier;
    payoutAt80 = monthly;
    payoutAt90 = monthly * 0.85;
    cum85 = monthly * 12.0 * yearsTo85;
    cum95 = monthly * 12.0 * yearsTo95;
    bequest75 = Math.max(ra * 1.15 - monthly * 12.0 * Math.max(75 - startAge, 0), 0);
    bequest85 = Math.max(ra * 1.1 - monthly * 12.0 * yearsTo85, 0);
  }

  return {
    raBalance: Number(ra.toFixed(2)),
    retirementTier,
    monthlyPayoutEstimated: Number(monthly.toFixed(2)),
    monthlyPayoutMin: Number((monthly * 0.95).toFixed(2)),
    monthlyPayoutMax: Number((monthly * 1.05).toFixed(2)),
    annualPayoutEstimated: Number((monthly * 12.0).toFixed(2)),
    payoutAt80: Number(payoutAt80.toFixed(2)),
    payoutAt90: Number(payoutAt90.toFixed(2)),
    cumulativePayout85: Number(cum85.toFixed(2)),
    cumulativePayout95: Number(cum95.toFixed(2)),
    estimatedBequest75: Number(bequest75.toFixed(2)),
    estimatedBequest85: Number(bequest85.toFixed(2)),
    bequest75: Number(bequest75.toFixed(2)),
    bequest85: Number(bequest85.toFixed(2)),
  };
}

export interface CPFHousingRefundParams {
  downpaymentOA: number;
  monthlyOADeduction?: number;
  monthlyOA?: number;
  housingGrants: number;
  holdingYears?: number;
  yearsHeld?: number;
  salePrice?: number;
  marketValuation?: number;
  outstandingMortgage?: number;
  outstandingLoan?: number;
  sellingCosts?: number; // e.g. 2% agent fee + legal
}

export interface CPFHousingRefundResult {
  principalWithdrawn: number;
  accruedInterest: number;
  totalAccruedInterest: number;
  totalRefundDue: number;
  totalRefundRequired: number;
  grossProceeds: number;
  netCashProceeds: number;
}

/**
 * Computes CPF Housing Accrued Interest (2.5% compounded) and Net Sale Cash Proceeds.
 * Mirrors models/singapore_property.py in moneta_core.
 */
export function computeCPFHousingRefund(params: CPFHousingRefundParams): CPFHousingRefundResult {
  const years = Math.max(params.holdingYears ?? params.yearsHeld ?? 0, 0);
  const downpayment = Math.max(params.downpaymentOA || 0, 0);
  const grants = Math.max(params.housingGrants || 0, 0);
  const monthly = Math.max(
    params.monthlyOADeduction ?? (params.monthlyOA ? params.monthlyOA / Math.max(years * 12, 1) : 0),
    0
  );
  const lumpSumPrincipal = downpayment + grants;
  const monthlyPrincipalTotal = monthly * 12.0 * years;
  const principalWithdrawn = lumpSumPrincipal + monthlyPrincipalTotal;

  // 2.5% compounded annual rate on lump-sum portion
  const lumpSumFutureValue = lumpSumPrincipal * Math.pow(1 + 0.025, years);
  const lumpSumInterest = lumpSumFutureValue - lumpSumPrincipal;

  // Monthly annuity compound interest at monthly rate r = 0.025 / 12
  const r = 0.025 / 12.0;
  const n = years * 12.0;
  let monthlyInterest = 0;
  if (r > 0 && n > 0 && monthly > 0) {
    const annuityFV = monthly * ((Math.pow(1 + r, n) - 1) / r);
    monthlyInterest = Math.max(annuityFV - monthlyPrincipalTotal, 0);
  }

  const accruedInterest = lumpSumInterest + monthlyInterest;
  const totalRefundDue = principalWithdrawn + accruedInterest;

  const mortgage = Math.max(params.outstandingMortgage ?? params.outstandingLoan ?? 0, 0);
  const costs = Math.max(params.sellingCosts || 0, 0);
  const salePrice = Math.max(params.salePrice ?? params.marketValuation ?? 0, 0);

  // Net Cash = Sale Price - Mortgage - Total CPF Refund - Selling Costs
  const netCash = Math.max(salePrice - mortgage - totalRefundDue - costs, 0);

  return {
    principalWithdrawn: Number(principalWithdrawn.toFixed(2)),
    accruedInterest: Number(accruedInterest.toFixed(2)),
    totalAccruedInterest: Number(accruedInterest.toFixed(2)),
    totalRefundDue: Number(totalRefundDue.toFixed(2)),
    totalRefundRequired: Number(totalRefundDue.toFixed(2)),
    grossProceeds: Number((salePrice - mortgage).toFixed(2)),
    netCashProceeds: Number(netCash.toFixed(2)),
  };
}

export type SingaporeBuyerProfile =
  | 'citizen_1'
  | 'citizen_1st'
  | 'citizen_2'
  | 'citizen_2nd'
  | 'citizen_3_plus'
  | 'citizen_3rd'
  | 'pr_1'
  | 'pr_1st'
  | 'pr_2_plus'
  | 'pr_2nd'
  | 'pr_3rd'
  | 'foreigner'
  | 'entity';

/**
 * Computes Singapore Buyer's Stamp Duty (BSD) and Additional Buyer's Stamp Duty (ABSD).
 * Mirrors models/singapore_property.py in moneta_core.
 */
export function computeSingaporeStampDuty(
  propertyPrice: number,
  profile: SingaporeBuyerProfile
): {
  bsd: number;
  absd: number;
  totalStampDuty: number;
  effectiveRatePct: number;
  absdRatePct: number;
} {
  const price = Math.max(propertyPrice || 0, 0);

  // Tiered BSD:
  // 1% on first $180k
  // 2% on next $180k ($180k - $360k)
  // 3% on next $640k ($360k - $1M)
  // 4% on next $500k ($1M - $1.5M)
  // 5% on next $1.5M ($1.5M - $3.0M)
  // 6% on excess over $3.0M
  let bsd = 0;
  if (price > 3000000) {
    bsd = 1800 + 3600 + 19200 + 20000 + 75000 + (price - 3000000) * 0.06;
  } else if (price > 1500000) {
    bsd = 1800 + 3600 + 19200 + 20000 + (price - 1500000) * 0.05;
  } else if (price > 1000000) {
    bsd = 1800 + 3600 + 19200 + (price - 1000000) * 0.04;
  } else if (price > 360000) {
    bsd = 1800 + 3600 + (price - 360000) * 0.03;
  } else if (price > 180000) {
    bsd = 1800 + (price - 180000) * 0.02;
  } else {
    bsd = price * 0.01;
  }

  // ABSD Rates:
  let absdRate = 0;
  if (profile === 'citizen_1' || profile === 'citizen_1st') {
    absdRate = 0.0;
  } else if (profile === 'citizen_2' || profile === 'citizen_2nd') {
    absdRate = 0.2;
  } else if (profile === 'citizen_3_plus' || profile === 'citizen_3rd') {
    absdRate = 0.3;
  } else if (profile === 'pr_1' || profile === 'pr_1st') {
    absdRate = 0.05;
  } else if (profile === 'pr_2_plus' || profile === 'pr_2nd') {
    absdRate = 0.3;
  } else if (profile === 'pr_3rd') {
    absdRate = 0.35;
  } else if (profile === 'foreigner') {
    absdRate = 0.6;
  } else if (profile === 'entity') {
    absdRate = 0.65;
  }

  const absd = price * absdRate;
  const totalStampDuty = bsd + absd;
  const effectiveRatePct = price > 0 ? (totalStampDuty / price) * 100 : 0;

  return {
    bsd: Number(bsd.toFixed(2)),
    absd: Number(absd.toFixed(2)),
    totalStampDuty: Number(totalStampDuty.toFixed(2)),
    effectiveRatePct: Number(effectiveRatePct.toFixed(2)),
    absdRatePct: Number((absdRate * 100).toFixed(1)),
  };
}

export interface CPFContributionRatesResult {
  employeeRatePct: number;
  employerRatePct: number;
  totalRatePct: number;
  subjectWage: number;
  employeeContribution: number;
  employerContribution: number;
  totalContribution: number;
  oaAllocation: number;
  saAllocation: number;
  maAllocation: number;
}

/**
 * Calculates statutory Singapore CPF monthly contribution rates and account allocation based on member age.
 * Mirrors `moneta_core/models/cpf.py`.
 */
export function computeCPFContributionRates(
  age: number,
  monthlySalary: number,
  owCeiling: number = 8000 // 2026 Ordinary Wage (OW) ceiling
): CPFContributionRatesResult {
  const wage = Math.max(monthlySalary || 0, 0);
  const subjectWage = Math.min(wage, owCeiling);

  let empRate = 0.20;
  let empyrRate = 0.17;
  let oaPct = 0.23;
  let saPct = 0.06;
  let maPct = 0.08;

  if (age > 70) {
    empRate = 0.05;
    empyrRate = 0.075;
    oaPct = 0.01;
    saPct = 0.01;
    maPct = 0.105;
  } else if (age > 65) {
    empRate = 0.075;
    empyrRate = 0.09;
    oaPct = 0.01;
    saPct = 0.05;
    maPct = 0.105;
  } else if (age > 60) {
    empRate = 0.115;
    empyrRate = 0.115;
    oaPct = 0.035;
    saPct = 0.09;
    maPct = 0.105;
  } else if (age > 55) {
    empRate = 0.17;
    empyrRate = 0.15;
    oaPct = 0.12;
    saPct = 0.095;
    maPct = 0.105;
  }

  const employeeContribution = Math.round(subjectWage * empRate);
  const employerContribution = Math.round(subjectWage * empyrRate);
  const totalContribution = employeeContribution + employerContribution;

  const oaAllocation = Math.round(subjectWage * oaPct);
  const saAllocation = Math.round(subjectWage * saPct);
  const maAllocation = totalContribution - (oaAllocation + saAllocation);

  return {
    employeeRatePct: Number((empRate * 100).toFixed(1)),
    employerRatePct: Number((empyrRate * 100).toFixed(1)),
    totalRatePct: Number(((empRate + empyrRate) * 100).toFixed(1)),
    subjectWage,
    employeeContribution,
    employerContribution,
    totalContribution,
    oaAllocation,
    saAllocation,
    maAllocation,
  };
}

export interface MASTDSRInputs {
  grossMonthlyIncome: number;
  monthlyDebtCommitments: number; // Car loan, personal loans, credit card min
  proposedLoanPayment: number;
  propertyType: 'private' | 'hdb' | 'ec';
}

export interface MASTDSRResult {
  tdsrPct: number; // Max 55%
  isTDSRCompliant: boolean;
  msrPct: number; // Max 30% (applies to HDB / EC)
  isMSRCompliant: boolean;
  maxAffordableLoanPayment: number;
  notes: string[];
}

/**
 * Computes MAS Total Debt Servicing Ratio (TDSR <= 55%) and Mortgage Servicing Ratio (MSR <= 30%).
 * Mirrors `moneta_core/models/singapore_property.py`.
 */
export function computeMASTDSRAffordability(inputs: MASTDSRInputs): MASTDSRResult {
  const income = Math.max(inputs.grossMonthlyIncome || 0, 0);
  const otherDebt = Math.max(inputs.monthlyDebtCommitments || 0, 0);
  const proposed = Math.max(inputs.proposedLoanPayment || 0, 0);
  const totalDebt = otherDebt + proposed;

  const tdsrPct = income > 0 ? (totalDebt / income) * 100 : 0;
  const isTDSRCompliant = tdsrPct <= 55.0;

  const msrPct = income > 0 ? (proposed / income) * 100 : 0;
  const isHdbOrEc = inputs.propertyType === 'hdb' || inputs.propertyType === 'ec';
  const isMSRCompliant = !isHdbOrEc || msrPct <= 30.0;

  // Maximum loan payment allowed
  const maxUnderTDSR = Math.max(income * 0.55 - otherDebt, 0);
  const maxUnderMSR = isHdbOrEc ? income * 0.30 : Infinity;
  const maxAffordableLoanPayment = Math.min(maxUnderTDSR, maxUnderMSR);

  const notes: string[] = [];
  if (!isTDSRCompliant) {
    notes.push(`⚠️ TDSR of ${tdsrPct.toFixed(1)}% exceeds the MAS 55.0% statutory threshold by ${(tdsrPct - 55.0).toFixed(1)}%.`);
  } else {
    notes.push(`✅ TDSR of ${tdsrPct.toFixed(1)}% is within the MAS 55.0% statutory cap.`);
  }

  if (isHdbOrEc) {
    if (!isMSRCompliant) {
      notes.push(`⚠️ MSR of ${msrPct.toFixed(1)}% exceeds the MAS / HDB 30.0% threshold by ${(msrPct - 30.0).toFixed(1)}%.`);
    } else {
      notes.push(`✅ MSR of ${msrPct.toFixed(1)}% is compliant with the 30.0% HDB / EC cap.`);
    }
  }

  return {
    tdsrPct: Number(tdsrPct.toFixed(1)),
    isTDSRCompliant,
    msrPct: Number(msrPct.toFixed(1)),
    isMSRCompliant,
    maxAffordableLoanPayment: Math.round(maxAffordableLoanPayment),
    notes,
  };
}

