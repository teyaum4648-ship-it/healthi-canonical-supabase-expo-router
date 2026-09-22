import type { DataConfidence, SleepSession } from './types';

/**
 * Where the body clock actually is, as distinct from when a person got out of bed.
 *
 * The energy curve used to be anchored to `sleep_end_at` — last night's actual wake
 * time. That quietly asserts something false: sleep in three hours on a Sunday and the
 * model moves your entire circadian rhythm three hours with you. It does not move. The
 * clock is set by light and by weeks of habit, and it shifts at most about an hour a day
 * even under deliberate pressure.
 *
 * So two quantities are tracked separately:
 *
 *   **Behavioural timing** — when you slept. Drives sleep pressure and sleep inertia.
 *   **Circadian phase**    — where the clock is. Drives the rhythm of alertness.
 *
 * The gap between them is misalignment, the thing usually called social jetlag, and it is
 * the term that was missing. It explains the Monday where you slept eight hours and still
 * felt wrong: the sleep was fine, the timing was not.
 *
 * Everything here works in minutes since local midnight, on a 1440-minute circle.
 * Clock times wrap, so ordinary arithmetic is wrong on them — 23:30 and 00:30 are one
 * hour apart, not twenty-three. Every mean and deviation below is therefore circular.
 */

const DAY_MINUTES = 1440;

/**
 * How far the clock can move in one night.
 *
 * Asymmetric on purpose: delaying is easier than advancing, which is why flying west is
 * kinder than flying east and why staying up late costs less than getting up early. The
 * intrinsic human period runs slightly over 24 hours, so drift toward later is the
 * direction the clock already wants to go.
 */
export const MAX_PHASE_DELAY_MINUTES = 60;
export const MAX_PHASE_ADVANCE_MINUTES = 45;

/** Morning light is the strongest zeitgeber, so it buys extra advance on the day it happens. */
export const LIGHT_ADVANCE_BONUS_MINUTES = 20;

/** Beyond this much variability the schedule carries no usable rhythm to anchor to. */
const REGULARITY_CEILING_MINUTES = 90;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/** Positive modulo, so negative inputs land back on the circle rather than off it. */
function wrapMinutes(value: number): number {
  return ((value % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
}

/**
 * Shortest signed path from `from` to `target`, in minutes, on the 24-hour circle.
 * Positive means later, negative means earlier. Always within ±720.
 */
export function circularDifference(target: number, from: number): number {
  let delta = wrapMinutes(target - from);
  if (delta > DAY_MINUTES / 2) delta -= DAY_MINUTES;
  return delta;
}

/** Minutes since local midnight for an ISO timestamp, read in the local zone. */
export function clockMinutes(iso: string): number | null {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.getHours() * 60 + parsed.getMinutes();
}

/**
 * The midpoint of a night's sleep, which is the standard marker for circadian timing —
 * more stable than either bedtime or wake time, because a short night pulls both ends in
 * while leaving the middle roughly where it was.
 */
export function midSleepMinutes(session: Pick<SleepSession, 'sleep_start_at' | 'sleep_end_at'>): number | null {
  const start = new Date(session.sleep_start_at ?? '');
  const end = new Date(session.sleep_end_at ?? '');
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  if (end.getTime() <= start.getTime()) return null;

  const startMinutes = start.getHours() * 60 + start.getMinutes();
  const durationMinutes = (end.getTime() - start.getTime()) / 60_000;
  return wrapMinutes(startMinutes + durationMinutes / 2);
}

/**
 * Circular mean of clock times. Returns null when the times are so evenly spread around
 * the clock that no mean exists — a real outcome for a shift worker, and one worth
 * reporting as "no rhythm found" rather than as a spurious midpoint.
 */
export function circularMeanMinutes(values: number[]): number | null {
  if (values.length === 0) return null;

  let sumSin = 0;
  let sumCos = 0;
  for (const value of values) {
    const angle = (2 * Math.PI * wrapMinutes(value)) / DAY_MINUTES;
    sumSin += Math.sin(angle);
    sumCos += Math.cos(angle);
  }

  const meanSin = sumSin / values.length;
  const meanCos = sumCos / values.length;
  /* Resultant length near zero means the directions cancel: no meaningful centre. */
  if (Math.hypot(meanSin, meanCos) < 1e-6) return null;

  const angle = Math.atan2(meanSin, meanCos);
  return wrapMinutes((angle * DAY_MINUTES) / (2 * Math.PI));
}

/**
 * Circular standard deviation, in minutes. Zero for identical times, growing without a
 * hard ceiling as the times scatter. This is the regularity measure: how tightly a
 * person's nights cluster, independent of where the cluster sits.
 */
export function circularSdMinutes(values: number[]): number | null {
  if (values.length < 2) return null;

  let sumSin = 0;
  let sumCos = 0;
  for (const value of values) {
    const angle = (2 * Math.PI * wrapMinutes(value)) / DAY_MINUTES;
    sumSin += Math.sin(angle);
    sumCos += Math.cos(angle);
  }

  const resultant = Math.hypot(sumSin / values.length, sumCos / values.length);
  if (resultant <= 1e-9) return DAY_MINUTES / 4; // maximally scattered
  if (resultant >= 1) return 0;

  const sdRadians = Math.sqrt(-2 * Math.log(resultant));
  return (sdRadians * DAY_MINUTES) / (2 * Math.PI);
}

export type CircadianPhaseEstimate = {
  /** Where the clock's mid-sleep sits, in minutes since local midnight. */
  phaseMinutes: number;
  /** Where last night's mid-sleep actually sat. Null when last night is unknown. */
  behaviouralMinutes: number | null;
  /**
   * Signed gap, behaviour minus clock. Positive means you slept later than your clock
   * wanted; negative means earlier. This is social jetlag with a direction attached.
   */
  misalignmentMinutes: number | null;
  /** Circular SD of mid-sleep across the window. Lower is more regular. */
  regularitySdMinutes: number | null;
  /** 0–1, from the SD. 1 is metronomic, 0 is no usable rhythm. */
  regularityScore: number | null;
  nightsUsed: number;
  confidence: DataConfidence;
};

/**
 * Track the clock forward through a run of nights.
 *
 * Starts at the oldest night's mid-sleep and lets each subsequent night pull the estimate
 * by at most one night's worth of drift. A week of 2am nights followed by one 10pm night
 * leaves the clock near 2am, which is the point — and is why that 10pm night will feel
 * like lying awake rather than like an early start.
 */
export function estimateCircadianPhase(params: {
  /** Any order; sorted internally. Sessions without a usable window are ignored. */
  sessions: SleepSession[];
  /** Local dates on which meaningful morning light was logged, as YYYY-MM-DD. */
  morningLightDates?: string[];
  /** How many trailing nights to consider. */
  windowNights?: number;
}): CircadianPhaseEstimate | null {
  const windowNights = params.windowNights ?? 14;
  const lightDates = new Set(params.morningLightDates ?? []);

  const nights = params.sessions
    .map((session) => ({ session, mid: midSleepMinutes(session) }))
    .filter((entry): entry is { session: SleepSession; mid: number } => entry.mid !== null)
    .sort((left, right) => left.session.date.localeCompare(right.session.date))
    .slice(-windowNights);

  if (nights.length === 0) return null;

  let phase = nights[0].mid;
  for (let index = 1; index < nights.length; index++) {
    const night = nights[index];
    const delta = circularDifference(night.mid, phase);
    /* Light only helps pull the clock earlier; it cannot make a delay happen faster. */
    const advanceAllowance =
      MAX_PHASE_ADVANCE_MINUTES +
      (lightDates.has(night.session.date.slice(0, 10)) ? LIGHT_ADVANCE_BONUS_MINUTES : 0);
    const step = Math.max(-advanceAllowance, Math.min(MAX_PHASE_DELAY_MINUTES, delta));
    phase = wrapMinutes(phase + step);
  }

  const mids = nights.map((night) => night.mid);
  const sd = circularSdMinutes(mids);
  const behavioural = nights[nights.length - 1].mid;

  return {
    phaseMinutes: Math.round(phase),
    behaviouralMinutes: behavioural,
    misalignmentMinutes: Math.round(circularDifference(behavioural, phase)),
    regularitySdMinutes: sd === null ? null : Math.round(sd),
    regularityScore: sd === null ? null : clamp01(1 - sd / REGULARITY_CEILING_MINUTES),
    nightsUsed: nights.length,
    /* Regularity is a property of a run of nights; one or two cannot establish it. */
    confidence: nights.length >= 10 ? 'high' : nights.length >= 5 ? 'medium' : 'low'
  };
}

/** "1h 20m earlier than your usual rhythm" — misalignment in words. */
export function describeMisalignment(minutes: number | null): string | null {
  if (minutes === null) return null;
  const magnitude = Math.abs(minutes);
  if (magnitude < 30) return 'In step with your usual rhythm';

  const hours = Math.floor(magnitude / 60);
  const mins = magnitude % 60;
  const span = hours > 0 ? `${hours}h${mins > 0 ? ` ${mins}m` : ''}` : `${mins}m`;
  return minutes > 0
    ? `${span} later than your usual rhythm`
    : `${span} earlier than your usual rhythm`;
}
