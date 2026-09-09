import {
  calculateSleepDuration,
  type DataConfidence,
  type SleepDataSource,
  type SleepInterval,
  type SleepSession
} from '../../engines/circadian';

export type SleepWindowStatus = 'estimated' | 'recorded' | 'confirmed' | 'corrected';

export type SleepWindowRecord = {
  schema_version: 1;
  id: string;
  date: string;
  timezone: string;
  start_at: string;
  end_at: string;
  asleep_minutes: number;
  elapsed_minutes: number;
  source: SleepDataSource;
  source_confidence: DataConfidence;
  status: SleepWindowStatus;
  confirmed_by_user: boolean;
  corrected_by_user: boolean;
  based_on_session_id: string | null;
  intervals: SleepInterval[];
  reason_codes: string[];
};

export type SleepWindowClockInterval = {
  id: string;
  start_time: string;
  end_time: string;
};

export type SleepWindowCorrection = {
  start_time: string;
  end_time: string;
  awake_periods?: SleepWindowClockInterval[];
};

type InferSleepWindowParams = {
  date: string;
  timezone: string;
  sessions: SleepSession[];
  preferredBedtime?: string | null;
  preferredWakeTime?: string | null;
};

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;
const NIGHT_AXIS_START = 18 * 60;
const NIGHT_AXIS_END = 36 * 60;

export const SLEEP_SOURCE_PRIORITY: Record<SleepDataSource, number> = {
  user_corrected: 900,
  manual: 800,
  healthkit: 700,
  health_connect: 700,
  wearable: 700,
  phone_motion: 500,
  phone_activity: 500,
  estimated: 300,
  demo: 100
};

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function utcDay(date: string): Date | null {
  const value = new Date(`${date.slice(0, 10)}T00:00:00.000Z`);
  return Number.isNaN(value.getTime()) ? null : value;
}

function parseClock(value: string | null | undefined): number | null {
  if (!value) return null;
  const direct = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (direct) {
    const hour = Number(direct[1]);
    const minute = Number(direct[2]);
    return hour <= 23 && minute <= 59 ? hour * 60 + minute : null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.getUTCHours() * 60 + parsed.getUTCMinutes();
}

function nightAxisMinute(clockMinute: number): number {
  return clockMinute < NIGHT_AXIS_START ? clockMinute + 24 * 60 : clockMinute;
}

function isoAtNightMinute(date: string, minute: number): string | null {
  const day = utcDay(date);
  if (!day) return null;
  return new Date(day.getTime() + (minute - 24 * 60) * MINUTE_MS).toISOString();
}

function clockAtNightMinute(minute: number): string {
  const normalized = ((Math.round(minute) % (24 * 60)) + 24 * 60) % (24 * 60);
  return `${String(Math.floor(normalized / 60)).padStart(2, '0')}:${String(normalized % 60).padStart(2, '0')}`;
}

function intervalMinutes(interval: Pick<SleepInterval, 'start_at' | 'end_at'>): number {
  return calculateSleepDuration(interval.start_at, interval.end_at) ?? 0;
}

function confidenceRank(confidence: DataConfidence): number {
  return confidence === 'high' ? 3 : confidence === 'medium' ? 2 : 1;
}

function validInterval(value: SleepInterval): boolean {
  return Boolean(value.id && (value.state === 'asleep' || value.state === 'awake') && intervalMinutes(value) > 0);
}

function statusForSession(session: SleepSession): SleepWindowStatus {
  if (session.corrected_by_user || session.source === 'user_corrected') return 'corrected';
  if (session.confirmed_by_user || session.source === 'manual') return 'confirmed';
  if (session.source === 'healthkit' || session.source === 'health_connect' || session.source === 'wearable') return 'recorded';
  return 'estimated';
}

function recordFromParts(params: {
  date: string;
  timezone: string;
  source: SleepDataSource;
  confidence: DataConfidence;
  status: SleepWindowStatus;
  confirmed: boolean;
  corrected: boolean;
  basedOnSessionId?: string | null;
  intervals: SleepInterval[];
  reasonCodes: string[];
}): SleepWindowRecord | null {
  const intervals = params.intervals.filter(validInterval).sort((left, right) => left.start_at.localeCompare(right.start_at));
  if (intervals.length === 0) return null;
  const startAt = intervals[0]!.start_at;
  const endAt = intervals.at(-1)!.end_at;
  const elapsedMinutes = calculateSleepDuration(startAt, endAt);
  if (elapsedMinutes === null) return null;
  const asleepMinutes = intervals
    .filter((interval) => interval.state === 'asleep')
    .reduce((total, interval) => total + intervalMinutes(interval), 0);
  if (asleepMinutes <= 0) return null;
  return {
    schema_version: 1,
    id: `sleep-window-${params.date}`,
    date: params.date,
    timezone: params.timezone,
    start_at: startAt,
    end_at: endAt,
    asleep_minutes: asleepMinutes,
    elapsed_minutes: elapsedMinutes,
    source: params.source,
    source_confidence: params.confidence,
    status: params.status,
    confirmed_by_user: params.confirmed,
    corrected_by_user: params.corrected,
    based_on_session_id: params.basedOnSessionId ?? null,
    intervals,
    reason_codes: unique(params.reasonCodes)
  };
}

function singleInterval(date: string, startMinute: number, endMinute: number): SleepInterval[] {
  const startAt = isoAtNightMinute(date, startMinute);
  const endAt = isoAtNightMinute(date, endMinute);
  if (!startAt || !endAt || endAt <= startAt) return [];
  return [{ id: `${date}-asleep-1`, state: 'asleep', start_at: startAt, end_at: endAt }];
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]!
    : Math.round((sorted[middle - 1]! + sorted[middle]!) / 2);
}

function sameDateSessions(sessions: SleepSession[], date: string): SleepSession[] {
  return sessions.filter((session) => session.date.slice(0, 10) === date.slice(0, 10));
}

export function selectPreferredSleepSession(sessions: SleepSession[], date: string): SleepSession | null {
  return [...sameDateSessions(sessions, date)]
    .filter((session) => calculateSleepDuration(session.sleep_start_at, session.sleep_end_at) !== null)
    .sort((left, right) => {
      const confirmedDifference = Number(Boolean(right.confirmed_by_user)) - Number(Boolean(left.confirmed_by_user));
      if (confirmedDifference !== 0) return confirmedDifference;
      const sourceDifference = SLEEP_SOURCE_PRIORITY[right.source] - SLEEP_SOURCE_PRIORITY[left.source];
      if (sourceDifference !== 0) return sourceDifference;
      const confidenceDifference = confidenceRank(right.source_confidence) - confidenceRank(left.source_confidence);
      if (confidenceDifference !== 0) return confidenceDifference;
      return right.created_at.localeCompare(left.created_at);
    })[0] ?? null;
}

export function sleepWindowFromSession(session: SleepSession, timezone = 'UTC'): SleepWindowRecord | null {
  if (!session.sleep_start_at || !session.sleep_end_at) return null;
  const providedIntervals = session.sleep_intervals?.filter(validInterval) ?? [];
  const intervals = providedIntervals.length > 0
    ? providedIntervals
    : [{
        id: `${session.date}-asleep-1`,
        state: 'asleep' as const,
        start_at: session.sleep_start_at,
        end_at: session.sleep_end_at
      }];
  const status = statusForSession(session);
  return recordFromParts({
    date: session.date,
    timezone: session.timezone || timezone,
    source: session.source,
    confidence: status === 'confirmed' || status === 'corrected' ? 'high' : session.source_confidence,
    status,
    confirmed: Boolean(session.confirmed_by_user || session.source === 'manual' || session.source === 'user_corrected'),
    corrected: Boolean(session.corrected_by_user || session.source === 'user_corrected'),
    basedOnSessionId: session.id ?? null,
    intervals,
    reasonCodes: session.reason_codes
  });
}

export function inferSleepWindow(params: InferSleepWindowParams): SleepWindowRecord {
  const selected = selectPreferredSleepSession(params.sessions, params.date);
  const selectedRecord = selected ? sleepWindowFromSession(selected, params.timezone) : null;
  if (selectedRecord) return selectedRecord;

  const recent = params.sessions
    .filter((session) => session.date.slice(0, 10) !== params.date.slice(0, 10))
    .filter((session) => session.sleep_start_at && session.sleep_end_at)
    .sort((left, right) => right.date.localeCompare(left.date))
    .slice(0, 14);
  const recentBedtimes = recent.map((session) => parseClock(session.sleep_start_at)).filter((value): value is number => value !== null).map(nightAxisMinute);
  const recentWakeTimes = recent.map((session) => parseClock(session.sleep_end_at)).filter((value): value is number => value !== null).map(nightAxisMinute);
  const preferredBedtime = parseClock(params.preferredBedtime) ?? 22 * 60 + 30;
  const preferredWakeTime = parseClock(params.preferredWakeTime) ?? 6 * 60 + 30;
  let startMinute = nightAxisMinute(preferredBedtime);
  let endMinute = nightAxisMinute(preferredWakeTime);
  let confidence: DataConfidence = 'low';
  let reasonCode = 'sleep_window_schedule_estimate';

  if (recentBedtimes.length >= 3 && recentWakeTimes.length >= 3) {
    startMinute = median(recentBedtimes) ?? startMinute;
    endMinute = median(recentWakeTimes) ?? endMinute;
    confidence = 'medium';
    reasonCode = 'sleep_window_recent_rhythm_estimate';
  }
  if (endMinute <= startMinute) endMinute += 24 * 60;
  const intervals = singleInterval(params.date, startMinute, endMinute);
  return recordFromParts({
    date: params.date,
    timezone: params.timezone,
    source: 'estimated',
    confidence,
    status: 'estimated',
    confirmed: false,
    corrected: false,
    intervals,
    reasonCodes: [reasonCode, 'sleep_window_estimated']
  })!;
}

export function confirmSleepWindow(record: SleepWindowRecord): SleepWindowRecord {
  return {
    ...record,
    status: record.corrected_by_user ? 'corrected' : 'confirmed',
    source_confidence: 'high',
    confirmed_by_user: true,
    reason_codes: unique([...record.reason_codes, 'user_confirmed_sleep_window'])
  };
}

export function correctSleepWindow(
  record: SleepWindowRecord,
  correction: SleepWindowCorrection
): SleepWindowRecord | null {
  const startClock = parseClock(correction.start_time);
  const endClock = parseClock(correction.end_time);
  if (startClock === null || endClock === null) return null;
  const startMinute = nightAxisMinute(startClock);
  let endMinute = nightAxisMinute(endClock);
  if (endMinute <= startMinute) endMinute += 24 * 60;
  if (endMinute - startMinute < 30 || endMinute - startMinute > 18 * 60) return null;

  const awakePeriods = (correction.awake_periods ?? []).map((period) => {
    const awakeStartClock = parseClock(period.start_time);
    const awakeEndClock = parseClock(period.end_time);
    if (awakeStartClock === null || awakeEndClock === null) return null;
    const awakeStart = nightAxisMinute(awakeStartClock);
    let awakeEnd = nightAxisMinute(awakeEndClock);
    if (awakeEnd <= awakeStart) awakeEnd += 24 * 60;
    if (awakeStart <= startMinute || awakeEnd >= endMinute || awakeEnd - awakeStart < 5) return null;
    return { ...period, start: awakeStart, end: awakeEnd };
  });
  if (awakePeriods.some((period) => period === null)) return null;
  const sortedAwake = (awakePeriods as Array<SleepWindowClockInterval & { start: number; end: number }>)
    .sort((left, right) => left.start - right.start);
  if (sortedAwake.some((period, index) => index > 0 && period.start < sortedAwake[index - 1]!.end)) return null;

  const intervals: SleepInterval[] = [];
  let cursor = startMinute;
  sortedAwake.forEach((period, index) => {
    const asleepStart = isoAtNightMinute(record.date, cursor)!;
    const asleepEnd = isoAtNightMinute(record.date, period.start)!;
    intervals.push({ id: `${record.date}-asleep-${index + 1}`, state: 'asleep', start_at: asleepStart, end_at: asleepEnd });
    intervals.push({
      id: period.id,
      state: 'awake',
      start_at: isoAtNightMinute(record.date, period.start)!,
      end_at: isoAtNightMinute(record.date, period.end)!
    });
    cursor = period.end;
  });
  intervals.push({
    id: `${record.date}-asleep-${sortedAwake.length + 1}`,
    state: 'asleep',
    start_at: isoAtNightMinute(record.date, cursor)!,
    end_at: isoAtNightMinute(record.date, endMinute)!
  });

  return recordFromParts({
    date: record.date,
    timezone: record.timezone,
    source: 'user_corrected',
    confidence: 'high',
    status: 'corrected',
    confirmed: true,
    corrected: true,
    basedOnSessionId: record.based_on_session_id,
    intervals,
    reasonCodes: [...record.reason_codes, 'user_corrected_sleep_window']
  });
}

export function suggestAwakePeriod(record: SleepWindowRecord, index = 0): SleepWindowClockInterval {
  const asleep = record.intervals.filter((interval) => interval.state === 'asleep').sort((left, right) => intervalMinutes(right) - intervalMinutes(left))[0];
  const startMs = asleep ? new Date(asleep.start_at).getTime() : new Date(record.start_at).getTime();
  const endMs = asleep ? new Date(asleep.end_at).getTime() : new Date(record.end_at).getTime();
  const middleMs = startMs + (endMs - startMs) / 2;
  const roundedStart = Math.round(middleMs / (15 * MINUTE_MS)) * 15 * MINUTE_MS;
  const start = new Date(roundedStart);
  const end = new Date(Math.min(roundedStart + 15 * MINUTE_MS, endMs - 5 * MINUTE_MS));
  return {
    id: `${record.date}-awake-${index + 1}`,
    start_time: clockAtNightMinute(start.getUTCHours() * 60 + start.getUTCMinutes()),
    end_time: clockAtNightMinute(end.getUTCHours() * 60 + end.getUTCMinutes())
  };
}

export function sleepWindowClockValue(value: string): string {
  const clock = parseClock(value);
  return clock === null ? '00:00' : clockAtNightMinute(clock);
}

export function adjustSleepWindowClock(value: string, deltaMinutes: number): string {
  const parsed = parseClock(value) ?? 0;
  return clockAtNightMinute(parsed + deltaMinutes);
}

export function sleepWindowToSession(record: SleepWindowRecord, createdAt = new Date().toISOString()): SleepSession {
  return {
    id: record.based_on_session_id ?? undefined,
    date: record.date,
    sleep_start_at: record.start_at,
    sleep_end_at: record.end_at,
    duration_minutes: record.asleep_minutes,
    sleep_quality: null,
    source: record.corrected_by_user ? 'user_corrected' : record.source,
    source_confidence: record.source_confidence,
    corrected_by_user: record.corrected_by_user,
    confirmed_by_user: record.confirmed_by_user,
    timezone: record.timezone,
    sleep_intervals: record.intervals.map((interval) => ({ ...interval })),
    reason_codes: [...record.reason_codes],
    created_at: createdAt
  };
}

export function sleepWindowSourceLabel(record: SleepWindowRecord): string {
  if (record.status === 'corrected') return 'Corrected by you';
  if (record.status === 'confirmed') return 'Confirmed by you';
  if (record.source === 'healthkit') return 'Recorded by Apple Health';
  if (record.source === 'health_connect') return 'Recorded by Health Connect';
  if (record.source === 'wearable') return 'Recorded by your wearable';
  if (record.source === 'phone_motion' || record.source === 'phone_activity') return 'Estimated from phone activity';
  return 'Estimated from your recent rhythm';
}

export const SLEEP_WINDOW_TIMELINE = {
  start_minute: NIGHT_AXIS_START,
  end_minute: NIGHT_AXIS_END
} as const;
