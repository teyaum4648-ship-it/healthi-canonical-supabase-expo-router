import { describe, expect, it } from 'vitest';

import { generateCircadianBriefing } from '../../../src/engines/circadian';
import {
  CAFFEINE_DRINKS,
  caffeineDay,
  caffeineOnBoard,
  createCaffeineEntry,
  drinkById,
  isAfterCutoff
} from '../../../src/features/sleepRhythm/caffeineLog';
import { createDefaultSleepNeedEstimate } from '../../../src/features/sleepRhythm/rhythmInputs';

const coffee = drinkById('coffee')!;
const date = '2026-07-14';

describe('caffeine on board', () => {
  it('halves every five hours', () => {
    const entry = createCaffeineEntry(coffee, date, '2026-07-14T08:00:00.000Z');
    expect(caffeineOnBoard([entry], Date.parse('2026-07-14T08:00:00.000Z'))).toBe(95);
    expect(caffeineOnBoard([entry], Date.parse('2026-07-14T13:00:00.000Z'))).toBe(48);
    expect(caffeineOnBoard([entry], Date.parse('2026-07-14T18:00:00.000Z'))).toBe(24);
  });

  it('ignores drinks in the future or more than a day old', () => {
    const later = createCaffeineEntry(coffee, date, '2026-07-14T20:00:00.000Z');
    const old = createCaffeineEntry(coffee, '2026-07-12', '2026-07-12T08:00:00.000Z');
    expect(caffeineOnBoard([later, old], Date.parse('2026-07-14T09:00:00.000Z'))).toBe(0);
  });

  it('adds up the day', () => {
    const rows = [
      createCaffeineEntry(coffee, date, '2026-07-14T08:00:00.000Z'),
      createCaffeineEntry(drinkById('tea')!, date, '2026-07-14T13:00:00.000Z'),
      createCaffeineEntry(coffee, '2026-07-13', '2026-07-13T08:00:00.000Z')
    ];
    const day = caffeineDay(rows, date);
    expect(day.totalMg).toBe(142);
    expect(day.count).toBe(2);
    expect(day.last?.drinkId).toBe('tea');
  });

  it('lists only plain drink names with their typical amounts', () => {
    expect(CAFFEINE_DRINKS.every((drink) => drink.mg > 0 && drink.serving.length > 0)).toBe(true);
  });
});

describe('the cutoff', () => {
  it('compares the drink’s local time with the wall-clock cutoff', () => {
    const local = (hour: number) => new Date(2026, 6, 14, hour, 0).toISOString();
    // The cutoff is held as a wall-clock time on the UTC axis: 14:00 means 2 p.m. local.
    expect(isAfterCutoff(local(15), '2026-07-14T14:00:00.000Z')).toBe(true);
    expect(isAfterCutoff(local(9), '2026-07-14T14:00:00.000Z')).toBe(false);
    expect(isAfterCutoff(local(9), null)).toBe(false);
  });
});

describe('the energy curve reads it', () => {
  it('lifts the afternoon when caffeine is on board', () => {
    const params = {
      date,
      timezone: 'UTC',
      recentSleepSessions: [{
        id: 'night', date, sleep_start_at: `${date}T00:00:00.000Z`, sleep_end_at: `${date}T07:30:00.000Z`,
        duration_minutes: 450, source: 'manual' as const, source_confidence: 'medium' as const, reason_codes: [], created_at: `${date}T07:30:00.000Z`
      }],
      sleepNeed: createDefaultSleepNeedEstimate(`${date}T12:00:00.000Z`),
      now: `${date}T14:00:00.000Z`
    };
    const without = generateCircadianBriefing(params);
    const withCaffeine = generateCircadianBriefing({ ...params, caffeineOnBoardMg: 150 });
    const sum = (curve: typeof without.energy_curve) => curve.reduce((total, point) => total + point.estimated_energy, 0);
    expect(sum(withCaffeine.energy_curve)).toBeGreaterThan(sum(without.energy_curve));
  });
});
