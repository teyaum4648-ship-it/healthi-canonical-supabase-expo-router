import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import type { FoundationScore } from '../../../src/engines/foundations/foundationTypes';
import {
  foundationAverage,
  foundationHistory,
  getFoundationScores,
  hasStoredScore,
  saveFoundationScore,
  toStoredFoundationScore,
  type FoundationScoreClient,
  type FoundationScoreRow
} from '../../../src/features/foundations/foundationScorePersistence';

function pillar(date: string, score: number | null, coverage = 0.8): FoundationScore {
  return {
    domain: 'movement_capacity', date, score, confidence: score === null ? 'low' : 'medium', coverage,
    contributors: [{ id: 'consistency', label: 'Consistency', weight: 0.25, value: 0.5, detail: '2 of 4 sessions' }],
    limiters: [{ id: 'consistency', label: 'Consistency', weight: 0.25, value: 0.5, detail: '2 of 4 sessions' }],
    reason_codes: ['movement_history_available'], summary: 'Two sessions this week.'
  };
}

function row(date: string, movement: number | null): FoundationScoreRow {
  return {
    user_id: 'u1', score_date: date, recovery_rhythm: {}, mind_life_load: {}, nourishment: {},
    movement_capacity: movement === null ? {} : toStoredFoundationScore(pillar(date, movement))
  };
}

describe('what a recorded pillar keeps', () => {
  it('keeps the reading and drops the rendering', () => {
    const stored = toStoredFoundationScore(pillar('2026-09-24', 72));
    expect(stored).toEqual({ score: 72, confidence: 'medium', coverage: 0.8, limiters: ['consistency'], reason_codes: ['movement_history_available'], summary: 'Two sessions this week.' });
    expect(stored).not.toHaveProperty('contributors');
  });
  it('records a withheld score as a known-nothing day rather than dropping it', () => {
    expect(toStoredFoundationScore(pillar('2026-09-24', null)).score).toBeNull();
    expect(hasStoredScore(toStoredFoundationScore(pillar('2026-09-24', null)))).toBe(true);
    expect(hasStoredScore({})).toBe(false);
  });
});

describe('writing one pillar without disturbing the others', () => {
  function client(updateMatched: boolean, insertFails = false) {
    const update = vi.fn((values: Partial<FoundationScoreRow>) => ({ values, eq: () => ({ eq: () => ({ select: async () => ({ data: updateMatched ? [{ user_id: 'u1' }] : [], error: null }) }) }) }));
    const insert = vi.fn(async () => ({ error: insertFails ? { message: 'duplicate' } : null }));
    return { calls: { update, insert }, client: { from: () => ({ update, insert, select: vi.fn() }) } as unknown as FoundationScoreClient };
  }

  it('updates only its own column when the day already exists', async () => {
    const { calls, client: c } = client(true);
    await saveFoundationScore(c, 'u1', 'movement_capacity', pillar('2026-09-24T00:00:00.000Z', 72));
    expect(Object.keys(calls.update.mock.calls[0][0])).toEqual(['movement_capacity']);
    expect(calls.insert).not.toHaveBeenCalled();
  });
  it('creates the day when there is not one yet', async () => {
    const { calls, client: c } = client(false);
    await saveFoundationScore(c, 'u1', 'nourishment', pillar('2026-09-24', 61));
    expect(calls.insert).toHaveBeenCalledTimes(1);
  });
  it('retries as an update when two pillars race to create the same day', async () => {
    const { calls, client: c } = client(false, true);
    await saveFoundationScore(c, 'u1', 'nourishment', pillar('2026-09-24', 61));
    expect(calls.insert).toHaveBeenCalledTimes(1);
    expect(calls.update).toHaveBeenCalledTimes(2);
  });
  it('asks only for the signed-in user and reports a failed read', async () => {
    const eq = vi.fn(function this_(this: unknown) { return chain; });
    const chain = { eq, gte: () => chain, lte: () => chain, order: () => chain, limit: async () => ({ data: [row('2026-09-24', 70)], error: null }) };
    const c = { from: () => ({ select: () => chain }) } as unknown as FoundationScoreClient;
    expect(await getFoundationScores(c, 'u1', '2026-09-18', '2026-09-24')).toHaveLength(1);
    expect(eq).toHaveBeenCalledWith('user_id', 'u1');

    const failing = { from: () => ({ select: () => ({ eq: () => ({ gte: () => ({ lte: () => ({ order: () => ({ limit: async () => ({ data: null, error: { message: 'no' } }) }) }) }) }) }) }) } as unknown as FoundationScoreClient;
    await expect(getFoundationScores(failing, 'u1', '2026-09-18', '2026-09-24')).rejects.toThrow('could not be read');
  });
});

describe('reading a pillar back over a window', () => {
  const rows = [row('2026-09-21', 60), row('2026-09-22', null), row('2026-09-23', 80), row('2026-09-24', 70)];

  it('leaves out the days it knew nothing about instead of scoring them zero', () => {
    expect(foundationHistory(rows, 'movement_capacity').map((entry) => entry.date)).toEqual(['2026-09-21', '2026-09-23', '2026-09-24']);
    expect(foundationAverage(rows, 'movement_capacity')).toEqual({ average: 70, days: 3 });
  });
  it('says there is no average rather than inventing one', () => {
    expect(foundationAverage([row('2026-09-21', null)], 'movement_capacity')).toEqual({ average: null, days: 0 });
    expect(foundationAverage([], 'nourishment')).toEqual({ average: null, days: 0 });
  });
  it('is recorded by the screens that compute each pillar', () => {
    expect(readFileSync('app/(app)/(tabs)/movement.tsx', 'utf8')).toContain("domain: 'movement_capacity'");
    expect(readFileSync('app/(app)/(tabs)/index.tsx', 'utf8')).toContain("domain: 'nourishment'");
  });
});
