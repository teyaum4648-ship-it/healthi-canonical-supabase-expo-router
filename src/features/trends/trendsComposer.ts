import {
  generateTrendsSummary,
  type GenerateTrendsSummaryInput,
  type TrendMovementEntry,
  type TrendNutritionEntry,
  type TrendRhythmEntry,
  type TrendScheduleEntry
} from '../../engines/trends';
import { getDemoScheduleBlocksForRange } from '../dayPlan/localDemoScheduleStore';
import {
  getScheduleBlocksForRange,
  type DayScheduleBlockRow,
  type DayScheduleBlockSupabaseClient
} from '../dayPlan/scheduleBlockPersistence';
import { getLocalDemoMovementState } from '../movement/localDemoMovementStore';
import {
  getWorkoutSessionsForRange,
  type MovementSupabaseClient,
  type WorkoutSessionRow
} from '../movement/movementPersistence';
import { getLocalDemoNutritionState } from '../nutrition/localDemoNutritionStore';
import { getRecentMealLogs, type MealLogRow, type NutritionSupabaseClient } from '../nutrition/persistence';
import type { MealLog } from '../../engines/nutrition';
import { getLocalSleepWindowSessions } from '../sleepRhythm/localSleepWindowStore';
import { localDay } from '../../utils/localDay';
import {
  getRecentSleepSessions,
  type SleepRhythmSupabaseClient,
  type SleepSessionRow
} from '../sleepRhythm/persistence';
import type { LoadTrendsScreenModelInput, TrendsScreenModel } from './trendsTypes';

const DAY_MS = 24 * 60 * 60 * 1000;

function dateKey(value: string): string {
  return value.slice(0, 10);
}

function rangeStart(today: string, rangeDays: number): string {
  const date = new Date(`${dateKey(today)}T12:00:00.000Z`);
  date.setTime(date.getTime() - (rangeDays - 1) * DAY_MS);
  return date.toISOString().slice(0, 10);
}

function numberOrZero(value: number | null | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function groupByDate<T>(rows: T[], getDate: (row: T) => string): Map<string, T[]> {
  return rows.reduce((groups, row) => {
    const date = dateKey(getDate(row));
    groups.set(date, [...(groups.get(date) ?? []), row]);
    return groups;
  }, new Map<string, T[]>());
}

type NutritionTrendMeal = Pick<MealLog, 'logged_at' | 'protein_g' | 'fiber_g' | 'sugar_g' | 'quality_flags' | 'user_response' | 'source_confidence' | 'reason_codes'>;

/* A meal belongs to the day it was eaten where the person is, not to the UTC date of its timestamp. */
export function nutritionHistoryFromMealLogs(meals: NutritionTrendMeal[]): TrendNutritionEntry[] {
  return [...groupByDate(meals, (meal) => localDay(meal.logged_at))].map(([date, rows]) => {
    const flags = rows.flatMap((row) => row.quality_flags);
    const hasWatch = flags.some((flag) => ['added_sugar', 'high_sodium', 'ultra_processed_indicator'].includes(flag));
    const hasSupport = flags.some((flag) => ['balanced_meal', 'whole_food_emphasis', 'timing_supportive'].includes(flag));
    const responseWatch = rows.some((row) => row.user_response?.energy === 'dip' || row.user_response?.digestion === 'uncomfortable');
    return {
      date,
      meal_count: rows.length,
      protein_grams: rows.reduce((sum, row) => sum + numberOrZero(row.protein_g), 0),
      fiber_grams: rows.reduce((sum, row) => sum + numberOrZero(row.fiber_g), 0),
      added_sugar_grams: rows.reduce((sum, row) => sum + numberOrZero(row.sugar_g), 0),
      food_quality_label: hasWatch ? 'watch' : hasSupport ? 'supportive' : 'steady',
      food_response_label: responseWatch ? 'watch' : 'steady',
      confidence: rows.some((row) => row.source_confidence === 'low') ? 'low' : 'medium',
      reason_codes: rows.flatMap((row) => row.reason_codes)
    };
  });
}

export function movementHistoryFromWorkoutSessions(sessions: WorkoutSessionRow[]): TrendMovementEntry[] {
  return [...groupByDate(sessions, (session) => session.session_date)].map(([date, rows]) => ({
    date,
    workout_count: rows.length,
    total_minutes: rows.reduce((sum, row) => sum + numberOrZero(row.duration_minutes), 0),
    training_load_label: rows.some((row) => numberOrZero(row.perceived_effort) >= 8) ? 'high' : rows.length ? 'steady' : 'unknown',
    readiness_label: rows.find((row) => row.readiness_before)?.readiness_before ?? null,
    confidence: rows.some((row) => row.source_confidence === 'low') ? 'low' : 'medium',
    reason_codes: rows.flatMap((row) => row.reason_codes)
  }));
}

export function scheduleHistoryFromBlocks(blocks: DayScheduleBlockRow[]): TrendScheduleEntry[] {
  return [...groupByDate(blocks, (block) => block.block_date)].map(([date, rows]) => ({
    date,
    block_count: rows.length,
    protected_block_count: rows.filter((row) => row.is_protected).length,
    confidence: rows.some((row) => row.source_confidence === 'low') ? 'low' : 'medium',
    reason_codes: rows.flatMap((row) => row.reason_codes)
  }));
}

export function rhythmHistoryFromSleepSessions(sessions: Array<Pick<SleepSessionRow, 'date' | 'duration_minutes' | 'source_confidence' | 'reason_codes'>>): TrendRhythmEntry[] {
  return sessions.map((session) => ({
    date: session.date,
    sleep_duration_hours: session.duration_minutes === null ? null : session.duration_minutes / 60,
    confidence: session.source_confidence,
    reason_codes: [...session.reason_codes]
  }));
}

export function composeTrendsScreenModel(input: GenerateTrendsSummaryInput, loadError = false): TrendsScreenModel {
  return {
    range_days: input.range_days ?? 7,
    summary: generateTrendsSummary(input),
    load_error: loadError
  };
}

async function loadDemoModel(input: LoadTrendsScreenModelInput): Promise<TrendsScreenModel> {
  const start = rangeStart(input.today, input.range_days);
  const endAt = `${dateKey(input.today)}T23:59:59.999Z`;
  const startAt = `${start}T00:00:00.000Z`;
  /*
   * The nights logged on this device, the same ones Home and the Sleep tab read. This
   * used to be a generated week of sample sleep, which gave every demo the same
   * "7h 37m average sleep" at high confidence whatever the person had actually logged.
   */
  const [nutrition, movement, schedule, sleep] = await Promise.all([
    getLocalDemoNutritionState(),
    getLocalDemoMovementState(),
    getDemoScheduleBlocksForRange(startAt, endAt),
    getLocalSleepWindowSessions()
  ]);
  return composeTrendsScreenModel({
    today: input.today,
    range_days: input.range_days,
    source_label: 'demo',
    nutritionHistory: nutritionHistoryFromMealLogs(nutrition.mealLogs),
    movementHistory: movementHistoryFromWorkoutSessions(movement.workoutSessions),
    scheduleHistory: scheduleHistoryFromBlocks(schedule),
    rhythmHistory: rhythmHistoryFromSleepSessions(sleep)
  });
}

async function loadRemoteModel(input: LoadTrendsScreenModelInput): Promise<TrendsScreenModel> {
  if (!input.user_id || !input.supabase_client) {
    return composeTrendsScreenModel({ today: input.today, range_days: input.range_days, source_label: 'calibrating' });
  }
  const start = rangeStart(input.today, input.range_days);
  const startAt = `${start}T00:00:00.000Z`;
  const endAt = `${dateKey(input.today)}T23:59:59.999Z`;
  const [meals, sessions, blocks, sleep] = await Promise.all([
    getRecentMealLogs(input.supabase_client as NutritionSupabaseClient, input.user_id, 100),
    getWorkoutSessionsForRange(input.supabase_client as MovementSupabaseClient, input.user_id, start, input.today, 100),
    getScheduleBlocksForRange(input.supabase_client as DayScheduleBlockSupabaseClient, input.user_id, startAt, endAt, 200),
    getRecentSleepSessions(input.supabase_client as SleepRhythmSupabaseClient, input.user_id, 30)
  ]);
  return composeTrendsScreenModel({
    today: input.today,
    range_days: input.range_days,
    source_label: 'logged',
    nutritionHistory: nutritionHistoryFromMealLogs(meals),
    movementHistory: movementHistoryFromWorkoutSessions(sessions),
    scheduleHistory: scheduleHistoryFromBlocks(blocks),
    rhythmHistory: rhythmHistoryFromSleepSessions(sleep)
  });
}

export async function loadTrendsScreenModel(input: LoadTrendsScreenModelInput): Promise<TrendsScreenModel> {
  try {
    return input.is_demo_mode ? await loadDemoModel(input) : await loadRemoteModel(input);
  } catch {
    return composeTrendsScreenModel({ today: input.today, range_days: input.range_days, source_label: 'calibrating' }, true);
  }
}
