import type { LoadPoints } from './loadCheckItems';
import type { ObservedLoadAnswers } from './scoreLoadCheck';

/**
 * The load-check questions the app can answer from what has been logged.
 *
 * A frequency is exactly what a log measures better than a memory, so these are taken off
 * the person's hands once there is enough to go on, and the basis is written out so they
 * can see where an answer came from. Too little logging leaves the question to them.
 */

type Night = { date: string; sleep_start_at?: string | null };
type Meal = { logged_at: string };
type Drink = { date: string };
type Morning = { date: string; morningRestedness?: number | null };

const WINDOW_DAYS = 14;
const MIN_NIGHTS = 7;
const MIN_DAYS = 5;

function dayNumber(date: string): number {
  const [year, month, day] = date.slice(0, 10).split('-').map(Number);
  return Date.UTC(year!, month! - 1, day!) / 86_400_000;
}

function inWindow(date: string, today: string): boolean {
  const age = dayNumber(today) - dayNumber(date);
  return age >= 0 && age < WINDOW_DAYS;
}

/** Sleep times are wall-clock times held on the UTC axis, so they are read in UTC. */
function wallClockMinute(iso: string): number | null {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date.getUTCHours() * 60 + date.getUTCMinutes();
}

function localDayKey(iso: string): string {
  const date = new Date(iso);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** A share of days or nights, as the four answers the questions offer. */
function fromShare(share: number): LoadPoints {
  if (share < 0.15) return 0;
  if (share < 0.4) return 1;
  if (share < 0.7) return 2;
  return 3;
}

export function observeLoadCheck(input: {
  today: string;
  sleepSessions?: readonly Night[];
  meals?: readonly Meal[];
  caffeine?: readonly Drink[];
  mornings?: readonly Morning[];
}): ObservedLoadAnswers {
  const observed: ObservedLoadAnswers = {};

  const nights = [...new Map((input.sleepSessions ?? [])
    .filter((night) => night.sleep_start_at && inWindow(night.date, input.today))
    .map((night) => [night.date.slice(0, 10), night] as const)).values()]
    .sort((a, b) => a.date.localeCompare(b.date));
  const starts = nights
    .map((night) => ({ date: night.date.slice(0, 10), minute: wallClockMinute(night.sleep_start_at!) }))
    .filter((night): night is { date: string; minute: number } => night.minute !== null);

  if (starts.length >= MIN_NIGHTS) {
    // After 11 p.m., or after midnight but before 5 a.m.
    const late = starts.filter((night) => night.minute >= 23 * 60 || night.minute < 5 * 60).length;
    observed.r_late = {
      points: fromShare(late / starts.length),
      basis: `From your sleep log: ${late} of ${starts.length} nights started after 11 p.m.`
    };
  }

  const pairs = starts.slice(1).map((night, index) => ({ previous: starts[index]!, night }))
    .filter(({ previous, night }) => dayNumber(night.date) - dayNumber(previous.date) === 1);
  if (pairs.length >= MIN_NIGHTS - 1) {
    const shifted = pairs.filter(({ previous, night }) => {
      const difference = Math.abs(night.minute - previous.minute) % 1440;
      return Math.min(difference, 1440 - difference) > 60;
    }).length;
    observed.r_irregular = {
      points: fromShare(shifted / pairs.length),
      basis: `From your sleep log: bedtime moved more than an hour on ${shifted} of ${pairs.length} nights.`
    };
  }

  const mornings = (input.mornings ?? []).filter((row) => inWindow(row.date, input.today) && typeof row.morningRestedness === 'number');
  if (mornings.length >= MIN_DAYS) {
    const tired = mornings.filter((row) => (row.morningRestedness as number) <= 2).length;
    observed.r_unrested = {
      points: fromShare(tired / mornings.length),
      basis: `From your morning check-ins: tired on ${tired} of ${mornings.length} mornings.`
    };
  }

  const firstMeals = new Map<string, number>();
  for (const meal of input.meals ?? []) {
    const day = localDayKey(meal.logged_at);
    if (!inWindow(day, input.today)) continue;
    const at = new Date(meal.logged_at);
    const minute = at.getHours() * 60 + at.getMinutes();
    firstMeals.set(day, Math.min(firstMeals.get(day) ?? Infinity, minute));
  }
  if (firstMeals.size >= MIN_DAYS) {
    const late = [...firstMeals.values()].filter((minute) => minute >= 11 * 60).length;
    observed.t_late_first = {
      points: fromShare(late / firstMeals.size),
      basis: `From your meal log: first meal after 11 a.m. on ${late} of ${firstMeals.size} days.`
    };
  }

  const drinksByDay = new Map<string, number>();
  for (const drink of input.caffeine ?? []) {
    if (inWindow(drink.date, input.today)) drinksByDay.set(drink.date, (drinksByDay.get(drink.date) ?? 0) + 1);
  }
  if (drinksByDay.size >= MIN_DAYS) {
    const average = [...drinksByDay.values()].reduce((sum, count) => sum + count, 0) / drinksByDay.size;
    const points: LoadPoints = average <= 1.5 ? 0 : average <= 2.5 ? 1 : average <= 3.5 ? 2 : 3;
    observed.t_caffeine = {
      points,
      basis: `From your caffeine log: about ${Math.round(average * 10) / 10} drinks a day on the ${drinksByDay.size} days you logged one.`
    };
  }

  return observed;
}
