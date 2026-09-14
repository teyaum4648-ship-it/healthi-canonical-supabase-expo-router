import { calculateSleepDebt } from './calculateSleepDebt';
import {
  circadianEnergyAt,
  computeRestorationFactor,
  deriveEnergyExtrema,
  deriveEnergyZones
} from './energyModel';
import { calculateSleepDuration } from './calculateSleepDuration';
import type {
  CircadianBriefing,
  CircadianEnergyPoint,
  CircadianPhase,
  DataConfidence,
  RhythmPlan,
  SleepDataSource,
  SleepNeedEstimate,
  SleepSession,
  TimeWindow
} from './types';

type GenerateCircadianBriefingParams = {
  date: string;
  timezone: string;
  recentSleepSessions: SleepSession[];
  sleepNeed: SleepNeedEstimate;
  preferredBedtime?: string | null;
  now?: string;
};

const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

function parseDate(input: string | null | undefined): Date | null {
  if (!input) {
    return null;
  }

  const parsed = new Date(input);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * MINUTE_MS);
}

function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * HOUR_MS);
}

function toIso(date: Date): string {
  return date.toISOString();
}

function createWindow(start: Date, end: Date, label: string): TimeWindow {
  return {
    start_at: toIso(start),
    end_at: toIso(end),
    label
  };
}

function getSessionDistance(date: string, session: SleepSession): number {
  return Math.abs(date.slice(0, 10).localeCompare(session.date.slice(0, 10)));
}

function findMostRecentSession(date: string, sessions: SleepSession[]): SleepSession | null {
  const target = date.slice(0, 10);

  return (
    [...sessions]
      .filter((session) => session.date.slice(0, 10) <= target)
      .sort((a, b) => {
        const dateSort = b.date.localeCompare(a.date);

        if (dateSort !== 0) {
          return dateSort;
        }

        return getSessionDistance(target, a) - getSessionDistance(target, b);
      })[0] ?? null
  );
}

function parsePreferredBedtime(preferredBedtime: string | null | undefined, date: string): Date | null {
  if (!preferredBedtime) {
    return null;
  }

  const timeOnly = /^(\d{1,2}):(\d{2})$/.exec(preferredBedtime.trim());

  if (timeOnly) {
    const hours = Number(timeOnly[1]);
    const minutes = Number(timeOnly[2]);

    if (hours > 23 || minutes > 59) {
      return null;
    }

    return new Date(`${date.slice(0, 10)}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00.000Z`);
  }

  return parseDate(preferredBedtime);
}

function getTargetBedtime(wakeTime: Date, preferredBedtime: string | null | undefined, date: string): Date {
  const preferred = parsePreferredBedtime(preferredBedtime, date);

  if (!preferred) {
    return addHours(wakeTime, 16);
  }

  if (preferred.getTime() <= wakeTime.getTime()) {
    return addHours(preferred, 24);
  }

  return preferred;
}

function getPhase(hoursSinceWake: number, minutesUntilBed: number): CircadianPhase {
  if (minutesUntilBed <= 0) {
    return 'sleep_window';
  }

  if (minutesUntilBed <= 90) {
    return 'wind_down';
  }

  if (hoursSinceWake < 1) {
    return 'wake_grogginess';
  }

  if (hoursSinceWake < 2) {
    return 'rising';
  }

  if (hoursSinceWake < 5) {
    return 'morning_peak';
  }

  if (hoursSinceWake >= 7 && hoursSinceWake < 9) {
    return 'afternoon_dip';
  }

  if (hoursSinceWake >= 10 && hoursSinceWake < 13) {
    return 'second_peak';
  }

  return 'rising';
}

const ENERGY_SAMPLE_STEP_MINUTES = 20;

function generateEnergyCurve(wakeTime: Date, targetBedtime: Date, restorationFactor: number): CircadianEnergyPoint[] {
  const points: CircadianEnergyPoint[] = [];
  const stepMs = ENERGY_SAMPLE_STEP_MINUTES * MINUTE_MS;
  const endMs = targetBedtime.getTime();

  for (let cursorMs = wakeTime.getTime(); cursorMs <= endMs; cursorMs += stepMs) {
    const minutesSinceWake = (cursorMs - wakeTime.getTime()) / MINUTE_MS;
    const minutesUntilBed = (endMs - cursorMs) / MINUTE_MS;
    const phase = getPhase(minutesSinceWake / 60, minutesUntilBed);

    points.push({
      time: toIso(new Date(cursorMs)),
      estimated_energy: circadianEnergyAt(minutesSinceWake, minutesUntilBed, restorationFactor),
      label: phase
    });
  }

  return points;
}

function createEmptyRhythmPlan(): RhythmPlan {
  return {
    deep_work_windows: [],
    best_exercise_windows: [],
    best_walk_windows: [],
    nap_windows: [],
    breathing_windows: [],
    morning_light_windows: [],
    evening_dim_light_start: null,
    caffeine_cutoff: null,
    caffeine_cutoff_large_dose: null,
    wind_down_start: null,
    target_bedtime: null,
    reason_codes: []
  };
}

/**
 * Exercise is placed where two independent lines of evidence agree.
 *
 * Physical performance peaks with core body temperature in the late afternoon and
 * early evening, and exercise ending less than four hours before sleep is
 * associated with later onset, shorter and worse sleep. For a typical riser those
 * two facts point at the same stretch of the day, so the window runs from eight
 * hours after waking to ten, and is then cut off four hours before target bedtime.
 *
 * A window narrower than this is withheld rather than shown as a sliver: a short
 * slot reads as precision the input cannot support.
 */
const EXERCISE_START_AFTER_WAKE_H = 8;
const EXERCISE_END_AFTER_WAKE_H = 10;
const EXERCISE_SLEEP_BUFFER_H = 4;
const MIN_EXERCISE_WINDOW_MINUTES = 45;

/** 8.8 h for a standard 107 mg coffee, rounded up; 13.2 h for ~200 mg or more. */
const CAFFEINE_CUTOFF_H = 9;
const CAFFEINE_CUTOFF_LARGE_DOSE_H = 13;

/** Melatonin is half-suppressed below ~30 lux, which is ordinary indoor lighting. */
const DIM_LIGHT_BEFORE_BED_H = 3;

function createRhythmPlan(wakeTime: Date, targetBedtime: Date, averageDebt: number | null): RhythmPlan {
  const windDownStart = addMinutes(targetBedtime, -90);
  const caffeineCutoff = addHours(targetBedtime, -CAFFEINE_CUTOFF_H);
  const debtIsModerateOrHigh = averageDebt !== null && averageDebt >= 60;
  const reasonCodes = [
    'deep_work_window_suggested',
    'movement_window_suggested',
    'morning_light_recommended',
    'caffeine_cutoff_recommended',
    'wind_down_recommended'
  ];

  const exerciseStart = addHours(wakeTime, EXERCISE_START_AFTER_WAKE_H);
  const exerciseLatestEnd = addHours(targetBedtime, -EXERCISE_SLEEP_BUFFER_H);
  const preferredEnd = addHours(wakeTime, EXERCISE_END_AFTER_WAKE_H);
  const exerciseEnd = preferredEnd.getTime() < exerciseLatestEnd.getTime() ? preferredEnd : exerciseLatestEnd;
  const exerciseWindows: TimeWindow[] = [];
  if (exerciseEnd.getTime() - exerciseStart.getTime() >= MIN_EXERCISE_WINDOW_MINUTES * MINUTE_MS) {
    exerciseWindows.push(createWindow(exerciseStart, exerciseEnd, 'suggested exercise timing'));
  }
  // Kept for people who can only train early. Labelled so it does not read as the
  // better slot: morning strength and power output measure below the afternoon.
  exerciseWindows.push(
    createWindow(addHours(wakeTime, 3), addHours(wakeTime, 5), 'earlier option if mornings suit you better')
  );

  const plan: RhythmPlan = {
    // Centred on the modelled morning peak (~3.5 h after waking) rather than starting at
    // +2 h, which began while sleep inertia was still measurably clearing.
    deep_work_windows: [
      createWindow(addHours(wakeTime, 2.5), addHours(wakeTime, 4.5), 'likely deep work window'),
      createWindow(addHours(wakeTime, 10), addHours(wakeTime, 11.5), 'likely second focus window')
    ],
    best_exercise_windows: exerciseWindows,
    best_walk_windows: [
      createWindow(addHours(wakeTime, 1), addHours(wakeTime, 1.5), 'suggested light movement'),
      createWindow(addHours(wakeTime, 7), addHours(wakeTime, 7.5), 'suggested afternoon walk')
    ],
    nap_windows: [],
    breathing_windows: [
      createWindow(addHours(wakeTime, 7.5), addHours(wakeTime, 7.75), 'suggested reset window'),
      createWindow(windDownStart, addMinutes(windDownStart, 15), 'suggested wind-down reset')
    ],
    // A single 30-minute exposure soon after waking is the documented dose. The
    // window is an hour wide because the 30 minutes need not start at the minute of waking.
    morning_light_windows: [
      createWindow(wakeTime, addHours(wakeTime, 1), '30 minutes of outdoor or bright light')
    ],
    evening_dim_light_start: toIso(addHours(targetBedtime, -DIM_LIGHT_BEFORE_BED_H)),
    caffeine_cutoff: toIso(caffeineCutoff),
    caffeine_cutoff_large_dose: toIso(addHours(targetBedtime, -CAFFEINE_CUTOFF_LARGE_DOSE_H)),
    wind_down_start: toIso(windDownStart),
    target_bedtime: toIso(targetBedtime),
    reason_codes: reasonCodes
  };

  if (debtIsModerateOrHigh) {
    // The dip sits 7-8 h after waking; 20 minutes is the dose that avoids waking
    // out of slow-wave sleep, which begins around 30 minutes in.
    plan.nap_windows = [
      createWindow(addHours(wakeTime, 7), addHours(wakeTime, 8), 'a 20-minute nap inside this window')
    ];
    plan.reason_codes.push('nap_window_suggested');
  }

  return plan;
}

function combineConfidence(
  sourceConfidence: DataConfidence,
  sleepNeedConfidence: DataConfidence,
  debtConfidence: DataConfidence
): DataConfidence {
  if ([sourceConfidence, sleepNeedConfidence, debtConfidence].includes('low')) {
    return 'low';
  }

  if (sourceConfidence === 'high' && sleepNeedConfidence === 'high' && debtConfidence === 'high') {
    return 'high';
  }

  return 'medium';
}

function getCurrentPhase(now: string | undefined, wakeTime: Date, targetBedtime: Date): CircadianPhase {
  const current = parseDate(now) ?? addHours(wakeTime, 3);
  const hoursSinceWake = (current.getTime() - wakeTime.getTime()) / HOUR_MS;
  const minutesUntilBed = (targetBedtime.getTime() - current.getTime()) / MINUTE_MS;

  return getPhase(hoursSinceWake, minutesUntilBed);
}

export function generateCircadianBriefing(params: GenerateCircadianBriefingParams): CircadianBriefing {
  const session = findMostRecentSession(params.date, params.recentSleepSessions);
  const sleepDebt7Day = calculateSleepDebt({
    date: params.date,
    sessions: params.recentSleepSessions,
    sleepNeed: params.sleepNeed,
    rollingWindowDays: 7
  });
  const sleepDebt14Day = calculateSleepDebt({
    date: params.date,
    sessions: params.recentSleepSessions,
    sleepNeed: params.sleepNeed,
    rollingWindowDays: 14
  });
  const source: SleepDataSource = session?.source ?? 'estimated';
  const sourceConfidence: DataConfidence = session?.source_confidence ?? 'low';
  const wakeTime = parseDate(session?.sleep_end_at);

  if (!wakeTime) {
    return {
      date: params.date,
      timezone: params.timezone,
      wake_time: null,
      target_bedtime: null,
      current_phase: 'unknown',
      energy_curve: [],
      energy_zones: [],
      energy_extrema: [],
      rhythm_plan: createEmptyRhythmPlan(),
      sleep_debt_7_day: sleepDebt7Day,
      sleep_debt_14_day: sleepDebt14Day,
      confidence: 'low',
      reason_codes: ['sleep_data_missing', 'calibrating'],
      source_summary: {
        sleep_source: source,
        source_confidence: sourceConfidence
      }
    };
  }

  const targetBedtime = getTargetBedtime(wakeTime, params.preferredBedtime, params.date);
  const restorationFactor = computeRestorationFactor({
    quality: session?.sleep_quality ?? null,
    durationMinutes:
      session?.duration_minutes ?? calculateSleepDuration(session?.sleep_start_at ?? null, session?.sleep_end_at ?? null),
    sleepNeedMinutes: params.sleepNeed.minutes,
    avgDebtMinutes: sleepDebt7Day.nightly_average_debt_minutes
  });
  const energyCurve = generateEnergyCurve(wakeTime, targetBedtime, restorationFactor);
  const energyZones = deriveEnergyZones(energyCurve);
  const energyExtrema = deriveEnergyExtrema(energyCurve);
  const rhythmPlan = createRhythmPlan(wakeTime, targetBedtime, sleepDebt7Day.nightly_average_debt_minutes);
  const confidence = combineConfidence(sourceConfidence, params.sleepNeed.confidence, sleepDebt7Day.confidence);
  const reasonCodes = [
    'circadian_phase_estimated',
    ...sleepDebt7Day.reason_codes,
    ...rhythmPlan.reason_codes
  ];

  if (session?.corrected_by_user) {
    reasonCodes.push('user_corrected_sleep');
  } else if (source === 'manual' || source === 'demo') {
    reasonCodes.push('wake_time_estimated');
  }

  return {
    date: params.date,
    timezone: params.timezone,
    wake_time: toIso(wakeTime),
    target_bedtime: toIso(targetBedtime),
    current_phase: getCurrentPhase(params.now, wakeTime, targetBedtime),
    energy_curve: energyCurve,
    energy_zones: energyZones,
    energy_extrema: energyExtrema,
    rhythm_plan: rhythmPlan,
    sleep_debt_7_day: sleepDebt7Day,
    sleep_debt_14_day: sleepDebt14Day,
    confidence,
    reason_codes: Array.from(new Set(reasonCodes)),
    source_summary: {
      sleep_source: source,
      source_confidence: sourceConfidence
    }
  };
}

