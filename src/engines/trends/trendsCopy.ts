import type { TrendsDomain } from './trendsTypes';

export const trendDomainTitles: Record<TrendsDomain, string> = {
  recovery_rhythm: 'Recovery + Rhythm',
  nourishment: 'Nourishment',
  movement_capacity: 'Movement Capacity',
  mind_life_load: 'Mind + Life Load',
  readiness: 'Readiness'
};

export function confidenceLabel(confidence: 'low' | 'medium' | 'high'): string {
  return `Confidence: ${confidence}`;
}

/**
 * How much a trend is built from, in days rather than a confidence grade.
 *
 * "Confidence: high" asked a person to trust a word; "5 of 7 days logged" shows them the
 * evidence and lets them judge it, and tells them how to improve it.
 */
export function daysLoggedLabel(days: number, rangeDays: number): string {
  if (days === 0) return `Nothing logged in the last ${rangeDays} days`;
  return `${days} of ${rangeDays} days logged`;
}
