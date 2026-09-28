import { calendarDaysBetween, clamp, interpolate, median, minutesBetween, type Anchors } from './interpolate';
import type { Restedness, SleepInput, SleepRecord } from './types';

/*
 * Every table below is the specification's anchor list, verbatim. Values between anchors
 * are interpolated linearly; values past the ends hold the end value unless a step is
 * stated (duration below half the need, efficiency below 60%).
 */

const DURATION_ANCHORS: Anchors = [
  [0.5, 10], [0.625, 28], [0.6875, 43], [0.75, 58], [0.8125, 72], [0.875, 85], [0.9375, 95], [1, 100]
];

const WASO_ANCHORS: Anchors = [
  [10, 100], [20, 95], [30, 88], [45, 75], [60, 60], [90, 40], [120, 20], [150, 5]
];

const EFFICIENCY_ANCHORS: Anchors = [
  [0.6, 25], [0.7, 45], [0.75, 60], [0.8, 75], [0.85, 88], [0.9, 96], [0.92, 100]
];

const DEBT_ANCHORS: Anchors = [
  [0, 100], [60, 94], [120, 88], [240, 75], [360, 62], [480, 50], [600, 40], [720, 30]
];

const HR_DEVIATION_ANCHORS: Anchors = [
  [0, 100], [0.03, 97], [0.05, 92], [0.08, 84], [0.1, 76], [0.15, 60], [0.2, 45], [0.3, 25]
];

const SUBJECTIVE_SCORES: Record<Restedness, number> = { 1: 15, 2: 38, 3: 65, 4: 85, 5: 100 };

/** Weight of each earlier night in the debt sum, by how many nights before last night it was. */
export const DEBT_NIGHT_WEIGHTS: Record<number, number> = { 1: 1, 2: 0.85, 3: 0.7, 4: 0.55, 5: 0.4, 6: 0.3, 7: 0.2 };

/** Readings needed before a morning pulse is compared with anything. */
export const MIN_HR_BASELINE_READINGS = 5;
/** Readings the baseline is taken from, most recent first. */
export const MAX_HR_BASELINE_READINGS = 21;
/** What a pulse typed in by hand can plausibly be, at rest after waking. */
export const PLAUSIBLE_MORNING_HR = { min: 30, max: 120 } as const;

export type DerivedSleep = {
  timeInBedMinutes: number;
  estimatedSleepMinutes: number;
  sleepEfficiency: number;
  durationRatio: number;
  awakeDuringNightMinutes: number;
  latencyMinutes: number;
};

/**
 * Last night in minutes. An unknown latency or awake time counts as zero here, which is
 * the optimistic reading; the confidence score is what carries the uncertainty, and the
 * fragmentation and efficiency features are left out when their inputs are unknown.
 */
export function deriveSleepMetrics(input: Pick<SleepInput, 'bedtime' | 'finalWakeTime' | 'sleepLatencyMinutes' | 'awakeDuringNightMinutes' | 'sleepNeedMinutes'>): DerivedSleep {
  const timeInBedMinutes = minutesBetween(input.bedtime, input.finalWakeTime);
  const latencyMinutes = input.sleepLatencyMinutes ?? 0;
  const awakeDuringNightMinutes = input.awakeDuringNightMinutes ?? 0;
  const estimatedSleepMinutes = Math.max(0, timeInBedMinutes - latencyMinutes - awakeDuringNightMinutes);
  return {
    timeInBedMinutes,
    estimatedSleepMinutes,
    sleepEfficiency: timeInBedMinutes > 0 ? estimatedSleepMinutes / timeInBedMinutes : 0,
    durationRatio: estimatedSleepMinutes / input.sleepNeedMinutes,
    awakeDuringNightMinutes,
    latencyMinutes
  };
}

export function calculateDurationScore(durationRatio: number): number {
  if (durationRatio < 0.5) return 5;
  return interpolate(durationRatio, DURATION_ANCHORS);
}

/**
 * Time awake counts for more than the number of awakenings. Remembered awakenings are
 * noisy, so the first one is free and each further one costs two points, twelve at most.
 */
export function calculateFragmentationScore(awakeDuringNightMinutes: number, awakeningCount: number | null | undefined): number {
  const wasoScore = interpolate(awakeDuringNightMinutes, WASO_ANCHORS);
  const awakeningPenalty = clamp(Math.max(0, (awakeningCount ?? 0) - 1) * 2, 0, 12);
  return clamp(wasoScore - awakeningPenalty, 0, 100);
}

/** Overlaps heavily with duration and time awake, which is why it carries a small weight. */
export function calculateEfficiencyScore(sleepEfficiency: number): number {
  if (sleepEfficiency < 0.6) return 10;
  return interpolate(sleepEfficiency, EFFICIENCY_ANCHORS);
}

/**
 * The week before last night, recent nights counting for more. Last night is scored by
 * duration and is not counted again here. A night with no record adds nothing: missing
 * data lowers confidence, never the score.
 */
export function weightedSleepDebt(previousNights: SleepRecord[], lastNight: Date, sleepNeedMinutes: number): { weightedDebtMinutes: number; nightsUsed: number } {
  const byNightsAgo = new Map<number, SleepRecord>();
  for (const night of previousNights) {
    const nightsAgo = calendarDaysBetween(night.date, lastNight);
    if (nightsAgo < 1 || nightsAgo > 7) continue;
    /* One record per night; the later-listed one wins, as a correction would. */
    byNightsAgo.set(nightsAgo, night);
  }
  let weightedDebtMinutes = 0;
  for (const [nightsAgo, night] of byNightsAgo) {
    const deficit = Math.max(0, sleepNeedMinutes - night.estimatedSleepMinutes);
    weightedDebtMinutes += deficit * DEBT_NIGHT_WEIGHTS[nightsAgo]!;
  }
  return { weightedDebtMinutes, nightsUsed: byNightsAgo.size };
}

/** Never below 30 from debt alone. */
export function calculateSleepDebtScore(weightedDebtMinutes: number): number {
  return Math.max(30, interpolate(weightedDebtMinutes, DEBT_ANCHORS));
}

export function calculateSubjectiveScore(restedness: Restedness): number {
  return SUBJECTIVE_SCORES[restedness];
}

export function isPlausibleMorningHR(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= PLAUSIBLE_MORNING_HR.min && value <= PLAUSIBLE_MORNING_HR.max;
}

/**
 * The person's own usual morning pulse: the median of up to 21 recent readings, and only
 * once there are five. Before that there is no baseline and the pulse is not used.
 */
export function morningHRBaseline(previousNights: SleepRecord[]): number | null {
  const readings = [...previousNights]
    .sort((left, right) => right.date.getTime() - left.date.getTime())
    .map((night) => night.morningHeartRate)
    .filter(isPlausibleMorningHR)
    .slice(0, MAX_HR_BASELINE_READINGS);
  return readings.length >= MIN_HR_BASELINE_READINGS ? median(readings) : null;
}

/**
 * Only a pulse above the person's own baseline costs anything. A lower one is not
 * rewarded past 100: a low reading is as likely to be a counting slip as good news.
 */
export function calculateHeartRateScore(morningHeartRate: number, baselineMorningHR: number): { score: number; deviation: number } {
  const deviation = (morningHeartRate - baselineMorningHR) / baselineMorningHR;
  return { score: deviation <= 0 ? 100 : interpolate(deviation, HR_DEVIATION_ANCHORS), deviation };
}
