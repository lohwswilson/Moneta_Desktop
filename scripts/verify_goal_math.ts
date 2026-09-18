import { computeGoalMetrics } from '../src/lib/data/goalMath.ts';

const TODAY = new Date(2026, 8, 18); // 2026-09-18
let pass = 0;
let fail = 0;

function check(label: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    pass++;
    console.log(`  ✅ ${label}: ${a}`);
  } else {
    fail++;
    console.log(`  ❌ ${label}: got ${a}, expected ${e}`);
  }
}

// 1. Partially funded, target ahead. 2026-09-18 -> 2027-06-30 is relativedelta(months=9, days=12),
//    so 9 months + 1 (leftover days) = 10 months; 15000 / 10 = 1500.
console.log('\n1. Emergency Fund (45000 / 60000, target 2027-06-30)');
{
  const m = computeGoalMetrics(
    { target_amount: 60000, current_amount: 45000, target_date: '2027-06-30', status: 'in_progress' },
    TODAY
  );
  check('remaining_amount', m.remaining_amount, 15000);
  check('progress_percent', m.progress_percent, 75);
  check('months_remaining', m.months_remaining, 10);
  check('monthly_contribution_required', m.monthly_contribution_required, 1500);
  check('status', m.status, 'in_progress');
}

// 2. Fully funded -> achieved, nothing left to save.
console.log('\n2. Fully funded (4500 / 4500)');
{
  const m = computeGoalMetrics(
    { target_amount: 4500, current_amount: 4500, target_date: '2026-08-31', status: 'in_progress' },
    TODAY
  );
  check('remaining_amount', m.remaining_amount, 0);
  check('progress_percent', m.progress_percent, 100);
  check('status', m.status, 'achieved');
  check('months_remaining', m.months_remaining, 0);
  check('monthly_contribution_required', m.monthly_contribution_required, 0);
}

// 3. Target date already passed -> no months left, so the whole remainder is needed now.
console.log('\n3. Target date in the past (5000 / 1000, target 2025-01-01)');
{
  const m = computeGoalMetrics(
    { target_amount: 5000, current_amount: 1000, target_date: '2025-01-01', status: 'in_progress' },
    TODAY
  );
  check('months_remaining', m.months_remaining, 0);
  check('monthly_contribution_required', m.monthly_contribution_required, 4000);
  check('status', m.status, 'in_progress');
}

// 4. Overfunded -> capped at 100, never over 100 or negative remaining.
console.log('\n4. Overfunded (12000 / 15000)');
{
  const m = computeGoalMetrics(
    { target_amount: 12000, current_amount: 15000, target_date: '2028-01-01', status: 'in_progress' },
    TODAY
  );
  check('progress_percent', m.progress_percent, 100);
  check('remaining_amount', m.remaining_amount, 0);
  check('status', m.status, 'achieved');
}

// 5. Paused must survive the computation when the target is not yet reached.
//    This mirrors goal.py: `elif goal.status != 'paused': goal.status = 'in_progress'`.
console.log('\n5. Paused goal, not yet reached');
{
  const m = computeGoalMetrics(
    { target_amount: 10000, current_amount: 2000, target_date: '2027-01-01', status: 'paused' },
    TODAY
  );
  check('status', m.status, 'paused');
}
console.log('\n6. Paused goal that has reached its target -> achieved wins');
{
  const m = computeGoalMetrics(
    { target_amount: 10000, current_amount: 10000, target_date: '2027-01-01', status: 'paused' },
    TODAY
  );
  check('status', m.status, 'achieved');
}

// 7. Zero target must not divide by zero.
console.log('\n7. Zero target (no division by zero)');
{
  const m = computeGoalMetrics(
    { target_amount: 0, current_amount: 0, target_date: '2027-01-01', status: 'in_progress' },
    TODAY
  );
  check('progress_percent', m.progress_percent, 0);
  check('status', m.status, 'in_progress');
}

// 8. One day out -> the ceil gives 1 month minimum, never 0-with-division.
console.log('\n8. Target tomorrow (1 month floor)');
{
  const m = computeGoalMetrics(
    { target_amount: 3000, current_amount: 0, target_date: '2026-09-19', status: 'in_progress' },
    TODAY
  );
  check('months_remaining', m.months_remaining, 1);
  check('monthly_contribution_required', m.monthly_contribution_required, 3000);
}

console.log(`\n${'='.repeat(50)}\n${pass} passed, ${fail} failed\n${'='.repeat(50)}`);
process.exit(fail === 0 ? 0 : 1);
