import assert from 'node:assert';
import { computeProgressiveResidentTax, computeIRASTaxAssessment } from '../src/lib/data/irasMath.ts';

console.log('── Running verify_iras_math.ts assertions ──');

// 1. Progressive Resident Tax Calculation
{
  // $20,000 -> 0% = $0
  const t1 = computeProgressiveResidentTax(20000);
  assert.strictEqual(t1.tax, 0);

  // $30,000 -> First $20k @ 0% + Next $10k @ 2% = $200
  const t2 = computeProgressiveResidentTax(30000);
  assert.strictEqual(t2.tax, 200.0);
  assert.strictEqual(t2.marginalRate, 2.0);

  // $80,000 -> First $40k is $550 + Next $40k @ 7% ($2,800) = $3,350
  const t3 = computeProgressiveResidentTax(80000);
  assert.strictEqual(t3.tax, 3350.0);
  assert.strictEqual(t3.marginalRate, 7.0);

  // $120,000 -> First $80k is $3,350 + Next $40k @ 11.5% ($4,600) = $7,950
  const t4 = computeProgressiveResidentTax(120000);
  assert.strictEqual(t4.tax, 7950.0);
  assert.strictEqual(t4.marginalRate, 11.5);

  console.log('  ✅ IRAS Progressive tax bracket calculations passed');
}

// 2. Full Assessment with Reliefs Under $80,000 Cap
{
  const res = computeIRASTaxAssessment({
    taxYear: 2025,
    employmentIncome: 120000,
    bonusAWS: 20000, // Total Assessable = $140,000
    ageGroup: 'under_55', // EIR = $1,000
    cpfEmployeeMandatoryRelief: 20400,
    rstuSelfTopUp: 8000,
    rstuFamilyTopUp: 8000,
    srsContribution: 15300,
    nsmanReliefType: 'active_ict_ippt', // $3,000
    qualifyingChildrenCount: 1, // $4,000
    parentReliefType: 'none',
  });

  // Total reliefs = $1,000 (EIR) + $20,400 (CPF) + $8,000 + $8,000 + $15,300 + $3,000 + $4,000 = $59,700
  assert.strictEqual(res.totalAssessableIncome, 140000.0);
  assert.strictEqual(res.uncappedTotalReliefs, 59700.0);
  assert.strictEqual(res.cappedTotalReliefs, 59700.0);
  assert.strictEqual(res.isReliefCapApplied, false);

  // Chargeable Income = $140,000 - $59,700 = $80,300
  assert.strictEqual(res.chargeableIncome, 80300.0);

  // Tax on $80,300: First $80k is $3,350 + ($300 * 11.5% = $34.50) = $3,384.50
  assert.strictEqual(res.grossTaxPayable, 3384.5);
  assert(res.effectiveTaxRate < 3.0); // very low effective tax
  console.log('  ✅ Standard assessment with personal reliefs passed');
}

// 3. $80,000 Statutory Personal Relief Cap Enforcement
{
  const res = computeIRASTaxAssessment({
    taxYear: 2025,
    employmentIncome: 250000,
    bonusAWS: 50000, // Gross = $300,000
    ageGroup: 'under_55',
    cpfEmployeeMandatoryRelief: 20400,
    rstuSelfTopUp: 8000,
    rstuFamilyTopUp: 8000,
    srsContribution: 15300,
    nsmanReliefType: 'active_ict_ippt', // $3,000
    qualifyingChildrenCount: 3, // $12,000
    parentReliefType: 'staying', // $9,000
    courseFeesRelief: 5500,
    lifeInsuranceRelief: 5000,
  });

  // Sum of reliefs > $80,000
  assert(res.uncappedTotalReliefs > 80000);
  assert.strictEqual(res.cappedTotalReliefs, 80000.0);
  assert.strictEqual(res.isReliefCapApplied, true);

  // Chargeable Income = $300,000 - $80,000 = $220,000
  assert.strictEqual(res.chargeableIncome, 220000.0);
  console.log('  ✅ Statutory $80,000 personal relief cap enforced correctly');
}

console.log('All IRAS Tax math assertions passed! (3/3)');
