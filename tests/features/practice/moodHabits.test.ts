import { describe, expect, it } from 'vitest';

import {
  availableHabits,
  createCustomHabit,
  CUSTOM_HABIT_MAX_NAME,
  DEFAULT_HABIT_IDS,
  HABIT_LIBRARY,
  habitById,
  habitDayLine,
  isUsableHabitName,
  resolveRoutine,
  summariseHabitDay,
  type HabitCompletion,
  type MoodHabit
} from '../../../src/features/practice/moodHabits';

function completion(habitId: string, date = '2026-09-16'): HabitCompletion {
  return { id: `c-${habitId}-${date}`, date, habitId, completedAt: `${date}T09:00:00.000Z` };
}

describe('HABIT_LIBRARY', () => {
  it('has unique ids and real copy on every entry', () => {
    const ids = HABIT_LIBRARY.map((h) => h.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const habit of HABIT_LIBRARY) {
      expect(habit.name.length, habit.id).toBeGreaterThan(3);
      expect(habit.detail.length, habit.id).toBeGreaterThan(5);
      expect(habit.why.length, habit.id).toBeGreaterThan(60);
      expect(habit.minutes, habit.id).toBeGreaterThan(0);
    }
  });

  it('covers what was actually asked for', () => {
    const ids = HABIT_LIBRARY.map((h) => h.id);
    for (const id of ['sauna', 'cold_shower', 'text_family', 'text_friend', 'stretch', 'nsdr', 'journal']) {
      expect(ids, id).toContain(id);
    }
  });

  it('cautions the two that raise blood pressure or cook you', () => {
    expect(habitById('cold_shower')?.caution).toBeTruthy();
    expect(habitById('sauna')?.caution).toBeTruthy();
    // And does not pad a message-a-friend with a warning that means nothing.
    expect(habitById('text_friend')?.caution).toBeUndefined();
  });

  it('starts a new person with a short routine rather than everything', () => {
    expect(DEFAULT_HABIT_IDS.length).toBeLessThanOrEqual(4);
    for (const id of DEFAULT_HABIT_IDS) expect(habitById(id), id).not.toBeNull();
  });
});

describe('custom habits', () => {
  it('rejects a name too short or too long to be useful', () => {
    expect(isUsableHabitName('')).toBe(false);
    expect(isUsableHabitName(' a ')).toBe(false);
    expect(isUsableHabitName('Porch coffee')).toBe(true);
    expect(isUsableHabitName('x'.repeat(CUSTOM_HABIT_MAX_NAME + 1))).toBe(false);
  });

  it('trims and caps the stored name', () => {
    const habit = createCustomHabit('  Sit on the porch  ', 10);
    expect(habit.name).toBe('Sit on the porch');
    expect(createCustomHabit('y'.repeat(200), 5).name).toHaveLength(CUSTOM_HABIT_MAX_NAME);
  });

  it('marks them custom and does not collide when two share a name', () => {
    /*
     * The id is time-based rather than derived from the name, so renaming one later
     * cannot collide with an existing entry or orphan its completions.
     */
    const a = createCustomHabit('Record on the turntable', 20, new Date(1_000));
    const b = createCustomHabit('Record on the turntable', 20, new Date(2_000));
    expect(a.custom).toBe(true);
    expect(a.id).not.toBe(b.id);
  });

  it('resolves alongside library habits', () => {
    const custom = [createCustomHabit('Porch coffee', 10, new Date(5_000))];
    const routine = resolveRoutine(['text_friend', custom[0].id], custom);
    expect(routine.map((h) => h.name)).toEqual(['Message one friend', 'Porch coffee']);
  });

  it('drops an id that no longer resolves instead of rendering a hole', () => {
    expect(resolveRoutine(['text_friend', 'deleted-custom-123'], [])).toHaveLength(1);
  });
});

describe('availableHabits', () => {
  it('offers only what is not already in the routine', () => {
    const available = availableHabits(['text_friend', 'sauna']);
    expect(available.some((h) => h.id === 'text_friend')).toBe(false);
    expect(available.some((h) => h.id === 'sauna')).toBe(false);
    expect(available.length).toBe(HABIT_LIBRARY.length - 2);
  });
});

describe('summariseHabitDay', () => {
  const routine: MoodHabit[] = resolveRoutine(['text_friend', 'stretch', 'journal'], []);

  it('counts only today', () => {
    const day = summariseHabitDay(
      [completion('text_friend'), completion('stretch', '2026-09-15')],
      routine,
      '2026-09-16'
    );
    expect(day.done).toBe(1);
    expect(day.total).toBe(3);
  });

  it('cannot report more done than are in the routine', () => {
    /*
     * A habit removed from the routine keeps its completion rows. Counting those would
     * make the day read "4 of 3", so only routine members count toward done.
     */
    const day = summariseHabitDay(
      [completion('text_friend'), completion('stretch'), completion('sauna'), completion('nsdr')],
      routine,
      '2026-09-16'
    );
    expect(day.done).toBe(2);
    expect(day.done).toBeLessThanOrEqual(day.total);
  });

  it('dedupes a double tap on the same habit', () => {
    const twice = [completion('text_friend'), { ...completion('text_friend'), id: 'other' }];
    expect(summariseHabitDay(twice, routine, '2026-09-16').done).toBe(1);
  });

  it('reads as a sentence at every stage', () => {
    expect(habitDayLine(summariseHabitDay([], [], '2026-09-16'))).toMatch(/No habits/);
    expect(habitDayLine(summariseHabitDay([], routine, '2026-09-16'))).toMatch(/None of your 3/);
    expect(habitDayLine(summariseHabitDay([completion('stretch')], routine, '2026-09-16'))).toMatch(/1 of 3/);
    const all = ['text_friend', 'stretch', 'journal'].map((id) => completion(id));
    expect(habitDayLine(summariseHabitDay(all, routine, '2026-09-16'))).toMatch(/All 3/);
  });
});
