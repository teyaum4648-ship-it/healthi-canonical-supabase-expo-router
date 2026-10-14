import { createScopedLogStore, isRecord } from './scopedLogStore';

/**
 * "How's your head?" — one tap, five answers, before and after a practice or on its own.
 *
 * The point is the pair. A breathing session that ends with a number of minutes says
 * that something was done; one that ends with "Tense → Steady" says whether it helped,
 * in the person's own words, and over a few weeks shows which technique helps them.
 *
 * It is a self-report about the moment, not a measure of mood or of anything clinical.
 */

export type HeadRating = 1 | 2 | 3 | 4 | 5;
export type HeadMoment = 'before' | 'after' | 'now';

export type HeadCheck = {
  id: string;
  /** YYYY-MM-DD, the day it belongs to. */
  date: string;
  rating: HeadRating;
  moment: HeadMoment;
  /** The breathing technique it was taken around, when it was. */
  techniqueId: string | null;
  at: string;
};

export const HEAD_OPTIONS: ReadonlyArray<{ rating: HeadRating; word: string; detail: string }> = [
  { rating: 1, word: 'Overloaded', detail: 'Too much at once' },
  { rating: 2, word: 'Tense', detail: 'Wound up or on edge' },
  { rating: 3, word: 'Okay', detail: 'Neither here nor there' },
  { rating: 4, word: 'Steady', detail: 'Settled and able' },
  { rating: 5, word: 'Clear', detail: 'Calm and focused' }
];

export function headWord(rating: HeadRating): string {
  return HEAD_OPTIONS.find((option) => option.rating === rating)?.word ?? 'Okay';
}

function isRating(value: unknown): value is HeadRating {
  return value === 1 || value === 2 || value === 3 || value === 4 || value === 5;
}

function isHeadCheck(value: unknown): value is HeadCheck {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.date === 'string'
    && isRating(value.rating)
    && (value.moment === 'before' || value.moment === 'after' || value.moment === 'now')
    && (value.techniqueId === null || typeof value.techniqueId === 'string')
    && typeof value.at === 'string';
}

export const localHeadCheckStore = createScopedLogStore<HeadCheck>({
  key: 'healthi:mood:head:v1',
  isRow: isHeadCheck
});

export function createHeadCheck(params: { date: string; rating: HeadRating; moment: HeadMoment; techniqueId?: string | null; at?: string }): HeadCheck {
  const at = params.at ?? new Date().toISOString();
  return { id: `head-${Date.parse(at)}-${params.moment}`, date: params.date, rating: params.rating, moment: params.moment, techniqueId: params.techniqueId ?? null, at };
}

/** The most recent answer today, whichever moment it was taken at. */
export function latestHeadCheck(rows: readonly HeadCheck[], date: string): HeadCheck | null {
  return rows.filter((row) => row.date === date).sort((a, b) => a.at.localeCompare(b.at)).at(-1) ?? null;
}

export type HeadShift = { before: HeadRating; after: HeadRating; change: number; line: string };

/** How a practice moved the answer, in the person's own words. */
export function headShift(before: HeadRating, after: HeadRating): HeadShift {
  const change = after - before;
  const words = `${headWord(before)} → ${headWord(after)}`;
  const line = change > 0 ? `${words}. That helped.` : change < 0 ? `${words}. Not this time — that happens.` : `${words}. Holding steady.`;
  return { before, after, change, line };
}

/**
 * Before-and-after pairs, matched by technique and taken within an hour of each other,
 * with the average change per technique: which practice actually helps this person.
 */
export function shiftsByTechnique(rows: readonly HeadCheck[]): Array<{ techniqueId: string; sessions: number; averageChange: number }> {
  const sorted = [...rows].sort((a, b) => a.at.localeCompare(b.at));
  const totals = new Map<string, { sessions: number; change: number }>();
  sorted.forEach((row, index) => {
    if (row.moment !== 'after' || !row.techniqueId) return;
    const before = sorted.slice(0, index).reverse().find((candidate) =>
      candidate.moment === 'before' && candidate.techniqueId === row.techniqueId && Date.parse(row.at) - Date.parse(candidate.at) <= 3_600_000
    );
    if (!before) return;
    const entry = totals.get(row.techniqueId) ?? { sessions: 0, change: 0 };
    totals.set(row.techniqueId, { sessions: entry.sessions + 1, change: entry.change + (row.rating - before.rating) });
  });
  return [...totals.entries()]
    .map(([techniqueId, { sessions, change }]) => ({ techniqueId, sessions, averageChange: Math.round((change / sessions) * 10) / 10 }))
    .sort((a, b) => b.averageChange - a.averageChange || b.sessions - a.sessions);
}
