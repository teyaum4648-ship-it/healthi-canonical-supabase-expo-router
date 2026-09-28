import { clamp } from './interpolate';
import { POPULATION_WEIGHTS, RECOVERY_FEATURES } from './recovery';
import type { CircadianPoint, RecoveryWeights } from './types';

/*
 * Phase 2 groundwork. Nothing here runs until someone has enough data, and the model works
 * without any of it. What exists now is the part that has to be right before any learning
 * happens: how a residual is measured, when calibration is allowed to start, how far a
 * personal weight may move, and how hard it is pulled back toward the population.
 */

export type EnergyCheckIn = {
  timestamp: Date;
  /** 0–100, what the person said. */
  reportedEnergy: number;
};

/** Before this much data, every personal adjustment stays at zero. */
export const CALIBRATION_MINIMUM = { sleepDays: 14, checkIns: 20 } as const;

/** How far each weight may move from the population value, before renormalisation. */
export const WEIGHT_BOUNDS: Record<keyof RecoveryWeights, readonly [number, number]> = {
  duration: [0.2, 0.45],
  fragmentation: [0.08, 0.28],
  efficiency: [0.03, 0.12],
  sleepDebt: [0.08, 0.25],
  subjective: [0.1, 0.32],
  heartRate: [0, 0.12]
};

/** The largest steady offset a person's check-ins may apply to the whole curve. */
export const MAX_PERSONAL_BIAS = 15;

/** The predicted energy at a moment, read linearly between curve points. Null outside the curve. */
export function predictedEnergyAt(curve: CircadianPoint[], timestamp: Date): number | null {
  const time = timestamp.getTime();
  for (let index = 1; index < curve.length; index += 1) {
    const before = curve[index - 1]!;
    const after = curve[index]!;
    const start = before.timestamp.getTime();
    const end = after.timestamp.getTime();
    if (time >= start && time <= end) {
      const fraction = end === start ? 0 : (time - start) / (end - start);
      return before.energy + fraction * (after.energy - before.energy);
    }
  }
  return null;
}

/** Reported minus predicted. Positive means the day felt better than forecast. */
export function predictionResidual(curve: CircadianPoint[], checkIn: EnergyCheckIn): number | null {
  if (!Number.isFinite(checkIn.reportedEnergy) || checkIn.reportedEnergy < 0 || checkIn.reportedEnergy > 100) return null;
  const predicted = predictedEnergyAt(curve, checkIn.timestamp);
  return predicted === null ? null : checkIn.reportedEnergy - predicted;
}

export function calibrationReady(sleepDays: number, checkIns: number): boolean {
  return sleepDays >= CALIBRATION_MINIMUM.sleepDays && checkIns >= CALIBRATION_MINIMUM.checkIns;
}

/**
 * The steady gap between forecast and reality, shrunk toward zero. With `priorStrength`
 * of 20, twenty check-ins move the estimate halfway to their raw mean, so no single day,
 * or single week, can swing it. Zero until calibration is ready.
 */
export function estimatePersonalBias(residuals: number[], ready: boolean, priorStrength = 20): number {
  if (!ready) return 0;
  const usable = residuals.filter((value) => Number.isFinite(value));
  if (!usable.length) return 0;
  const shrunk = usable.reduce((sum, value) => sum + value, 0) / (usable.length + priorStrength);
  return clamp(shrunk, -MAX_PERSONAL_BIAS, MAX_PERSONAL_BIAS);
}

/** Holds every weight inside its bounds and makes them sum to 1, so no one input can dominate. */
export function constrainWeights(weights: RecoveryWeights): RecoveryWeights {
  let current = { ...weights };
  for (let pass = 0; pass < 8; pass += 1) {
    const bounded = Object.fromEntries(
      RECOVERY_FEATURES.map((feature) => {
        const [low, high] = WEIGHT_BOUNDS[feature];
        const value = Number.isFinite(current[feature]) ? current[feature] : POPULATION_WEIGHTS[feature];
        return [feature, clamp(value, low, high)];
      })
    ) as RecoveryWeights;
    const total = RECOVERY_FEATURES.reduce((sum, feature) => sum + bounded[feature], 0);
    current = Object.fromEntries(RECOVERY_FEATURES.map((feature) => [feature, bounded[feature] / total])) as RecoveryWeights;
  }
  return current;
}

/**
 * Personal weights pulled toward the population in proportion to how little evidence
 * there is: with `observations` equal to `priorStrength`, the result sits halfway.
 */
export function regularizeWeights(personal: RecoveryWeights, observations: number, priorStrength = 40): RecoveryWeights {
  const trust = Math.max(0, observations) / (Math.max(0, observations) + priorStrength);
  const blended = Object.fromEntries(
    RECOVERY_FEATURES.map((feature) => [feature, POPULATION_WEIGHTS[feature] + trust * (personal[feature] - POPULATION_WEIGHTS[feature])])
  ) as RecoveryWeights;
  return constrainWeights(blended);
}

/** A steady personal offset applied to a curve, clamped to 0–100. */
export function applyPersonalBias(curve: CircadianPoint[], bias: number): CircadianPoint[] {
  if (!bias) return curve;
  return curve.map((point) => ({ timestamp: point.timestamp, energy: clamp(point.energy + bias, 0, 100) }));
}

