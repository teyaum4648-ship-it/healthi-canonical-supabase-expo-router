import type { SleepSession } from '../../engines/circadian';
import type { MealLog } from '../../engines/nutrition';

export type DashboardMacroTotals = {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  has_nutrition: boolean;
};

export function greetingForHour(hour: number): 'Good morning' | 'Good afternoon' | 'Good evening' {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

/**
 * The name to greet someone by, or null to greet them without one.
 *
 * "Good morning, there" was what an unknown name produced. The first name given at
 * sign-up comes first; an account's display name is the fallback. The demo's placeholder
 * profile is called "Demo User", which is nobody's name, so the demo only uses a first
 * name it was actually given.
 */
export function greetingName(metadataFirstName: unknown, displayName: string | null | undefined, demo: boolean): string | null {
  if (typeof metadataFirstName === 'string' && metadataFirstName.trim()) return metadataFirstName.trim();
  if (demo) return null;
  /* An account made without a name has its email as the display name; never greet with that. */
  if (!displayName || displayName.includes('@')) return null;
  const first = displayName.trim().split(/\s+/)[0];
  return first ? first : null;
}

export function homeGreeting(greeting: string, name: string | null): string {
  return name ? `${greeting}, ${name}` : greeting;
}

export function aggregateDashboardMacros(meals: MealLog[]): DashboardMacroTotals {
  const values = meals.reduce(
    (totals, meal) => ({
      calories: totals.calories + (Number.isFinite(meal.calories) ? meal.calories ?? 0 : 0),
      protein_g: totals.protein_g + (Number.isFinite(meal.protein_g) ? meal.protein_g ?? 0 : 0),
      carbs_g: totals.carbs_g + (Number.isFinite(meal.carbs_g) ? meal.carbs_g ?? 0 : 0),
      fat_g: totals.fat_g + (Number.isFinite(meal.fat_g) ? meal.fat_g ?? 0 : 0)
    }),
    { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
  );

  return {
    calories: Math.round(values.calories),
    protein_g: Math.round(values.protein_g),
    carbs_g: Math.round(values.carbs_g),
    fat_g: Math.round(values.fat_g),
    has_nutrition: meals.some((meal) =>
      [meal.calories, meal.protein_g, meal.carbs_g, meal.fat_g].some(Number.isFinite)
    )
  };
}

export function boundedProgress(current: number, target: number | null | undefined): number {
  if (!Number.isFinite(current) || !Number.isFinite(target) || !target || target <= 0) return 0;
  return Math.min(1, Math.max(0, current / target));
}

export function driverStatusProgress(status: 'supportive' | 'steady' | 'watch' | 'calibrating'): number {
  if (status === 'supportive') return 1;
  if (status === 'steady') return 0.72;
  if (status === 'watch') return 0.46;
  return 0.18;
}

export function recentSleepTrend(sessions: SleepSession[], limit = 7): number[] {
  return sessions
    .filter((session) => typeof session.duration_minutes === 'number' && Number.isFinite(session.duration_minutes))
    .sort((left, right) => left.date.localeCompare(right.date))
    .slice(-limit)
    .map((session) => session.duration_minutes as number);
}
