import { describe, expect, it } from 'vitest';

import { loggingPrompts, type LoggingPromptInput } from '../../../src/features/dashboard/loggingPrompts';
import { pillarColors, pillarTint } from '../../../src/styles/pillarColors';

const empty: LoggingPromptInput = {
  sleepMissing: true,
  checkin: null,
  mealsToday: 0,
  waterToday: 0,
  sessionsThisWeek: 0,
  clock: () => '9:15 AM'
};

describe('loggingPrompts', () => {
  it('keeps one row per pillar in a fixed order, whatever is done', () => {
    const blank = loggingPrompts(empty).map((row) => row.id);
    const full = loggingPrompts({ ...empty, sleepMissing: false, checkin: { at: '2026-09-24T09:15:00Z', stale: false }, mealsToday: 2, sessionsThisWeek: 3 }).map((row) => row.id);
    expect(blank).toEqual(['sleep', 'checkin', 'food', 'movement']);
    expect(full).toEqual(blank);
  });

  it('asks for each thing when nothing is logged', () => {
    const rows = loggingPrompts(empty);
    expect(rows.every((row) => !row.done)).toBe(true);
    expect(rows.map((row) => row.actionLabel)).toEqual(['Add sleep', 'Check in', 'Log food', 'Log one']);
    expect(rows[2]?.status).toBe('No food or water logged today');
    expect(rows[3]?.status).toBe('No sessions in the last 7 days');
  });

  it('marks rows done and changes the action once today has them', () => {
    const rows = loggingPrompts({ ...empty, sleepMissing: false, checkin: { at: '2026-09-24T09:15:00Z', stale: false }, mealsToday: 1, waterToday: 2, sessionsThisWeek: 1 });
    expect(rows.every((row) => row.done)).toBe(true);
    expect(rows.map((row) => row.status)).toEqual([
      'Last night is counted',
      'Checked in at 9:15 AM',
      '1 meal logged today · water too',
      '1 session in the last 7 days'
    ]);
    expect(rows.map((row) => row.actionLabel)).toEqual(['Edit', 'Update', 'Add more', 'Log another']);
  });

  it('asks for a fresh check-in when the last one is old', () => {
    const row = loggingPrompts({ ...empty, checkin: { at: '2026-09-24T06:00:00Z', stale: true } })[1];
    expect(row).toMatchObject({ done: false, actionLabel: 'Update', status: 'Your check-in is over two hours old' });
  });

  it('does not claim there is no check-in when it cannot know', () => {
    const row = loggingPrompts({ ...empty, checkin: undefined })[1];
    expect(row?.status).toBe('How today has felt so far');
    expect(row?.status).not.toMatch(/^No /);
  });

  it('counts water without calling it a meal, and leaves water out when it is not loaded', () => {
    expect(loggingPrompts({ ...empty, waterToday: 1 })[2]).toMatchObject({ status: 'Water logged, no meals yet', done: false });
    expect(loggingPrompts({ ...empty, waterToday: null })[2]?.status).toBe('No meals logged today');
    expect(loggingPrompts({ ...empty, waterToday: null, mealsToday: 3 })[2]?.status).toBe('3 meals logged today');
  });

  it('does not report zero sessions when the week is unknown', () => {
    const row = loggingPrompts({ ...empty, sessionsThisWeek: null })[3];
    expect(row).toMatchObject({ status: 'Log a session to count it this week', done: false, actionLabel: 'Log one' });
  });

  it('names each pillar alongside its colour', () => {
    for (const row of loggingPrompts(empty)) {
      expect(pillarColors[row.pillar]).toMatch(/^#[0-9A-F]{6}$/);
      expect(row.pillarName.length).toBeGreaterThan(0);
    }
  });

  it('uses no shame or diagnosis language', () => {
    const text = [empty, { ...empty, checkin: { at: 'x', stale: true } }].flatMap((input) => loggingPrompts(input)).map((row) => `${row.status} ${row.actionLabel}`).join(' ');
    expect(text).not.toMatch(/diagnos|treat|fail|bad|should have|missed/i);
  });
});

describe('pillarTint', () => {
  it('turns a pillar colour into a translucent backing', () => {
    expect(pillarTint('recovery_rhythm')).toBe('rgba(36, 122, 49, 0.16)');
    expect(pillarTint('nourishment', 0.3)).toBe('rgba(137, 68, 171, 0.3)');
  });

  it('keeps the four pillars distinct', () => {
    expect(new Set(Object.values(pillarColors)).size).toBe(4);
  });
});
