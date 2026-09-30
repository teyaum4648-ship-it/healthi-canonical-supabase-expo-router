import { describe, expect, it } from 'vitest';

import { READINESS_CONTRIBUTION_RANGE } from '../../../src/engines/readiness';
import { PILLAR_ORDER, pillarFill } from '../../../src/features/dashboard/premium/pillarRingModel';

describe('the four-pillar ring', () => {
  it('reads recovery, nourishment, movement, mind clockwise from the top', () => {
    expect(PILLAR_ORDER).toEqual(['recovery_rhythm', 'nourishment', 'movement_capacity', 'mind_life_load']);
  });

  it('fills each quarter by where the foundation sits in its own range', () => {
    const [low, high] = READINESS_CONTRIBUTION_RANGE.recovery_rhythm;
    expect(pillarFill({ domain: 'recovery_rhythm', contribution: low, missing: false })).toBe(0);
    expect(pillarFill({ domain: 'recovery_rhythm', contribution: high, missing: false })).toBe(1);
    expect(pillarFill({ domain: 'recovery_rhythm', contribution: 0, missing: false })).toBeCloseTo(-low / (high - low));
    expect(pillarFill({ domain: 'mind_life_load', contribution: 6, missing: false })).toBe(1);
  });

  it('shows a missing foundation as empty, never as a low reading', () => {
    expect(pillarFill({ domain: 'nourishment', contribution: 0, missing: true })).toBeNull();
    expect(pillarFill(undefined)).toBeNull();
  });

  it('stays inside the track when a contribution lands outside its range', () => {
    expect(pillarFill({ domain: 'movement_capacity', contribution: 99, missing: false })).toBe(1);
    expect(pillarFill({ domain: 'movement_capacity', contribution: -99, missing: false })).toBe(0);
  });
});
