import type { SleepSession } from '../../engines/circadian';
import { SESSION_TARGET } from '../../engines/movement/calculateMovementScore';
import type { MovementWorkoutType } from '../../engines/movement/movementTypes';
import type { MealLog, NutritionTargets } from '../../engines/nutrition';
import { localDay } from '../../utils/localDay';
import type { PillarId } from '../../styles/pillarColors';
import { shiftDay } from '../navigation/navigationModel';
import type { DaylightBout } from '../practice/daylightModel';
import type { PracticeSession } from '../practice/practiceModel';
import { formatSleepMinutes, formatSleepTime } from '../sleepRhythm/sleepPresentation';

/**
 * The four "This week" cards on Home: one per tab, each with the tab's headline number on
 * the front and, turned over, the one thing that tab most needs next.
 *
 * Every figure here is counted from what was logged, and says how much was logged. A day
 * with nothing recorded is a gap in the chart, never a zero, because an empty diary is not
 * evidence that nobody ate — the same rule the readiness estimate follows.
 */

export type WeekCardId = 'sleep' | 'diet' | 'move' | 'mood';
export type WeekCardRoute = '/rhythm' | '/food' | '/movement' | '/mood';

export type WeekBar = {
  day: string;
  /** Height as a share of the chart, 0–1, or null for a day with nothing logged. */
  fraction: number | null;
  /** Drawn at full strength when the day met its mark; dimmer when it was logged but short. */
  strong: boolean;
};

export type WeekCard = {
  id: WeekCardId;
  pillar: PillarId;
  title: string;
  front: { value: string; label: string; caption: string; bars: WeekBar[] };
  back: {
    headline: string;
    detail: string;
    actionLabel: string;
    route: WeekCardRoute;
    /** When set, the action opens that tab's logger rather than the tab itself. */
    quickEntry?: 'sleep' | 'food' | 'workout';
  };
};

/** The seven days ending today, oldest first, so the chart reads left to right. */
export function lastSevenDays(today: string): string[] {
  return Array.from({ length: 7 }, (_, index) => shiftDay(today, index - 6));
}

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;
const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;

/* Sleep times are stored as wall-clock values on a UTC axis, the way the Sleep tab reads them. */
function wakeMinute(session: SleepSession): number | null {
  if (!session.sleep_end_at) return null;
  const value = new Date(session.sleep_end_at);
  return Number.isNaN(value.getTime()) ? null : value.getUTCHours() * 60 + value.getUTCMinutes();
}

export function sleepWeekCard(input: {
  today: string;
  sessions: SleepSession[];
  needMinutes: number;
  debtMinutes: number | null;
  targetBedtime: string | null;
}): WeekCard {
  const days = lastSevenDays(input.today);
  /* A night belongs to the morning it ends on; where two share a day, the longer one stands. */
  const nights = days.map((day) => input.sessions
    .filter((session) => session.date.slice(0, 10) === day && typeof session.duration_minutes === 'number' && session.duration_minutes > 0)
    .sort((left, right) => (right.duration_minutes ?? 0) - (left.duration_minutes ?? 0))[0] ?? null);
  const logged = nights.filter((night): night is SleepSession => night !== null);
  const average = logged.length ? mean(logged.map((night) => night.duration_minutes ?? 0)) : null;
  const debt = input.debtMinutes !== null && logged.length ? Math.max(0, input.debtMinutes) : null;
  const scale = Math.max(input.needMinutes, ...logged.map((night) => night.duration_minutes ?? 0)) || 1;

  const front = {
    value: average === null ? '—' : formatSleepMinutes(average),
    label: logged.length ? `avg sleep · ${logged.length} of 7 nights` : 'avg sleep',
    caption: debt === null ? 'No nights logged yet' : debt < 15 ? 'No sleep debt' : `Sleep debt ${formatSleepMinutes(debt)}`,
    bars: nights.map((night, index) => ({
      day: days[index]!,
      fraction: night ? Math.min(1, (night.duration_minutes ?? 0) / scale) : null,
      strong: night !== null && (night.duration_minutes ?? 0) >= input.needMinutes - 30
    }))
  };

  const wakes = logged.map(wakeMinute).filter((minute): minute is number => minute !== null);
  const wakeSpread = wakes.length >= 3 ? Math.max(...wakes) - Math.min(...wakes) : 0;
  const need = formatSleepMinutes(input.needMinutes);
  const bedtime = input.targetBedtime ? formatSleepTime(input.targetBedtime) : null;

  const back: WeekCard['back'] = logged.length === 0
    ? { headline: 'Log a night', detail: 'Your average and sleep debt start with the first night you add.', actionLabel: 'Add sleep', route: '/rhythm', quickEntry: 'sleep' }
    : nights[6] === null
      ? { headline: 'Add last night', detail: `This week’s average uses ${plural(logged.length, 'night')}. Last night isn’t in it yet.`, actionLabel: 'Add sleep', route: '/rhythm', quickEntry: 'sleep' }
      : debt !== null && debt >= 60
        ? { headline: 'Ease the sleep debt', detail: `About ${formatSleepMinutes(debt)} under your ${need} need this week. ${bedtime && bedtime !== '—' ? `Try bed around ${bedtime}.` : 'An earlier night helps most.'}`, actionLabel: 'Plan tonight', route: '/rhythm' }
        : wakeSpread >= 60
          ? { headline: 'Steady your wake time', detail: `Your wake time moved by ${formatSleepMinutes(wakeSpread)} this week. A steady morning helps more than a lie-in.`, actionLabel: 'Open Sleep', route: '/rhythm' }
          : { headline: 'Keep this rhythm', detail: `Averaging ${formatSleepMinutes(average ?? 0)} against a ${need} need, with a steady wake time.`, actionLabel: 'Open Sleep', route: '/rhythm' };

  return { id: 'sleep', pillar: 'recovery_rhythm', title: 'Sleep', front, back };
}

type DietMetric = 'calories' | 'protein' | 'carbs' | 'fat';
const DIET_METRICS: { id: DietMetric; name: string; unit: string; target: keyof NutritionTargets; eaten: 'calories' | 'protein_g' | 'carbs_g' | 'fat_g' }[] = [
  { id: 'protein', name: 'Protein', unit: 'g', target: 'protein_g_target', eaten: 'protein_g' },
  { id: 'calories', name: 'Calories', unit: 'kcal', target: 'calories_target', eaten: 'calories' },
  { id: 'carbs', name: 'Carbs', unit: 'g', target: 'carbs_g_target', eaten: 'carbs_g' },
  { id: 'fat', name: 'Fat', unit: 'g', target: 'fat_g_target', eaten: 'fat_g' }
];

/**
 * Whether a day's total counts as landing on a target.
 *
 * Calories get the tighter band because the target is the one people set deliberately;
 * macros get more room because single foods swing them. Protein is a floor rather than a
 * band — eating more than the target is not a miss worth pointing at.
 */
export function dietOnTarget(metric: DietMetric, eaten: number, target: number): boolean {
  if (metric === 'protein') return eaten >= target * 0.85;
  const band = metric === 'calories' ? 0.1 : 0.15;
  return Math.abs(eaten - target) <= target * band;
}

export function dietWeekCard(input: { today: string; meals: Pick<MealLog, 'logged_at' | 'calories' | 'protein_g' | 'carbs_g' | 'fat_g'>[]; targets: NutritionTargets | null }): WeekCard {
  const days = lastSevenDays(input.today);
  const byDay = days.map((day) => input.meals.filter((meal) => localDay(meal.logged_at) === day));
  const total = (meals: typeof input.meals, key: 'calories' | 'protein_g' | 'carbs_g' | 'fat_g') => {
    const values = meals.map((meal) => meal[key]).filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
    return values.length ? values.reduce((sum, value) => sum + value, 0) : null;
  };
  const loggedDays = byDay.filter((meals) => meals.length > 0).length;
  const metrics = DIET_METRICS.filter((metric) => {
    const target = input.targets?.[metric.target];
    return typeof target === 'number' && target > 0;
  });
  const calorieTarget = input.targets?.calories_target ?? null;

  if (!metrics.length) {
    const calories = byDay.map((meals) => total(meals, 'calories'));
    const scale = Math.max(1, ...calories.map((value) => value ?? 0));
    return {
      id: 'diet', pillar: 'nourishment', title: 'Diet',
      front: {
        value: `${loggedDays} of 7`,
        label: 'days logged',
        caption: 'Set goals to see targets hit',
        bars: days.map((day, index) => ({ day, fraction: byDay[index]!.length ? Math.min(1, (calories[index] ?? 0) / scale) : null, strong: false }))
      },
      back: loggedDays === 0
        ? { headline: 'Log a meal', detail: 'This card fills in as you log. Setting goals adds the days your calories and macros land.', actionLabel: 'Log food', route: '/food', quickEntry: 'food' }
        : { headline: 'Set your goals', detail: 'With goals in place, this shows the days your calories and macros landed on target.', actionLabel: 'Set goals', route: '/food' }
    };
  }

  /*
   * Only finished days with a measured total for every targeted metric can hit or miss.
   * Today is still being eaten, so a lunchtime total is not a shortfall; it shows in the
   * chart as it fills but is only judged once it is over.
   */
  const measured = byDay.map((meals, index) => {
    if (!meals.length || days[index] === input.today) return null;
    const totals = metrics.map((metric) => ({ metric, eaten: total(meals, metric.eaten), target: input.targets![metric.target] as number }));
    return totals.every((row) => row.eaten !== null) ? totals as { metric: typeof metrics[number]; eaten: number; target: number }[] : null;
  });
  const measuredDays = measured.filter((day) => day !== null);
  const hit = measured.map((day) => day !== null && day.every((row) => dietOnTarget(row.metric.id, row.eaten, row.target)));
  const hitDays = hit.filter(Boolean).length;

  const bars = days.map((day, index) => {
    const row = measured[index];
    const calories = row?.find((entry) => entry.metric.id === 'calories')?.eaten ?? total(byDay[index]!, 'calories');
    const fraction = !byDay[index]!.length ? null : calorieTarget ? Math.min(1, (calories ?? 0) / (calorieTarget * 1.25)) : 0.6;
    return { day, fraction, strong: hit[index]! };
  });

  const misses = metrics.map((metric) => {
    const rows = measuredDays.map((day) => day.find((entry) => entry.metric.id === metric.id)!);
    const missed = rows.filter((row) => !dietOnTarget(metric.id, row.eaten, row.target));
    const under = missed.filter((row) => row.eaten < row.target).length;
    return { metric, missed: missed.length, under: under >= missed.length - under, average: rows.length ? mean(rows.map((row) => row.eaten)) : 0, target: rows[0]?.target ?? 0 };
  });
  const worst = [...misses].sort((left, right) => right.missed - left.missed)[0];
  const round = (value: number, unit: string) => unit === 'kcal' ? Math.round(value / 10) * 10 : Math.round(value);

  const pastLogged = byDay.filter((meals, index) => meals.length > 0 && days[index] !== input.today).length;
  const back: WeekCard['back'] = measuredDays.length === 0
    ? loggedDays === 0
      ? { headline: 'Log a meal', detail: 'Targets hit starts counting from your first full logged day.', actionLabel: 'Log food', route: '/food', quickEntry: 'food' }
      : pastLogged === 0
        ? { headline: 'Today counts tonight', detail: 'A day is checked against your goals once it’s over. Keep logging today.', actionLabel: 'Log food', route: '/food', quickEntry: 'food' }
        : { headline: 'Add amounts', detail: 'Meals are logged without the amounts needed to check them against your goals.', actionLabel: 'Log food', route: '/food', quickEntry: 'food' }
    : !worst || worst.missed === 0
      ? { headline: 'Every logged day landed', detail: `Calories and macros were on target on all ${plural(measuredDays.length, 'logged day')}.`, actionLabel: 'Open Diet', route: '/food' }
      : {
          headline: worst.metric.name,
          detail: `${worst.under ? 'Under' : 'Over'} on ${worst.missed} of ${plural(measuredDays.length, 'logged day')} · averaging ${round(worst.average, worst.metric.unit).toLocaleString()} of ${round(worst.target, worst.metric.unit).toLocaleString()} ${worst.metric.unit}.`,
          actionLabel: 'Open Diet',
          route: '/food'
        };

  return {
    id: 'diet', pillar: 'nourishment', title: 'Diet',
    front: {
      value: measuredDays.length ? `${hitDays} of ${measuredDays.length}` : '—',
      label: 'days calories + macros hit',
      caption: loggedDays ? `${plural(loggedDays, 'day')} logged this week` : 'Nothing logged this week',
      bars
    },
    back
  };
}

export function moveWeekCard(input: { today: string; sessions: { session_date: string; workout_type: MovementWorkoutType; duration_minutes: number | null }[] }): WeekCard {
  const days = lastSevenDays(input.today);
  const week = input.sessions.filter((session) => days.includes(session.session_date.slice(0, 10)));
  const minutesByDay = days.map((day) => {
    const sessions = week.filter((session) => session.session_date.slice(0, 10) === day);
    return sessions.length ? sessions.reduce((sum, session) => sum + Math.max(0, session.duration_minutes ?? 0), 0) : null;
  });
  const scale = Math.max(45, ...minutesByDay.map((value) => value ?? 0));
  const totalMinutes = week.reduce((sum, session) => sum + Math.max(0, session.duration_minutes ?? 0), 0);
  const count = week.length;
  const has = (...types: MovementWorkoutType[]) => week.some((session) => types.includes(session.workout_type));

  const back: WeekCard['back'] = count === 0
    ? { headline: 'Start the week', detail: 'Any session counts, including a walk. The first one starts this chart.', actionLabel: 'Log one', route: '/movement', quickEntry: 'workout' }
    : !has('strength', 'mixed')
      ? { headline: 'Add strength', detail: `${plural(count, 'session')} this week, none of them strength. A short one would round the week out.`, actionLabel: 'Open Move', route: '/movement' }
      : !has('mobility', 'recovery')
        ? { headline: 'Add mobility', detail: 'No mobility or recovery this week. Ten easy minutes balances the harder days.', actionLabel: 'Open Move', route: '/movement' }
        : count < SESSION_TARGET
          ? { headline: `${SESSION_TARGET - count} more ${SESSION_TARGET - count === 1 ? 'session' : 'sessions'}`, detail: `${count} of ${SESSION_TARGET} so far, with strength and mobility both in.`, actionLabel: 'Log one', route: '/movement', quickEntry: 'workout' }
          : { headline: 'A balanced week', detail: 'Strength, mobility and enough sessions. An easy day is part of the plan too.', actionLabel: 'Open Move', route: '/movement' };

  return {
    id: 'move', pillar: 'movement_capacity', title: 'Move',
    front: {
      value: `${count} of ${SESSION_TARGET}`,
      label: 'sessions this week',
      caption: count ? `${totalMinutes} min in total` : 'No sessions yet',
      bars: minutesByDay.map((minutes, index) => ({ day: days[index]!, fraction: minutes === null ? null : Math.max(0.12, minutes / scale), strong: minutes !== null }))
    },
    back
  };
}

const MORNING_WINDOWS = new Set<DaylightBout['window']>(['early', 'morning']);

export function moodWeekCard(input: { today: string; practice: PracticeSession[]; daylight: DaylightBout[] }): WeekCard {
  const days = lastSevenDays(input.today);
  const practice = input.practice.filter((session) => days.includes(session.date));
  const secondsByDay = days.map((day) => {
    const sessions = practice.filter((session) => session.date === day);
    return sessions.length ? sessions.reduce((sum, session) => sum + session.seconds, 0) : null;
  });
  const scale = Math.max(300, ...secondsByDay.map((value) => value ?? 0));
  const minutes = Math.round(practice.reduce((sum, session) => sum + session.seconds, 0) / 60);
  const resets = practice.length;
  const morningDays = days.filter((day) => input.daylight.some((bout) => bout.date === day && MORNING_WINDOWS.has(bout.window) && bout.minutes > 0)).length;
  const anyDaylight = input.daylight.some((bout) => days.includes(bout.date));

  const back: WeekCard['back'] = resets === 0 && !anyDaylight
    ? { headline: 'Start with one minute', detail: 'Nothing logged this week. One minute of paced breathing is enough to begin.', actionLabel: 'Open Mood', route: '/mood' }
    : morningDays < 4
      ? { headline: 'Morning light', detail: `Outside before noon on ${morningDays} of 7 days. Ten morning minutes do the most for sleep timing.`, actionLabel: 'Open Mood', route: '/mood' }
      : resets < 3
        ? { headline: 'A daily reset', detail: `${plural(resets, 'breathing reset')} this week. A minute a day keeps the habit easy to reach for.`, actionLabel: 'Open Mood', route: '/mood' }
        : { headline: 'Keep both going', detail: `Morning light on ${morningDays} of 7 days and ${plural(resets, 'reset')}. That’s a steady week.`, actionLabel: 'Open Mood', route: '/mood' };

  return {
    id: 'mood', pillar: 'mind_life_load', title: 'Mood',
    front: {
      value: String(resets),
      label: resets === 1 ? 'breathing reset' : 'breathing resets',
      caption: resets ? `${minutes < 1 ? 'Under a minute' : `${minutes} min`} this week` : 'None yet this week',
      bars: secondsByDay.map((seconds, index) => ({ day: days[index]!, fraction: seconds === null ? null : Math.max(0.12, seconds / scale), strong: seconds !== null }))
    },
    back
  };
}
