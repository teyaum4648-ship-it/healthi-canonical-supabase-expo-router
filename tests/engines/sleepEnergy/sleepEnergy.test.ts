import { describe, expect, it } from 'vitest';

import {
  applySleepInertia,
  baseInertiaPenalty,
  calculateDurationScore,
  calculateEfficiencyScore,
  calculateFragmentationScore,
  calculateHeartRateScore,
  calculatePredictionConfidence,
  calculateRecoveryScore,
  calculateSleepDebtScore,
  calculateSubjectiveScore,
  calibrationReady,
  constrainWeights,
  deriveSleepMetrics,
  estimatePersonalBias,
  POPULATION_WEIGHTS,
  predictionResidual,
  predictSleepEnergy,
  recoveryMultiplier,
  regularizeWeights,
  resolveOvernightWindow,
  WEIGHT_BOUNDS,
  type CircadianPoint,
  type SleepEnergyPrediction,
  type SleepInput,
  type SleepRecord
} from '../../../src/engines/sleepEnergy';

const WAKE_DATE = '2026-09-28';
const at = (clock: string, date = WAKE_DATE) => new Date(`${date}T${clock}:00.000Z`);

/** A plausible full-strength circadian day: waking at 07:00, a late-morning peak of 88, a mid-afternoon dip, an evening second wind. */
function circadianDay(wake = at('07:00')): CircadianPoint[] {
  const points: CircadianPoint[] = [];
  for (let minutes = 0; minutes <= 16 * 60; minutes += 30) {
    const hours = minutes / 60;
    const peak = 30 * Math.exp(-(((hours - 3.5) / 2.2) ** 2));
    const dip = 14 * Math.exp(-(((hours - 7) / 1.6) ** 2));
    const second = 20 * Math.exp(-(((hours - 12.5) / 2) ** 2));
    const windDown = 22 * Math.exp(-(((hours - 16) / 1.2) ** 2));
    points.push({ timestamp: new Date(wake.getTime() + minutes * 60000), energy: Math.max(0, Math.min(100, 58 + peak - dip + second - windDown)) });
  }
  return points;
}

function nights(minutes: number[], heartRates: (number | undefined)[] = []): SleepRecord[] {
  // minutes[0] is one night before last night.
  return minutes.map((value, index) => ({
    date: new Date(Date.UTC(2026, 8, 27 - index, 12)),
    estimatedSleepMinutes: value,
    morningHeartRate: heartRates[index]
  }));
}

function input(overrides: Partial<SleepInput> = {}): SleepInput {
  return {
    bedtime: at('22:45', '2026-09-27'),
    finalWakeTime: at('07:00'),
    sleepLatencyMinutes: 10,
    awakeningCount: 1,
    awakeDuringNightMinutes: 5,
    morningRestedness: 5,
    morningHeartRate: 55,
    sleepNeedMinutes: 480,
    previousNights: nights([480, 480, 480, 480, 480, 480, 480], [56, 55, 57, 56, 55, 56, 57]),
    circadianCurve: circadianDay(),
    ...overrides
  };
}

function predict(overrides: Partial<SleepInput> = {}): SleepEnergyPrediction {
  const result = predictSleepEnergy(input(overrides));
  if (!result.ok) throw new Error(result.errors.map((error) => error.code).join(', '));
  return result.prediction;
}

const peakOf = (curve: CircadianPoint[]) => Math.max(...curve.map((point) => point.energy));
const peakTime = (curve: CircadianPoint[]) => curve.reduce((best, point) => (point.energy > best.energy ? point : best)).timestamp.getTime();

describe('score tables', () => {
  it('reads the duration anchors, with an 8-hour need', () => {
    const score = (hours: number) => calculateDurationScore((hours * 60) / 480);
    expect([8, 7.5, 7, 6.5, 6, 5.5, 5, 4].map(score)).toEqual([100, 95, 85, 72, 58, 43, 28, 10]);
    expect(score(9)).toBe(100);
    expect(score(3)).toBe(5);
    expect(score(7.25)).toBeCloseTo(90, 5);
  });

  it('scores time awake more than the count of awakenings', () => {
    expect(calculateFragmentationScore(10, 1)).toBe(100);
    expect(calculateFragmentationScore(45, 1)).toBe(75);
    expect(calculateFragmentationScore(200, 1)).toBe(5);
    expect(calculateFragmentationScore(15, 3)).toBeCloseTo(97.5 - 4, 5);
    expect(calculateFragmentationScore(10, 30)).toBe(88);
  });

  it('reads the efficiency, debt, subjective and heart-rate tables', () => {
    expect(calculateEfficiencyScore(0.95)).toBe(100);
    expect(calculateEfficiencyScore(0.8)).toBe(75);
    expect(calculateEfficiencyScore(0.55)).toBe(10);
    expect(calculateSleepDebtScore(0)).toBe(100);
    expect(calculateSleepDebtScore(180)).toBeCloseTo(81.5, 5);
    expect(calculateSleepDebtScore(5000)).toBe(30);
    expect([1, 2, 3, 4, 5].map((value) => calculateSubjectiveScore(value as 1))).toEqual([15, 38, 65, 85, 100]);
    expect(calculateHeartRateScore(60, 60).score).toBe(100);
    expect(calculateHeartRateScore(50, 60).score).toBe(100);
    expect(calculateHeartRateScore(66, 60).score).toBe(76);
    expect(calculateHeartRateScore(90, 60).score).toBe(25);
  });

  it('turns recovery into a multiplier and a morning inertia penalty', () => {
    expect([100, 80, 60, 40, 20].map(recoveryMultiplier)).toEqual([1, 0.88, 0.76, 0.64, 0.52]);
    expect([100, 70, 40, 20].map(baseInertiaPenalty).map((value) => Math.round(value * 10) / 10)).toEqual([8, 11.6, 15.2, 17.6]);
    const flat = Array.from({ length: 6 }, (_, index) => ({ timestamp: new Date(at('07:00').getTime() + index * 35 * 60000), energy: 50 }));
    const groggy = applySleepInertia(flat, at('07:00'), 100);
    expect(groggy[0]!.energy).toBeCloseTo(42, 5);
    expect(groggy[1]!.energy).toBeCloseTo(50 - 8 / Math.E, 5);
    expect(groggy[4]!.energy).toBe(50); // 140 minutes: past the two-hour window
  });

  it('drops a missing feature and shares its weight rather than scoring it as zero', () => {
    const { score, weightsUsed } = calculateRecoveryScore({ duration: 80, fragmentation: 80, efficiency: 80, sleepDebt: 80, subjective: 80, heartRate: null });
    expect(score).toBeCloseTo(80, 5);
    expect(weightsUsed.heartRate).toBeUndefined();
    expect(Object.values(weightsUsed).reduce((sum, weight) => sum + (weight ?? 0), 0)).toBeCloseTo(1, 10);
  });
});

describe('predictSleepEnergy — the ten cases', () => {
  it('1. excellent sleep keeps the day at full strength', () => {
    const prediction = predict();
    expect(prediction.sleepRecoveryScore).toBe(100);
    expect(prediction.dailySleepScore).toBe(100);
    expect(prediction.modelConfidence).toBe(100);
    expect(prediction.contributors.every((contributor) => contributor.impact === 'positive')).toBe(true);
    expect(peakOf(prediction.energyCurve)).toBeCloseTo(peakOf(input().circadianCurve), 5);
    expect(prediction.metrics.estimatedSleepMinutes).toBe(480);
  });

  it('2. short but uninterrupted sleep is held back by duration alone', () => {
    const prediction = predict({ bedtime: at('00:30'), finalWakeTime: at('06:00', WAKE_DATE), sleepLatencyMinutes: 5, awakeDuringNightMinutes: 0, awakeningCount: 0, morningRestedness: 3, morningHeartRate: null });
    expect(prediction.metrics.estimatedSleepMinutes).toBe(325);
    expect(prediction.scores.fragmentation).toBe(100);
    expect(prediction.contributors[0]!.id).toBe('duration');
    expect(prediction.contributors[0]!.impact).toBe('negative');
    expect(prediction.sleepRecoveryScore).toBeGreaterThan(60);
    expect(prediction.sleepRecoveryScore).toBeLessThan(80);
  });

  it('3. long but highly fragmented sleep scores below the same hours slept straight through', () => {
    const fragmented = predict({ bedtime: at('22:00', '2026-09-27'), finalWakeTime: at('07:30'), sleepLatencyMinutes: 30, awakeDuringNightMinutes: 120, awakeningCount: 6, morningRestedness: 3, morningHeartRate: null });
    const straight = predict({ bedtime: at('00:00'), finalWakeTime: at('07:00'), sleepLatencyMinutes: 0, awakeDuringNightMinutes: 0, awakeningCount: 0, morningRestedness: 3, morningHeartRate: null });
    expect(fragmented.metrics.estimatedSleepMinutes).toBe(straight.metrics.estimatedSleepMinutes);
    expect(fragmented.scores.fragmentation).toBe(10);
    expect(fragmented.contributors.find((contributor) => contributor.id === 'fragmentation')!.impact).toBe('negative');
    expect(fragmented.sleepRecoveryScore).toBeLessThan(straight.sleepRecoveryScore - 10);
  });

  it('4. good duration but reported exhaustion pulls the prediction down', () => {
    const exhausted = predict({ morningRestedness: 1 });
    const rested = predict({ morningRestedness: 5 });
    expect(exhausted.scores.subjective).toBe(15);
    expect(rested.sleepRecoveryScore - exhausted.sleepRecoveryScore).toBeGreaterThanOrEqual(15);
    const subjective = exhausted.contributors[0]!;
    expect(subjective.id).toBe('subjective');
    expect(subjective.message).toBe('You reported feeling exhausted this morning.');
    expect(peakOf(exhausted.energyCurve)).toBeLessThan(peakOf(rested.energyCurve));
  });

  it('5. severe accumulated sleep debt floors at 30 and never below', () => {
    const indebted = predict({ previousNights: nights([300, 300, 300, 300, 300, 300, 300], [56, 55, 57, 56, 55, 56, 57]) });
    expect(indebted.metrics.weightedDebtMinutes).toBe(720);
    expect(indebted.scores.sleepDebt).toBe(30);
    const worse = predict({ previousNights: nights([120, 120, 120, 120, 120, 120, 120], [56, 55, 57, 56, 55, 56, 57]) });
    expect(worse.scores.sleepDebt).toBe(30);
    expect(indebted.contributors[0]!.id).toBe('sleepDebt');
    expect(indebted.contributors[0]!.impact).toBe('negative');
  });

  it('6. an elevated morning pulse costs points against the person’s own baseline', () => {
    const elevated = predict({ morningHeartRate: 63 });
    expect(elevated.metrics.baselineMorningHR).toBe(56);
    expect(elevated.metrics.morningHRDeviationPercent).toBeCloseTo(12.5, 1);
    expect(elevated.scores.heartRate).toBeLessThan(70);
    expect(elevated.contributors[0]!.id).toBe('heartRate');
    expect(elevated.contributors[0]!.message).not.toMatch(/sick|ill\b|infection|caused/i);
    const low = predict({ morningHeartRate: 48 });
    expect(low.scores.heartRate).toBe(100);
  });

  it('7. a missing pulse is left out, not penalised', () => {
    const base = { morningRestedness: 3 as const };
    const missing = predict({ ...base, morningHeartRate: null });
    expect(missing.scores.heartRate).toBeNull();
    expect(missing.weightsUsed.heartRate).toBeUndefined();
    const others = calculateRecoveryScore({ ...missing.scores, heartRate: null }).score!;
    expect(missing.sleepRecoveryScore).toBeCloseTo(others, 1);
    expect(missing.modelConfidence).toBe(95);
    expect(missing.reason_codes).toContain('morning_hr_missing');
  });

  it('8. a new user with no history gets a prediction at lower confidence', () => {
    const fresh = predict({ previousNights: [] });
    expect(fresh.scores.sleepDebt).toBeNull();
    /* A pulse is given, but with no baseline it is not compared with anything yet. */
    expect(fresh.scores.heartRate).toBeNull();
    expect(fresh.reason_codes).toEqual(expect.arrayContaining(['sleep_history_missing', 'morning_hr_calibrating']));
    expect(fresh.modelConfidence).toBe(80);
    expect(fresh.notes.length).toBeGreaterThan(0);
    expect(fresh.sleepRecoveryScore).toBeGreaterThan(90);
  });

  it('9. a night that crosses midnight is one window, and a reversed one is refused', () => {
    const crossing = resolveOvernightWindow('23:30', '06:45', WAKE_DATE)!;
    expect(crossing.bedtime.toISOString()).toBe('2026-09-27T23:30:00.000Z');
    expect(crossing.finalWakeTime.toISOString()).toBe('2026-09-28T06:45:00.000Z');
    const afterMidnight = resolveOvernightWindow('00:15', '07:26', WAKE_DATE)!;
    expect(deriveSleepMetrics({ ...afterMidnight, sleepNeedMinutes: 480 }).timeInBedMinutes).toBe(431);
    const prediction = predict({ ...crossing, circadianCurve: circadianDay(crossing.finalWakeTime) });
    expect(prediction.metrics.timeInBedMinutes).toBe(435);
    expect(resolveOvernightWindow('25:00', '07:00', WAKE_DATE)).toBeNull();
    const reversed = predictSleepEnergy(input({ bedtime: at('07:00'), finalWakeTime: at('06:00') }));
    expect(reversed.ok).toBe(false);
    expect(!reversed.ok && reversed.errors[0]!.code).toBe('wake_not_after_bedtime');
  });

  it('10. very poor sleep visibly suppresses the whole curve without moving its peak', () => {
    const circadian = circadianDay(at('05:30'));
    const poor = predict({
      bedtime: at('02:00'),
      finalWakeTime: at('05:30'),
      sleepLatencyMinutes: 45,
      awakeDuringNightMinutes: 60,
      awakeningCount: 5,
      morningRestedness: 1,
      morningHeartRate: 66,
      previousNights: nights([330, 300, 360, 300, 330, 300, 360], [56, 55, 57, 56, 55, 56, 57]),
      circadianCurve: circadian
    });
    expect(poor.sleepRecoveryScore).toBeLessThan(30);
    expect(poor.recoveryMultiplier).toBeLessThan(0.58);
    expect(peakOf(poor.energyCurve)).toBeLessThan(peakOf(circadian) * 0.6);
    expect(peakTime(poor.energyCurve)).toBe(peakTime(circadian));
    /* The first minutes after waking carry the full inertia penalty on top. */
    expect(poor.energyCurve[0]!.energy).toBeLessThan(circadian[0]!.energy * poor.recoveryMultiplier - 15);
    expect(poor.contributors.filter((contributor) => contributor.impact === 'negative').length).toBeGreaterThanOrEqual(4);
  });
});

describe('invalid input is refused, not bent into shape', () => {
  const codes = (overrides: Partial<SleepInput>) => {
    const result = predictSleepEnergy(input(overrides));
    return result.ok ? [] : result.errors.map((error) => error.code);
  };

  it('refuses negative, impossible and implausible values', () => {
    expect(codes({ sleepLatencyMinutes: -5 })).toContain('negative_value');
    expect(codes({ awakeDuringNightMinutes: -1 })).toContain('negative_value');
    expect(codes({ awakeDuringNightMinutes: 600 })).toContain('awake_exceeds_time_in_bed');
    expect(codes({ bedtime: at('06:00', '2026-09-26') })).toContain('window_longer_than_24_hours');
    expect(codes({ morningHeartRate: 250 })).toContain('heart_rate_implausible');
    expect(codes({ morningHeartRate: 12 })).toContain('heart_rate_implausible');
    expect(codes({ awakeningCount: 2.5 })).toContain('awakening_count_invalid');
    expect(codes({ morningRestedness: 7 as 5 })).toContain('restedness_invalid');
    expect(codes({ bedtime: new Date('nope') })).toContain('invalid_date');
    expect(codes({ sleepNeedMinutes: 60 })).toContain('sleep_need_implausible');
    expect(codes({ circadianCurve: [{ timestamp: at('08:00'), energy: 140 }] })).toContain('curve_value_invalid');
  });

  it('drops an impossible stored night with a warning instead of failing the day', () => {
    const history = [...nights([480, 480, 480, 480]), { date: new Date(Date.UTC(2026, 8, 22, 12)), estimatedSleepMinutes: -30 }];
    const prediction = predict({ previousNights: history });
    expect(prediction.warnings).toContain('history_night_ignored_invalid');
  });
});

describe('confidence and wording', () => {
  it('starts at 100 and only subtracts for what is missing', () => {
    expect(calculatePredictionConfidence({ restednessMissing: false, heartRateUnavailable: false, previousNightsCount: 7, latencyUnknown: false, awakeUnknown: false, timesUncertain: false })).toBe(100);
    expect(calculatePredictionConfidence({ restednessMissing: true, heartRateUnavailable: true, previousNightsCount: 0, latencyUnknown: true, awakeUnknown: true, timesUncertain: true })).toBe(35);
    const unknowns = predict({ sleepLatencyMinutes: null, awakeDuringNightMinutes: null, awakeningCount: null, timesUncertain: true });
    expect(unknowns.scores.fragmentation).toBeNull();
    expect(unknowns.scores.efficiency).toBeNull();
    expect(unknowns.modelConfidence).toBe(70);
  });

  it('never uses causal or clinical language', () => {
    const forbidden = /sick|caused|causes|diagnos|disease|illness|infection|clinical|guarantee|treat/i;
    const cases: Partial<SleepInput>[] = [{}, { morningRestedness: 1 }, { morningHeartRate: 70 }, { awakeDuringNightMinutes: 100, awakeningCount: 8 }, { previousNights: nights([200, 200, 200, 200, 200, 200, 200]) }];
    for (const overrides of cases) {
      const prediction = predict(overrides);
      for (const line of [...prediction.contributors.map((contributor) => contributor.message), ...prediction.notes]) {
        expect(line).not.toMatch(forbidden);
      }
    }
  });
});

describe('phase 2 groundwork', () => {
  it('measures a residual against the curve and ignores check-ins outside it', () => {
    const curve = [{ timestamp: at('08:00'), energy: 60 }, { timestamp: at('09:00'), energy: 80 }];
    expect(predictionResidual(curve, { timestamp: at('08:30'), reportedEnergy: 55 })).toBeCloseTo(-15, 5);
    expect(predictionResidual(curve, { timestamp: at('12:00'), reportedEnergy: 55 })).toBeNull();
    expect(predictionResidual(curve, { timestamp: at('08:30'), reportedEnergy: 140 })).toBeNull();
  });

  it('does not calibrate before 14 days of sleep and 20 check-ins, then shrinks toward zero', () => {
    expect(calibrationReady(13, 40)).toBe(false);
    expect(calibrationReady(14, 19)).toBe(false);
    expect(calibrationReady(14, 20)).toBe(true);
    expect(estimatePersonalBias(Array(30).fill(10), false)).toBe(0);
    expect(estimatePersonalBias(Array(20).fill(10), true)).toBeCloseTo(5, 5);
    expect(estimatePersonalBias(Array(500).fill(-40), true)).toBe(-15);
  });

  it('keeps personal weights bounded, summing to one, and starts from the population', () => {
    const wild = constrainWeights({ duration: 0.9, fragmentation: 0, efficiency: 0.5, sleepDebt: 0, subjective: 0.9, heartRate: 0.9 });
    expect(Object.values(wild).reduce((sum, weight) => sum + weight, 0)).toBeCloseTo(1, 10);
    for (const [feature, value] of Object.entries(wild)) {
      const [low, high] = WEIGHT_BOUNDS[feature as keyof typeof WEIGHT_BOUNDS];
      expect(value).toBeGreaterThanOrEqual(low - 0.02);
      expect(value).toBeLessThanOrEqual(high + 0.02);
    }
    const untouched = regularizeWeights({ ...POPULATION_WEIGHTS, subjective: 0.3, duration: 0.24 }, 0);
    for (const feature of Object.keys(POPULATION_WEIGHTS) as (keyof typeof POPULATION_WEIGHTS)[]) {
      expect(untouched[feature]).toBeCloseTo(POPULATION_WEIGHTS[feature], 5);
    }
  });

  it('accepts personal weights and a bias without changing the rules', () => {
    const result = predictSleepEnergy(input({ morningRestedness: 2 }), { weights: constrainWeights({ ...POPULATION_WEIGHTS, subjective: 0.3 }), personalBias: 5 });
    expect(result.ok).toBe(true);
  });
});
