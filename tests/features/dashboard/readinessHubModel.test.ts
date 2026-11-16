import { describe, expect, it } from 'vitest';

import { points, readinessRingLabel, splitFirstSentence } from '../../../src/features/dashboard/premium/readinessHubModel';

describe('readiness hub copy', () => {
  it('splits the engine line after its first sentence', () => {
    expect(splitFirstSentence('You’re steady, not fully charged. Keep today’s effort moderate.')).toEqual({
      headline: 'You’re steady, not fully charged.',
      rest: 'Keep today’s effort moderate.'
    });
  });

  it('keeps a single sentence whole', () => {
    expect(splitFirstSentence('Today’s direction is a starting point, not a live reading of how you feel now.')).toEqual({
      headline: 'Today’s direction is a starting point, not a live reading of how you feel now.',
      rest: ''
    });
  });

  it('signs points with a true minus', () => {
    expect([points(-6), points(2.4), points(0)]).toEqual(['−6', '+2', '0']);
  });

  it('announces the ring as one label with every foundation', () => {
    const label = readinessRingLabel(68, 'Steady', [
      { domain: 'recovery_rhythm', contribution: -6, missing: false },
      { domain: 'nourishment', contribution: 2, missing: false },
      { domain: 'movement_capacity', contribution: 3, missing: false },
      { domain: 'mind_life_load', contribution: 0, missing: true }
    ]);
    expect(label).toBe('Readiness 68 out of 100, steady. Recovery minus 6, Nourish plus 2, Movement plus 3, Mind no signal yet.');
  });

  it('says plainly when there is no estimate', () => {
    expect(readinessRingLabel(null, 'No estimate')).toBe('No readiness estimate yet.');
  });
});
