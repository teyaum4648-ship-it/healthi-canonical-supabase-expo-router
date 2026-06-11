import { calculateSleepDebt } from './calculateSleepDebt';
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

function getDebtPenalty(nightlyAverageDebt: number | null): number {
  if (nightlyAverageDebt === null) {
    return 4;
  }

  if (nightlyAverageDebt > 180) {
    return 22;
  }

  if (nightlyAverageDebt >= 60) {
    return 12;
  }

  return 0;
}

function clampEnergy(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
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

function energyForPhase(phase: CircadianPhase, debtPenalty: number): number {
  const baseByPhase: Record<CircadianPhase, number> = {
    wake_grogginess: 44,
    rising: 64,
    morning_peak: 84,
    afternoon_dip: 52,
    second_peak: 76,
    wind_down: 38,
    sleep_window: 24,
    unknown: 0
  };

  const penalty = phase === 'sleep_window' || phase === 'wind_down' ? debtPenalty * 0.5 : debtPenalty;

  return clampEnergy(baseByPhase[phase] - penalty);
}

function generateEnergyCurve(wakeTime: Date, targetBedtime: Date, debtPenalty: number): CircadianEnergyPoint[] {
  const points: CircadianEnergyPoint[] = [];

  for (let cursor = wakeTime; cursor.getTime() <= targetBedtime.getTime(); cursor = addHours(cursor, 1)) {
    const hoursSinceWake = (cursor.getTime() - wakeTime.getTime()) / HOUR_MS;
    const minutesUntilBed = (targetBedtime.getTime() - cursor.getTime()) / MINUTE_MS;
    const phase = getPhase(hoursSinceWake, minutesUntilBed);

    points.push({
      time: toIso(cursor),
      estimated_energy: energyForPhase(phase, debtPenalty),
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
    caffeine_cutoff: null,
    wind_down_start: null,
    target_bedtime: null,
    reason_codes: []
  };
}

function createRhythmPlan(wakeTime: Date, targetBedtime: Date, averageDebt: number | null): RhythmPlan {
  const windDownStart = addMinutes(targetBedtime, -90);
  const caffeineCutoff = addHours(targetBedtime, -8);
  const debtIsModerateOrHigh = averageDebt !== null && averageDebt >= 60;
  const reasonCodes = [
    'deep_work_window_suggested',
    'movement_window_suggested',
    'caffeine_cutoff_recommended',
    'wind_down_recommended'
  ];

  const plan: RhythmPlan = {
    deep_work_windows: [
      createWindow(addHours(wakeTime, 2), addHours(wakeTime, 4), 'likely deep work window'),
      createWindow(addHours(wakeTime, 10), addHours(wakeTime, 11.5), 'likely second focus window')
    ],
    best_exercise_windows: [
      createWindow(addHours(wakeTime, 3), addHours(wakeTime, 5), 'suggested exercise timing'),
      createWindow(addHours(wakeTime, 10), addHours(wakeTime, 12), 'suggested later exercise timing')
    ],
    best_walk_windows: [
      createWindow(addHours(wakeTime, 1), addHours(wakeTime, 1.5), 'suggested light movement'),
      createWindow(addHours(wakeTime, 7), addHours(wakeTime, 7.5), 'suggested afternoon walk')
    ],
    nap_windows: [],
    breathing_windows: [
      createWindow(addHours(wakeTime, 7.5), addHours(wakeTime, 7.75), 'suggested reset window'),
      createWindow(windDownStart, addMinutes(windDownStart, 15), 'suggested wind-down reset')
    ],
    caffeine_cutoff: toIso(caffeineCutoff),
    wind_down_start: toIso(windDownStart),
    target_bedtime: toIso(targetBedtime),
    reason_codes: reasonCodes
  };

  if (debtIsModerateOrHigh) {
    plan.nap_windows = [
      createWindow(addHours(wakeTime, 7), addHours(wakeTime, 7.5), 'possible short nap window')
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
  const debtPenalty = getDebtPenalty(sleepDebt7Day.nightly_average_debt_minutes);
  const energyCurve = generateEnergyCurve(wakeTime, targetBedtime, debtPenalty);
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

