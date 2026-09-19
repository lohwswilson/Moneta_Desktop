import assert from 'node:assert/strict';
import {
  computeSRSMetrics,
  computeSRSWithdrawalPlan,
} from '../src/lib/data/srsMath.ts';
import {
  computeCPFContributionRates,
  computeMASTDSRAffordability,
} from '../src/lib/data/cpfMath.ts';

console.log('── Running verify_srs_math.ts assertions ──');

// 1. SRS Contribution Caps & Tax Relief
const srsCitizen = computeSRSMetrics({
  residencyStatus: 'citizen_pr',
  totalContributedYTD: 10000,
  marginalTaxRatePct: 15.0,
});
assert.equal(srsCitizen.annualCap, 15300, 'Citizen/PR SRS cap is S$15,300');
assert.equal(srsCitizen.remainingAllowance, 5300, 'Remaining allowance is S$5,300');
assert.equal(srsCitizen.estimatedTaxSavings, 1500, 'Tax saved at 15% bracket is S$1,500');
assert.equal(srsCitizen.isCapReached, false, 'Cap not yet reached');

const srsForeigner = computeSRSMetrics({
  residencyStatus: 'foreigner',
  totalContributedYTD: 35700,
  marginalTaxRatePct: 20.0,
});
assert.equal(srsForeigner.annualCap, 35700, 'Foreigner SRS cap is S$35,700');
assert.equal(srsForeigner.remainingAllowance, 0, 'No allowance remaining at cap');
assert.equal(srsForeigner.isCapReached, true, 'Cap reached');
console.log('  ✅ SRS Contribution caps & tax relief calculation passed');

// 2. 10-Year Penalty-Free SRS Withdrawal Window (50% concession)
const srsWithdrawal = computeSRSWithdrawalPlan({
  currentBalance: 400000,
  spreadYears: 10,
});
assert.equal(srsWithdrawal.annualWithdrawalTarget, 40000, 'Annual withdrawal target is S$40,000');
assert.equal(srsWithdrawal.annualTaxablePortion, 20000, '50% taxable portion is S$20,000');
assert.equal(srsWithdrawal.isTaxFreeStrategy, true, 'S$20,000 taxable income is 100% tax-free under IRAS progressive rates');
assert.equal(srsWithdrawal.estimatedAnnualTax, 0, 'Estimated annual tax is S$0');
console.log('  ✅ 10-Year SRS penalty-free 50% concession withdrawal passed');

// 3. CPF Statutory Contribution Rates & Age Tiers
const cpfYoung = computeCPFContributionRates(30, 6000, 8000);
assert.equal(cpfYoung.employeeRatePct, 20, 'Employee rate <= 55 is 20%');
assert.equal(cpfYoung.employerRatePct, 17, 'Employer rate <= 55 is 17%');
assert.equal(cpfYoung.totalRatePct, 37, 'Total rate <= 55 is 37%');
assert.equal(cpfYoung.totalContribution, 2220, 'Total contribution on S$6,000 salary is S$2,220');

const cpfSenior = computeCPFContributionRates(58, 6000, 8000);
assert.equal(cpfSenior.employeeRatePct, 17, 'Employee rate 55-60 is 17%');
assert.equal(cpfSenior.employerRatePct, 15, 'Employer rate 55-60 is 15%');
assert.equal(cpfSenior.totalRatePct, 32, 'Total rate 55-60 is 32%');
console.log('  ✅ CPF Contribution rates by age tier passed');

// 4. MAS TDSR & MSR Affordability Checks
const hdbCheck = computeMASTDSRAffordability({
  grossMonthlyIncome: 10000,
  monthlyDebtCommitments: 1500, // Car loan
  proposedLoanPayment: 2500, // HDB mortgage
  propertyType: 'hdb',
});
// Total debt = 1500 + 2500 = 4000 -> TDSR = 40% (<= 55% compliant)
// MSR = 2500 / 10000 = 25% (<= 30% compliant)
assert.equal(hdbCheck.tdsrPct, 40, 'TDSR is 40%');
assert.equal(hdbCheck.isTDSRCompliant, true, 'TDSR is compliant');
assert.equal(hdbCheck.msrPct, 25, 'MSR is 25%');
assert.equal(hdbCheck.isMSRCompliant, true, 'MSR is compliant');
console.log('  ✅ MAS TDSR (55%) & MSR (30%) checks passed');

console.log('All SRS, CPF Rates & MAS Affordability assertions passed! (4/4)');
