import { generateSleepExplanation } from './explain';
import { DAY_MS, MINUTE_MS, round1 } from './interpolate';
import { applyPersonalBias } from './personalization';
import {
  applyRecoveryToCircadianCurve,
  applySleepInertia,
  calculatePredictionConfidence,
  calculateRecoveryScore,
  POPULATION_WEIGHTS,
  recoveryMultiplier
} from './recovery';
import {
  calculateDurationScore,
  calculateEfficiencyScore,
  calculateFragmentationScore,
  calculateHeartRateScore,
  calculateSleepDebtScore,
  calculateSubjectiveScore,
  deriveSleepMetrics,
  isPlausibleMorningHR,
  MIN_HR_BASELINE_READINGS,
  morningHRBaseline,
  weightedSleepDebt
} from './scores';
import type { PredictionResult, RecoveryFeature, RecoveryWeights, SleepInput } from './types';
import { partitionHistory, validateSleepInput } from './validate';

export type PredictionOptions = {
  /** Per-person weights once calibrated. Defaults to the population weights. */
  weights?: RecoveryWeights;
  /** A calibrated steady offset, from {@link estimatePersonalBias}. Zero until then. */
  personalBias?: number;
};

/**
 * Last night's sleep and the week before it, turned into how strong today is likely to
 * feel, laid over the circadian curve that already decides when the peaks and dips fall.
 *
 * The order is fixed: validate, derive last night, score each feature, combine the
 * available ones, scale the curve, add the morning's inertia. Timing is never touched.
 */
export function predictSleepEnergy(input: SleepInput, options: PredictionOptions = {}): PredictionResult {
  const errors = validateSleepInput(input);
  if (errors.length) return { ok: false, errors };

  const { valid: history, warnings } = partitionHistory(input.previousNights);
  const derived = deriveSleepMetrics(input);
  const reasonCodes: string[] = [];
  const notes: string[] = [];

  const latencyUnknown = input.sleepLatencyMinutes === null || input.sleepLatencyMinutes === undefined;
  const awakeUnknown = input.awakeDuringNightMinutes === null || input.awakeDuringNightMinutes === undefined;
  const restedness = input.morningRestedness ?? null;

  const scores: Record<RecoveryFeature, number | null> = {
    duration: calculateDurationScore(derived.durationRatio),
    /* Without a known awake time there is nothing to score fragmentation or efficiency from. */
    fragmentation: awakeUnknown ? null : calculateFragmentationScore(derived.awakeDuringNightMinutes, input.awakeningCount),
    efficiency: awakeUnknown && latencyUnknown ? null : calculateEfficiencyScore(derived.sleepEfficiency),
    sleepDebt: null,
    subjective: restedness ? calculateSubjectiveScore(restedness) : null,
    heartRate: null
  };
  if (awakeUnknown) reasonCodes.push('sleep_awake_time_unknown');
  if (latencyUnknown) reasonCodes.push('sleep_latency_unknown');
  if (!restedness) reasonCodes.push('sleep_restedness_missing');

  const debt = weightedSleepDebt(history, input.finalWakeTime, input.sleepNeedMinutes);
  if (debt.nightsUsed > 0) {
    scores.sleepDebt = calculateSleepDebtScore(debt.weightedDebtMinutes);
  } else {
    reasonCodes.push('sleep_history_missing');
    notes.push('Sleep debt is left out until there are earlier nights to compare.');
  }

  const baseline = morningHRBaseline(history);
  let hrDeviation: number | null = null;
  if (isPlausibleMorningHR(input.morningHeartRate) && baseline !== null) {
    const heart = calculateHeartRateScore(input.morningHeartRate, baseline);
    scores.heartRate = heart.score;
    hrDeviation = heart.deviation;
  } else if (isPlausibleMorningHR(input.morningHeartRate)) {
    reasonCodes.push('morning_hr_calibrating');
    notes.push(`Your morning pulse is compared with your own usual once there are ${MIN_HR_BASELINE_READINGS} earlier readings.`);
  } else {
    reasonCodes.push('morning_hr_missing');
  }

  const weights = options.weights ?? POPULATION_WEIGHTS;
  const combined = calculateRecoveryScore(scores, weights);
  /* Duration is always scorable once validation passes, so a score always exists here. */
  const sleepRecoveryScore = round1(combined.score ?? 0);

  const scaled = applyRecoveryToCircadianCurve(input.circadianCurve, sleepRecoveryScore);
  const withInertia = applySleepInertia(scaled, input.finalWakeTime, sleepRecoveryScore);
  const energyCurve = applyPersonalBias(withInertia, options.personalBias ?? 0);

  const modelConfidence = calculatePredictionConfidence({
    restednessMissing: !restedness,
    heartRateUnavailable: scores.heartRate === null,
    previousNightsCount: debt.nightsUsed,
    latencyUnknown,
    awakeUnknown,
    timesUncertain: Boolean(input.timesUncertain)
  });
  if (input.timesUncertain) reasonCodes.push('sleep_times_uncertain');
  if (debt.nightsUsed > 0 && debt.nightsUsed < 4) reasonCodes.push('sleep_history_short');
  reasonCodes.push(sleepRecoveryScore >= 80 ? 'sleep_recovery_high' : sleepRecoveryScore >= 55 ? 'sleep_recovery_moderate' : 'sleep_recovery_low');

  return {
    ok: true,
    prediction: {
      sleepRecoveryScore,
      dailySleepScore: Math.round(sleepRecoveryScore),
      recoveryMultiplier: recoveryMultiplier(sleepRecoveryScore),
      modelConfidence,
      metrics: {
        timeInBedMinutes: Math.round(derived.timeInBedMinutes),
        estimatedSleepMinutes: Math.round(derived.estimatedSleepMinutes),
        sleepEfficiency: Math.round(derived.sleepEfficiency * 1000) / 1000,
        durationRatio: Math.round(derived.durationRatio * 1000) / 1000,
        awakeDuringNightMinutes: Math.round(derived.awakeDuringNightMinutes),
        weightedDebtMinutes: debt.nightsUsed ? Math.round(debt.weightedDebtMinutes) : null,
        baselineMorningHR: baseline,
        morningHRDeviationPercent: hrDeviation === null ? null : round1(hrDeviation * 100)
      },
      scores,
      weightsUsed: combined.weightsUsed,
      contributors: generateSleepExplanation(scores, combined.weightsUsed, restedness),
      notes,
      energyCurve,
      reason_codes: reasonCodes,
      warnings: [...new Set(warnings)]
    }
  };
}

/**
 * Bed and wake as clock times, turned into a window that ends on `wakeDate`. A bedtime
 * later in the clock than the wake time is taken to be the evening before, which is how
 * a night that crosses midnight is written down. Times are "HH:MM", 24-hour, on the same
 * UTC wall-clock axis the rest of the app uses.
 */
export function resolveOvernightWindow(bedClock: string, wakeClock: string, wakeDate: string): { bedtime: Date; finalWakeTime: Date } | null {
  const parse = (clock: string) => {
    const match = /^(\d{1,2}):(\d{2})$/.exec(clock.trim());
    if (!match) return null;
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    return hours < 24 && minutes < 60 ? hours * 60 + minutes : null;
  };
  const bed = parse(bedClock);
  const wake = parse(wakeClock);
  const day = Date.parse(`${wakeDate}T00:00:00.000Z`);
  if (bed === null || wake === null || !Number.isFinite(day)) return null;
  const finalWakeTime = new Date(day + wake * MINUTE_MS);
  const bedtime = new Date(day + bed * MINUTE_MS - (bed >= wake ? DAY_MS : 0));
  return { bedtime, finalWakeTime };
}
