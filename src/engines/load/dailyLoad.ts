import type { DataConfidence } from '../../types/common';
import { shiftDay, type WellnessZone } from '../biomarkers';

/**
 * How much the day's training asked of the body, from what was logged.
 *
 * A session's load is its minutes multiplied by the effort the person gave it on the 1–10
 * scale (session effort × duration, a common coaching measure). Nothing is inferred from
 * heart rate, because Healthi has none. A session logged without an effort rating is not
 * given a guessed one: it is left out of the number and lowers confidence instead.
 */
export type LoadSession = {
  session_date: string;
  duration_minutes: number | null;
  perceived_effort: number | null;
};

export type LoadBand = 'rest' | 'light' | 'moderate' | 'heavy' | 'very_heavy';

/** Upper bounds of each band, in effort-minutes. */
export const LOAD_BANDS = { light: 300, moderate: 600, heavy: 900 } as const;

const bandLabel: Record<LoadBand, string> = {
  rest: 'Rest day',
  light: 'Light',
  moderate: 'Moderate',
  heavy: 'Heavy',
  very_heavy: 'Very heavy'
};

const bandZone: Record<LoadBand, WellnessZone> = {
  rest: 'neutral',
  light: 'optimal',
  moderate: 'optimal',
  heavy: 'warning',
  very_heavy: 'critical'
};

const bandInsight: Record<LoadBand, string> = {
  rest: 'No training logged today. Rest counts too.',
  light: 'A light day of training so far.',
  moderate: 'A solid, manageable day of training.',
  heavy: 'A heavy day. Food, water and sleep tonight help you absorb it.',
  very_heavy: 'A very big day. Recovery tonight matters more than usual.'
};

/** Effort × minutes, or null when either is missing or outside the scale. */
export function sessionLoad(session: LoadSession): number | null {
  const minutes = session.duration_minutes;
  const effort = session.perceived_effort;
  if (minutes == null || effort == null || !Number.isFinite(minutes) || !Number.isFinite(effort)) return null;
  if (minutes <= 0 || effort < 1 || effort > 10) return null;
  return Math.round(minutes * effort);
}

export function loadBand(load: number): LoadBand {
  if (load <= 0) return 'rest';
  if (load < LOAD_BANDS.light) return 'light';
  if (load < LOAD_BANDS.moderate) return 'moderate';
  if (load < LOAD_BANDS.heavy) return 'heavy';
  return 'very_heavy';
}

export type LoadSummary = {
  today: { load: number; sessions: number; unrated: number };
  band: LoadBand;
  label: string;
  zone: WellnessZone;
  insight: string;
  series: { date: string; load: number }[];
  weekTotal: number;
  activeDays: number;
  confidence: DataConfidence;
  reason_codes: string[];
};

export function summarizeLoad(sessions: LoadSession[], today: string, days = 7): LoadSummary {
  const dates = Array.from({ length: days }, (_, index) => shiftDay(today, index - (days - 1)));
  const inWindow = sessions.filter((session) => dates.includes(session.session_date.slice(0, 10)));
  const series = dates.map((date) => ({
    date,
    load: inWindow
      .filter((session) => session.session_date.slice(0, 10) === date)
      .reduce((sum, session) => sum + (sessionLoad(session) ?? 0), 0)
  }));
  const todays = inWindow.filter((session) => session.session_date.slice(0, 10) === today);
  const unrated = todays.filter((session) => sessionLoad(session) === null).length;
  const load = series[series.length - 1]!.load;
  const band = loadBand(load);
  const reasons = [`load_${band}`];
  if (unrated) reasons.push('load_session_without_effort');
  const unratedWeek = inWindow.filter((session) => sessionLoad(session) === null).length;
  const confidence: DataConfidence = unrated ? 'low' : unratedWeek ? 'medium' : 'high';
  const insight = unrated
    ? `${bandInsight[band]} ${unrated === 1 ? 'One session has' : `${unrated} sessions have`} no effort rating, so ${unrated === 1 ? 'it isn’t' : 'they aren’t'} counted.`
    : bandInsight[band];

  return {
    today: { load, sessions: todays.length, unrated },
    band,
    label: bandLabel[band],
    zone: bandZone[band],
    insight,
    series,
    weekTotal: series.reduce((sum, day) => sum + day.load, 0),
    activeDays: series.filter((day) => day.load > 0).length,
    confidence,
    reason_codes: reasons
  };
}
