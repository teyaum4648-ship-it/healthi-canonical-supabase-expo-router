import {
  calculateDurationScore,
  predictSleepEnergy,
  recoveryMultiplier,
  type CircadianPoint,
  type Restedness,
  type SleepEnergyPrediction,
  type SleepRecord
} from '../sleepEnergy';
import type { TypicalBand } from './energyModel';
import type { CircadianEnergyPoint, SleepRecoverySummary, SleepSession } from './types';

/**
 * What the person said this morning about last night, beyond the window itself. Every
 * field is optional: an unanswered question is unknown, which lowers the prediction's
 * confidence and never its score.
 */
export type MorningReport = {
  sleepLatencyMinutes?: number | null;
  awakeningCount?: number | null;
  awakeDuringNightMinutes?: number | null;
  morningRestedness?: Restedness | null;
  timesUncertain?: boolean;
};

/** A morning pulse by local date, taken at the wrist before getting up. */
export type MorningPulse = { date: string; bpm: number };

const MINUTE_MS = 60_000;
/** How far back stored nights are read: the debt uses a week, the pulse baseline three. */
const HISTORY_DAYS = 21;

function asDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function noonOf(date: string): Date {
  return new Date(`${date}T12:00:00.000Z`);
}

function asleepMinutes(session: SleepSession): number | null {
  if (typeof session.duration_minutes === 'number' && Number.isFinite(session.duration_minutes)) return session.duration_minutes;
  const start = asDate(session.sleep_start_at);
  const end = asDate(session.sleep_end_at);
  if (!start || !end) return null;
  const minutes = (end.getTime() - start.getTime()) / MINUTE_MS;
  return minutes > 0 ? minutes : null;
}

/** Awake periods the person marked on the window itself, which beat a remembered total. */
function awakeFromIntervals(session: SleepSession): { minutes: number; count: number } | null {
  const awake = (session.sleep_intervals ?? []).filter((interval) => interval.state === 'awake');
  if (!awake.length) return null;
  const minutes = awake.reduce((sum, interval) => {
    const start = asDate(interval.start_at);
    const end = asDate(interval.end_at);
    return start && end && end > start ? sum + (end.getTime() - start.getTime()) / MINUTE_MS : sum;
  }, 0);
  return { minutes, count: awake.length };
}

function asRestedness(value: number | null | undefined): Restedness | null {
  return value === 1 || value === 2 || value === 3 || value === 4 || value === 5 ? value : null;
}

/**
 * Last night, the nights before it, this morning's answers and pulse, and the timing
 * curve, run through the prediction.
 *
 * The window's start is when the person fell asleep, not when they got into bed, so a
 * known time-to-fall-asleep is added before it to recover time in bed. Unknown stays
 * unknown rather than becoming a guessed fifteen minutes.
 */
export function predictFromSession(params: {
  date: string;
  session: SleepSession;
  sessions: SleepSession[];
  sleepNeedMinutes: number;
  timingCurve: CircadianEnergyPoint[];
  report?: MorningReport | null;
  pulses?: MorningPulse[];
  /** The older 1–5 refreshment answer, used when the morning report has none. */
  refreshment?: number | null;
}): { prediction: SleepEnergyPrediction; curve: CircadianEnergyPoint[] } | { errors: string[] } {
  const onset = asDate(params.session.sleep_start_at);
  const finalWakeTime = asDate(params.session.sleep_end_at);
  if (!onset || !finalWakeTime) return { errors: ['sleep_window_missing'] };

  const report = params.report ?? {};
  const latency = report.sleepLatencyMinutes ?? null;
  const fromIntervals = awakeFromIntervals(params.session);
  const pulseByDate = new Map((params.pulses ?? []).map((pulse) => [pulse.date, pulse.bpm]));
  const earliest = new Date(noonOf(params.date).getTime() - HISTORY_DAYS * 86_400_000).toISOString().slice(0, 10);

  const previousNights: SleepRecord[] = params.sessions
    .filter((session) => session.date < params.date && session.date >= earliest)
    .flatMap((session) => {
      const minutes = asleepMinutes(session);
      return minutes === null ? [] : [{ date: noonOf(session.date), estimatedSleepMinutes: minutes, morningHeartRate: pulseByDate.get(session.date) ?? null }];
    });

  const result = predictSleepEnergy({
    bedtime: latency !== null && latency >= 0 ? new Date(onset.getTime() - latency * MINUTE_MS) : onset,
    finalWakeTime,
    sleepLatencyMinutes: latency,
    awakeningCount: fromIntervals ? fromIntervals.count : report.awakeningCount ?? null,
    awakeDuringNightMinutes: fromIntervals ? fromIntervals.minutes : report.awakeDuringNightMinutes ?? null,
    morningRestedness: report.morningRestedness ?? asRestedness(params.refreshment),
    morningHeartRate: pulseByDate.get(params.date) ?? null,
    sleepNeedMinutes: params.sleepNeedMinutes,
    previousNights,
    circadianCurve: params.timingCurve.map((point): CircadianPoint => ({ timestamp: new Date(point.time), energy: point.estimated_energy })),
    timesUncertain: Boolean(report.timesUncertain)
  });
  if (!result.ok) return { errors: result.errors.map((error) => error.code) };

  const curve = result.prediction.energyCurve.map((point, index): CircadianEnergyPoint => ({
    time: params.timingCurve[index]?.time ?? point.timestamp.toISOString(),
    estimated_energy: Math.round(point.energy),
    label: params.timingCurve[index]?.label ?? ''
  }));
  return { prediction: result.prediction, curve };
}

export function summarizeRecovery(prediction: SleepEnergyPrediction): SleepRecoverySummary {
  return {
    score: prediction.dailySleepScore,
    multiplier: Math.round(prediction.recoveryMultiplier * 100) / 100,
    confidence: prediction.modelConfidence,
    contributors: prediction.contributors.map((contributor) => ({ ...contributor })),
    notes: [...prediction.notes],
    estimated_sleep_minutes: prediction.metrics.estimatedSleepMinutes,
    sleep_efficiency: prediction.metrics.sleepEfficiency,
    weighted_debt_minutes: prediction.metrics.weightedDebtMinutes,
    morning_hr_deviation_percent: prediction.metrics.morningHRDeviationPercent,
    reason_codes: [...prediction.reason_codes]
  };
}

/** The most costly negative contributor, in the briefing's limiter vocabulary. */
export function limiterFromPrediction(prediction: SleepEnergyPrediction): 'duration' | 'debt' | 'refreshment' | 'fragmentation' | 'heart_rate' | null {
  const worst = prediction.contributors.find((contributor) => contributor.impact === 'negative');
  if (!worst) return null;
  switch (worst.id) {
    case 'duration': return 'duration';
    case 'sleepDebt': return 'debt';
    case 'subjective': return 'refreshment';
    case 'fragmentation':
    case 'efficiency': return 'fragmentation';
    case 'heartRate': return 'heart_rate';
  }
}

/**
 * The person's typical day on the same scale as today's: the timing curve scaled by what
 * their median night's length would earn on duration alone, as the older band did.
 */
export function typicalBandFromTiming(timingCurve: CircadianEnergyPoint[], nightlySleepMinutes: number[], sleepNeedMinutes: number): TypicalBand | null {
  const usable = nightlySleepMinutes.filter((value) => Number.isFinite(value) && value > 0).sort((left, right) => left - right);
  if (!usable.length || !timingCurve.length) return null;
  const middle = Math.floor(usable.length / 2);
  const median = usable.length % 2 ? usable[middle]! : (usable[middle - 1]! + usable[middle]!) / 2;
  const multiplier = recoveryMultiplier(calculateDurationScore(median / sleepNeedMinutes));
  const energies = timingCurve.map((point) => point.estimated_energy * multiplier);
  return { low: Math.round(Math.min(...energies)), high: Math.round(Math.max(...energies)), nights: usable.length };
}
