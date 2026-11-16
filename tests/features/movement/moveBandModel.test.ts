import { describe, expect, it } from 'vitest';

import { LOAD_BANDS } from '../../../src/engines/load';
import { loadChart } from '../../../src/features/movement/moveBandModel';

const week = (loads: number[]) => ({
  series: loads.map((load, index) => ({ date: `2026-11-${String(10 + index).padStart(2, '0')}`, load }))
});

describe('the Move band load chart', () => {
  it('draws each day that has a session as a bar, against one scale', () => {
    const chart = loadChart(week([0, 420, 0, 900, 0, 0, 300]), '2026-11-16');
    expect(chart.max).toBe(900);
    expect(chart.bars[3]!.height).toBe(1);
    expect(chart.bars[1]!.height).toBeCloseTo(420 / 900, 5);
  });

  it('shows a day with no session as rest, never a zero bar', () => {
    const chart = loadChart(week([0, 420, 0, 0, 0, 0, 0]), '2026-11-16');
    expect(chart.bars[0]!.height).toBeNull();
    expect(chart.bars[0]!.reading).toMatch(/no session logged$/);
  });

  it('keeps a light week from filling the chart, and places the moderate band on the same scale', () => {
    const chart = loadChart(week([100, 0, 0, 0, 0, 0, 0]), '2026-11-16');
    expect(chart.max).toBe(LOAD_BANDS.moderate * 1.25);
    expect(chart.zone.top).toBeCloseTo(1 - LOAD_BANDS.moderate / chart.max, 5);
    expect(chart.zone.bottom).toBeCloseTo(1 - LOAD_BANDS.light / chart.max, 5);
  });

  it('says which day is today and reads a logged day with its source', () => {
    const chart = loadChart(week([0, 0, 0, 0, 0, 0, 450]), '2026-11-16');
    expect(chart.bars[6]).toMatchObject({ isToday: true, reading: 'Mon · 450 load · logged' });
  });
});
