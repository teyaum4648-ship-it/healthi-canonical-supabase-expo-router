import type { DailyReadinessDomain } from '../../../engines/readiness';
import { PILLAR_ORDER, type PillarReading } from './pillarRingModel';

/** Short names for the pillar row and the ring's spoken label. */
export const PILLAR_NAMES: Record<DailyReadinessDomain, string> = {
  recovery_rhythm: 'Recovery',
  nourishment: 'Nourish',
  movement_capacity: 'Movement',
  mind_life_load: 'Mind'
};

/** Signed points, short enough for a quarter of the row. Uses a true minus sign. */
export function points(contribution: number): string {
  const value = Math.round(contribution);
  return value > 0 ? `+${value}` : value < 0 ? `−${Math.abs(value)}` : '0';
}

/**
 * The band shows the readiness line as a headline and a quieter sub-line. The copy is the
 * engine's own; this only splits it after its first sentence. A single sentence stays whole.
 */
export function splitFirstSentence(text: string): { headline: string; rest: string } {
  const trimmed = text.trim();
  const match = trimmed.match(/^(.+?[.!?])\s+(\S[\s\S]*)$/);
  if (!match) return { headline: trimmed, rest: '' };
  return { headline: match[1]!, rest: match[2]!.trim() };
}

/** "minus 6", "plus 2", "0" — how a screen reader should say a contribution. */
function spoken(contribution: number): string {
  const value = Math.round(contribution);
  return value > 0 ? `plus ${value}` : value < 0 ? `minus ${Math.abs(value)}` : 'no change';
}

/**
 * The ring is announced as one label: the score, the zone word and each foundation's
 * contribution, e.g. "Readiness 68 out of 100, steady. Recovery minus 6, Nourish plus 2, …".
 */
export function readinessRingLabel(score: number | null, word: string, pillars?: readonly PillarReading[]): string {
  const head = score === null ? 'No readiness estimate yet.' : `Readiness ${score} out of 100, ${word.toLowerCase()}.`;
  if (!pillars) return head;
  const parts = PILLAR_ORDER.map((domain) => {
    const reading = pillars.find((pillar) => pillar.domain === domain);
    return `${PILLAR_NAMES[domain]} ${reading && !reading.missing ? spoken(reading.contribution) : 'no signal yet'}`;
  });
  return `${head} ${parts.join(', ')}.`;
}
