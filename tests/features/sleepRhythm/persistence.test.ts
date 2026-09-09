import { describe, expect, it } from 'vitest';

import {
  hydrateSleepSession,
  toSleepNeedEstimateInsert,
  toSleepSessionInsert,
  type JsonValue,
  type SleepSessionPersistenceInput,
  type SleepSessionRow
} from '../../../src/features/sleepRhythm/persistence';
import type { SleepNeedEstimate } from '../../../src/engines/circadian';

const userId = '00000000-0000-0000-0000-000000000001';

function baseSleepSession(overrides: Partial<SleepSessionPersistenceInput> = {}): SleepSessionPersistenceInput {
  return {
    date: '2026-06-10',
    sleep_start_at: '2026-06-09T22:30:00.000Z',
    sleep_end_at: '2026-06-10T06:45:00.000Z',
    duration_minutes: 495,
    sleep_quality: 4,
    source: 'manual',
    source_confidence: 'medium',
    corrected_by_user: false,
    reason_codes: ['calibrating', 'wake_time_estimated'],
    created_at: '2026-06-10T12:00:00.000Z',
    ...overrides
  };
}

function baseSleepNeed(overrides: Partial<SleepNeedEstimate> = {}): SleepNeedEstimate {
  return {
    minutes: 480,
    confidence: 'medium',
    basis: ['onboarding'],
    updated_at: '2026-06-10T12:00:00.000Z',
    ...overrides
  };
}

describe('sleep rhythm persistence mapping', () => {
  it('maps all required sleep session fields', () => {
    const payload = toSleepSessionInsert(baseSleepSession(), userId);

    expect(payload).toEqual({
      user_id: userId,
      date: '2026-06-10',
      sleep_start_at: '2026-06-09T22:30:00.000Z',
      sleep_end_at: '2026-06-10T06:45:00.000Z',
      duration_minutes: 495,
      sleep_quality: 4,
      source: 'manual',
      source_confidence: 'medium',
      corrected_by_user: false,
      confirmed_by_user: false,
      correction_of_session_id: null,
      original_source_id: null,
      raw_source_payload: null,
      reason_codes: ['calibrating', 'wake_time_estimated']
    });
  });

  it('handles optional sleep session fields safely', () => {
    const payload = toSleepSessionInsert(
      baseSleepSession({
        sleep_start_at: null,
        sleep_end_at: null,
        duration_minutes: null,
        sleep_quality: undefined,
        corrected_by_user: undefined,
        reason_codes: []
      }),
      userId
    );

    expect(payload.sleep_start_at).toBeNull();
    expect(payload.sleep_end_at).toBeNull();
    expect(payload.duration_minutes).toBeNull();
    expect(payload.sleep_quality).toBeNull();
    expect(payload.corrected_by_user).toBe(false);
    expect(payload.confirmed_by_user).toBe(false);
    expect(payload.reason_codes).toEqual([]);
  });

  it('preserves raw source payloads', () => {
    const rawPayload: JsonValue = {
      provider: 'demo_seed',
      intervals: [{ start: '2026-06-09T22:30:00.000Z', end: '2026-06-10T06:45:00.000Z' }]
    };
    const payload = toSleepSessionInsert(
      baseSleepSession({
        source: 'demo',
        original_source_id: 'demo-session-1',
        raw_source_payload: rawPayload
      }),
      userId
    );

    expect(payload.original_source_id).toBe('demo-session-1');
    expect(payload.raw_source_payload).toEqual(rawPayload);
  });

  it('serializes and hydrates sleep-window intervals through the existing source payload', () => {
    const intervals = [
      {
        id: 'asleep-1',
        state: 'asleep' as const,
        start_at: '2026-06-09T22:30:00.000Z',
        end_at: '2026-06-10T02:15:00.000Z'
      },
      {
        id: 'awake-1',
        state: 'awake' as const,
        start_at: '2026-06-10T02:15:00.000Z',
        end_at: '2026-06-10T02:30:00.000Z'
      },
      {
        id: 'asleep-2',
        state: 'asleep' as const,
        start_at: '2026-06-10T02:30:00.000Z',
        end_at: '2026-06-10T06:45:00.000Z'
      }
    ];
    const payload = toSleepSessionInsert(baseSleepSession({
      timezone: 'America/Los_Angeles',
      sleep_intervals: intervals,
      confirmed_by_user: true
    }), userId);
    const row: SleepSessionRow = {
      ...payload,
      id: 'sleep-row-1',
      created_at: '2026-06-10T12:00:00.000Z',
      updated_at: '2026-06-10T12:00:00.000Z'
    };

    expect(payload.raw_source_payload).toEqual({
      schema_version: 1,
      timezone: 'America/Los_Angeles',
      intervals
    });
    expect(hydrateSleepSession(row)).toMatchObject({
      id: 'sleep-row-1',
      timezone: 'America/Los_Angeles',
      sleep_intervals: intervals,
      confirmed_by_user: true
    });
  });

  it('preserves correction lineage', () => {
    const payload = toSleepSessionInsert(
      baseSleepSession({
        source: 'user_corrected',
        source_confidence: 'high',
        corrected_by_user: true,
        confirmed_by_user: true,
        correction_of_session_id: '11111111-1111-1111-1111-111111111111'
      }),
      userId
    );

    expect(payload.source).toBe('user_corrected');
    expect(payload.source_confidence).toBe('high');
    expect(payload.corrected_by_user).toBe(true);
    expect(payload.confirmed_by_user).toBe(true);
    expect(payload.correction_of_session_id).toBe('11111111-1111-1111-1111-111111111111');
  });

  it('preserves reason codes without mutating the source array', () => {
    const reasonCodes = ['sleep_debt_low', 'calibrating'];
    const payload = toSleepSessionInsert(baseSleepSession({ reason_codes: reasonCodes }), userId);

    payload.reason_codes.push('source_confidence_low');

    expect(reasonCodes).toEqual(['sleep_debt_low', 'calibrating']);
  });

  it('keeps sleep session payloads serializable', () => {
    const payload = toSleepSessionInsert(baseSleepSession(), userId);

    expect(() => JSON.stringify(payload)).not.toThrow();
    expect(JSON.parse(JSON.stringify(payload))).toEqual(payload);
  });

  it('maps required sleep need estimate fields', () => {
    const payload = toSleepNeedEstimateInsert(baseSleepNeed(), userId);

    expect(payload).toEqual({
      user_id: userId,
      minutes: 480,
      confidence: 'medium',
      basis: ['onboarding'],
      is_active: true
    });
  });

  it('supports inactive sleep need estimate payloads', () => {
    const payload = toSleepNeedEstimateInsert(
      baseSleepNeed({
        minutes: 510,
        confidence: 'high',
        basis: ['sleep_history', 'manual_adjustment']
      }),
      userId,
      false
    );

    expect(payload).toEqual({
      user_id: userId,
      minutes: 510,
      confidence: 'high',
      basis: ['sleep_history', 'manual_adjustment'],
      is_active: false
    });
  });

  it('does not introduce blocked language in helper-generated strings', () => {
    const sessionPayload = toSleepSessionInsert(baseSleepSession(), userId);
    const needPayload = toSleepNeedEstimateInsert(baseSleepNeed(), userId);
    const output = JSON.stringify({ sessionPayload, needPayload }).toLowerCase();
    const blockedTerms = [
      'diag' + 'nosis',
      'diag' + 'nose',
      'treat' + 'ment',
      'c' + 'ure',
      'pre' + 'scribe',
      'pre' + 'scription',
      'ad' + 'renal',
      'h' + 'pa',
      'cor' + 'tisol',
      'hor' + 'mone',
      'clin' + 'ical',
      'medical ' + 'decision',
      'dys' + 'regulated',
      'dys' + 'function',
      'de' + 'tox'
    ];

    for (const term of blockedTerms) {
      expect(output).not.toContain(term);
    }
  });
});
