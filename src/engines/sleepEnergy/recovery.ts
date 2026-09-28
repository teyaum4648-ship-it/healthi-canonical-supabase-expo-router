import { clamp, MINUTE_MS } from './interpolate';
import type { CircadianPoint, RecoveryFeature, RecoveryWeights } from './types';

/** The starting weights for everyone. Personal weights are only ever regularised toward these. */
export const POPULATION_WEIGHTS: RecoveryWeights = {
  duration: 0.34,
  fragmentation: 0.18,
  efficiency: 0.08,
  sleepDebt: 0.15,
  subjective: 0.2,
  heartRate: 0.05
};

export const RECOVERY_FEATURES: RecoveryFeature[] = ['duration', 'fragmentation', 'efficiency', 'sleepDebt', 'subjective', 'heartRate'];

/**
 * The weighted mean of the features that are available. A missing feature is dropped and
 * its weight shared across the rest in proportion, so an absent reading lowers
 * confidence and never lowers the score.
 */
export function calculateRecoveryScore(
  scores: Partial<Record<RecoveryFeature, number | null>>,
  weights: RecoveryWeights = POPULATION_WEIGHTS
): { score: number | null; weightsUsed: Partial<RecoveryWeights> } {
  const available = RECOVERY_FEATURES.filter((feature) => {
    const value = scores[feature];
    return typeof value === 'number' && Number.isFinite(value) && weights[feature] > 0;
  });
  const total = available.reduce((sum, feature) => sum + weights[feature], 0);
  if (!available.length || total <= 0) return { score: null, weightsUsed: {} };
  const weightsUsed: Partial<RecoveryWeights> = {};
  let score = 0;
  for (const feature of available) {
    const weight = weights[feature] / total;
    weightsUsed[feature] = weight;
    score += weight * (scores[feature] as number);
  }
  return { score: clamp(score, 0, 100), weightsUsed };
}

/** 100 → 1.00, 80 → 0.88, 60 → 0.76, 40 → 0.64, 20 → 0.52. */
export function recoveryMultiplier(sleepRecoveryScore: number): number {
  return 0.4 + 0.6 * (clamp(sleepRecoveryScore, 0, 100) / 100);
}

/**
 * Recovery sets how strong the day is, never when it peaks: every point keeps its
 * timestamp and is scaled by the same factor.
 */
export function applyRecoveryToCircadianCurve(curve: CircadianPoint[], sleepRecoveryScore: number): CircadianPoint[] {
  const multiplier = recoveryMultiplier(sleepRecoveryScore);
  return curve.map((point) => ({ timestamp: point.timestamp, energy: clamp(point.energy * multiplier, 0, 100) }));
}

export const INERTIA_WINDOW_MINUTES = 120;
export const INERTIA_DECAY_MINUTES = 35;

/** 100 → 8, 70 → 11.6, 40 → 15.2, 20 → 17.6 points at the moment of waking. */
export function baseInertiaPenalty(sleepRecoveryScore: number): number {
  return 8 + (100 - clamp(sleepRecoveryScore, 0, 100)) * 0.12;
}

/**
 * The groggy first two hours: a penalty at waking that decays exponentially and is gone
 * at 120 minutes. Points before the wake time are left alone.
 */
export function applySleepInertia(curve: CircadianPoint[], finalWakeTime: Date, sleepRecoveryScore: number): CircadianPoint[] {
  const base = baseInertiaPenalty(sleepRecoveryScore);
  return curve.map((point) => {
    const minutesAwake = (point.timestamp.getTime() - finalWakeTime.getTime()) / MINUTE_MS;
    if (minutesAwake < 0 || minutesAwake >= INERTIA_WINDOW_MINUTES) return point;
    const penalty = base * Math.exp(-minutesAwake / INERTIA_DECAY_MINUTES);
    return { timestamp: point.timestamp, energy: clamp(point.energy - penalty, 0, 100) };
  });
}

export type ConfidenceInputs = {
  restednessMissing: boolean;
  heartRateUnavailable: boolean;
  previousNightsCount: number;
  latencyUnknown: boolean;
  awakeUnknown: boolean;
  timesUncertain: boolean;
};

/** How far to trust the prediction, 30–100. It describes the inputs, not the person's health. */
export function calculatePredictionConfidence(inputs: ConfidenceInputs): number {
  let confidence = 100;
  if (inputs.restednessMissing) confidence -= 15;
  if (inputs.heartRateUnavailable) confidence -= 5;
  if (inputs.previousNightsCount < 4) confidence -= 15;
  if (inputs.latencyUnknown) confidence -= 10;
  if (inputs.awakeUnknown) confidence -= 10;
  if (inputs.timesUncertain) confidence -= 10;
  return clamp(confidence, 30, 100);
}
