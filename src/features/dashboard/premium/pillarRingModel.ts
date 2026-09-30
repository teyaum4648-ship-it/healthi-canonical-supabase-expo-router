import { READINESS_CONTRIBUTION_RANGE, type DailyReadinessDomain } from '../../../engines/readiness';

export type PillarReading = { domain: DailyReadinessDomain; contribution: number; missing: boolean };

/** Clockwise from the top: the order the quarters sit in and the order they are read. */
export const PILLAR_ORDER: readonly DailyReadinessDomain[] = ['recovery_rhythm', 'nourishment', 'movement_capacity', 'mind_life_load'];

/**
 * Where a foundation sits between the least and most it can move the score, 0 to 1.
 * Missing is null: no signal is shown as an empty track, never as a low one.
 */
export function pillarFill(reading: PillarReading | undefined): number | null {
  if (!reading || reading.missing) return null;
  const [low, high] = READINESS_CONTRIBUTION_RANGE[reading.domain];
  return Math.min(1, Math.max(0, (reading.contribution - low) / (high - low)));
}
