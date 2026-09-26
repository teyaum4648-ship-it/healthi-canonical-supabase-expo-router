import type { SleepSession } from '../../engines/circadian';
import type { WellnessZone } from '../../engines/biomarkers';
import { shiftDay } from '../../engines/biomarkers';
import type { DataConfidence } from '../../types/common';

/**
 * The Home dashboard's two single-glance readings, readiness and last night's sleep, as a
 * zone, a word and one line. They restate what the engines already decided; nothing here
 * scores anything new.
 */

/** Readiness bands on the 0–100 estimate. 70 is where every day starts, so it sits in the middle band. */
export const READINESS_ZONE_CUTS = { optimal: 75, warning: 55 } as const;

export function readinessZone(score: number | null, safetyActive: boolean): WellnessZone {
  /* Safety guidance outranks any colour a number would earn. */
  if (score === null || safetyActive) return 'neutral';
  if (score >= READINESS_ZONE_CUTS.optimal) return 'optimal';
  if (score >= READINESS_ZONE_CUTS.warning) return 'warning';
  return 'critical';
}

const readinessWords: Record<WellnessZone, string> = {
  optimal: 'Optimal',
  warning: 'Steady',
  critical: 'Low',
  neutral: 'No estimate'
};

const readinessLines: Record<Exclude<WellnessZone, 'neutral'>, string> = {
  optimal: 'Your recovery looks strong. A good day for your harder session.',
  warning: 'You’re steady, not fully charged. Keep today’s effort moderate.',
  critical: 'Your body may need a lighter day. Favour recovery and an early night.'
};

/**
 * The word for the zone and the line under the ring. Without a number, or while safety
 * guidance is active, the engine's own sentence is used unchanged.
 */
export function readinessHeadline(zone: WellnessZone, engineLine: string): { word: string; insight: string } {
  return { word: readinessWords[zone], insight: zone === 'neutral' ? engineLine : readinessLines[zone] };
}

export type SleepGlance = {
  lastNight: { minutes: number; date: string } | null;
  needMinutes: number;
  /** Last night as a share of the estimated need, 0–1+. */
  fraction: number | null;
  zone: WellnessZone;
  label: string;
  averageMinutes: number | null;
  nightsLogged: number;
  series: { date: string; minutes: number | null }[];
  confidence: DataConfidence;
  reason_codes: string[];
};

function asleepMinutes(session: SleepSession): number | null {
  if (typeof session.duration_minutes === 'number' && Number.isFinite(session.duration_minutes)) return session.duration_minutes;
  if (!session.sleep_start_at || !session.sleep_end_at) return null;
  const minutes = (Date.parse(session.sleep_end_at) - Date.parse(session.sleep_start_at)) / 60000;
  return Number.isFinite(minutes) && minutes > 0 ? Math.round(minutes) : null;
}

/**
 * Last night against the sleep-need estimate. A night is dated by the morning it ends on,
 * so last night is the session dated today. A missing night is shown as missing, never as
 * zero hours.
 */
export function sleepGlance(input: { sessions: SleepSession[]; today: string; needMinutes: number; days?: number }): SleepGlance {
  const days = input.days ?? 7;
  const byDate = new Map<string, number>();
  for (const session of input.sessions) {
    const minutes = asleepMinutes(session);
    if (minutes !== null) byDate.set(session.date.slice(0, 10), minutes);
  }
  const series = Array.from({ length: days }, (_, index) => {
    const date = shiftDay(input.today, index - (days - 1));
    return { date, minutes: byDate.get(date) ?? null };
  });
  const logged = series.filter((night): night is { date: string; minutes: number } => night.minutes !== null);
  const tonight = byDate.get(input.today);
  const averageMinutes = logged.length ? Math.round(logged.reduce((sum, night) => sum + night.minutes, 0) / logged.length) : null;
  const base = { needMinutes: input.needMinutes, averageMinutes, nightsLogged: logged.length, series };

  if (tonight === undefined) {
    return {
      ...base, lastNight: null, fraction: null, zone: 'neutral', label: 'Not logged',
      confidence: 'low', reason_codes: ['sleep_last_night_missing']
    };
  }
  const fraction = input.needMinutes > 0 ? tonight / input.needMinutes : null;
  const zone: WellnessZone = fraction === null ? 'neutral' : fraction >= 0.95 ? 'optimal' : fraction >= 0.8 ? 'warning' : 'critical';
  const label = zone === 'optimal' ? 'Met your need' : zone === 'warning' ? 'A little short' : zone === 'critical' ? 'Well short' : 'Logged';
  return {
    ...base,
    lastNight: { minutes: tonight, date: input.today },
    fraction,
    zone,
    label,
    confidence: logged.length >= 5 ? 'high' : logged.length >= 3 ? 'medium' : 'low',
    reason_codes: [`sleep_${zone === 'optimal' ? 'met_need' : zone === 'warning' ? 'slightly_short' : zone === 'critical' ? 'well_short' : 'logged'}`]
  };
}

export function formatHoursMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = Math.round(minutes % 60);
  return hours ? `${hours}h ${String(rest).padStart(2, '0')}m` : `${rest}m`;
}
