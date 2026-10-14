import { calculateSleepDebt, type SleepNeedEstimate, type SleepSession } from '../../engines/circadian';
import { calculateMovementSummary } from '../../engines/movement';
import type { FoodPatternProfile, MealLog } from '../../engines/nutrition';
import type { WorkoutSessionRow } from '../movement/movementPersistence';
import { workoutSessionRowToEngineSession } from '../movement/movementPersistence';

export type MacroTendencySlice = {
  nutrient: 'Protein' | 'Carbs' | 'Fat';
  weight: number;
  tendency: 'lower' | 'moderate' | 'higher';
};

export type PersonalBlueprint = {
  nourishment: {
    status: 'ready' | 'calibrating';
    pattern_label: string;
    macro_tendency: MacroTendencySlice[];
    often_logged_meals: string[];
    meal_timing: string[];
    detail: string;
    readiness_note: string;
  };
  sleep: {
    confidence: 'low' | 'medium' | 'high';
    biggest_friction: string[];
    biggest_supporters: string[];
    rhythm_tips: Array<{ title: string; detail: string }>;
    readiness_note: string;
  };
  movement: {
    total_minutes: number;
    average_effort: number | null;
    mobility_recovery_sessions: number;
    consistency_label: string;
    movement_notes: string[];
    mobility_note: string;
    readiness_note: string;
  };
};

function humanize(value: string): string {
  return value
    .replace(/[_-]/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function timeLabel(value: string): string | null {
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  const suffix = hours >= 12 ? 'PM' : 'AM';
  return `${hours % 12 || 12}:${String(minutes).padStart(2, '0')} ${suffix}`;
}

function shiftedTime(value: string, minutesToSubtract: number): string | null {
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(value.trim());
  if (!match) return null;
  const minutes = Number(match[1]) * 60 + Number(match[2]);
  if (minutes > 1439) return null;
  const shifted = (minutes - minutesToSubtract + 1440) % 1440;
  return timeLabel(`${Math.floor(shifted / 60)}:${String(shifted % 60).padStart(2, '0')}`);
}

function macroWeight(tendency: 'lower' | 'moderate' | 'higher'): number {
  return tendency === 'higher' ? 40 : tendency === 'lower' ? 20 : 30;
}

function macroSlices(profile?: FoodPatternProfile | null): MacroTendencySlice[] {
  const tendency = profile?.macro_tendency ?? { protein: 'moderate' as const, carbs: 'moderate' as const, fat: 'moderate' as const };
  return [
    { nutrient: 'Protein', tendency: tendency.protein, weight: macroWeight(tendency.protein) },
    { nutrient: 'Carbs', tendency: tendency.carbs, weight: macroWeight(tendency.carbs) },
    { nutrient: 'Fat', tendency: tendency.fat, weight: macroWeight(tendency.fat) }
  ];
}

function mostLoggedMealNames(meals: MealLog[]): string[] {
  const counts = new Map<string, number>();
  for (const meal of meals) {
    const name = meal.name.trim();
    if (name) counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 3)
    .map(([name]) => name);
}

function nourishmentBlueprint(profile: FoodPatternProfile | null | undefined, meals: MealLog[]): PersonalBlueprint['nourishment'] {
  const status = !profile || profile.pattern_label === 'calibrating' ? 'calibrating' : 'ready';
  const timing = profile
    ? [
        `Breakfast: ${humanize(profile.meal_timing_tendency.breakfast)}`,
        `Meal spacing: ${humanize(profile.meal_timing_tendency.meal_spacing)}`,
        `Late meals: ${humanize(profile.meal_timing_tendency.late_meal_sensitivity)} sensitivity`
      ]
    : ['Meal timing is still calibrating from your answers and logged meals.'];
  return {
    status,
    pattern_label: status === 'ready' ? humanize(profile?.pattern_label ?? '') : 'Food pattern calibrating',
    macro_tendency: macroSlices(profile),
    often_logged_meals: mostLoggedMealNames(meals),
    meal_timing: timing,
    detail: status === 'ready'
      ? 'This is your current food-pattern tendency, not a macro target.'
      : 'Complete the food pattern and log a few meals to make this more personal.',
    readiness_note: 'Logged meal quality and food response contribute to your nourishment signal when available.'
  };
}

function sleepBlueprint(params: {
  today: string;
  sessions: SleepSession[];
  sleepNeed: SleepNeedEstimate;
  preferredBedtime?: string | null;
}): PersonalBlueprint['sleep'] {
  const debt = calculateSleepDebt({ date: params.today, sessions: params.sessions, sleepNeed: params.sleepNeed, rollingWindowDays: 7 });
  const nights = debt.nights;
  const averageMinutes = nights.length
    ? Math.round(nights.reduce((sum, night) => sum + (night.sleep_minutes ?? 0), 0) / nights.length)
    : null;
  const friction: string[] = [];
  const supporters: string[] = [];
  if (!nights.length) {
    friction.push('Sleep context is still calibrating from your first entries.');
  } else {
    if (averageMinutes !== null && averageMinutes < params.sleepNeed.minutes) {
      friction.push('Recent sleep duration sits below your current estimated need.');
    }
    if ((debt.nightly_average_debt_minutes ?? 0) >= 60) {
      friction.push('Recent sleep debt is building across logged nights.');
    }
    if (!friction.length) supporters.push('Your recent sleep duration is staying close to your estimated need.');
    if (nights.length >= 3) supporters.push(`${nights.length} recent nights are giving daywoven usable rhythm context.`);
  }
  const windDown = params.preferredBedtime ? shiftedTime(params.preferredBedtime, 90) : null;
  const caffeineCutoff = params.preferredBedtime ? shiftedTime(params.preferredBedtime, 8 * 60) : null;
  const tips = [
    windDown
      ? { title: 'Wind-down cue', detail: `Start easing the day around ${windDown}, based on your preferred bedtime.` }
      : { title: 'Add your sleep window', detail: 'A bedtime and wake time help daywoven organize more useful rhythm cues.' },
    caffeineCutoff
      ? { title: 'Caffeine boundary', detail: `Consider wrapping caffeine around ${caffeineCutoff} to protect your preferred sleep window.` }
      : { title: 'Keep timing visible', detail: 'Log a few sleep windows so daywoven can make timing suggestions from your pattern.' }
  ];
  return {
    confidence: debt.confidence,
    biggest_friction: friction.length ? friction : ['No strong sleep friction is showing up in your available data.'],
    biggest_supporters: supporters.length ? supporters : ['More logged nights will reveal your strongest sleep supporters.'],
    rhythm_tips: tips,
    readiness_note: 'Sleep duration and recent sleep debt contribute to your recovery rhythm signal.'
  };
}

function movementBlueprint(params: {
  today: string;
  sessions: WorkoutSessionRow[];
  movementFlags?: string[] | null;
  postureFlags?: string[] | null;
}): PersonalBlueprint['movement'] {
  const summary = calculateMovementSummary({ date: params.today, sessions: params.sessions.map(workoutSessionRowToEngineSession) });
  const efforts = params.sessions
    .map((session) => session.perceived_effort)
    .filter((effort): effort is number => typeof effort === 'number');
  const notes = [...(params.movementFlags ?? []), ...(params.postureFlags ?? [])].map(humanize);
  return {
    total_minutes: summary.total_minutes,
    average_effort: efforts.length ? Math.round((efforts.reduce((sum, effort) => sum + effort, 0) / efforts.length) * 10) / 10 : null,
    mobility_recovery_sessions: summary.mobility_recovery_session_count,
    consistency_label: humanize(summary.consistency),
    movement_notes: notes.length ? notes : ['No movement limitation notes have been provided yet.'],
    mobility_note: summary.mobility_recovery_session_count > 0
      ? `${summary.mobility_recovery_session_count} mobility or recovery session${summary.mobility_recovery_session_count === 1 ? '' : 's'} logged this week.`
      : 'Mobility and recovery context will sharpen as you log those sessions.',
    readiness_note: 'Training time, recent effort, and mobility or recovery sessions contribute to movement capacity.'
  };
}

export function buildPersonalBlueprint(input: {
  today: string;
  foodPattern?: FoodPatternProfile | null;
  meals?: MealLog[];
  sleepSessions?: SleepSession[];
  sleepNeed: SleepNeedEstimate;
  preferredBedtime?: string | null;
  movementSessions?: WorkoutSessionRow[];
  movementFlags?: string[] | null;
  postureFlags?: string[] | null;
}): PersonalBlueprint {
  return {
    nourishment: nourishmentBlueprint(input.foodPattern, input.meals ?? []),
    sleep: sleepBlueprint({
      today: input.today,
      sessions: input.sleepSessions ?? [],
      sleepNeed: input.sleepNeed,
      preferredBedtime: input.preferredBedtime
    }),
    movement: movementBlueprint({
      today: input.today,
      sessions: input.movementSessions ?? [],
      movementFlags: input.movementFlags,
      postureFlags: input.postureFlags
    })
  };
}
