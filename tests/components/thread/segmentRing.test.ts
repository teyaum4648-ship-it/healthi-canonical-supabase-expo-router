import { describe, expect, it } from 'vitest';

import { segmentDash, segmentRingGeometry } from '../../../src/components/thread/segmentRingModel';
import { PILLAR_ORDER_1C, ring } from '../../../src/styles/daywoven1c';
import { PILLAR_ORDER } from '../../../src/features/dashboard/premium/pillarRingModel';

describe('the 1c segmented ring', () => {
  const geometry = segmentRingGeometry(ring.radius, 4, ring.gap);

  it('matches the design source: four 75.68 arcs, starting half a gap past each quarter', () => {
    expect(geometry.circumference).toBeCloseTo(326.73, 2);
    expect(geometry.segmentLength).toBeCloseTo(75.68, 2);
    [-3, -84.68, -166.36, -248.05].forEach((designOffset, index) => expect(geometry.offsets[index]).toBeCloseTo(designOffset, 1));
  });

  it('fills each segment in proportion, clamped to its track', () => {
    expect(segmentDash(geometry, 0.5)![0]).toBeCloseTo(37.84, 2);
    expect(segmentDash(geometry, 2)![0]).toBeCloseTo(geometry.segmentLength, 5);
    expect(segmentDash(geometry, 0.5)![1]).toBeCloseTo(geometry.circumference, 5);
  });

  it('draws no fill for a missing signal, never a short arc', () => {
    expect(segmentDash(geometry, null)).toBeNull();
    expect(segmentDash(geometry, 0)).toBeNull();
    expect(segmentDash(geometry, Number.NaN)).toBeNull();
  });

  it('keeps the readiness pillars in the order the handoff draws them', () => {
    expect([...PILLAR_ORDER]).toEqual([...PILLAR_ORDER_1C]);
  });
});
