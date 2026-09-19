import assert from 'node:assert/strict';
import {
  computeSSBYields,
  computeTBillEconomics,
  computeUCITSETFComparison,
} from '../src/lib/data/singaporeFixedIncomeMath.ts';

console.log('── Running verify_singapore_fixed_income.ts assertions ──');

// 1. Singapore Savings Bonds (SSB) 10-Year Step-Up
const ssb = computeSSBYields({
  investmentAmount: 10000,
  stepUpRates: [2.80, 2.85, 2.90, 2.95, 3.00, 3.05, 3.10, 3.15, 3.20, 3.30],
});

assert.equal(ssb.average10YrYield, 3.03, '10-year average yield should be 3.03%');
assert.equal(ssb.totalInterestToMaturity, 3030, 'Total interest on $10k over 10 years should be $3,030');
assert.equal(ssb.nextSemiAnnualCoupon, 140, 'First semi-annual coupon should be $140 ($10k * 2.8% / 2)');
assert.equal(ssb.isValidAmount, true, '$10k is a multiple of $500 and under $200k cap');

const invalidSSB = computeSSBYields({
  investmentAmount: 250000, // Exceeds $200k cap
  stepUpRates: [3.0, 3.0, 3.0, 3.0, 3.0, 3.0, 3.0, 3.0, 3.0, 3.0],
});
assert.equal(invalidSSB.isValidAmount, false, 'Amounts > $200k should fail validation');
console.log('  ✅ SSB 10-Year Step-Up yields and $200k cap validation passed');

// 2. MAS Treasury Bills (T-Bills)
const tbill6mo = computeTBillEconomics({
  faceValue: 10000,
  issuePricePerHundred: 98.15,
  tenureType: '6_month',
  fundingSource: 'cash',
  issueDate: '2026-01-01',
});

assert.equal(tbill6mo.totalInvestmentCost, 9815, 'Actual investment cost should be $9,815');
assert.equal(tbill6mo.netDiscountProfit, 185, 'Net discount profit at par maturity should be $185');
// Yield = (185 / 9815) * (365 / 182) * 100 ~ 3.78%
assert.equal(tbill6mo.cutOffYieldPA, 3.78, 'Annualized cut-off yield should be ~3.78%');
assert.equal(tbill6mo.maturityDate, '2026-07-02', '6-month maturity date is 182 days after issue');
console.log('  ✅ MAS T-Bills discount economics and annualized yield passed');

// 3. Irish UCITS vs US-Domiciled ETF Tax Drag & Estate Tax
const etfComp = computeUCITSETFComparison({
  portfolioValue: 200000,
  dividendYieldPct: 1.5,
  expectedGrowthRatePct: 8.0,
  investmentHorizonYears: 20,
  usWithholdingTaxPct: 30.0,
  ucitsWithholdingTaxPct: 15.0,
});

assert.equal(etfComp.annualGrossDividend, 3000, 'Gross dividend on $200k @ 1.5% is $3,000');
assert.equal(etfComp.usEtfAnnualTaxDrag, 900, '30% US tax drag on $3,000 is $900');
assert.equal(etfComp.ucitsAnnualTaxDrag, 450, '15% Irish UCITS tax drag on $3,000 is $450');
assert.equal(etfComp.annualTaxSavingsWithUCITS, 450, 'Annual tax saved with UCITS is $450');
assert(etfComp.cumulativeCompoundedTaxSavings > 20000, 'Compounded tax savings over 20 years should exceed $20,000');
// US estate tax: ($200,000 - $60,000) * 40% = $56,000
assert.equal(etfComp.usEstateTaxExposureRisk, 56000, 'US estate tax exposure risk is $56,000');
assert.equal(etfComp.ucitsEstateTaxExposureRisk, 0, 'Irish UCITS estate tax liability is $0');
console.log('  ✅ Irish UCITS vs US ETF tax drag and estate tax comparison passed');

console.log('All Singapore Fixed Income & UCITS math assertions passed! (3/3)');
