import type { CircadianBriefing } from '../../engines/circadian';
import type { DayPlanResult } from '../../engines/dayPlan';
import type { MealLog } from '../../engines/nutrition';
import { formatHoursMinutes } from './dashboardZones';
import type { DayThreadInput } from './dayThreadModel';

import { formatClockRange } from '../../utils/clockFormat';
/**
 * Turns what Today already has (the circadian briefing, the day plan, and today's logs) into
 * the DayThread model's input. Read-only: nothing here estimates, it only places.
 *
 * Two time conventions meet here, and each is read the way its source writes it:
 * - The sleep and day-plan engines put the local wall clock on the UTC axis (see
 *   `wallClockIso`): a 07:05 wake is T07:05Z of its day. `wallClockMinute` reads those.
 * - Meals, water and workouts store real instants. `localMinute` reads those on the device clock.
 */

/** Minutes from the start of `day` for a wall-clock-on-UTC timestamp, e.g. 2026-11-16T06:40Z → 400. */
export function wallClockMinute(iso: string | null | undefined, day: string): number | null {
  if (!iso) return null;
  const time = Date.parse(iso);
  const base = Date.parse(`${day}T00:00:00.000Z`);
  if (!Number.isFinite(time) || !Number.isFinite(base)) return null;
  return Math.round((time - base) / 60000);
}

/** Minutes from the start of local `day` for a real instant, by the device's own clock. */
export function localMinute(iso: string | null | undefined, day: string): number | null {
  if (!iso) return null;
  const date = new Date(iso);
  const [year, month, dayOfMonth] = day.split('-').map(Number);
  if (!Number.isFinite(date.getTime()) || !year || !month || !dayOfMonth) return null;
  const dayDiff = Math.round((Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - Date.UTC(year, month - 1, dayOfMonth)) / 86400000);
  return dayDiff * 1440 + date.getHours() * 60 + date.getMinutes();
}

export function localNowMinute(now: Date, day: string): number {
  return localMinute(now.toISOString(), day) ?? now.getHours() * 60 + now.getMinutes();
}

const MEAL_NAMES: Record<MealLog['meal_type'], string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
  unknown: 'Meal'
};

const onToday = (minute: number | null): minute is number => minute !== null && minute >= 0 && minute < 1440;
const range = (start: number, end: number) => formatClockRange(start, end);

export type DayThreadSources = {
  today: string;
  nowMinute: number;
  briefing: Pick<CircadianBriefing, 'wake_time' | 'target_bedtime' | 'energy_curve' | 'energy_zones' | 'rhythm_plan'>;
  /** Last night's sleep, only when a night ending today is logged or measured. */
  lastNight: { minutes: number } | null;
  meals: Pick<MealLog, 'id' | 'logged_at' | 'name' | 'meal_type' | 'protein_g'>[];
  water: { id: string; logged_at: string; amount_ml: number }[];
  workouts: { id: string; logged_at: string; title: string; duration_minutes: number | null }[];
  plan: Pick<DayPlanResult, 'recommendations' | 'protected_blocks'> | null;
  glassMl: number;
};

export function buildDayThreadInput(sources: DayThreadSources): DayThreadInput {
  const { today } = sources;
  const wakeMinute = wallClockMinute(sources.briefing.wake_time, today);
  const bedMinute = wallClockMinute(sources.briefing.target_bedtime ?? sources.briefing.rhythm_plan.target_bedtime, today);

  const curve = sources.briefing.energy_curve
    .map((point) => ({ minute: wallClockMinute(point.time, today), energy: point.estimated_energy }))
    .filter((point): point is { minute: number; energy: number } => point.minute !== null && Number.isFinite(point.energy));
  const zones = sources.briefing.energy_zones
    .map((zone) => ({ start: wallClockMinute(zone.start_at, today), end: wallClockMinute(zone.end_at, today), level: zone.level }))
    .filter((zone): zone is { start: number; end: number; level: typeof zone.level } => zone.start !== null && zone.end !== null && zone.end > zone.start);

  const logged: DayThreadInput['logged'] = [];
  if (sources.lastNight && wakeMinute !== null) {
    logged.push({ id: 'wake', minute: wakeMinute, label: `Woke · ${formatHoursMinutes(sources.lastNight.minutes)} asleep` });
  }
  for (const meal of sources.meals) {
    const minute = localMinute(meal.logged_at, today);
    if (!onToday(minute)) continue;
    const name = meal.name?.trim() || MEAL_NAMES[meal.meal_type] || 'Meal';
    const protein = typeof meal.protein_g === 'number' && meal.protein_g > 0 ? ` · ${Math.round(meal.protein_g)} g protein` : '';
    logged.push({ id: `meal-${meal.id}`, minute, label: `${name}${protein}` });
  }
  const water = sources.water
    .map((entry) => ({ ...entry, minute: localMinute(entry.logged_at, today) }))
    .filter((entry): entry is typeof entry & { minute: number } => onToday(entry.minute));
  if (water.length) {
    const allGlasses = water.every((entry) => entry.amount_ml === sources.glassMl);
    const total = water.reduce((sum, entry) => sum + entry.amount_ml, 0);
    logged.push({
      id: 'water',
      minute: Math.max(...water.map((entry) => entry.minute)),
      label: allGlasses ? `Water · ${water.length} glass${water.length === 1 ? '' : 'es'}` : `Water · ${total} mL`
    });
  }
  for (const workout of sources.workouts) {
    const minute = localMinute(workout.logged_at, today);
    if (!onToday(minute)) continue;
    const duration = typeof workout.duration_minutes === 'number' && workout.duration_minutes > 0 ? ` · ${Math.round(workout.duration_minutes)} min` : '';
    logged.push({ id: `workout-${workout.id}`, minute, label: `${workout.title}${duration}` });
  }

  const planned: DayThreadInput['planned'] = [];
  let hasWindDown = false;
  for (const recommendation of sources.plan?.recommendations ?? []) {
    const start = wallClockMinute(recommendation.start, today);
    if (start === null) continue;
    const end = wallClockMinute(recommendation.end, today);
    if (recommendation.type === 'wind_down') hasWindDown = true;
    const timed = end !== null && end > start ? `${range(start, end)} · ` : '';
    planned.push({ id: `rec-${recommendation.id}`, start, end: end !== null && end > start ? end : null, title: recommendation.title, detail: `${timed}${recommendation.detail}` });
  }
  for (const block of sources.plan?.protected_blocks ?? []) {
    if (block.type === 'sleep') continue;
    const start = wallClockMinute(block.start, today);
    const end = wallClockMinute(block.end, today);
    if (start === null || end === null || end <= start) continue;
    /* Listed, not drawn to scale: a schedule block is the person's own time, not a peak-aligned suggestion. */
    planned.push({ id: `block-${block.id}`, start, end, title: block.label, detail: range(start, end), listOnly: true });
  }
  const windDown = wallClockMinute(sources.briefing.rhythm_plan.wind_down_start, today);
  if (!hasWindDown && windDown !== null) planned.push({ id: 'wind-down', start: windDown, title: 'Wind-down', detail: null });
  if (bedMinute !== null) planned.push({ id: 'bed', start: bedMinute, title: 'Bed', detail: null });

  return { wakeMinute, bedMinute, nowMinute: sources.nowMinute, curve, zones, logged, planned };
}
