import { describe, expect, it } from 'vitest';

import { layoutOverlaps } from '../../../src/features/dayPlan/timelineLayout';

const h = (hour: number) => hour * 3_600_000;

describe('layoutOverlaps', () => {
  it('gives a span on its own the full width', () => {
    expect(layoutOverlaps([{ startMs: h(9), endMs: h(10) }])).toEqual([{ column: 0, columns: 1 }]);
  });

  it('puts two overlapping spans side by side', () => {
    expect(layoutOverlaps([{ startMs: h(9.5), endMs: h(11) }, { startMs: h(10), endMs: h(12) }])).toEqual([
      { column: 0, columns: 2 },
      { column: 1, columns: 2 }
    ]);
  });

  it('does not treat spans that only touch as overlapping', () => {
    expect(layoutOverlaps([{ startMs: h(9), endMs: h(10) }, { startMs: h(10), endMs: h(11) }])).toEqual([
      { column: 0, columns: 1 },
      { column: 0, columns: 1 }
    ]);
  });

  it('reuses a column once it is free, and shares width across a chained group', () => {
    const placements = layoutOverlaps([
      { startMs: h(9), endMs: h(11) },
      { startMs: h(10), endMs: h(12) },
      { startMs: h(11), endMs: h(13) },
      { startMs: h(15), endMs: h(16) }
    ]);
    expect(placements).toEqual([
      { column: 0, columns: 2 },
      { column: 1, columns: 2 },
      { column: 0, columns: 2 },
      { column: 0, columns: 1 }
    ]);
  });

  it('keeps results in input order whatever order the spans arrive in', () => {
    const placements = layoutOverlaps([{ startMs: h(10), endMs: h(12) }, { startMs: h(9), endMs: h(11) }]);
    expect(placements).toEqual([{ column: 1, columns: 2 }, { column: 0, columns: 2 }]);
  });
});
