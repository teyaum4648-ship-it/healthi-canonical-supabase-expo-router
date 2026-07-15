import AsyncStorage from '@react-native-async-storage/async-storage';

import { generateBaselineSummary, type BaselineOnboardingInput } from '../../engines/baseline';
import { getDemoScheduleBlocksForRange } from '../dayPlan/localDemoScheduleStore';
import { getScheduleBlocksForRange, type DayScheduleBlockSupabaseClient } from '../dayPlan/scheduleBlockPersistence';
import { getLocalDemoMovementState } from '../movement/localDemoMovementStore';
import { getWorkoutSessionsForRange, type MovementSupabaseClient } from '../movement/movementPersistence';
import { getLocalDemoNutritionState } from '../nutrition/localDemoNutritionStore';
import { getActiveFoodPatternProfile, type FoodPersonalizationSupabaseClient } from '../nutrition/foodPersonalizationPersistence';
import { getRecentMealLogs, type NutritionSupabaseClient } from '../nutrition/persistence';
import { createDefaultSleepNeedEstimate, createDemoSleepSessions } from '../sleepRhythm/rhythmInputs';
import { getActiveSleepNeedEstimate, getRecentSleepSessions, type SleepRhythmSupabaseClient } from '../sleepRhythm/persistence';
import { buildPersonalBlueprint } from './personalBlueprint';
import type {
  BaselineProfileRecord,
  ProfileComposerData,
  ProfileComposerInput,
  ProfileScreenModel
} from './profileTypes';

const demoOnboardingResultKey = 'healthi:demo:onboardingResult';
const DAY_MS = 24 * 60 * 60 * 1000;

type QueryResponse<T> = { data: T | null; error: { message?: string } | null };
type BaselineProfileSupabaseClient = {
  from(table: 'baseline_profiles'): {
    select(columns: string): {
      eq(column: string, value: string): {
        order(column: string, options: { ascending: boolean }): {
          limit(count: number): Promise<QueryResponse<BaselineProfileRecord[]>>;
        };
      };
    };
  };
};

function dateKey(value: string): string {
  return value.slice(0, 10);
}

function rangeStart(today: string, days = 30): string {
  const date = new Date(`${dateKey(today)}T12:00:00.000Z`);
  date.setTime(date.getTime() - (days - 1) * DAY_MS);
  return date.toISOString().slice(0, 10);
}

function uniqueDates(values: string[]): string[] {
  return [...new Set(values.map(dateKey).filter(Boolean))];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function baselineFromUnknown(value: unknown): BaselineProfileRecord | null {
  if (!isRecord(value)) return null;
  const training = isRecord(value.training_capacity) ? value.training_capacity : null;
  return {
    preferred_bedtime: asString(value.preferred_bedtime),
    preferred_waketime: asString(value.preferred_waketime),
    hydration_target_ml: asNumber(value.hydration_target_ml),
    food_constraints: asStringArray(value.food_constraints),
    training_capacity: training
      ? { experience: asString(training.experience), weekly_training_days: asString(training.weekly_training_days) }
      : null,
    movement_flags: asStringArray(value.movement_flags),
    posture_flags: asStringArray(value.posture_flags),
    primary_goal: asString(value.primary_goal),
    calibration_status: asString(value.calibration_status),
    generated_at: asString(value.generated_at)
  };
}

function onboardingFromProfile(
  profile: ProfileComposerInput['profile'],
  baseline: BaselineProfileRecord | null
): BaselineOnboardingInput {
  return {
    completed: profile?.onboarding_status === 'completed',
    baseline_profile: baseline,
    reason_codes: profile?.onboarding_status === 'completed' ? ['onboarding_completed'] : ['onboarding_incomplete']
  };
}

function accountLabel(input: ProfileComposerData): ProfileScreenModel['account'] {
  const source = input.source_label ?? 'calibrating';
  if (source === 'demo') {
    return { label: 'Local demo preview', detail: 'Your changes stay on this device. Remote sync is not active.', source_label: 'demo' };
  }
  if (input.profile) {
    return { label: input.email ?? input.profile.display_name ?? 'Signed in', detail: 'Your profile is available on this account. Logged data appears as you add it.', source_label: source === 'logged' ? 'logged' : 'calibrating' };
  }
  return { label: 'Not signed in', detail: 'Complete setup or sign in to save a personal baseline.', source_label: 'calibrating' };
}

export function composeProfileScreenModel(input: ProfileComposerData, loadError = false): ProfileScreenModel {
  const profile = input.profile;
  const baseline = generateBaselineSummary({
    profile,
    onboarding: input.onboarding,
    source_label: input.source_label,
    dataCoverage: {
      recovery_rhythm_days: uniqueDates(input.sleep_dates ?? []).length,
      nourishment_days: uniqueDates(input.nutrition_dates ?? []).length,
      movement_capacity_days: uniqueDates(input.movement_dates ?? []).length,
      mind_life_load_days: uniqueDates(input.schedule_dates ?? []).length,
      readiness_days: 0
    },
    currentSignals: {
      food_pattern_label: input.food_pattern_label,
      movement_readiness_label: input.movement_readiness_label,
      rhythm_confidence: input.rhythm_confidence
    }
  });
  return {
    account: accountLabel(input),
    baseline,
    blueprint: buildPersonalBlueprint({
      today: new Date().toISOString().slice(0, 10),
      foodPattern: input.food_pattern,
      meals: input.recent_meals,
      sleepSessions: input.sleep_sessions,
      sleepNeed: input.sleep_need ?? createDefaultSleepNeedEstimate(),
      preferredBedtime: input.preferred_bedtime ?? input.onboarding?.baseline_profile?.preferred_bedtime,
      movementSessions: input.movement_sessions,
      movementFlags: input.movement_flags ?? input.onboarding?.baseline_profile?.movement_flags,
      postureFlags: input.posture_flags ?? input.onboarding?.baseline_profile?.posture_flags
    }),
    load_error: loadError
  };
}

async function getLatestBaselineProfile(client: BaselineProfileSupabaseClient, userId: string): Promise<BaselineProfileRecord | null> {
  const { data, error } = await client
    .from('baseline_profiles')
    .select('*')
    .eq('user_id', userId)
    .order('generated_at', { ascending: false })
    .limit(1);
  if (error) throw new Error(error.message ?? 'Baseline profile request failed.');
  return data?.[0] ?? null;
}

async function loadDemoModel(input: ProfileComposerInput): Promise<ProfileScreenModel> {
  const today = new Date().toISOString().slice(0, 10);
  const start = rangeStart(today);
  const [savedOnboarding, nutrition, movement, schedule] = await Promise.all([
    AsyncStorage.getItem(demoOnboardingResultKey),
    getLocalDemoNutritionState(),
    getLocalDemoMovementState(),
    getDemoScheduleBlocksForRange(`${start}T00:00:00.000Z`, `${today}T23:59:59.999Z`)
  ]);
  const parsed = savedOnboarding ? JSON.parse(savedOnboarding) as unknown : null;
  const record = isRecord(parsed) ? parsed : null;
  const baseline = baselineFromUnknown(record?.baselineProfile);
  const latestMovement = [...movement.workoutSessions].sort((left, right) => right.logged_at.localeCompare(left.logged_at))[0];
  const sleepSessions = createDemoSleepSessions(today);
  return composeProfileScreenModel({
    profile: input.profile ? { display_name: input.profile.display_name, goal: input.profile.primary_goal ?? baseline?.primary_goal } : null,
    onboarding: {
      ...onboardingFromProfile(input.profile, baseline),
      completed: input.profile?.onboarding_status === 'completed' || Boolean(baseline)
    },
    email: input.email,
    source_label: 'demo',
    nutrition_dates: nutrition.mealLogs.map((meal) => meal.logged_at),
    recent_meals: nutrition.mealLogs,
    food_pattern: nutrition.foodPatternProfile,
    movement_dates: movement.workoutSessions.map((session) => session.session_date),
    movement_sessions: movement.workoutSessions,
    schedule_dates: schedule.map((block) => block.block_date),
    sleep_dates: sleepSessions.map((session) => session.date),
    sleep_sessions: sleepSessions,
    sleep_need: createDefaultSleepNeedEstimate(),
    preferred_bedtime: baseline?.preferred_bedtime,
    movement_flags: baseline?.movement_flags,
    posture_flags: baseline?.posture_flags,
    food_pattern_label: nutrition.foodPatternProfile?.pattern_label,
    movement_readiness_label: latestMovement?.readiness_before,
    rhythm_confidence: 'medium'
  });
}

async function loadRemoteModel(input: ProfileComposerInput): Promise<ProfileScreenModel> {
  const profile = input.profile;
  const userId = profile?.id;
  if (!userId || !input.supabase_client || !profile) {
    return composeProfileScreenModel({
      profile: input.profile ? { display_name: input.profile.display_name, goal: input.profile.primary_goal } : null,
      onboarding: onboardingFromProfile(input.profile, null),
      email: input.email,
      source_label: 'calibrating'
    });
  }
  const today = new Date().toISOString().slice(0, 10);
  const start = rangeStart(today);
  const client = input.supabase_client;
  const [baseline, meals, movement, schedule, sleep, sleepNeed, foodPattern] = await Promise.all([
    getLatestBaselineProfile(client as BaselineProfileSupabaseClient, userId),
    getRecentMealLogs(client as NutritionSupabaseClient, userId, 100),
    getWorkoutSessionsForRange(client as MovementSupabaseClient, userId, start, today, 100),
    getScheduleBlocksForRange(client as DayScheduleBlockSupabaseClient, userId, `${start}T00:00:00.000Z`, `${today}T23:59:59.999Z`, 200),
    getRecentSleepSessions(client as SleepRhythmSupabaseClient, userId, 30),
    getActiveSleepNeedEstimate(client as SleepRhythmSupabaseClient, userId),
    getActiveFoodPatternProfile(client as FoodPersonalizationSupabaseClient, userId)
  ]);
  const latestMovement = [...movement].sort((left, right) => right.logged_at.localeCompare(left.logged_at))[0];
  return composeProfileScreenModel({
    profile: { display_name: profile.display_name, goal: profile.primary_goal ?? baseline?.primary_goal },
    onboarding: onboardingFromProfile(profile, baseline),
    email: input.email,
    source_label: 'logged',
    nutrition_dates: meals.map((meal) => meal.logged_at),
    recent_meals: meals,
    food_pattern: foodPattern,
    movement_dates: movement.map((session) => session.session_date),
    movement_sessions: movement,
    schedule_dates: schedule.map((block) => block.block_date),
    sleep_dates: sleep.map((session) => session.date),
    sleep_sessions: sleep,
    sleep_need: sleepNeed
      ? { minutes: sleepNeed.minutes, confidence: sleepNeed.confidence, basis: sleepNeed.basis, updated_at: sleepNeed.updated_at }
      : createDefaultSleepNeedEstimate(),
    preferred_bedtime: baseline?.preferred_bedtime,
    movement_flags: baseline?.movement_flags,
    posture_flags: baseline?.posture_flags,
    food_pattern_label: foodPattern?.pattern_label,
    movement_readiness_label: latestMovement?.readiness_before,
    rhythm_confidence: sleep.length ? sleep[0]?.source_confidence : undefined
  });
}

export async function loadProfileScreenModel(input: ProfileComposerInput): Promise<ProfileScreenModel> {
  try {
    return input.is_demo_mode ? await loadDemoModel(input) : await loadRemoteModel(input);
  } catch {
    return composeProfileScreenModel({
      profile: input.profile ? { display_name: input.profile.display_name, goal: input.profile.primary_goal } : null,
      onboarding: onboardingFromProfile(input.profile, null),
      email: input.email,
      source_label: 'calibrating'
    }, true);
  }
}
