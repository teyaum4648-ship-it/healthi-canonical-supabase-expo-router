import { describe, expect, it } from 'vitest';

import { createMovementPreviewFixture } from '../../../src/features/movement/movementPreviewFixtures';

describe('movement preview fixture', () => {
  it('provides a full, non-persisted visual state across four weeks', () => {
    const fixture = createMovementPreviewFixture('2026-08-04');

    expect(fixture.workoutSessions).toHaveLength(10);
    expect(fixture.workoutExerciseEntries.length).toBeGreaterThan(10);
    expect(fixture.workoutSetEntries.length).toBeGreaterThan(10);
    expect(fixture.exerciseLibrary.length).toBeGreaterThan(12);
    expect(fixture.workoutSessions.at(-1)?.session_date).toBe('2026-07-08');
  });

  it('covers the movement categories used by the Library layout', () => {
    const fixture = createMovementPreviewFixture('2026-08-04');
    const categories = new Set(fixture.exerciseLibrary.map((item) => item.category));

    expect(categories).toEqual(new Set(['strength', 'cardio', 'mobility', 'recovery', 'sport', 'other']));
  });

  it('keeps every exercise entry attached to a fixture session', () => {
    const fixture = createMovementPreviewFixture('2026-08-04');
    const sessionIds = new Set(fixture.workoutSessions.map((item) => item.id));

    expect(fixture.workoutExerciseEntries.every((item) => sessionIds.has(item.workout_session_id))).toBe(true);
    const exerciseIds = new Set(fixture.workoutExerciseEntries.map((item) => item.id));
    expect(fixture.workoutSetEntries.every((item) => exerciseIds.has(item.workout_exercise_entry_id))).toBe(true);
  });
});
