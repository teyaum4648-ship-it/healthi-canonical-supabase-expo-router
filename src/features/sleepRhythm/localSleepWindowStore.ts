import AsyncStorage from '@react-native-async-storage/async-storage';

import type { SleepInterval, SleepSession } from '../../engines/circadian';

export const localSleepWindowSessionsKey = 'healthi.sleep-window.sessions.v1';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function validInterval(value: unknown): value is SleepInterval {
  return isRecord(value)
    && typeof value.id === 'string'
    && (value.state === 'asleep' || value.state === 'awake')
    && typeof value.start_at === 'string'
    && typeof value.end_at === 'string';
}

function validSession(value: unknown): value is SleepSession {
  return isRecord(value)
    && typeof value.date === 'string'
    && (typeof value.sleep_start_at === 'string' || value.sleep_start_at === null)
    && (typeof value.sleep_end_at === 'string' || value.sleep_end_at === null)
    && (typeof value.duration_minutes === 'number' || value.duration_minutes === null)
    && typeof value.source === 'string'
    && ['low', 'medium', 'high'].includes(String(value.source_confidence))
    && Array.isArray(value.reason_codes)
    && value.reason_codes.every((reason) => typeof reason === 'string')
    && typeof value.created_at === 'string'
    && (!('sleep_intervals' in value) || value.sleep_intervals === undefined
      || (Array.isArray(value.sleep_intervals) && value.sleep_intervals.every(validInterval)));
}

export function deserializeLocalSleepWindowSessions(value: string | null): SleepSession[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(validSession).slice(0, 30).map((session) => ({
      ...session,
      sleep_intervals: session.sleep_intervals?.map((interval) => ({ ...interval })),
      reason_codes: [...session.reason_codes]
    }));
  } catch {
    return [];
  }
}

export function serializeLocalSleepWindowSessions(sessions: SleepSession[]): string {
  return JSON.stringify(sessions.slice(0, 30));
}

export function upsertLocalSleepWindowSession(sessions: SleepSession[], session: SleepSession): SleepSession[] {
  return [session, ...sessions.filter((candidate) => candidate.date !== session.date)]
    .sort((left, right) => right.date.localeCompare(left.date))
    .slice(0, 30);
}

export async function getLocalSleepWindowSessions(): Promise<SleepSession[]> {
  return deserializeLocalSleepWindowSessions(await AsyncStorage.getItem(localSleepWindowSessionsKey));
}

export async function saveLocalSleepWindowSession(session: SleepSession): Promise<SleepSession[]> {
  const current = await getLocalSleepWindowSessions();
  const next = upsertLocalSleepWindowSession(current, session);
  await AsyncStorage.setItem(localSleepWindowSessionsKey, serializeLocalSleepWindowSessions(next));
  return next;
}
