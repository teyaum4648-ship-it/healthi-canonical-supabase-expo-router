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
