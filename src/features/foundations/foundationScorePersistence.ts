import type { DataConfidence } from '../../types/common';
import type { FoundationDomain, FoundationScore } from '../../engines/foundations/foundationTypes';

/**
 * A pillar score as it is kept, which is less than the pillar carries on screen.
 *
 * Contributors are how a score is explained today; what a trend needs is the number, how
 * much was known behind it, and what was holding it back. Keeping the full breakdown would
 * store a rendering rather than a reading, and it would grow every time a term is added.
 */
export type StoredFoundationScore = {
  score: number | null;
  confidence: DataConfidence;
  coverage: number;
  limiters: string[];
  reason_codes: string[];
  summary: string;
};

export type FoundationScoreRow = {
  user_id: string;
  score_date: string;
  recovery_rhythm: StoredFoundationScore | Record<string, never>;
  nourishment: StoredFoundationScore | Record<string, never>;
  movement_capacity: StoredFoundationScore | Record<string, never>;
  mind_life_load: StoredFoundationScore | Record<string, never>;
};

type Result = PromiseLike<{ data: FoundationScoreRow[] | null; error: unknown }>;
type SelectQuery = { eq(column: string, value: string): SelectQuery; gte(column: string, value: string): SelectQuery; lte(column: string, value: string): SelectQuery; order(column: string, options: { ascending: boolean }): SelectQuery; limit(count: number): Result };
type UpdateQuery = { eq(column: string, value: string): UpdateQuery; select(columns: string): Result };

export type FoundationScoreClient = {
  from(table: 'foundation_scores'): {
    select(columns: string): SelectQuery;
    update(values: Partial<FoundationScoreRow>): UpdateQuery;
    insert(values: Partial<FoundationScoreRow>): PromiseLike<{ error: unknown }>;
  };
};

export function toStoredFoundationScore(score: FoundationScore): StoredFoundationScore {
  return {
    score: score.score,
    confidence: score.confidence,
    coverage: score.coverage,
    limiters: score.limiters.map((limiter) => limiter.id),
    reason_codes: [...score.reason_codes],
    summary: score.summary
  };
}

/** True when a stored pillar actually holds a reading rather than the column default. */
export function hasStoredScore(value: StoredFoundationScore | Record<string, never> | null | undefined): value is StoredFoundationScore {
  return Boolean(value && typeof value === 'object' && 'confidence' in value);
}

/**
 * Record one pillar for one day, leaving the day's other pillars alone.
 *
 * The write targets a single column rather than the row, because the pillars are computed
 * on different screens at different moments. Reading the day, merging one pillar in and
 * writing the row back would mean whichever screen saved last erased what the others had
 * recorded since it read.
 */
export async function saveFoundationScore(
  client: FoundationScoreClient,
  userId: string,
  domain: FoundationDomain,
  score: FoundationScore
): Promise<void> {
  const value = toStoredFoundationScore(score);
  const scoreDate = score.date.slice(0, 10);
  const { data, error } = await client
    .from('foundation_scores')
    .update({ [domain]: value })
    .eq('user_id', userId)
    .eq('score_date', scoreDate)
    .select('user_id');
  if (error) throw new Error('This pillar could not be recorded.');
  if (data && data.length > 0) return;

  /* No row for the day yet. A duplicate insert can only happen when two pillars land at
     once on a fresh day; the unique constraint rejects the loser and the retry updates. */
  const insert = await client.from('foundation_scores').insert({ user_id: userId, score_date: scoreDate, [domain]: value });
  if (!insert.error) return;
  const retry = await client
    .from('foundation_scores')
    .update({ [domain]: value })
    .eq('user_id', userId)
    .eq('score_date', scoreDate)
    .select('user_id');
  if (retry.error) throw new Error('This pillar could not be recorded.');
}

export async function getFoundationScores(
  client: FoundationScoreClient,
  userId: string,
  startDate: string,
  endDate: string,
  limit = 60
): Promise<FoundationScoreRow[]> {
  const { data, error } = await client
    .from('foundation_scores')
    .select('*')
    .eq('user_id', userId)
    .gte('score_date', startDate)
    .lte('score_date', endDate)
    .order('score_date', { ascending: true })
    .limit(limit);
  if (error) throw new Error('Your pillar history could not be read.');
  return data ?? [];
}

/**
 * One pillar across the days that have a reading for it.
 *
 * Days where the pillar withheld its score are left out rather than counted as zero: a day
 * nothing was known about is not a bad day, and averaging it in as one would report a
 * decline that never happened.
 */
export function foundationHistory(
  rows: readonly FoundationScoreRow[],
  domain: FoundationDomain
): Array<{ date: string; score: number; confidence: DataConfidence }> {
  const history: Array<{ date: string; score: number; confidence: DataConfidence }> = [];
  for (const row of rows) {
    const stored = row[domain];
    if (!hasStoredScore(stored) || typeof stored.score !== 'number') continue;
    history.push({ date: row.score_date, score: stored.score, confidence: stored.confidence });
  }
  return history;
}

/** The pillar's average over the days that reported one, and how many that was. */
export function foundationAverage(
  rows: readonly FoundationScoreRow[],
  domain: FoundationDomain
): { average: number | null; days: number } {
  const history = foundationHistory(rows, domain);
  if (history.length === 0) return { average: null, days: 0 };
  const total = history.reduce((sum, entry) => sum + entry.score, 0);
  return { average: Math.round(total / history.length), days: history.length };
}
