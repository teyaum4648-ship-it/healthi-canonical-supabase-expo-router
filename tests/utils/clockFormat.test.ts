import { describe, expect, it } from 'vitest';

import {
  formatClock,
  formatClockCompact,
  formatClockOfDate,
  formatClockRange,
  formatClockText,
  formatWallClockIso
} from '../../src/utils/clockFormat';

describe('12-hour clock formatting', () => {
  it('formats the examples people expect', () => {
    expect(formatClock(14 * 60 + 30)).toBe('2:30 PM');
    expect(formatClock(7 * 60 + 15)).toBe('7:15 AM');
  });

  it('gets midnight and noon right', () => {
    expect(formatClock(0)).toBe('12:00 AM');
    expect(formatClock(12 * 60)).toBe('12:00 PM');
    expect(formatClock(11 * 60 + 59)).toBe('11:59 AM');
    expect(formatClock(23 * 60 + 59)).toBe('11:59 PM');
    expect(formatClock(12 * 60 + 1)).toBe('12:01 PM');
    expect(formatClock(1)).toBe('12:01 AM');
  });

  it('wraps minutes past the day and before it', () => {
    expect(formatClock(1440)).toBe('12:00 AM');
    expect(formatClock(1440 + 30)).toBe('12:30 AM');
    expect(formatClock(-30)).toBe('11:30 PM');
  });

  it('drops :00 in compact labels for axes', () => {
    expect(formatClockCompact(9 * 60)).toBe('9 AM');
    expect(formatClockCompact(0)).toBe('12 AM');
    expect(formatClockCompact(12 * 60)).toBe('12 PM');
    expect(formatClockCompact(24 * 60)).toBe('12 AM');
    expect(formatClockCompact(9 * 60 + 30)).toBe('9:30 AM');
  });

  it('shares the AM/PM in a range when both ends have it', () => {
    expect(formatClockRange(14 * 60, 16 * 60)).toBe('2:00–4:00 PM');
    expect(formatClockRange(9 * 60, 12 * 60)).toBe('9:00 AM–12:00 PM');
    expect(formatClockRange(22 * 60, 24 * 60 + 30)).toBe('10:00 PM–12:30 AM');
  });

  it('turns stored 24-hour strings into 12-hour text without touching anything else', () => {
    expect(formatClockText('21:30')).toBe('9:30 PM');
    expect(formatClockText('00:00')).toBe('12:00 AM');
    expect(formatClockText('12:00')).toBe('12:00 PM');
    expect(formatClockText('07:05:00')).toBe('7:05 AM');
    expect(formatClockText('after lunch')).toBe('after lunch');
    expect(formatClockText('25:00')).toBe('25:00');
  });

  it('reads wall-clock-on-UTC times in UTC and real instants on the device clock', () => {
    expect(formatWallClockIso('2026-11-16T22:40:00.000Z')).toBe('10:40 PM');
    expect(formatWallClockIso(null)).toBe('—');
    expect(formatWallClockIso('not a date')).toBe('—');
    const local = new Date(2026, 10, 16, 0, 5);
    expect(formatClockOfDate(local)).toBe('12:05 AM');
    expect(formatClockOfDate(new Date(Number.NaN))).toBe('—');
  });
});
