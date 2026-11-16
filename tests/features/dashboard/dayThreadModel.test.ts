import { describe, expect, it } from 'vitest';

import {
  buildDayThread,
  clock,
  energyAt,
  energyX,
  levelAt,
  ROW_GAP,
  scrubAt,
  threadRange,
  type DayThreadInput,
  type DayThreadRow
} from '../../../src/features/dashboard/dayThreadModel';
import { strand } from '../../../src/styles/daywoven1c';

const WAKE = 400; // 06:40
const BED = 1395; // 23:15

function curve(): DayThreadInput['curve'] {
  const points: DayThreadInput['curve'] = [];
  for (let minute = WAKE; minute <= BED; minute += 20) points.push({ minute, energy: 30 + 40 * Math.sin(((minute - WAKE) / (BED - WAKE)) * Math.PI) });
  return points;
}

const zones: DayThreadInput['zones'] = [
  { start: WAKE, end: 540, level: 'moderate' },
  { start: 540, end: 720, level: 'high' },
  { start: 720, end: 830, level: 'moderate' },
  { start: 830, end: 940, level: 'low' },
  { start: 940, end: 1080, level: 'moderate' },
  { start: 1080, end: 1200, level: 'high' },
  { start: 1200, end: BED, level: 'low' }
];

function input(overrides: Partial<DayThreadInput> = {}): DayThreadInput {
  return {
    wakeMinute: WAKE,
    bedMinute: BED,
    nowMinute: 581, // 09:41
    curve: curve(),
    zones,
    logged: [
      { id: 'wake', minute: WAKE, label: 'Woke · 6h 52m asleep' },
      { id: 'meal', minute: 470, label: 'Breakfast · 31 g protein' },
      { id: 'water', minute: 510, label: 'Water · 2 glasses' }
    ],
    planned: [
      { id: 'focus', start: 555, end: 705, title: 'Focus window', detail: '09:15–11:45 · Use your strongest energy window for focused work.' },
      { id: 'walk', start: 855, end: 875, title: 'Light movement', detail: 'Keep movement lighter today.' },
      { id: 'move', start: 1110, end: 1170, title: 'Movement window', detail: '18:30–19:30 · This window has rhythm support for movement.' },
      { id: 'bed', start: BED, title: 'Bed' }
    ],
    ...overrides
  };
}

function expectNoOverlap(rows: DayThreadRow[]) {
  const sorted = [...rows].sort((a, b) => a.top - b.top);
  for (let index = 1; index < sorted.length; index += 1) {
    const previous = sorted[index - 1]!;
    expect(sorted[index]!.top, `${sorted[index]!.id} overlaps ${previous.id}`).toBeGreaterThanOrEqual(previous.top + previous.height + ROW_GAP / 2 - 0.001);
  }
}

describe('the day column', () => {
  it('runs from the wake hour to the hour after bedtime', () => {
    expect(threadRange(WAKE, BED)).toEqual({ startHour: 6, endHour: 24 });
    expect(threadRange(7 * 60 + 5, 22 * 60 + 30)).toEqual({ startHour: 7, endHour: 23 });
    expect(threadRange(6 * 60, 24 * 60 + 30)).toEqual({ startHour: 6, endHour: 25 });
  });

  it('falls back to 06:00–24:00 when wake or bedtime is unknown', () => {
    expect(threadRange(null, BED)).toEqual({ startHour: 6, endHour: 24 });
    expect(threadRange(WAKE, null)).toEqual({ startHour: 6, endHour: 24 });
    expect(threadRange(900, 600)).toEqual({ startHour: 6, endHour: 24 });
  });

  it('is one hour per strand.hourHeight, with a label every three hours', () => {
    const model = buildDayThread(input());
    expect(model.height).toBeGreaterThanOrEqual(18 * strand.hourHeight);
    expect(model.hourLabels.map((label) => label.label)).toEqual(['06', '09', '12', '15', '18', '21', '24']);
    expect(model.hourLabels[1]!.y).toBe(3 * strand.hourHeight);
  });

  it('formats times on a 24-hour clock, wrapping past midnight', () => {
    expect(clock(400)).toBe('06:40');
    expect(clock(1470)).toBe('00:30');
  });
});

describe('the energy strand', () => {
  it('maps energy 0–100 onto the strand width', () => {
    expect(energyX(0)).toBe(strand.minX);
    expect(energyX(100)).toBe(strand.minX + strand.spanX);
    expect(energyX(140)).toBe(strand.minX + strand.spanX);
  });

  it('draws nothing at all without a curve, rather than a made-up one', () => {
    const model = buildDayThread(input({ curve: [] }));
    expect(model.area).toBeNull();
    expect(scrubAt({ curve: [], zones }, model.startHour, 100)).toBeNull();
  });

  it('fills solid up to now and dots the line only after now', () => {
    const model = buildDayThread(input());
    const nowY = ((581 - 360) / 60) * strand.hourHeight;
    expect(model.area?.livedHeight).toBeCloseTo(nowY, 5);
    const firstDotted = model.area!.predictedLine!.split(' ')[0]!.split(',').map(Number);
    expect(firstDotted[1]).toBeCloseTo(nowY, 1);
  });

  it('treats a whole curve as predicted before waking and as lived after bedtime', () => {
    expect(buildDayThread(input({ nowMinute: 300 })).area?.livedHeight).toBe(0);
    expect(buildDayThread(input({ nowMinute: 300 })).area?.predictedLine).not.toBeNull();
    expect(buildDayThread(input({ nowMinute: 1430 })).area?.predictedLine).toBeNull();
  });

  it('interpolates between samples and returns nothing outside them', () => {
    const points = [{ minute: 600, energy: 40 }, { minute: 620, energy: 60 }];
    expect(energyAt(points, 610)).toBe(50);
    expect(energyAt(points, 590)).toBeNull();
    expect(energyAt(points, 630)).toBeNull();
  });
});

describe('the now line', () => {
  it('sits at the current time with a short label', () => {
    const model = buildDayThread(input());
    expect(model.now?.label).toBe('Now 9:41');
    expect(model.now?.y).toBeCloseTo(((581 - 360) / 60) * strand.hourHeight, 5);
  });

  it('is left out when now is outside the column', () => {
    expect(buildDayThread(input({ nowMinute: 241 })).now).toBeNull();
  });
});

describe('what goes above and below now', () => {
  it('shows only logged items above now, and never one dated after now', () => {
    const model = buildDayThread(input({ logged: [...input().logged, { id: 'later', minute: 900, label: 'Lunch' }] }));
    const logs = model.rows.filter((row) => row.kind === 'log');
    expect(logs.map((row) => row.id)).toEqual(['wake', 'meal', 'water']);
    for (const row of logs) expect(row.top + row.height).toBeLessThanOrEqual(model.now!.y);
  });

  it('shows only what is still ahead from the plan', () => {
    const model = buildDayThread(input({ nowMinute: 900 }));
    const ids = model.rows.filter((row) => row.kind !== 'log' && row.kind !== 'note').map((row) => row.id);
    expect(ids).toEqual(['move', 'bed']);
  });

  it('keeps a block that is under way, with its text below the now line', () => {
    const model = buildDayThread(input({ nowMinute: 600 }));
    const focus = model.rows.find((row) => row.id === 'focus');
    expect(focus?.kind).toBe('block');
    if (focus?.kind !== 'block') throw new Error('expected a block');
    expect(focus.contentTop).not.toBeNull();
    expect(focus.top + focus.contentTop!).toBeGreaterThan(model.now!.y + 8);
    expect(focus.detailInside).toBe(true);
    expect(focus.top + focus.height).toBeGreaterThanOrEqual(focus.top + focus.contentTop! + 20);
  });

  it('starts a block that has not begun at its own time', () => {
    const model = buildDayThread(input({ nowMinute: 500 }));
    const focus = model.rows.find((row) => row.id === 'focus');
    expect(focus).toMatchObject({ kind: 'block', contentTop: null });
    expect(focus?.top).toBeCloseTo(((555 - 360) / 60) * strand.hourHeight, 5);
  });

  it('draws a block to scale only when it sits inside a high-energy window', () => {
    const model = buildDayThread(input({ nowMinute: 500 }));
    const focus = model.rows.find((row) => row.id === 'focus');
    expect(focus?.kind).toBe('block');
    expect(focus?.height).toBeCloseTo((150 / 60) * strand.hourHeight, 5);
    expect(model.rows.find((row) => row.id === 'walk')?.kind).toBe('plan');
  });

  it('puts a short block’s detail under it instead of cramming it in', () => {
    const model = buildDayThread(input());
    const move = model.rows.find((row) => row.id === 'move');
    expect(move).toMatchObject({ kind: 'block', detailInside: false });
    expect(model.rows.find((row) => row.id === 'move-note')).toBeDefined();
  });

  it('never draws a listed or very long block to scale', () => {
    const planned = [
      { id: 'work', start: 540, end: 1020, title: 'Work', detail: '09:00–17:00' },
      { id: 'class', start: 600, end: 660, title: 'Class', detail: '10:00–11:00', listOnly: true }
    ];
    const model = buildDayThread(input({ planned, nowMinute: 500 }));
    expect(model.rows.find((row) => row.id === 'work')?.kind).toBe('plan');
    expect(model.rows.find((row) => row.id === 'class')?.kind).toBe('plan');
  });
});

describe('rows never overlap', () => {
  it('nudges close rows apart, keeping their order', () => {
    const logged = [0, 2, 4, 6, 8, 10].map((offset, index) => ({ id: `log-${index}`, minute: 460 + offset, label: `Item ${index}` }));
    const model = buildDayThread(input({ logged }));
    expectNoOverlap(model.rows);
    const logs = model.rows.filter((row) => row.kind === 'log');
    expect(logs.map((row) => row.id)).toEqual(logged.map((item) => item.id));
  });

  it('keeps the newest logged row above the now pill, and the next plan row below it', () => {
    const model = buildDayThread(input({
      logged: [{ id: 'just-now', minute: 580, label: 'Water · 1 glass' }],
      planned: [{ id: 'soon', start: 585, title: 'Caffeine cutoff', detail: 'Use this cutoff.' }]
    }));
    const now = model.now!.y;
    const log = model.rows.find((row) => row.id === 'just-now')!;
    const plan = model.rows.find((row) => row.id === 'soon')!;
    expect(log.top + log.height).toBeLessThan(now - 8);
    expect(plan.top).toBeGreaterThan(now + 8);
  });

  it('holds for a crowded day of every kind', () => {
    const logged = Array.from({ length: 12 }, (_, index) => ({ id: `l${index}`, minute: WAKE + index * 13, label: 'Logged' }));
    const planned = Array.from({ length: 10 }, (_, index) => ({ id: `p${index}`, start: 600 + index * 25, end: 600 + index * 25 + 45, title: 'Plan', detail: 'Detail' }));
    const model = buildDayThread(input({ logged, planned, nowMinute: 590 }));
    expectNoOverlap(model.rows);
    expect(model.height).toBeGreaterThanOrEqual(Math.max(...model.rows.map((row) => row.top + row.height)));
  });
});

describe('scrubbing', () => {
  it('reads the time, a point on the curve and the energy window, snapped to five minutes', () => {
    const y = ((15 * 60 + 32 - 360) / 60) * strand.hourHeight;
    const reading = scrubAt(input(), 6, y)!;
    expect(reading.time).toBe('15:30');
    expect(reading.level).toBe('Low');
    expect(reading.x).toBeCloseTo(energyX(energyAt(curve(), 930)!), 5);
  });

  it('stays on the curve when dragged past either end', () => {
    expect(scrubAt(input(), 6, -50)!.minute).toBe(WAKE);
    expect(scrubAt(input(), 6, 5000)!.minute).toBe(curve()[curve().length - 1]!.minute);
  });

  it('names the window by level', () => {
    expect(levelAt(zones, 600)).toBe('High');
    expect(levelAt(zones, 1300)).toBe('Low');
    expect(levelAt([], 600)).toBeNull();
  });
});

describe('the spoken summary', () => {
  it('describes the day without numbers that were not given', () => {
    const model = buildDayThread(input());
    expect(model.summary).toContain('high 09:00 to 12:00');
    expect(model.summary).toContain('3 logged so far');
    expect(buildDayThread(input({ zones: [] })).summary).toContain('No energy estimate yet.');
  });
});
