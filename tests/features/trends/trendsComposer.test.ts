import { describe, expect, it } from 'vitest';

import {
  composeTrendsScreenModel,
  movementHistoryFromWorkoutSessions,
  nutritionHistoryFromMealLogs,
  rhythmHistoryFromSleepSessions,
  scheduleHistoryFromBlocks
} from '../../../src/features/trends/trendsComposer';

describe('trends composer', () => {
  it('returns a serializable calibrating model for empty data', () => {
    const model = composeTrendsScreenModel({ today: '2026-07-14', source_label: 'calibrating' });

    expect(model.summary.overview.trend_direction).toBe('calibrating');
    expect(JSON.parse(JSON.stringify(model))).toEqual(model);
  });

  it('groups food records into daily nourishment history', () => {
    const history = nutritionHistoryFromMealLogs([
      {
        logged_at: '2026-07-14T12:00:00.000Z', protein_g: 28, fiber_g: 8, sugar_g: 5,
        quality_flags: ['balanced_meal'], user_response: { energy: 'steady' }, source_confidence: 'medium', reason_codes: ['manual_food_log']
      },
      {
        logged_at: '2026-07-14T18:00:00.000Z', protein_g: 24, fiber_g: 6, sugar_g: 7,
        quality_flags: ['whole_food_emphasis'], user_response: null, source_confidence: 'medium', reason_codes: ['manual_food_log']
      }
    ]);

    expect(history).toEqual([expect.objectContaining({ date: '2026-07-14', meal_count: 2, protein_grams: 52, fiber_grams: 14 })]);
  });

  it('maps workout records into daily movement history', () => {
    const history = movementHistoryFromWorkoutSessions([{
      id: 'session-1', user_id: 'user-1', logged_at: '2026-07-14T09:00:00.000Z', session_date: '2026-07-14', title: 'Strength', workout_type: 'strength', duration_minutes: 45, perceived_effort: 6, readiness_before: 'steady', session_note: null, source: 'manual', source_confidence: 'medium', reason_codes: ['manual_workout'], created_at: '2026-07-14T09:00:00.000Z', updated_at: '2026-07-14T09:00:00.000Z'
    }]);

    expect(history).toEqual([expect.objectContaining({ workout_count: 1, total_minutes: 45, readiness_label: 'steady' })]);
  });

  it('maps schedule blocks and sleep records by day', () => {
    const schedule = scheduleHistoryFromBlocks([{
      id: 'block-1', user_id: 'user-1', block_date: '2026-07-14', start_at: '2026-07-14T09:00:00.000Z', end_at: '2026-07-14T10:00:00.000Z', block_type: 'work', title: 'Work', description: null, location: null, flexibility: 'fixed', is_protected: true, source: 'manual', source_confidence: 'medium', reason_codes: ['manual_schedule_block'], created_at: '2026-07-14T08:00:00.000Z', updated_at: '2026-07-14T08:00:00.000Z'
    }]);
    const rhythm = rhythmHistoryFromSleepSessions([{
      date: '2026-07-14', duration_minutes: 450, source_confidence: 'medium', reason_codes: ['user_confirmed_sleep']
    }]);

    expect(schedule[0]).toEqual(expect.objectContaining({ block_count: 1, protected_block_count: 1 }));
    expect(rhythm[0]).toEqual(expect.objectContaining({ sleep_duration_hours: 7.5 }));
  });
});
