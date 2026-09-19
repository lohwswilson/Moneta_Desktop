import assert from 'node:assert';
import {
  computeCPFInterest,
  computeCPFLifeSimulation,
  computeCPFHousingRefund,
  computeSingaporeStampDuty,
} from '../src/lib/data/cpfMath.ts';

console.log('── Running verify_cpf_math.ts assertions ──');

// 1. CPF Interest Calculations with Extra 1%
{
  const balances = {
    oa: 50000,
    sa: 40000,
    ma: 20000,
    ra: 0,
  };
  const res = computeCPFInterest(balances);

  // OA Base: $50,000 * 2.5% = $1,250
  assert.strictEqual(res.oaInterest, 1250.0);
  // SA Base: $40,000 * 4.0% = $1,600
  assert.strictEqual(res.saInterest, 1600.0);
  // MA Base: $20,000 * 4.0% = $800
  assert.strictEqual(res.maInterest, 800.0);

  // Extra 1% on first $60,000:
  // Non-OA total = $40k + $20k = $60k (uses up the full $60k pool)
  // Extra 1% = $60,000 * 1% = $600
  assert.strictEqual(res.extraInterest, 600.0);
  assert.strictEqual(res.totalAnnualInterest, 4250.0);
  console.log('  ✅ CPF Interest & Extra 1% pool logic passed');
}

// 2. Extra 1% when Non-OA is under $60k (OA absorbs up to $20k)
{
  const balances = {
    oa: 30000,
    sa: 20000,
    ma: 10000,
    ra: 0,
  };
  const res = computeCPFInterest(balances);
  // Non-OA = $30,000
  // OA can contribute max $20,000 to the remaining $30,000 pool
  // Total eligible for extra 1% = $30,000 + $20,000 = $50,000
  // Extra interest = $50,000 * 1% = $500
  assert.strictEqual(res.extraInterest, 500.0);
  console.log('  ✅ CPF OA $20k cap for Extra 1% passed');
}

// 3. CPF LIFE Retirement Simulator (FRS Standard Plan)
{
  const res = computeCPFLifeSimulation({
    raBalanceAt55: 213000, // Full Retirement Sum (FRS)
    payoutStartAge: 65,
    planType: 'standard',
  });

  assert.strictEqual(res.retirementTier, 'frs');
  // Monthly payout on FRS Standard at 65 is benchmarked at $1,650.00
  assert.strictEqual(res.monthlyPayoutEstimated, 1650.0);
  assert.strictEqual(res.annualPayoutEstimated, 19800.0);
  assert.strictEqual(res.payoutAt80, 1650.0);
  assert.strictEqual(res.payoutAt90, 1650.0);
  // Cumulative by 85 (20 years * $19,800 = $396,000)
  assert.strictEqual(res.cumulativePayout85, 396000.0);
  console.log('  ✅ CPF LIFE Standard Plan FRS simulation passed');
}

// 4. CPF LIFE Escalating Plan (+2% compounding per year)
{
  const res = computeCPFLifeSimulation({
    raBalanceAt55: 213000,
    payoutStartAge: 65,
    planType: 'escalating',
  });

  // Starting payout is 80% of standard: $1,650 * 0.8 = $1,320
  assert.strictEqual(res.monthlyPayoutEstimated, 1320.0);
  // At age 80 (15 years later): $1,320 * (1.02)^15 = $1,776.54
  assert(res.payoutAt80 > res.monthlyPayoutEstimated);
  assert(res.payoutAt90 > res.payoutAt80);
  console.log('  ✅ CPF LIFE Escalating Plan (+2%/yr) passed');
}

// 5. CPF Housing Accrued Interest (2.5% Compounded)
{
  const res = computeCPFHousingRefund({
    downpaymentOA: 100000,
    monthlyOADeduction: 1000,
    housingGrants: 50000,
    holdingYears: 5,
    salePrice: 800000,
    outstandingMortgage: 300000,
    sellingCosts: 16000,
  });

  // Principal withdrawn: $100k + $50k + ($1k * 12 * 5 = $60k) = $210,000
  assert.strictEqual(res.principalWithdrawn, 210000.0);
  // Accrued interest must be positive and compounded
  assert(res.accruedInterest > 20000);
  assert(res.totalRefundDue > res.principalWithdrawn);

  // Net Cash Proceeds = $800k - $300k (loan) - totalRefundDue - $16k
  assert(res.netCashProceeds > 0);
  assert.strictEqual(res.grossProceeds, 500000.0);
  console.log('  ✅ CPF Housing Accrued Interest & Net Cash Proceeds passed');
}

// 6. Singapore Buyer's Stamp Duty (BSD) & ABSD
{
  // Property $1,200,000 for Citizen 1st property
  const res1 = computeSingaporeStampDuty(1200000, 'citizen_1');
  // First $180k @ 1% = $1,800
  // Next $180k @ 2% = $3,600
  // Next $640k @ 3% = $19,200
  // Next $200k @ 4% = $8,000
  // Total BSD = $1,800 + $3,600 + $19,200 + $8,000 = $32,600
  assert.strictEqual(res1.bsd, 32600.0);
  assert.strictEqual(res1.absd, 0.0);
  assert.strictEqual(res1.totalStampDuty, 32600.0);

  // Foreigner 60% ABSD on $1.2M property
  const resForeigner = computeSingaporeStampDuty(1200000, 'foreigner');
  assert.strictEqual(resForeigner.bsd, 32600.0);
  assert.strictEqual(resForeigner.absd, 720000.0); // 60% of $1.2M
  assert.strictEqual(resForeigner.totalStampDuty, 752600.0);

  console.log('  ✅ Singapore BSD & ABSD stamp duty passed');
}

console.log('All CPF and Singapore Housing math assertions passed! (6/6)');
