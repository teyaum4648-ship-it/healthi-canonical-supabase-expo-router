import { describe, expect, it } from 'vitest';

import type { SleepSession } from '../../../src/engines/circadian';
import { buildTwoProcessDay, readTwoProcess, twoProcessGeometry, TWO_PROCESS } from '../../../src/features/sleepRhythm/twoProcessModel';

const DAY = '2026-11-16';

/** A night ending on `date` at `wake` (HH:MM), `hours` long, on the wall-clock-on-UTC axis. */
function night(date: string, wake: string, hours: number): SleepSession {
  const end = new Date(`${date}T${wake}:00.000Z`);
  const start = new Date(end.getTime() - hours * 3600_000);
  return {
    date,
    sleep_start_at: start.toISOString(),
    sleep_end_at: end.toISOString(),
    duration_minutes: Math.round(hours * 60),
    source: 'manual',
    source_confidence: 'medium',
    reason_codes: [],
    created_at: end.toISOString()
  } as SleepSession;
}

function week(hours: number[], skip: number[] = []): SleepSession[] {
  return hours
    .map((h, index) => ({ h, index, date: `2026-11-${String(10 + index).padStart(2, '0')}` }))
    .filter(({ index }) => !skip.includes(index))
    .map(({ h, date }) => night(date, '07:00', h));
}

function build(sessions: SleepSession[], overrides: Partial<Parameters<typeof buildTwoProcessDay>[0]> = {}) {
  return buildTwoProcessDay({
    day: DAY,
    wakeIso: `${DAY}T07:00:00.000Z`,
    bedIso: `${DAY}T23:00:00.000Z`,
    clockMidSleepMinutes: 3 * 60,
    sessions,
    needMinutes: 8 * 60,
    ...overrides
  });
}

describe('the two-process sleep model', () => {
  it('uses the published parameters', () => {
    expect(TWO_PROCESS.tauRise).toBe(18.2);
    expect(TWO_PROCESS.tauFall).toBe(4.2);
    expect(TWO_PROCESS.upperMean).toBe(0.67);
    expect(TWO_PROCESS.amplitude).toBe(0.12);
  });

  it('shows nothing until there is a wake time and at least one logged night', () => {
    expect(build([])).toBeNull();
    expect(build(week([8, 8, 8, 8, 8, 8, 8]), { wakeIso: null })).toBeNull();
  });

  it('starts a short week with more sleep pressure than a rested one, and says how much', () => {
    const rested = build(week([8, 8, 8, 8, 8, 8, 8]))!;
    const short = build(week([6, 6, 6, 6, 6, 6, 6]))!;
    const wakeOf = (day: NonNullable<typeof rested>) => day.points.find((p) => p.minute === day.wakeMinute)!;
    expect(wakeOf(short).pressure).toBeGreaterThan(wakeOf(rested).pressure);
    expect(short.extraPressureAtWake).toBeGreaterThan(0.05);
    expect(rested.extraPressureAtWake).toBeLessThan(0.01);
  });

  it('has sleep pressure rise all day while awake and the dashed rested line only after waking', () => {
    const day = build(week([7, 7, 7, 7, 7, 7, 7]))!;
    const awake = day.points.filter((p) => p.minute >= day.wakeMinute && p.minute <= day.bedMinute);
    for (let index = 1; index < awake.length; index += 1) expect(awake[index]!.pressure).toBeGreaterThan(awake[index - 1]!.pressure);
    expect(day.points.filter((p) => p.minute < day.wakeMinute).every((p) => p.rested === null)).toBe(true);
    expect(awake.every((p) => p.rested !== null)).toBe(true);
  });

  it('brings the threads together near the usual bedtime for a rested sleeper', () => {
    const day = build(week([8, 8, 8, 8, 8, 8, 8]))!;
    const at = (minute: number) => day.points.find((p) => p.minute === minute)!;
    const bedGap = at(23 * 60).clock - at(23 * 60).pressure;
    const middayGap = at(12 * 60).clock - at(12 * 60).pressure;
    expect(Math.abs(bedGap)).toBeLessThan(0.02);
    expect(middayGap).toBeGreaterThan(bedGap + 0.1);
  });

  it('fills a missing night with the person’s usual night, counts it and lowers confidence', () => {
    const full = build(week([7, 7, 7, 7, 7, 7, 7]))!;
    const gappy = build(week([7, 7, 7, 7, 7, 7, 7], [3]))!;
    expect(full.loggedNights).toBe(7);
    expect(full.confidence).toBe('medium');
    expect(gappy.loggedNights).toBe(6);
    expect(gappy.filledNights).toBe(1);
    expect(gappy.reason_codes).toContain('nights_filled_with_usual');
    /* Filled with the usual 7 hours, so it is not drawn as a bad night. */
    expect(gappy.extraPressureAtWake).toBeCloseTo(full.extraPressureAtWake, 3);
  });

  it('keeps confidence low when last night was not logged, and never claims high', () => {
    const day = build(week([7, 7, 7, 7, 7, 7, 7], [6]))!;
    expect(day.lastNightLogged).toBe(false);
    expect(day.reason_codes).toContain('last_night_not_logged');
    expect(day.confidence).toBe('low');
    expect(build(week([8, 8, 8, 8, 8, 8, 8]))!.confidence).not.toBe('high');
  });

  it('falls back to the wake time for the clock when the engine has no phase yet', () => {
    const day = build(week([8]), { clockMidSleepMinutes: null })!;
    expect(day.reason_codes).toContain('clock_from_wake_time');
    expect(day.confidence).toBe('low');
  });

  it('names what the threads are doing through the day, closing towards bedtime', () => {
    const day = build(week([7, 7, 7, 7, 7, 7, 7]))!;
    expect(readTwoProcess(day, 6 * 60 + 30)).toMatchObject({ name: 'Asleep', energy: 'Recovering' });
    expect(readTwoProcess(day, 7 * 60 + 30)).toMatchObject({ name: 'Fresh start', energy: 'High energy' });
    expect(readTwoProcess(day, 15 * 60).name).toBe('Clock rising');
    expect(readTwoProcess(day, 19 * 60 + 30).name).toBe('Pressure building');
    expect(readTwoProcess(day, 22 * 60).name).toBe('Winding down');
    expect(readTwoProcess(day, 23 * 60 + 30).name).toBe('Past bedtime');
    const levels = [8, 12, 16, 20].map((hour) => readTwoProcess(day, hour * 60).level);
    for (let index = 1; index < levels.length; index += 1) expect(levels[index]!).toBeLessThan(levels[index - 1]!);
    expect(readTwoProcess(day, 20 * 60).trend).toBe('falling');
  });

  it('reads a short week lower than a rested one at the same minute', () => {
    const rested = build(week([8, 8, 8, 8, 8, 8, 8]))!;
    const short = build(week([5.5, 5.5, 5.5, 5.5, 5.5, 5.5, 5.5]))!;
    expect(readTwoProcess(short, 14 * 60).level).toBeLessThan(readTwoProcess(rested, 14 * 60).level);
  });

  it('lays the day out across the chart with clock-time ticks every three hours', () => {
    const day = build(week([7, 7, 7, 7, 7, 7, 7]))!;
    expect(day.startMinute).toBe(6 * 60);
    expect(day.endMinute).toBe(24 * 60);
    const geometry = twoProcessGeometry(day, 360, 190, true);
    expect(geometry.x(day.startMinute)).toBe(0);
    expect(geometry.x(day.endMinute)).toBe(360);
    expect(geometry.ticks.map((tick) => tick.minute)).toEqual([360, 540, 720, 900, 1080, 1260, 1440]);
    expect(geometry.minuteAt(180)).toBe(15 * 60);
    expect(geometry.rested).not.toBeNull();
    expect(twoProcessGeometry(day, 360, 190, false).rested).toBeNull();
    expect(geometry.pressureLabelY - geometry.clockLabelY).toBeGreaterThanOrEqual(16);
  });
});
