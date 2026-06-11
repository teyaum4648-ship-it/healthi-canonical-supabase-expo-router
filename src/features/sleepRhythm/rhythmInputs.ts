import {
  calculateSleepDuration,
  type DataConfidence,
  type SleepDataSource,
  type SleepNeedEstimate,
  type SleepSession
} from '../../engines/circadian';

type CreateManualSleepSessionParams = {
  date: string;
  sleepStartTime: string;
  wakeTime: string;
  sleepQuality?: number | null;
  createdAt?: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function parseDate(date: string): Date {
  const parsed = new Date(`${date.slice(0, 10)}T00:00:00.000Z`);

  if (Number.isNaN(parsed.getTime())) {
    return new Date('2026-06-10T00:00:00.000Z');
  }

  return parsed;
}

function parseTimeToMinutes(time: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time.trim());

  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (hours > 23 || minutes > 59) {
    return null;
  }

  return hours * 60 + minutes;
}

function toIsoAtTime(date: Date, time: string): string | null {
  const minutes = parseTimeToMinutes(time);

  if (minutes === null) {
    return null;
  }

  const next = new Date(date.getTime() + minutes * 60 * 1000);
  return next.toISOString();
}

export function createDemoSleepSessions(date = new Date().toISOString().slice(0, 10)): SleepSession[] {
  const baseDate = parseDate(date);
  const durations = [450, 480, 435, 465, 420, 495, 455, 440, 470, 430, 460, 485, 425, 475];

  return durations.map((duration, index) => {
    const sessionDate = new Date(baseDate.getTime() - index * DAY_MS);
    const sessionDateString = sessionDate.toISOString().slice(0, 10);
    const startDate = new Date(sessionDate.getTime() - DAY_MS);
    const startAt = toIsoAtTime(startDate, index % 3 === 0 ? '23:10' : '22:45');
    const endAt = toIsoAtTime(sessionDate, index % 4 === 0 ? '06:20' : '06:45');

    return {
      date: sessionDateString,
      sleep_start_at: startAt,
      sleep_end_at: endAt,
      duration_minutes: duration,
      sleep_quality: index < 2 ? 4 : null,
      source: 'demo',
      source_confidence: 'medium',
      corrected_by_user: false,
      reason_codes: ['calibrating', 'wake_time_estimated'],
      created_at: `${sessionDateString}T12:00:00.000Z`
    };
  });
}

export function createDefaultSleepNeedEstimate(
  updatedAt = new Date().toISOString()
): SleepNeedEstimate {
  return {
    minutes: 480,
    confidence: 'medium',
    basis: ['default'],
    updated_at: updatedAt
  };
}

export function createManualSleepSession(params: CreateManualSleepSessionParams): SleepSession {
  const date = params.date.slice(0, 10);
  const wakeDate = parseDate(date);
  const sleepStartMinutes = parseTimeToMinutes(params.sleepStartTime);
  const wakeMinutes = parseTimeToMinutes(params.wakeTime);
  const sleepStartDate =
    sleepStartMinutes !== null && wakeMinutes !== null && sleepStartMinutes >= wakeMinutes
      ? new Date(wakeDate.getTime() - DAY_MS)
      : wakeDate;
  const sleepStartAt = toIsoAtTime(sleepStartDate, params.sleepStartTime);
  const sleepEndAt = toIsoAtTime(wakeDate, params.wakeTime);

  return {
    date,
    sleep_start_at: sleepStartAt,
    sleep_end_at: sleepEndAt,
    duration_minutes: calculateSleepDuration(sleepStartAt, sleepEndAt),
    sleep_quality: params.sleepQuality ?? null,
    source: 'manual',
    source_confidence: sleepStartAt && sleepEndAt ? 'medium' : 'low',
    corrected_by_user: false,
    reason_codes: sleepStartAt && sleepEndAt ? ['user_confirmed_sleep'] : ['sleep_data_missing'],
    created_at: params.createdAt ?? new Date().toISOString()
  };
}

export function getSleepSourceLabel(source: SleepDataSource): string {
  const labels: Record<SleepDataSource, string> = {
    manual: 'Manual',
    estimated: 'Estimated',
    demo: 'Demo',
    phone_motion: 'Phone estimate coming later',
    phone_activity: 'Phone estimate coming later',
    healthkit: 'Wearable sync coming later',
    health_connect: 'Wearable sync coming later',
    wearable: 'Wearable sync coming later',
    user_corrected: 'Confirmed'
  };

  return labels[source];
}

export function getConfidenceLabel(confidence: DataConfidence): string {
  const labels: Record<DataConfidence, string> = {
    low: 'Low confidence',
    medium: 'Medium confidence',
    high: 'High confidence'
  };

  return labels[confidence];
}

