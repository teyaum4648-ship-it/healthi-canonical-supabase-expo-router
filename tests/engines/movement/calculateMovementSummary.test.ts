import { describe, expect, it } from 'vitest';

import {
  calculateMovementSummary,
  generateMovementReadinessSignal,
  type MovementExerciseEntry,
  type MovementSession
} from '../../../src/engines/movement';

function session(overrides: Partial<MovementSession> = {}): MovementSession {
  return {
    id: 'session-1',
    session_date: '2026-07-13',
    logged_at: '2026-07-13T12:00:00.000Z',
    title: 'Strength Session',
    workout_type: 'strength',
    duration_minutes: 45,
    perceived_effort: 6,
    source_confidence: 'medium',
    reason_codes: ['manual_workout_log'],
    ...overrides
  };
}

function entry(overrides: Partial<MovementExerciseEntry> = {}): MovementExerciseEntry {
  return {
    id: 'entry-1',
    workout_session_id: 'session-1',
    exercise_name: 'Goblet Squat',
    category: 'strength',
    sets: 3,
    reps: 8,
    weight: 20,
    distance: null,
    duration_minutes: null,
    effort: 6,
    ...overrides
  };
}

describe('Movement Intelligence engine', () => {
  it('returns a calibrating signal for empty history', () => {
    const summary = calculateMovementSummary({ date: '2026-07-13' });
    const signal = generateMovementReadinessSignal({ summary });

    expect(summary.workout_count).toBe(0);
    expect(summary.confidence).toBe('low');
    expect(signal.label).toBe('calibrating');
    expect(signal.summary).toBe('Movement is still calibrating.');
  });

  it('calculates weekly count, minutes, categories, entries, and load', () => {
    const sessions = [
      session(),
      session({ id: 'session-2', workout_type: 'cardio', duration_minutes: 30, perceived_effort: 5, logged_at: '2026-07-11T12:00:00.000Z' }),
      session({ id: 'session-3', workout_type: 'mobility', duration_minutes: 15, perceived_effort: 3, logged_at: '2026-07-09T12:00:00.000Z' }),
      session({ id: 'old-session', logged_at: '2026-07-01T12:00:00.000Z' })
    ];
    const summary = calculateMovementSummary({ date: '2026-07-13', sessions, exerciseEntries: [entry()] });

    expect(summary.workout_count).toBe(3);
    expect(summary.total_minutes).toBe(90);
    expect(summary.strength_session_count).toBe(1);
    expect(summary.cardio_session_count).toBe(1);
    expect(summary.mobility_recovery_session_count).toBe(1);
    expect(summary.exercise_entry_count).toBe(1);
    expect(summary.estimated_training_load).toBe(465);
    expect(summary.reason_codes).toContain('weekly_minutes_available');
  });

  it('handles recent high-effort sessions conservatively', () => {
    const summary = calculateMovementSummary({
      date: '2026-07-13',
      sessions: [
        session({ perceived_effort: 9 }),
        session({ id: 'session-2', perceived_effort: 8, logged_at: '2026-07-12T12:00:00.000Z' })
      ]
    });
    const signal = generateMovementReadinessSignal({ summary });

    expect(summary.recent_high_effort_count).toBe(2);
    expect(signal.label).toBe('lighter_day');
    expect(signal.training_readiness).toBe('low');
    expect(signal.reason_codes).toContain('multiple_high_effort_sessions');
  });

  it('uses restore mode for recovery support', () => {
    const summary = calculateMovementSummary({ date: '2026-07-13', sessions: [session()] });
    const signal = generateMovementReadinessSignal({ summary, readiness_mode: 'restore' });

    expect(signal.label).toBe('recovery_support');
    expect(signal.training_readiness).toBe('low');
    expect(signal.reason_codes).toContain('restore_mode_active');
  });

  it('lets consistent moderate history and supportive readiness create build room', () => {
    const summary = calculateMovementSummary({
      date: '2026-07-13',
      sessions: [
        session(),
        session({ id: 'session-2', logged_at: '2026-07-11T12:00:00.000Z' }),
        session({ id: 'session-3', logged_at: '2026-07-09T12:00:00.000Z' })
      ]
    });
    const signal = generateMovementReadinessSignal({ summary, readiness_mode: 'build', readiness_score: 82 });

    expect(summary.consistency).toBe('steady');
    expect(summary.confidence).toBe('high');
    expect(signal.label).toBe('ready_to_build');
    expect(signal.training_readiness).toBe('high');
  });

  it('lets a limited sleep signal lower the suggestion without making a claim', () => {
    const summary = calculateMovementSummary({ date: '2026-07-13', sessions: [session()] });
    const signal = generateMovementReadinessSignal({ summary, sleep_signal: 'limited' });

    expect(signal.label).toBe('lighter_day');
    expect(signal.reason_codes).toContain('sleep_signal_limited');
  });

  it('keeps output serializable and includes reason codes', () => {
    const summary = calculateMovementSummary({ date: '2026-07-13', sessions: [session()], exerciseEntries: [entry()] });
    const signal = generateMovementReadinessSignal({ summary });

    expect(JSON.parse(JSON.stringify({ summary, signal }))).toEqual({ summary, signal });
    expect(signal.reason_codes.length).toBeGreaterThan(0);
  });

  it('avoids blocked language in user-facing output', () => {
    const summary = calculateMovementSummary({ date: '2026-07-13', sessions: [session()] });
    const output = JSON.stringify(generateMovementReadinessSignal({ summary })).toLowerCase();
    const blocked = [
      'diag' + 'nosis', 'diag' + 'nose', 'treat' + 'ment', 'c' + 'ure', 'pre' + 'scribe',
      'pre' + 'scription', 're' + 'hab', 'clin' + 'ical', 'medical ' + 'decision', 'dys' + 'function',
      'dys' + 'regulated', 'ad' + 'renal', 'h' + 'pa', 'cor' + 'tisol', 'hor' + 'mone',
      'de' + 'tox', 'clean' + 'se', 'tox' + 'ic', 'bad ' + 'body', 'bad ' + 'movement',
      'che' + 'k', 'h' + 'lc', '4 doc' + 'tors', 'primal ' + 'pattern', 'work-' + 'in',
      'whoop ' + 'strain', 'fit' + 'bod', 'strong ' + 'app'
    ];
    for (const term of blocked) expect(output).not.toContain(term);
  });
});
