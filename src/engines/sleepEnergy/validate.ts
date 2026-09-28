import { minutesBetween } from './interpolate';
import { isPlausibleMorningHR, PLAUSIBLE_MORNING_HR } from './scores';
import type { SleepInput, SleepInputError, SleepRecord } from './types';

const MAX_WINDOW_MINUTES = 24 * 60;
const SLEEP_NEED_RANGE = { min: 240, max: 720 } as const;
const MAX_AWAKENINGS = 30;

function isValidDate(value: unknown): value is Date {
  return value instanceof Date && Number.isFinite(value.getTime());
}

function isUnknown(value: number | null | undefined): value is null | undefined {
  return value === null || value === undefined;
}

/**
 * Every impossible input is refused with a reason rather than bent into shape. A negative
 * latency, a wake time before bedtime, a thirty-hour night or a pulse of 250 are errors a
 * person can fix; quietly clamping them would produce a confident prediction from nonsense.
 */
export function validateSleepInput(input: SleepInput): SleepInputError[] {
  const errors: SleepInputError[] = [];
  const add = (code: SleepInputError['code'], field: string, message: string) => errors.push({ code, field, message });

  if (!isValidDate(input.bedtime)) add('invalid_date', 'bedtime', 'Bedtime is not a valid time.');
  if (!isValidDate(input.finalWakeTime)) add('invalid_date', 'finalWakeTime', 'Wake time is not a valid time.');

  if (isValidDate(input.bedtime) && isValidDate(input.finalWakeTime)) {
    const window = minutesBetween(input.bedtime, input.finalWakeTime);
    if (window <= 0) add('wake_not_after_bedtime', 'finalWakeTime', 'Wake time has to be after bedtime.');
    else if (window > MAX_WINDOW_MINUTES) add('window_longer_than_24_hours', 'finalWakeTime', 'A night longer than 24 hours is not a single night of sleep.');
    else {
      const latency = input.sleepLatencyMinutes ?? 0;
      const awake = input.awakeDuringNightMinutes ?? 0;
      if (latency >= 0 && awake >= 0 && latency + awake > window) {
        add('awake_exceeds_time_in_bed', 'awakeDuringNightMinutes', 'Time to fall asleep and time awake add up to more than the time in bed.');
      }
    }
  }

  for (const [field, value] of [['sleepLatencyMinutes', input.sleepLatencyMinutes], ['awakeDuringNightMinutes', input.awakeDuringNightMinutes]] as const) {
    if (isUnknown(value)) continue;
    if (!Number.isFinite(value) || value < 0) add('negative_value', field, `${field === 'sleepLatencyMinutes' ? 'Time to fall asleep' : 'Time awake'} cannot be negative.`);
  }

  if (!isUnknown(input.awakeningCount)) {
    const count = input.awakeningCount;
    if (!Number.isInteger(count) || count < 0 || count > MAX_AWAKENINGS) {
      add('awakening_count_invalid', 'awakeningCount', `Awakenings must be a whole number from 0 to ${MAX_AWAKENINGS}.`);
    }
  }

  if (!isUnknown(input.morningRestedness) && ![1, 2, 3, 4, 5].includes(input.morningRestedness)) {
    add('restedness_invalid', 'morningRestedness', 'Morning restedness must be 1 to 5.');
  }

  if (!isUnknown(input.morningHeartRate) && !isPlausibleMorningHR(input.morningHeartRate)) {
    add('heart_rate_implausible', 'morningHeartRate', `A morning pulse is expected between ${PLAUSIBLE_MORNING_HR.min} and ${PLAUSIBLE_MORNING_HR.max} bpm. Recount for 30 seconds and double it.`);
  }

  if (!Number.isFinite(input.sleepNeedMinutes) || input.sleepNeedMinutes < SLEEP_NEED_RANGE.min || input.sleepNeedMinutes > SLEEP_NEED_RANGE.max) {
    add('sleep_need_implausible', 'sleepNeedMinutes', `Sleep need is expected between ${SLEEP_NEED_RANGE.min / 60} and ${SLEEP_NEED_RANGE.max / 60} hours.`);
  }

  if (input.circadianCurve.some((point) => !isValidDate(point.timestamp) || !Number.isFinite(point.energy) || point.energy < 0 || point.energy > 100)) {
    add('curve_value_invalid', 'circadianCurve', 'The circadian curve has a point outside 0–100 or without a valid time.');
  }

  return errors;
}

/**
 * Stored history is read, not typed, so one bad row should not block today's prediction.
 * Impossible rows are dropped and each drop is reported by the caller as a warning.
 */
export function partitionHistory(previousNights: SleepRecord[]): { valid: SleepRecord[]; warnings: string[] } {
  const valid: SleepRecord[] = [];
  const warnings: string[] = [];
  for (const night of previousNights) {
    if (!isValidDate(night.date) || !Number.isFinite(night.estimatedSleepMinutes) || night.estimatedSleepMinutes < 0 || night.estimatedSleepMinutes > MAX_WINDOW_MINUTES) {
      warnings.push('history_night_ignored_invalid');
      continue;
    }
    if (!isUnknown(night.morningHeartRate) && !isPlausibleMorningHR(night.morningHeartRate)) {
      warnings.push('history_heart_rate_ignored_implausible');
      valid.push({ date: night.date, estimatedSleepMinutes: night.estimatedSleepMinutes });
      continue;
    }
    valid.push(night);
  }
  return { valid, warnings };
}
