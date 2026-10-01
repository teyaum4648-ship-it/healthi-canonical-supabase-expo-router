import { calculateSleepDebt } from './calculateSleepDebt';
import { circularDifference, estimateCircadianPhase, type CircadianPhaseEstimate } from './circadianPhase';
import {
  circadianEnergyAt,
  computeRestoration,
  deriveDayOutlook,
  deriveEnergyExtrema,
  deriveEnergyZones,
  deriveTypicalBand,
  THIN_COVERAGE,
  type DayOutlook,
  type EnergyModifiers
} from './energyModel';
import { calculateSleepDuration } from './calculateSleepDuration';
import {
  limiterFromPrediction,
  predictFromSession,
  summarizeRecovery,
  typicalBandFromTiming,
  type MorningPulse,
  type MorningReport
} from './sleepRecoveryAdapter';
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
  /** How refreshed the person said they felt on waking, 1–5. Null when unasked. */
  refreshment?: number | null;
  /** Local dates (YYYY-MM-DD) on which meaningful morning light was logged. */
  morningLightDates?: string[];
  /** Minutes of morning light logged today. */
  morningLightMinutes?: number | null;
  /** Estimated caffeine still on board right now, mg. */
  caffeineOnBoardMg?: number | null;
  /**
   * Where the clock sits according to the chronotype questions, before any night is known.
   *
   * Only ever a starting point: each logged night can still move the estimate by up to an
   * hour, so a week of real sleep overrules it. Null once someone has declined the day it
   * proposed, since carrying on from answers they have rejected is not listening.
   */
  chronotypeMidSleepMinutes?: number | null;
  /**
   * This morning's answers about last night: time to fall asleep, time awake, how rested.
   * Feeds the sleep-to-energy prediction; anything unanswered lowers its confidence only.
   */
  morningReport?: MorningReport | null;
  /** Morning pulses by date, taken at the wrist before getting up. */
  morningPulses?: MorningPulse[];
};

/**
 * How old last night's record may be before it stops describing today.
 *
 * `findMostRecentSession` will happily return a session from last week, and the curve was
 * then anchored to a week-old wake time at full confidence. Past this age the record is no
 * longer evidence about this morning, so the rhythm falls back to the body clock's own
 * expected wake and the briefing says so.
 */
const MAX_SESSION_AGE_DAYS = 2;

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

/** Whole days from `earlier` to `later`, on calendar dates. Null if either is unparseable. */
function daysBetweenDates(later: string, earlier: string): number | null {
  const a = new Date(`${later.slice(0, 10)}T00:00:00.000Z`);
  const b = new Date(`${earlier.slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null;
  return Math.round((a.getTime() - b.getTime()) / (24 * HOUR_MS));
}

/**
 * The clock time the body expected to wake: its mid-sleep, plus half a night's sleep need.
 * Used when last night's record is missing or stale, so the rhythm still has an anchor.
 */
function expectedWakeFromPhase(date: string, phaseMinutes: number, sleepNeedMinutes: number): Date | null {
  const midnight = new Date(`${date.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(midnight.getTime())) return null;
  const wakeMinutes = ((phaseMinutes + sleepNeedMinutes / 2) % 1440 + 1440) % 1440;
  return new Date(midnight.getTime() + wakeMinutes * MINUTE_MS);
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

/**
 * Bedtime closes the day that this wake opened, so a preferred clock time is placed on the
 * wake's own date (or the next, if it falls before the wake). Placing it on the date being
 * asked about instead let a wake from yesterday pair with tonight's bedtime: a 38-hour
 * "day" whose curve flattened between a squeezed morning and evening.
 */
function getTargetBedtime(wakeTime: Date, preferredBedtime: string | null | undefined): Date {
  const preferred = parsePreferredBedtime(preferredBedtime, wakeTime.toISOString().slice(0, 10));

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

function generateEnergyCurve(
  wakeTime: Date,
  targetBedtime: Date,
  restorationFactor: number,
  modifiers: EnergyModifiers = {}
): CircadianEnergyPoint[] {
  const points: CircadianEnergyPoint[] = [];
  const stepMs = ENERGY_SAMPLE_STEP_MINUTES * MINUTE_MS;
  const endMs = targetBedtime.getTime();

  for (let cursorMs = wakeTime.getTime(); cursorMs <= endMs; cursorMs += stepMs) {
    const minutesSinceWake = (cursorMs - wakeTime.getTime()) / MINUTE_MS;
    const minutesUntilBed = (endMs - cursorMs) / MINUTE_MS;
    const phase = getPhase(minutesSinceWake / 60, minutesUntilBed);

    points.push({
      time: toIso(new Date(cursorMs)),
      estimated_energy: circadianEnergyAt(minutesSinceWake, minutesUntilBed, restorationFactor, {
        ...modifiers,
        /*
         * The clock offset is constant across the day — it is how late this morning's
         * wake was relative to what the body expected — so adding it to each sample's
         * minutes-since-wake puts the rhythm back on clock time.
         */
        minutesSinceCircadianWake:
          modifiers.minutesSinceCircadianWake === null || modifiers.minutesSinceCircadianWake === undefined
            ? null
            : minutesSinceWake + modifiers.minutesSinceCircadianWake
      }),
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

/** Variadic so new signals can join without another positional argument. Weakest wins. */
function combineConfidence(...parts: DataConfidence[]): DataConfidence {
  if (parts.includes('low')) {
    return 'low';
  }

  if (parts.every((part) => part === 'high')) {
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

  const phaseEstimate = estimateCircadianPhase({
    sessions: params.recentSleepSessions,
    morningLightDates: params.morningLightDates,
    priorMidSleepMinutes: params.chronotypeMidSleepMinutes
  });

  /*
   * A session older than a couple of days is not evidence about this morning. Rather than
   * anchoring the whole day to a stale wake time, or blanking the chart entirely, the
   * rhythm falls back to the clock's own expected wake and the briefing reports it.
   */
  const sessionAgeDays = session ? daysBetweenDates(params.date, session.date) : null;
  const sessionIsStale = sessionAgeDays === null || sessionAgeDays > MAX_SESSION_AGE_DAYS;
  const actualWake = sessionIsStale ? null : parseDate(session?.sleep_end_at);

  /*
   * Misalignment from one or two nights is structurally zero — the phase estimate starts
   * at the first night's mid-sleep, so a single night is by construction in step with
   * itself. Counting that as a known term flattered coverage and made a first-ever log
   * look better established than it was.
   */
  const usableMisalignment =
    phaseEstimate && phaseEstimate.nightsUsed >= 3 ? phaseEstimate.misalignmentMinutes : null;
  const expectedWake = phaseEstimate
    ? expectedWakeFromPhase(params.date, phaseEstimate.phaseMinutes, params.sleepNeed.minutes)
    : null;
  const wakeTime = actualWake ?? expectedWake;

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
      },
      day_outlook: null,
      circadian_phase: phaseEstimate,
      limiter: null,
      input_coverage: 0,
      typical_band: null,
      sleep_recovery: null
    };
  }

  const targetBedtime = getTargetBedtime(wakeTime, params.preferredBedtime);
  const restoration = computeRestoration({
    quality: sessionIsStale ? null : session?.sleep_quality ?? null,
    refreshment: params.refreshment ?? null,
    durationMinutes: sessionIsStale
      ? null
      : session?.duration_minutes ?? calculateSleepDuration(session?.sleep_start_at ?? null, session?.sleep_end_at ?? null),
    sleepNeedMinutes: params.sleepNeed.minutes,
    avgDebtMinutes: sleepDebt7Day.nightly_average_debt_minutes,
    regularityScore: phaseEstimate?.regularityScore ?? null,
    misalignmentMinutes: sessionIsStale ? null : usableMisalignment
  });
  const restorationFactor = restoration.factor;

  /* Positive when this morning's wake was later than the clock expected. */
  const clockOffsetMinutes =
    actualWake && expectedWake
      ? circularDifference(
          actualWake.getHours() * 60 + actualWake.getMinutes(),
          expectedWake.getHours() * 60 + expectedWake.getMinutes()
        )
      : null;

  const curveModifiers: EnergyModifiers = {
    misalignmentMinutes: sessionIsStale ? null : usableMisalignment,
    caffeineOnBoardMg: params.caffeineOnBoardMg ?? null,
    morningLightMinutes: params.morningLightMinutes ?? null,
    minutesSinceCircadianWake: clockOffsetMinutes
  };

  /*
   * With a current night on record, timing and recovery are kept apart. The circadian
   * model draws the day at full strength and without inertia, which fixes when the peaks
   * and dips fall; the sleep-to-energy prediction then decides how strong they are likely
   * to feel and adds the morning's inertia. Without one, the older restoration path runs.
   */
  const timingCurve = !sessionIsStale && session && actualWake
    ? generateEnergyCurve(wakeTime, targetBedtime, 1, { ...curveModifiers, excludeInertia: true })
    : null;
  const predicted = timingCurve && session
    ? predictFromSession({
        date: params.date,
        session,
        sessions: params.recentSleepSessions,
        sleepNeedMinutes: params.sleepNeed.minutes,
        timingCurve,
        report: params.morningReport ?? null,
        pulses: params.morningPulses ?? [],
        refreshment: params.refreshment ?? null
      })
    : null;
  const prediction = predicted && 'prediction' in predicted ? predicted.prediction : null;
  const energyCurve = predicted && 'curve' in predicted
    ? predicted.curve
    : generateEnergyCurve(wakeTime, targetBedtime, restorationFactor, curveModifiers);
  const inputCoverage = prediction ? prediction.modelConfidence / 100 : restoration.coverage;
  const dayOutlook = deriveDayOutlook(energyCurve, inputCoverage, ENERGY_SAMPLE_STEP_MINUTES);
  const energyZones = deriveEnergyZones(energyCurve);
  const energyExtrema = deriveEnergyExtrema(energyCurve);
  const rhythmPlan = createRhythmPlan(wakeTime, targetBedtime, sleepDebt7Day.nightly_average_debt_minutes);
  /*
   * Thin input lowers confidence rather than the score, which is the rule the previous
   * version broke by filling unknown terms with a flattering placeholder.
   */
  const coverageConfidence: DataConfidence = prediction
    ? prediction.modelConfidence >= 85 ? 'high' : prediction.modelConfidence >= 60 ? 'medium' : 'low'
    : restoration.coverage >= 0.7 ? 'high' : restoration.coverage >= THIN_COVERAGE ? 'medium' : 'low';
  const confidence = combineConfidence(
    sessionIsStale ? 'low' : sourceConfidence,
    params.sleepNeed.confidence,
    sleepDebt7Day.confidence,
    coverageConfidence,
    phaseEstimate?.confidence ?? 'low'
  );
  const recentNightMinutes = sleepDebt14Day.nights
    .map((night) => night.sleep_minutes)
    .filter((minutes): minutes is number => typeof minutes === 'number');
  const reasonCodes = [
    'circadian_phase_estimated',
    ...sleepDebt7Day.reason_codes,
    ...rhythmPlan.reason_codes
  ];

  if (sessionIsStale) {
    /* The rhythm is anchored to the clock's expected wake, not to a real record. */
    reasonCodes.push('sleep_data_stale', 'wake_time_estimated');
  }
  if (inputCoverage < THIN_COVERAGE) {
    reasonCodes.push('sleep_inputs_thin');
  }
  if (prediction) {
    reasonCodes.push('sleep_recovery_predicted', ...prediction.reason_codes);
  } else if (predicted && 'errors' in predicted) {
    reasonCodes.push('sleep_prediction_input_invalid');
  }
  if (usableMisalignment !== null && Math.abs(usableMisalignment) >= 60) {
    reasonCodes.push('rhythm_out_of_step');
  }
  if (phaseEstimate?.regularityScore !== null && phaseEstimate?.regularityScore !== undefined && phaseEstimate.regularityScore < 0.5) {
    reasonCodes.push('schedule_irregular');
  }
  const limiter = prediction ? limiterFromPrediction(prediction) : restoration.limiter;
  if (limiter) {
    reasonCodes.push(`limiter_${limiter}`);
  }

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
    },
    day_outlook: dayOutlook,
    circadian_phase: phaseEstimate,
    limiter,
    input_coverage: inputCoverage,
    typical_band: prediction && timingCurve
      ? typicalBandFromTiming(timingCurve, recentNightMinutes, params.sleepNeed.minutes)
      : deriveTypicalBand(recentNightMinutes, params.sleepNeed.minutes, (targetBedtime.getTime() - wakeTime.getTime()) / MINUTE_MS),
    sleep_recovery: prediction ? summarizeRecovery(prediction) : null
  };
}

