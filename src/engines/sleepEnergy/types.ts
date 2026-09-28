/**
 * Types for the phone-only sleep-to-energy prediction.
 *
 * Two ideas are kept apart on purpose. Circadian timing decides *when* energy peaks and
 * dips happen, and arrives here as an already-computed curve. Sleep recovery decides *how
 * strong* that day is likely to feel, and is what this module adds. Nothing in here moves
 * a peak in time.
 */

/** 1 exhausted · 2 tired · 3 okay · 4 rested · 5 very rested. */
export type Restedness = 1 | 2 | 3 | 4 | 5;

export type SleepRecord = {
  /** The morning the night ended on. Compared by UTC calendar day, the app's wall-clock axis. */
  date: Date;
  estimatedSleepMinutes: number;
  morningHeartRate?: number | null;
};

export type CircadianPoint = {
  timestamp: Date;
  /** 0–100. */
  energy: number;
};

export type SleepInput = {
  bedtime: Date;
  finalWakeTime: Date;
  /** Minutes in bed before falling asleep. Null or omitted when the person does not know. */
  sleepLatencyMinutes?: number | null;
  /** Awakenings the person remembers. Null or omitted when unknown. */
  awakeningCount?: number | null;
  /** Total minutes awake after first falling asleep. Null or omitted when unknown. */
  awakeDuringNightMinutes?: number | null;
  /** Null or omitted when unasked. */
  morningRestedness?: Restedness | null;
  /** Pulse taken at the wrist while still lying down after waking, bpm. */
  morningHeartRate?: number | null;
  /** Estimated sleep need. Callers without one use {@link DEFAULT_SLEEP_NEED_MINUTES}. */
  sleepNeedMinutes: number;
  /** Nights before last night. Last night itself must not be repeated here. */
  previousNights: SleepRecord[];
  /** The existing circadian curve, at full strength and without sleep inertia. */
  circadianCurve: CircadianPoint[];
  /** The person said they are unsure of their bed and wake times. */
  timesUncertain?: boolean;
};

export const DEFAULT_SLEEP_NEED_MINUTES = 480;

export type RecoveryFeature = 'duration' | 'fragmentation' | 'efficiency' | 'sleepDebt' | 'subjective' | 'heartRate';

export type RecoveryWeights = Record<RecoveryFeature, number>;

export type SleepMetrics = {
  timeInBedMinutes: number;
  estimatedSleepMinutes: number;
  /** 0–1. */
  sleepEfficiency: number;
  durationRatio: number;
  awakeDuringNightMinutes: number;
  weightedDebtMinutes: number | null;
  baselineMorningHR: number | null;
  /** Percent above (positive) or below the person's own baseline. */
  morningHRDeviationPercent: number | null;
};

export type ContributorImpact = 'positive' | 'neutral' | 'negative';

export type SleepContributor = {
  id: RecoveryFeature;
  score: number;
  impact: ContributorImpact;
  message: string;
};

export type SleepEnergyPrediction = {
  /** 0–100, one decimal. */
  sleepRecoveryScore: number;
  /** The Sleep score shown for the day: the recovery score, rounded. Never read off the curve. */
  dailySleepScore: number;
  recoveryMultiplier: number;
  /** 0–100. Confidence in the prediction, not a statement about health. */
  modelConfidence: number;
  metrics: SleepMetrics;
  /** Each feature's 0–100 score, or null when it could not be used. */
  scores: Record<RecoveryFeature, number | null>;
  /** The weights actually applied, after unavailable features were dropped and the rest renormalised. */
  weightsUsed: Partial<RecoveryWeights>;
  /** Most negative first. */
  contributors: SleepContributor[];
  /** Plain notes about what was left out and why. */
  notes: string[];
  energyCurve: CircadianPoint[];
  reason_codes: string[];
  /** Stored history that was ignored because it was impossible. Surfaced, never silent. */
  warnings: string[];
};

export type SleepInputErrorCode =
  | 'invalid_date'
  | 'wake_not_after_bedtime'
  | 'window_longer_than_24_hours'
  | 'negative_value'
  | 'awake_exceeds_time_in_bed'
  | 'awakening_count_invalid'
  | 'restedness_invalid'
  | 'heart_rate_implausible'
  | 'sleep_need_implausible'
  | 'curve_value_invalid';

export type SleepInputError = { code: SleepInputErrorCode; field: string; message: string };

export type PredictionResult =
  | { ok: true; prediction: SleepEnergyPrediction }
  | { ok: false; errors: SleepInputError[] };
