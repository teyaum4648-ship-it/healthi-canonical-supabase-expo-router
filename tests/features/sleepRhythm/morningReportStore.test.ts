import { describe, expect, it } from 'vitest';

import { isMorningReportRow, withMorningReport } from '../../../src/features/sleepRhythm/morningReportStore';

describe('morning report store', () => {
  it('merges a day’s answers one question at a time', () => {
    const first = withMorningReport([], '2026-09-28', { morningRestedness: 2 }, new Date('2026-09-28T07:30:00Z'));
    const second = withMorningReport(first, '2026-09-28', { sleepLatencyMinutes: 30 }, new Date('2026-09-28T07:31:00Z'));
    expect(second).toHaveLength(1);
    expect(second[0]).toMatchObject({ date: '2026-09-28', morningRestedness: 2, sleepLatencyMinutes: 30 });
  });

  it('keeps other days and orders by date', () => {
    const rows = withMorningReport(withMorningReport([], '2026-09-28', { morningRestedness: 4 }), '2026-09-26', { morningRestedness: 3 });
    expect(rows.map((row) => row.date)).toEqual(['2026-09-26', '2026-09-28']);
  });

  it('drops rows an older build or a bad write could leave behind', () => {
    const good = { date: '2026-09-28', recordedAt: '2026-09-28T07:00:00Z', morningRestedness: 3, sleepLatencyMinutes: null };
    expect(isMorningReportRow(good)).toBe(true);
    expect(isMorningReportRow({ ...good, morningRestedness: 9 })).toBe(false);
    expect(isMorningReportRow({ ...good, sleepLatencyMinutes: -5 })).toBe(false);
    expect(isMorningReportRow({ ...good, date: 'today' })).toBe(false);
  });
});
