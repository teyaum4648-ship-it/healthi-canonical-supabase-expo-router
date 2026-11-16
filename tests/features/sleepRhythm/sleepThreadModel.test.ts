import { describe, expect, it } from 'vitest';

import type { CircadianBriefing, CircadianPhase } from '../../../src/engines/circadian';
import type { SleepProtocolItem } from '../../../src/features/sleepRhythm/sleepPresentation';
import { buildRhythm, buildSleepChart, chartPoints, minuteAtX, readSleepChart, SLEEP_CHART } from '../../../src/features/sleepRhythm/sleepThreadModel';

const DAY = '2026-11-16';
const at = (minute: number) => `${DAY}T${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}:00.000Z`;
const phaseFor = (minute: number): CircadianPhase => (minute < 540 ? 'rising' : minute < 720 ? 'morning_peak' : minute < 900 ? 'afternoon_dip' : minute < 1260 ? 'second_peak' : 'wind_down');

function briefing(overrides: Partial<CircadianBriefing> = {}): CircadianBriefing {
  const curve = [];
  for (let minute = 400; minute <= 1360; minute += 20) curve.push({ time: at(minute), estimated_energy: 40 + 30 * Math.sin(((minute - 400) / 960) * Math.PI), label: phaseFor(minute) });
  return {
    date: DAY,
    timezone: 'UTC',
    wake_time: at(400),
    target_bedtime: at(1360),
    current_phase: 'morning_peak',
    energy_curve: curve,
    energy_zones: [
      { start_at: at(400), end_at: at(540), level: 'moderate' },
      { start_at: at(540), end_at: at(720), level: 'high' },
      { start_at: at(820), end_at: at(940), level: 'low' },
      { start_at: at(1080), end_at: at(1300), level: 'high' }
    ],
    energy_extrema: [],
    rhythm_plan: {
      deep_work_windows: [], best_exercise_windows: [], best_walk_windows: [], nap_windows: [], breathing_windows: [], morning_light_windows: [],
      evening_dim_light_start: null, caffeine_cutoff: at(810), caffeine_cutoff_large_dose: null, wind_down_start: at(1270), target_bedtime: at(1360), reason_codes: []
    },
    sleep_debt_7_day: { date: DAY, rolling_window_days: 7, total_sleep_debt_minutes: 240, weighted_sleep_debt_minutes: null, nightly_average_debt_minutes: null, nights: [], confidence: 'medium', reason_codes: [] },
    sleep_debt_14_day: { date: DAY, rolling_window_days: 14, total_sleep_debt_minutes: null, weighted_sleep_debt_minutes: null, nightly_average_debt_minutes: null, nights: [], confidence: 'low', reason_codes: [] },
    confidence: 'medium',
    reason_codes: [],
    source_summary: { sleep_source: 'manual', source_confidence: 'medium' },
    day_outlook: null,
    circadian_phase: null,
    limiter: null,
    input_coverage: 1,
    typical_band: { low: 35, high: 60, nights: 6 },
    ...overrides
  } as CircadianBriefing;
}

const item = (id: SleepProtocolItem['id'], start: number, end: number | null, reason: string): SleepProtocolItem => ({
  id, name: id, reason, start_at: at(start), end_at: end === null ? null : at(end), point_in_time: end === null, evidence: ''
});

describe('the Sleep energy chart', () => {
  it('reads the curve on the wall-clock axis', () => {
    const points = chartPoints(briefing());
    expect(points[0]).toMatchObject({ minute: 400, phase: 'rising' });
    expect(points.at(-1)!.minute).toBe(1360);
  });

  it('draws solid up to now and dotted after, from the same point', () => {
    const chart = buildSleepChart({ briefing: briefing(), nowMinute: 581, width: 350 });
    const livedEnd = chart.lived!.split(' ').at(-1);
    const predictedStart = chart.predicted!.split(' ')[0];
    expect(livedEnd).toBe(predictedStart);
    expect(chart.area).toMatch(/^M/);
    expect(chart.nowX).toBeGreaterThan(0);
    expect(chart.nowX).toBeLessThan(350);
  });

  it('draws the person’s usual range as a band, high above low', () => {
    const chart = buildSleepChart({ briefing: briefing(), nowMinute: 581, width: 350 });
    expect(chart.usual!.top).toBeLessThan(chart.usual!.bottom);
    expect(buildSleepChart({ briefing: briefing({ typical_band: null }), nowMinute: 581, width: 350 }).usual).toBeNull();
  });

  it('draws no curve at all without one, rather than a made-up shape', () => {
    const chart = buildSleepChart({ briefing: briefing({ energy_curve: [] }), nowMinute: 581, width: 350 });
    expect(chart.lived).toBeNull();
    expect(chart.predicted).toBeNull();
    expect(chart.area).toBeNull();
    expect(readSleepChart(briefing({ energy_curve: [] }), 600, 350)).toBeNull();
  });

  it('labels every third hour from the wake hour', () => {
    const chart = buildSleepChart({ briefing: briefing(), nowMinute: 581, width: 360 });
    expect(chart.hourLabels.map((label) => label.label)).toEqual(['06', '09', '12', '15', '18', '21']);
    expect(chart.baselineY).toBe(SLEEP_CHART.height - SLEEP_CHART.bottom);
  });

  it('reads a time, its phase and its window, snapped to five minutes and kept on the curve', () => {
    const reading = readSleepChart(briefing(), 603, 360)!;
    expect(reading.time).toBe('10:05');
    expect(reading.phase).toBe('morning_peak');
    expect(reading.level).toBe('High');
    expect(readSleepChart(briefing(), 100, 360)!.minute).toBe(400);
    expect(readSleepChart(briefing(), 2000, 360)!.minute).toBe(1360);
  });

  it('turns a drag position into a minute across the day', () => {
    expect(minuteAtX(briefing(), 0, 360)).toBe(360);
    expect(minuteAtX(briefing(), 360, 360)).toBe(23 * 60);
    expect(minuteAtX(briefing(), -50, 360)).toBe(360);
  });
});

describe('Today’s rhythm', () => {
  const protocol = [
    item('focus', 560, 680, 'Aligned with your estimated first focus peak'),
    item('reset', 840, 870, 'Placed near your estimated lower-energy window'),
    item('movement', 1100, 1200, 'Near your estimated temperature peak'),
    item('wind_down', 1270, 1360, 'A calmer transition before your target sleep time')
  ];
  const phaseName = (phase: CircadianPhase) => ({ morning_peak: 'First peak', afternoon_dip: 'Midday dip', second_peak: 'Second peak' } as Record<string, string>)[phase] ?? phase;

  it('splits the day into windows that add up to the whole bar', () => {
    const rhythm = buildRhythm(briefing(), protocol, phaseName);
    const total = rhythm.segments.reduce((sum, segment) => sum + segment.share, 0);
    expect(total).toBeCloseTo(1, 6);
    expect(rhythm.segments.at(-1)!.level).toBe('wind_down');
  });

  it('lists the high and low windows and wind-down, with the engine’s own fit text', () => {
    const rows = buildRhythm(briefing(), protocol, phaseName).rows;
    expect(rows.map((row) => row.name)).toEqual(['First peak', 'Midday dip', 'Second peak', 'Wind-down']);
    expect(rows[0]).toMatchObject({ range: '09:00–12:00', fit: 'Aligned with your estimated first focus peak' });
    expect(rows[1]!.fit).toBe('Placed near your estimated lower-energy window');
    expect(rows[3]).toMatchObject({ range: '21:10–22:40', fit: 'A calmer transition before your target sleep time' });
  });

  it('leaves the fit line empty rather than inventing one when no step falls in a window', () => {
    const rows = buildRhythm(briefing(), [], phaseName).rows;
    expect(rows.every((row) => row.fit === null)).toBe(true);
  });

  it('has nothing to show without windows', () => {
    expect(buildRhythm(briefing({ energy_zones: [], rhythm_plan: { ...briefing().rhythm_plan, wind_down_start: null } }), protocol, phaseName)).toEqual({ segments: [], rows: [] });
  });
});
