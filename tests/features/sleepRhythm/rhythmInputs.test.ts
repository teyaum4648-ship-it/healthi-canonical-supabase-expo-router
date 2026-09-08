import { describe, expect, it } from 'vitest';

import {
  createDefaultSleepNeedEstimate,
  createDemoSleepSessions,
  createManualSleepSession,
  getConfidenceLabel,
  getSleepSourceLabel
} from '../../../src/features/sleepRhythm/rhythmInputs';

describe('rhythm input helpers', () => {
  it('creates demo sleep sessions clearly marked as demo source', () => {
    const sessions = createDemoSleepSessions('2026-06-10');

    expect(sessions).toHaveLength(14);
    expect(sessions[0]?.source).toBe('demo');
    expect(sessions[0]?.source_confidence).toBe('medium');
    expect(sessions[0]?.reason_codes).toContain('wake_time_estimated');
  });

  it('creates a valid manual sleep session across midnight', () => {
    const session = createManualSleepSession({
      date: '2026-06-10',
      sleepStartTime: '22:30',
      wakeTime: '06:45',
      sleepQuality: 4,
      createdAt: '2026-06-10T12:00:00.000Z'
    });

    expect(session).toEqual({
      date: '2026-06-10',
      sleep_start_at: '2026-06-09T22:30:00.000Z',
      sleep_end_at: '2026-06-10T06:45:00.000Z',
      duration_minutes: 495,
      sleep_quality: 4,
      source: 'manual',
      source_confidence: 'medium',
      corrected_by_user: false,
      reason_codes: ['user_confirmed_sleep'],
      created_at: '2026-06-10T12:00:00.000Z'
    });
  });

  it('lowers manual session confidence when time input is invalid', () => {
    const session = createManualSleepSession({
      date: '2026-06-10',
      sleepStartTime: 'bad',
      wakeTime: '06:45'
    });

    expect(session.sleep_start_at).toBeNull();
    expect(session.duration_minutes).toBeNull();
    expect(session.source_confidence).toBe('low');
    expect(session.reason_codes).toContain('sleep_data_missing');
  });

  it('creates a default active sleep need estimate shape for the engine', () => {
    const estimate = createDefaultSleepNeedEstimate('2026-06-10T12:00:00.000Z');

    expect(estimate).toEqual({
      minutes: 480,
      confidence: 'medium',
      basis: ['default'],
      updated_at: '2026-06-10T12:00:00.000Z'
    });
  });

  it('returns source and confidence labels for UI copy', () => {
    expect(getSleepSourceLabel('manual')).toBe('Manual');
    expect(getSleepSourceLabel('wearable')).toBe('Wearable sync coming later');
    expect(getConfidenceLabel('high')).toBe('High confidence');
  });

  it('does not introduce blocked language in helper-generated strings', () => {
    const output = JSON.stringify({
      sessions: createDemoSleepSessions('2026-06-10'),
      manual: createManualSleepSession({
        date: '2026-06-10',
        sleepStartTime: '22:30',
        wakeTime: '06:45'
      }),
      sourceLabels: [
        getSleepSourceLabel('manual'),
        getSleepSourceLabel('estimated'),
        getSleepSourceLabel('wearable')
      ],
      confidenceLabels: [getConfidenceLabel('low'), getConfidenceLabel('medium'), getConfidenceLabel('high')]
    }).toLowerCase();
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

