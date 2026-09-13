import { describe, expect, it } from 'vitest';

import {
  adjustRestTimer,
  createRestTimer,
  formatRestClock,
  isRestComplete,
  isRestPaused,
  pauseRestTimer,
  restRemainingSeconds,
  resumeRestTimer
} from '../../../src/features/movement/restTimer';
import {
  convertWeightForDisplay,
  formatWeight,
  stepWeight,
  weightStep
} from '../../../src/features/movement/weightUnits';
import { parseWorkoutDraft } from '../../../src/features/movement/workoutDraftStore';
import {
  createQuickExerciseDraft,
  createQuickSetDraft,
  createQuickWorkoutFromText,
  previousSetFor,
  quickWorkoutToInputs,
  type QuickWorkoutDraft
} from '../../../src/features/movement/workoutQuickLog';
import { summarizeQuickWorkout } from '../../../src/features/movement/workoutSummary';

function draftWith(overrides: Partial<QuickWorkoutDraft> = {}): QuickWorkoutDraft {
  const base = createQuickWorkoutFromText('Bench Press', '2026-09-12T17:00:00.000Z')!;
  return { ...base, ...overrides };
}

describe('weight units', () => {
  it('never presents a logged number without knowing its unit', () => {
    expect(formatWeight(135, 'lb')).toBe('135 lb');
    expect(formatWeight(60, 'kg')).toBe('60 kg');
    // Sets recorded before units existed are shown bare rather than assumed.
    expect(formatWeight(135, null)).toBe('135');
    expect(formatWeight(null, 'lb')).toBe('—');
  });

  it('steps by the increment a gym can actually make', () => {
    expect(weightStep('lb')).toBe(5);
    expect(weightStep('kg')).toBe(2.5);
    expect(stepWeight(135, 'lb', 1)).toBe(140);
    expect(stepWeight(135, 'lb', -1)).toBe(130);
    // A stray value snaps onto the grid instead of staying off it.
    expect(stepWeight(137, 'lb', 1)).toBe(140);
    expect(stepWeight(137, 'lb', -1)).toBe(135);
    expect(stepWeight(null, 'kg', 1)).toBe(2.5);
    expect(stepWeight(0, 'lb', -1)).toBe(0);
  });

  it('rounds a cross-unit comparison to a believable precision', () => {
    expect(convertWeightForDisplay(135, 'lb', 'kg')).toBeCloseTo(61.25, 2);
    expect(convertWeightForDisplay(60, 'kg', 'lb')).toBeCloseTo(132.5, 1);
    expect(convertWeightForDisplay(100, 'lb', 'lb')).toBe(100);
  });
});

describe('rest timer', () => {
  const start = '2026-09-12T17:00:00.000Z';

  it('derives remaining time from the clock so a locked phone stays accurate', () => {
    const timer = createRestTimer('exercise-1', 'set-1', 90, start);
    expect(restRemainingSeconds(timer, start)).toBe(90);
    expect(restRemainingSeconds(timer, '2026-09-12T17:00:30.000Z')).toBe(60);
    // Returning long after the timer should have finished reports overtime,
    // not a frozen countdown.
    expect(restRemainingSeconds(timer, '2026-09-12T17:05:00.000Z')).toBe(-210);
    expect(isRestComplete(timer, '2026-09-12T17:05:00.000Z')).toBe(true);
  });

  it('keeps time already served across a pause', () => {
    const timer = createRestTimer('exercise-1', 'set-1', 90, start);
    const paused = pauseRestTimer(timer, '2026-09-12T17:00:30.000Z');
    expect(isRestPaused(paused)).toBe(true);
    // Ten minutes paused must not consume rest.
    expect(restRemainingSeconds(paused, '2026-09-12T17:10:00.000Z')).toBe(60);
    const resumed = resumeRestTimer(paused, '2026-09-12T17:10:00.000Z');
    expect(restRemainingSeconds(resumed, '2026-09-12T17:10:15.000Z')).toBe(45);
  });

  it('adjusts the target without losing served time, and clamps at zero', () => {
    const timer = createRestTimer('exercise-1', 'set-1', 90, start);
    expect(adjustRestTimer(timer, 15).duration_seconds).toBe(105);
    expect(adjustRestTimer(timer, -15).duration_seconds).toBe(75);
    expect(adjustRestTimer(timer, -500).duration_seconds).toBe(0);
  });

  it('formats overtime distinguishably', () => {
    expect(formatRestClock(90)).toBe('1:30');
    expect(formatRestClock(5)).toBe('0:05');
    expect(formatRestClock(-12)).toBe('+0:12');
  });
});

describe('workout draft persistence', () => {
  it('round-trips an in-progress session', () => {
    const draft = draftWith({ weight_unit: 'kg', note: 'Felt steady before training' });
    draft.exercises[0].sets[0].weight = '60';
    draft.exercises[0].sets[0].reps = '8';
    draft.exercises[0].sets[0].completed = true;

    const restored = parseWorkoutDraft(JSON.parse(JSON.stringify(draft)) as unknown);
    expect(restored).not.toBeNull();
    expect(restored?.weight_unit).toBe('kg');
    expect(restored?.note).toBe('Felt steady before training');
    expect(restored?.exercises[0].sets[0]).toMatchObject({ weight: '60', reps: '8', completed: true });
  });

  it('treats an unusable stored draft as absent rather than crashing Move', () => {
    expect(parseWorkoutDraft(null)).toBeNull();
    expect(parseWorkoutDraft('not a draft')).toBeNull();
    expect(parseWorkoutDraft({ title: 'Legs' })).toBeNull();
    // An exercise with no sets carries nothing worth resuming.
    expect(parseWorkoutDraft({ title: 'Legs', started_at: '2026-09-12T17:00:00.000Z', exercises: [{ id: 'a', exercise_name: 'Squat', category: 'strength', sets: [] }] })).toBeNull();
  });

  it('defaults a draft stored before units existed instead of dropping it', () => {
    const restored = parseWorkoutDraft({
      title: 'Legs',
      started_at: '2026-09-12T17:00:00.000Z',
      exercises: [{
        id: 'exercise-1',
        exercise_name: 'Squat',
        category: 'strength',
        sets: [{ id: 'set-1', set_index: 1, weight: '225', reps: '5' }]
      }]
    });
    expect(restored?.weight_unit).toBe('lb');
    expect(restored?.exercises[0].sets[0].warmup).toBe(false);
  });

  it('gives restored and newly added sets distinct ids', () => {
    // A counter that resets on restart would collide here.
    const ids = new Set([createQuickSetDraft(1).id, createQuickSetDraft(1).id, createQuickExerciseDraft('Row').id]);
    expect(ids.size).toBe(3);
  });
});

describe('previous set comparison', () => {
  it('falls back to the nearest earlier set instead of showing nothing', () => {
    const exercise = createQuickExerciseDraft('Bench Press', 'strength', 4);
    exercise.previous_sets = [1, 2, 3].map((index) => ({
      set_index: index,
      weight: 135,
      reps: 8,
      rpe: null,
      rest_seconds: 90,
      weight_unit: 'lb' as const
    }));

    expect(previousSetFor(exercise, 2)).toMatchObject({ exact: true });
    const fourth = previousSetFor(exercise, 4);
    expect(fourth?.exact).toBe(false);
    expect(fourth?.set.set_index).toBe(3);
    expect(previousSetFor(createQuickExerciseDraft('New Lift'), 1)).toBeNull();
  });
});

describe('saving a session', () => {
  it('records the unit each weight was entered in', () => {
    const draft = draftWith({ weight_unit: 'lb' });
    draft.exercises[0].sets[0].weight = '135';
    draft.exercises[0].sets[0].reps = '8';

    const result = quickWorkoutToInputs(draft, 'manual', '2026-09-12T18:00:00.000Z');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.sets[0].input).toMatchObject({ weight: 135, weight_unit: 'lb', warmup: false });
    expect(result.value.exercises[0].weight_unit).toBe('lb');
  });

  it('leaves the unit off a set with no weight', () => {
    const draft = draftWith();
    draft.exercises[0].sets[0].reps = '12';

    const result = quickWorkoutToInputs(draft, 'manual');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.sets[0].input.weight_unit).toBeNull();
  });

  it('keeps warm-ups out of the exercise headline load', () => {
    const draft = draftWith();
    const exercise = draft.exercises[0];
    exercise.sets = [
      { ...createQuickSetDraft(1), weight: '95', reps: '10', warmup: true },
      { ...createQuickSetDraft(2), weight: '185', reps: '5' }
    ];

    const result = quickWorkoutToInputs(draft, 'manual');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // The warm-up is still recorded...
    expect(result.value.sets).toHaveLength(2);
    expect(result.value.sets[0].input.warmup).toBe(true);
    // ...but 95 lb must not become the exercise's headline weight.
    expect(result.value.exercises[0].weight).toBe(185);
    expect(result.value.exercises[0].sets).toBe(1);
  });

  it('carries the session note and the canonical library link', () => {
    const draft = draftWith({ note: 'Felt heavy before training' });
    draft.exercises[0].exercise_library_item_id = 'library-item-1';
    draft.exercises[0].sets[0].reps = '5';

    const result = quickWorkoutToInputs(draft, 'manual');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.session.session_note).toBe('Felt heavy before training');
    expect(result.value.exercises[0].exercise_library_item_id).toBe('library-item-1');
  });
});

describe('completion summary', () => {
  function benchDraft(todayWeight: string, previousWeight: number, previousUnit: 'lb' | 'kg' = 'lb') {
    const draft = draftWith({ weight_unit: 'lb' });
    const exercise = draft.exercises[0];
    exercise.previous_sets = [{ set_index: 1, weight: previousWeight, reps: 8, rpe: null, rest_seconds: 90, weight_unit: previousUnit }];
    exercise.sets = [{ ...createQuickSetDraft(1), weight: todayWeight, reps: '8', completed: true }];
    return draft;
  }

  it('reports a load increase against the matched set', () => {
    const summary = summarizeQuickWorkout(benchDraft('140', 135), '2026-09-12T18:00:00.000Z');
    expect(summary.working_sets).toBe(1);
    expect(summary.duration_minutes).toBe(60);
    expect(summary.changes[0]).toMatchObject({ direction: 'up' });
    expect(summary.changes[0].detail).toContain('+5 lb');
    expect(summary.headline).toContain('Bench Press');
  });

  it('compares across units rather than against a raw number', () => {
    // 61.25 kg is 135 lb; entering 135 lb today held the load, it did not add 73.
    const summary = summarizeQuickWorkout(benchDraft('135', 61.25, 'kg'));
    expect(summary.changes[0].direction).toBe('held');
  });

  it('stays silent when there is nothing to compare', () => {
    const draft = draftWith();
    draft.exercises[0].sets[0].weight = '135';
    draft.exercises[0].sets[0].completed = true;
    const summary = summarizeQuickWorkout(draft);
    expect(summary.changes[0].direction).toBe('new');
    expect(summary.headline).toBeNull();
  });

  it('counts warm-ups separately from working sets', () => {
    const draft = draftWith();
    draft.exercises[0].sets = [
      { ...createQuickSetDraft(1), weight: '95', reps: '10', completed: true, warmup: true },
      { ...createQuickSetDraft(2), weight: '185', reps: '5', completed: true }
    ];
    const summary = summarizeQuickWorkout(draft);
    expect(summary.working_sets).toBe(1);
    expect(summary.warmup_sets).toBe(1);
  });
});
