import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FoundationScore } from '../../../src/engines/foundations/foundationTypes';

const storage = vi.hoisted(() => new Map<string, string>());
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (key: string) => storage.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => { storage.set(key, value); })
  }
}));

import { getLocalDemoFoundationScores, saveLocalDemoFoundationScore } from '../../../src/features/foundations/localDemoFoundationStore';
import { foundationAverage, hasStoredScore } from '../../../src/features/foundations/foundationScorePersistence';
import { resettableDemoKeys } from '../../../src/features/auth/demoLifecycle';

function pillar(domain: FoundationScore['domain'], date: string, score: number): FoundationScore {
  return { domain, date, score, confidence: 'medium', coverage: 0.7, contributors: [], limiters: [], reason_codes: [], summary: 'x' };
}

describe('pillar history on the device', () => {
  beforeEach(() => storage.clear());

  it('keeps one day per date and one entry per pillar', async () => {
    await saveLocalDemoFoundationScore('movement_capacity', pillar('movement_capacity', '2026-09-24', 70));
    await saveLocalDemoFoundationScore('nourishment', pillar('nourishment', '2026-09-24', 60));
    const rows = await getLocalDemoFoundationScores();
    expect(rows).toHaveLength(1);
    expect(hasStoredScore(rows[0].movement_capacity) && rows[0].movement_capacity.score).toBe(70);
    expect(hasStoredScore(rows[0].nourishment) && rows[0].nourishment.score).toBe(60);
  });
  it('does not let one pillar overwrite another recorded the same day', async () => {
    await saveLocalDemoFoundationScore('nourishment', pillar('nourishment', '2026-09-24', 60));
    await saveLocalDemoFoundationScore('movement_capacity', pillar('movement_capacity', '2026-09-24', 70));
    await saveLocalDemoFoundationScore('nourishment', pillar('nourishment', '2026-09-24', 65));
    const [day] = await getLocalDemoFoundationScores();
    expect(hasStoredScore(day.movement_capacity) && day.movement_capacity.score).toBe(70);
    expect(hasStoredScore(day.nourishment) && day.nourishment.score).toBe(65);
  });
  it('builds an average across days', async () => {
    for (const [date, score] of [['2026-09-22', 60], ['2026-09-23', 80], ['2026-09-24', 70]] as const) {
      await saveLocalDemoFoundationScore('movement_capacity', pillar('movement_capacity', date, score));
    }
    expect(foundationAverage(await getLocalDemoFoundationScores(), 'movement_capacity')).toEqual({ average: 70, days: 3 });
  });
  it('keeps the store bounded, dropping the oldest days and keeping order', async () => {
    const start = new Date('2026-07-01T12:00:00.000Z');
    for (let offset = 0; offset < 50; offset += 1) {
      const day = new Date(start);
      day.setUTCDate(day.getUTCDate() + offset);
      await saveLocalDemoFoundationScore('movement_capacity', pillar('movement_capacity', day.toISOString().slice(0, 10), 70));
    }
    const rows = await getLocalDemoFoundationScores();
    expect(rows).toHaveLength(45);
    expect(rows[0].score_date).toBe('2026-07-06');
    expect(rows.at(-1)?.score_date).toBe('2026-08-19');
    expect([...rows].sort((a, b) => a.score_date.localeCompare(b.score_date))).toEqual(rows);
  });
  it('survives a corrupt store instead of throwing at the screen', async () => {
    storage.set('healthi:demo:foundations:scores', 'not json');
    expect(await getLocalDemoFoundationScores()).toEqual([]);
  });
  it('is cleared by an explicit demo reset', () => {
    expect(resettableDemoKeys).toContain('healthi:demo:foundations:scores');
  });
});
