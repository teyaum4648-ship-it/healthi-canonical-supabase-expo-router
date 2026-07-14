import { describe, expect, it } from 'vitest';

import { calculateMovementSummary, generateMovementReadinessSignal } from '../../../src/engines/movement';
import { composeDashboardMovementSummary, movementSignalToDayPlanInput } from '../../../src/features/movement/movementIntegration';
import {
  applyWorkoutTemplate,
  createDemoWorkoutRows,
  createEmptyExerciseDraft,
  createEmptyWorkoutDraft,
  workoutDraftToInputs,
  workoutTemplates
} from '../../../src/features/movement/workoutForms';

describe('workout form and integration helpers', () => {
  it('maps a workout and multiple exercise entries safely', () => {
    const result = workoutDraftToInputs({
      ...createEmptyWorkoutDraft('2026-07-13'),
      title: 'Full Body',
      duration_minutes: '45',
      perceived_effort: '7',
      exercises: [
        { ...createEmptyExerciseDraft(), exercise_name: 'Goblet Squat', sets: '3', reps: '8', weight: '25' },
        { ...createEmptyExerciseDraft('cardio'), exercise_name: 'Bike', duration_minutes: '12', effort: '5' }
      ]
    }, 'manual', '2026-07-13T18:00:00.000Z');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.session.title).toBe('Full Body');
    expect(result.session.duration_minutes).toBe(45);
    expect(result.session.perceived_effort).toBe(7);
    expect(result.exercises).toHaveLength(2);
    expect(result.exercises[0]).toMatchObject({ sets: 3, reps: 8, weight: 25, order_index: 0 });
    expect(result.exercises[1]).toMatchObject({ category: 'cardio', duration_minutes: 12, effort: 5, order_index: 1 });
  });

  it('allows a sparse cardio-only workout', () => {
    const result = workoutDraftToInputs({
      ...createEmptyWorkoutDraft('2026-07-13'),
      workout_type: 'cardio',
      duration_minutes: '30',
      perceived_effort: '4'
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.session.title).toBe('Cardio Session');
      expect(result.exercises).toEqual([]);
    }
  });

  it('rejects effort outside 1 to 10 and invalid numeric fields', () => {
    expect(workoutDraftToInputs({ ...createEmptyWorkoutDraft('2026-07-13'), perceived_effort: '11' })).toEqual({
      ok: false,
      error: 'Effort must be a whole number from 1 to 10 or left blank.'
    });
    expect(workoutDraftToInputs({ ...createEmptyWorkoutDraft('2026-07-13'), duration_minutes: '-1' }).ok).toBe(false);
    expect(workoutDraftToInputs({
      ...createEmptyWorkoutDraft('2026-07-13'),
      exercises: [{ ...createEmptyExerciseDraft(), exercise_name: 'Squat', sets: '-2' }]
    }).ok).toBe(false);
  });

  it('creates an editable draft from a template', () => {
    const draft = applyWorkoutTemplate(workoutTemplates[0], '2026-07-13');
    const changed = { ...draft, title: 'Edited Session', exercises: draft.exercises.map((item) => ({ ...item })) };
    changed.exercises[0].reps = '10';

    expect(draft.title).toBe('Full Body Strength');
    expect(changed.title).toBe('Edited Session');
    expect(changed.exercises[0].reps).toBe('10');
    expect(workoutTemplates[0].exercises[0].reps).toBe('8');
  });

  it('creates serializable local rows with preserved exercises', () => {
    const result = workoutDraftToInputs(applyWorkoutTemplate(workoutTemplates[1], '2026-07-13'), 'demo', '2026-07-13T18:00:00.000Z');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const rows = createDemoWorkoutRows(result, 'demo-user', '2026-07-13T18:00:00.000Z');

    expect(rows.session.reason_codes).toContain('demo_movement_data');
    expect(rows.exercises[0].workout_session_id).toBe(rows.session.id);
    expect(JSON.parse(JSON.stringify(rows))).toEqual(rows);
  });

  it('maps Movement summary to the Home card and Plan input', () => {
    const result = workoutDraftToInputs(applyWorkoutTemplate(workoutTemplates[1], '2026-07-13'), 'demo', '2026-07-13T18:00:00.000Z');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const rows = createDemoWorkoutRows(result, 'demo-user', '2026-07-13T18:00:00.000Z');
    const summary = calculateMovementSummary({
      date: '2026-07-13',
      sessions: [{
        id: rows.session.id,
        session_date: rows.session.session_date,
        logged_at: rows.session.logged_at,
        title: rows.session.title,
        workout_type: rows.session.workout_type,
        duration_minutes: rows.session.duration_minutes,
        perceived_effort: rows.session.perceived_effort,
        source_confidence: rows.session.source_confidence,
        reason_codes: rows.session.reason_codes
      }]
    });
    const signal = generateMovementReadinessSignal({ summary });
    const card = composeDashboardMovementSummary({ summary, signal, demoMode: true });
    const planInput = movementSignalToDayPlanInput(signal, '2026-07-13T11:00:00.000Z');

    expect(card.workout_count).toBe(1);
    expect(card.source_label).toBe('demo');
    expect(planInput.training_readiness).toBe(signal.training_readiness);
    expect(planInput.preferred_training_time).toBe('2026-07-13T11:00:00.000Z');
    expect(planInput.reason_codes).toEqual(signal.reason_codes);
  });
});
