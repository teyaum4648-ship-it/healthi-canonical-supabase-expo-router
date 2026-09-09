import { describe, expect, it } from 'vitest';

import type { SleepDataSource, SleepSession } from '../../../src/engines/circadian';
import {
  confirmSleepWindow,
  correctSleepWindow,
  inferSleepWindow,
  selectPreferredSleepSession,
  sleepWindowSourceLabel,
  sleepWindowToSession
} from '../../../src/features/sleepRhythm/sleepWindowEngine';

function session(overrides: Partial<SleepSession> = {}): SleepSession {
  return {
    date: '2026-09-09',
    sleep_start_at: '2026-09-08T22:45:00.000Z',
    sleep_end_at: '2026-09-09T06:45:00.000Z',
    duration_minutes: 480,
    source: 'estimated',
    source_confidence: 'medium',
    reason_codes: ['sleep_window_estimated'],
    created_at: '2026-09-09T12:00:00.000Z',
    ...overrides
  };
}

function infer(sessions: SleepSession[] = []) {
  return inferSleepWindow({
    date: '2026-09-09',
    timezone: 'America/Los_Angeles',
    sessions,
    preferredBedtime: '22:30',
    preferredWakeTime: '06:30'
  });
}

describe('sleep window engine', () => {
  it('uses deterministic source priority without confusing confidence with source quality', () => {
    const sources: SleepDataSource[] = ['demo', 'phone_activity', 'wearable', 'manual', 'user_corrected'];
    const sessions = sources.map((source, index) => session({
      source,
      source_confidence: source === 'demo' ? 'high' : 'medium',
      created_at: `2026-09-09T12:0${index}:00.000Z`
    }));

    expect(selectPreferredSleepSession(sessions, '2026-09-09')?.source).toBe('user_corrected');
  });

  it('puts an explicitly confirmed source ahead of an unconfirmed source', () => {
    const selected = selectPreferredSleepSession([
      session({ source: 'wearable', source_confidence: 'high' }),
      session({ source: 'estimated', source_confidence: 'low', confirmed_by_user: true })
    ], '2026-09-09');

    expect(selected?.confirmed_by_user).toBe(true);
  });

  it('creates a low-confidence schedule estimate when no observations exist', () => {
    const record = infer();

    expect(record).toMatchObject({
      status: 'estimated',
      source: 'estimated',
      source_confidence: 'low',
      asleep_minutes: 480,
      elapsed_minutes: 480,
      confirmed_by_user: false
    });
    expect(record.reason_codes).toContain('sleep_window_schedule_estimate');
  });

  it('uses the recent median rhythm when at least three nights are available', () => {
    const record = infer([
      session({ date: '2026-09-08', sleep_start_at: '2026-09-07T22:30:00.000Z', sleep_end_at: '2026-09-08T06:40:00.000Z' }),
      session({ date: '2026-09-07', sleep_start_at: '2026-09-06T22:45:00.000Z', sleep_end_at: '2026-09-07T06:30:00.000Z' }),
      session({ date: '2026-09-06', sleep_start_at: '2026-09-05T23:00:00.000Z', sleep_end_at: '2026-09-06T06:20:00.000Z' })
    ]);

    expect(record.start_at).toBe('2026-09-08T22:45:00.000Z');
    expect(record.end_at).toBe('2026-09-09T06:30:00.000Z');
    expect(record.source_confidence).toBe('medium');
    expect(record.reason_codes).toContain('sleep_window_recent_rhythm_estimate');
  });

  it('represents awake periods as gaps without counting them as sleep', () => {
    const corrected = correctSleepWindow(infer(), {
      start_time: '22:00',
      end_time: '07:00',
      awake_periods: [
        { id: 'awake-1', start_time: '01:00', end_time: '01:30' },
        { id: 'awake-2', start_time: '04:15', end_time: '04:30' }
      ]
    });

    expect(corrected).toMatchObject({
      status: 'corrected',
      source: 'user_corrected',
      source_confidence: 'high',
      elapsed_minutes: 540,
      asleep_minutes: 495,
      confirmed_by_user: true,
      corrected_by_user: true
    });
    expect(corrected?.intervals.map((interval) => interval.state)).toEqual([
      'asleep', 'awake', 'asleep', 'awake', 'asleep'
    ]);
  });

  it('rejects overlapping or out-of-window awake periods', () => {
    expect(correctSleepWindow(infer(), {
      start_time: '22:00',
      end_time: '07:00',
      awake_periods: [
        { id: 'awake-1', start_time: '01:00', end_time: '02:00' },
        { id: 'awake-2', start_time: '01:30', end_time: '02:30' }
      ]
    })).toBeNull();
    expect(correctSleepWindow(infer(), {
      start_time: '22:00',
      end_time: '07:00',
      awake_periods: [{ id: 'awake-1', start_time: '20:00', end_time: '20:30' }]
    })).toBeNull();
  });

  it('confirms an estimate without silently changing its times', () => {
    const estimated = infer();
    const confirmed = confirmSleepWindow(estimated);

    expect(confirmed.start_at).toBe(estimated.start_at);
    expect(confirmed.end_at).toBe(estimated.end_at);
    expect(confirmed.status).toBe('confirmed');
    expect(confirmed.source_confidence).toBe('high');
    expect(confirmed.reason_codes).toContain('user_confirmed_sleep_window');
  });

  it('creates a serializable session with interval evidence intact', () => {
    const record = correctSleepWindow(infer(), {
      start_time: '22:30',
      end_time: '06:30',
      awake_periods: [{ id: 'awake-1', start_time: '02:00', end_time: '02:20' }]
    })!;
    const result = sleepWindowToSession(record, '2026-09-09T12:00:00.000Z');

    expect(result.duration_minutes).toBe(460);
    expect(result.sleep_intervals).toHaveLength(3);
    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
    expect(sleepWindowSourceLabel(record)).toBe('Corrected by you');
  });

  it('keeps consumer-facing output within general wellness language', () => {
    const output = JSON.stringify({ record: infer(), label: sleepWindowSourceLabel(infer()) }).toLowerCase();
    const blocked = ['diagnosis', 'treatment', 'cure', 'prescribe', 'cortisol', 'hormone repair'];
    blocked.forEach((term) => expect(output).not.toContain(term));
  });
});
