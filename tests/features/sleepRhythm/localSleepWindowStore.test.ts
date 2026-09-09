import { describe, expect, it } from 'vitest';

import type { SleepSession } from '../../../src/engines/circadian';
import {
  deserializeLocalSleepWindowSessions,
  serializeLocalSleepWindowSessions,
  upsertLocalSleepWindowSession
} from '../../../src/features/sleepRhythm/localSleepWindowStore';

function session(date: string): SleepSession {
  return {
    date,
    sleep_start_at: `${date}T00:00:00.000Z`,
    sleep_end_at: `${date}T07:00:00.000Z`,
    duration_minutes: 420,
    source: 'user_corrected',
    source_confidence: 'high',
    corrected_by_user: true,
    confirmed_by_user: true,
    timezone: 'America/Los_Angeles',
    sleep_intervals: [{ id: `${date}-sleep`, state: 'asleep', start_at: `${date}T00:00:00.000Z`, end_at: `${date}T07:00:00.000Z` }],
    reason_codes: ['user_corrected_sleep_window'],
    created_at: `${date}T12:00:00.000Z`
  };
}

describe('local sleep window store serialization', () => {
  it('round trips interval evidence', () => {
    const source = [session('2026-09-09')];
    expect(deserializeLocalSleepWindowSessions(serializeLocalSleepWindowSessions(source))).toEqual(source);
  });

  it('rejects malformed or unrelated storage values', () => {
    expect(deserializeLocalSleepWindowSessions('bad json')).toEqual([]);
    expect(deserializeLocalSleepWindowSessions(JSON.stringify({ value: [] }))).toEqual([]);
    expect(deserializeLocalSleepWindowSessions(JSON.stringify([{ date: '2026-09-09' }]))).toEqual([]);
  });

  it('upserts by wake date and keeps newest nights first', () => {
    const result = upsertLocalSleepWindowSession([
      session('2026-09-08'),
      { ...session('2026-09-09'), duration_minutes: 420 }
    ], { ...session('2026-09-09'), duration_minutes: 450 });

    expect(result.map((value) => value.date)).toEqual(['2026-09-09', '2026-09-08']);
    expect(result[0]?.duration_minutes).toBe(450);
  });

  it('bounds local history to thirty records', () => {
    const records = Array.from({ length: 35 }, (_, index) => session(`2026-08-${String(index + 1).padStart(2, '0')}`));
    expect(deserializeLocalSleepWindowSessions(serializeLocalSleepWindowSessions(records))).toHaveLength(30);
  });
});
