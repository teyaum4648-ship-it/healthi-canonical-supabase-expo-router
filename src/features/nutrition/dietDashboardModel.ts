import { shiftDay } from '../navigation/navigationModel';

/** Intake progress is presentation only; it never creates a health score. */
export function intakeProgress(current: number | null | undefined, target: number | null | undefined) {
  const amount = typeof current === 'number' && Number.isFinite(current) && current >= 0 ? current : null;
  const goal = typeof target === 'number' && Number.isFinite(target) && target > 0 ? target : null;
  return {
    amount,
    target: goal,
    fraction: amount !== null && goal !== null ? Math.min(amount / goal, 1) : null,
    remaining: amount !== null && goal !== null ? goal - amount : null
  };
}

export function dietWeek(date: string) {
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
  const start = shiftDay(date, -weekday);
  return Array.from({ length: 7 }, (_, index) => shiftDay(start, index));
}
