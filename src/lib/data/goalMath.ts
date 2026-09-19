import type { FinancialGoal, GoalStatus } from '../types/moneta';

/**
 * Single source of truth for `moneta.goal` derived figures.
 *
 * Both the SQLite and Mock adapters call this rather than recomputing the
 * numbers themselves: when two surfaces derive the same figure independently
 * they drift, and a goal then reads differently in two places. Odoo computes
 * these in `moneta_core/models/goal.py::_compute_goal_progress` — keep the
 * two in step.
 */

/** Parses 'YYYY-MM-DD' as a local date. `new Date(str)` would parse as UTC and can shift a day. */
export function parseDateOnly(value: string): Date {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

/** Today at local midnight, so date comparisons are date-only. */
export function todayDateOnly(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export function toDateOnlyString(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${m}-${d}`;
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

/**
 * Calendar difference between two dates, mirroring Python's
 * `dateutil.relativedelta(end, start)`: whole years and months, with the
 * leftover days borrowed from the month preceding `end`.
 */
function calendarDelta(start: Date, end: Date): { years: number; months: number; days: number } {
  let years = end.getFullYear() - start.getFullYear();
  let months = end.getMonth() - start.getMonth();
  let days = end.getDate() - start.getDate();

  if (days < 0) {
    const borrow = new Date(end.getFullYear(), end.getMonth() - 1, 1);
    days += daysInMonth(borrow.getFullYear(), borrow.getMonth());
    months -= 1;
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  return { years, months, days };
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export type GoalMetrics = Pick<
  FinancialGoal,
  'remaining_amount' | 'progress_percent' | 'months_remaining' | 'monthly_contribution_required' | 'status'
>;

/**
 * Derives a goal's progress figures.
 *
 * `status` is passed through because 'paused' is a user choice the computation
 * must not overwrite — matching `goal.py`, where an achieved goal always reads
 * `achieved` but a paused one only changes once it is achieved.
 */
export function computeGoalMetrics(
  goal: Pick<FinancialGoal, 'target_amount' | 'current_amount' | 'target_date' | 'status'>,
  today: Date = todayDateOnly()
): GoalMetrics {
  const target = Number(goal.target_amount) || 0;
  const current = Number(goal.current_amount) || 0;

  const remaining_amount = round(Math.max(target - current, 0), 4);
  const progress_percent = target > 0 ? round(Math.min((current / target) * 100, 100), 1) : 0;

  let status: GoalStatus;
  if (current >= target && target > 0) {
    status = 'achieved';
  } else if (goal.status === 'paused') {
    status = 'paused';
  } else {
    status = 'in_progress';
  }

  let months_remaining: number;
  let monthly_contribution_required: number;

  const targetDate = goal.target_date ? parseDateOnly(goal.target_date) : null;
  if (targetDate && targetDate.getTime() > today.getTime()) {
    const delta = calendarDelta(today, targetDate);
    const months = Math.max(delta.years * 12 + delta.months + (delta.days > 0 ? 1 : 0), 1);
    months_remaining = months;
    monthly_contribution_required = round(remaining_amount / months, 4);
  } else {
    months_remaining = 0;
    monthly_contribution_required = remaining_amount;
  }

  return { remaining_amount, progress_percent, months_remaining, monthly_contribution_required, status };
}
