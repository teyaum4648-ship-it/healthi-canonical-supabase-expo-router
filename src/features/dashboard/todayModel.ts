import type { CircadianBriefing } from '../../engines/circadian';
import { formatSleepTime } from '../sleepRhythm/sleepPresentation';
import type { ReadinessHistoryEntry } from '../trends/readinessHistoryStore';

/**
 * The small calculations behind the Today screen's layout: the week strip, today against
 * the person's own recent days, and the energy card's line and curve. Everything is read
 * from data the screen already has; nothing here estimates a new number.
 */

function shiftDay(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function weekdayLetter(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'narrow', timeZone: 'UTC' });
}

export type ReadinessWeekDay = { date: string; letter: string; fraction: number | null; today: boolean };

/**
 * The seven days ending today, oldest first. A day with no recorded estimate is an empty
 * ring, never a low one. Today's ring uses the number on screen rather than the stored
 * one, so the strip and the dial cannot disagree.
 */
export function readinessWeek(history: ReadinessHistoryEntry[], today: string, todayScore: number | null): ReadinessWeekDay[] {
  return Array.from({ length: 7 }, (_, index) => {
    const date = shiftDay(today, index - 6);
    const isToday = date === today;
    const stored = history.find((entry) => entry.date === date)?.score ?? null;
    const score = isToday ? todayScore : stored;
    return { date, letter: weekdayLetter(date), fraction: score === null ? null : Math.max(0, Math.min(1, score / 100)), today: isToday };
  });
}

export type ReadinessTrend = { text: string; direction: 'up' | 'down' | 'flat'; baseline: number; days: number };

/** Days of history needed before a personal baseline is worth showing. */
export const TREND_MIN_DAYS = 3;

/**
 * Today against the average of the person's own earlier days in the window. Today is left
 * out of its own baseline. With too few days there is no trend line at all rather than a
 * comparison against a handful of readings.
 */
export function readinessTrend(score: number | null, history: ReadinessHistoryEntry[], today: string, windowDays = 14): ReadinessTrend | null {
  if (score === null) return null;
  const start = shiftDay(today, -windowDays);
  const prior = history.filter((entry) => entry.date >= start && entry.date < today);
  if (prior.length < TREND_MIN_DAYS) return null;
  const baseline = Math.round(prior.reduce((sum, entry) => sum + entry.score, 0) / prior.length);
  const delta = score - baseline;
  const window = `${windowDays}-day baseline`;
  if (delta === 0) return { text: `In line with your ${window}`, direction: 'flat', baseline, days: prior.length };
  return {
    text: `${Math.abs(delta)} ${delta > 0 ? 'above' : 'below'} your ${window}`,
    direction: delta > 0 ? 'up' : 'down',
    baseline,
    days: prior.length
  };
}

/** The readings for a chart window, oldest first, with a null for each day not recorded. */
export function readinessSeries(history: ReadinessHistoryEntry[], today: string, todayScore: number | null, days: number): { date: string; score: number | null }[] {
  return Array.from({ length: days }, (_, index) => {
    const date = shiftDay(today, index - (days - 1));
    if (date === today) return { date, score: todayScore };
    return { date, score: history.find((entry) => entry.date === date)?.score ?? null };
  });
}

export type EnergyCardModel = {
  title: string;
  subtitle: string;
  points: number[];
  markerIndex: number | undefined;
  startLabel: string;
  endLabel: string;
};

function minutesBetween(fromIso: string, toIso: string): number {
  return Math.round((Date.parse(toIso) - Date.parse(fromIso)) / 60000);
}

function durationLabel(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest}m`;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

/**
 * The energy card on Today: the next turn in the curve as a title, where the day is now
 * as a subtitle, and the curve itself sampled down for a small chart. Null when there is
 * no curve yet, so the card can ask for last night instead of drawing a guess.
 */
export function energyCardModel(briefing: CircadianBriefing, now: string, phaseLabel: string): EnergyCardModel | null {
  const curve = briefing.energy_curve;
  if (curve.length < 2) return null;
  const step = Math.max(1, Math.floor(curve.length / 24));
  const sampled = curve.filter((_, index) => index % step === 0);
  const max = Math.max(...sampled.map((point) => point.estimated_energy), 1);
  const points = sampled.map((point) => point.estimated_energy / max);
  const nowMs = Date.parse(now);
  let markerIndex: number | undefined;
  let best = Number.POSITIVE_INFINITY;
  sampled.forEach((point, index) => {
    const gap = Math.abs(Date.parse(point.time) - nowMs);
    if (gap < best) { best = gap; markerIndex = index; }
  });
  const first = Date.parse(sampled[0]!.time);
  const last = Date.parse(sampled[sampled.length - 1]!.time);
  if (nowMs < first || nowMs > last) markerIndex = undefined;

  const upcoming = [...briefing.energy_extrema]
    .filter((extreme) => Date.parse(extreme.time) > nowMs)
    .sort((left, right) => left.time.localeCompare(right.time))[0];
  const title = upcoming
    ? `${upcoming.type === 'low' ? 'Dip' : 'Peak'} expected around ${formatSleepTime(upcoming.time)}`
    : briefing.target_bedtime
      ? `Winding down toward ${formatSleepTime(briefing.target_bedtime)}`
      : 'Easing toward evening';
  const subtitle = upcoming
    ? `${phaseLabel} now. Next shift in ${durationLabel(Math.max(0, minutesBetween(now, upcoming.time)))}.`
    : `${phaseLabel} now.`;

  return {
    title,
    subtitle,
    points,
    markerIndex,
    startLabel: formatSleepTime(sampled[0]!.time),
    endLabel: formatSleepTime(sampled[sampled.length - 1]!.time)
  };
}

/** "7h 10m" for a number of minutes, or a dash when there is none. */
export function hoursAndMinutes(minutes: number | null | undefined): { value: string; unit?: string } {
  if (minutes === null || minutes === undefined || !Number.isFinite(minutes)) return { value: '—' };
  const rounded = Math.round(minutes);
  return { value: `${Math.floor(rounded / 60)}h ${String(rounded % 60).padStart(2, '0')}m` };
}
