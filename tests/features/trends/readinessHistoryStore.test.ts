import { describe, expect, it } from 'vitest';

import { withReadinessEntry, type ReadinessHistoryEntry } from '../../../src/features/trends/readinessHistoryStore';

const entry = (date: string, score: number): ReadinessHistoryEntry => ({ date, score, label: 'steady', confidence: 'medium', recordedAt: `${date}T12:00:00.000Z` });

describe('withReadinessEntry', () => {
  it('keeps one reading per day, the latest one', () => {
    const rows = withReadinessEntry([entry('2026-09-23', 70), entry('2026-09-24', 72)], entry('2026-09-24', 76));
    expect(rows.map((row) => [row.date, row.score])).toEqual([['2026-09-23', 70], ['2026-09-24', 76]]);
  });

  it('keeps days in order when an earlier day is added', () => {
    const rows = withReadinessEntry([entry('2026-09-24', 72)], entry('2026-09-22', 68));
    expect(rows.map((row) => row.date)).toEqual(['2026-09-22', '2026-09-24']);
  });
});
