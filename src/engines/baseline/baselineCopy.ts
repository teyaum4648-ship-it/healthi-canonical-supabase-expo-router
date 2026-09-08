import type { BaselineDomain, BaselineMode } from './baselineTypes';

export const baselineDomainLabels: Record<BaselineDomain, string> = {
  recovery_rhythm: 'Recovery + Rhythm',
  nourishment: 'Nourishment',
  movement_capacity: 'Movement Capacity',
  mind_life_load: 'Mind + Life Load',
  readiness: 'Readiness'
};

export const baselineModeLabels: Record<BaselineMode, string> = {
  build: 'Build',
  maintain: 'Maintain',
  correct: 'Correct',
  restore: 'Restore',
  professional_guidance: 'Guided'
};

export function humanize(value: string): string {
  return value
    .replace(/[_-]/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}
