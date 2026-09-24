import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { explainMovementLimiter } from '../../../src/engines/movement/calculateMovementScore';

/**
 * Nourishment explains a movement limiter; it never moves the movement score.
 *
 * The context field existed from the start and nothing ever filled it, so the one
 * explanation that needed it could not fire — a person whose lifts had stalled on a week
 * of thin eating was told it was probably their programme.
 */
describe('food as context for a stalled lift', () => {
  it('names thin fueling when that is what is there', () => {
    expect(explainMovementLimiter('progression', { nourishment_score: 40 })).toContain('food has been running short');
  });
  it('prefers sleep debt when both are present, because recovery is where lifting adapts', () => {
    expect(explainMovementLimiter('progression', { nourishment_score: 40, sleep_debt_hours: 3 })).toContain('sleep debt');
  });
  it('falls back to the programme when food is unknown or fine', () => {
    for (const context of [{}, { nourishment_score: null }, { nourishment_score: 80 }]) {
      expect(explainMovementLimiter('progression', context)).toContain('programme');
    }
  });
  it('is actually passed in by the movement screen', () => {
    const screen = readFileSync('app/(app)/(tabs)/movement.tsx', 'utf8');
    expect(screen).toContain('nourishment_score: nourishmentScore');
    expect(screen).toContain('calculateNourishmentScore(');
    // A withheld pillar score must reach the context as null rather than as a guess.
    expect(screen).toContain('setNourishmentScore(nourishment.score)');
  });
});
