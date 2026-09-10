import { describe, expect, it } from 'vitest';

import { sleepClockParts, sleepClockValue, sleepWheelIndex } from '../../../src/features/sleepRhythm/sleepTimePickerModel';
import { adjustSleepWindowClock, correctSleepWindow, inferSleepWindow } from '../../../src/features/sleepRhythm/sleepWindowEngine';

describe('sleep time wheel', () => {
  it('round trips every clock minute without rounding or date/timezone conversion', () => {
    for (let minute = 0; minute < 1440; minute += 1) {
      const clock = `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
      expect(sleepClockValue(sleepClockParts(clock)!)).toBe(clock);
    }
  });

  it('distinguishes noon, midnight, and AM/PM changes', () => {
    expect(sleepClockParts('00:07')).toEqual({ hour: 12, minute: 7, period: 'AM' });
    expect(sleepClockParts('12:07')).toEqual({ hour: 12, minute: 7, period: 'PM' });
    expect(sleepClockValue({ hour: 8, minute: 45, period: 'PM' })).toBe('20:45');
    expect(sleepClockValue({ hour: 12, minute: 0, period: 'AM' })).toBe('00:00');
  });

  it('does not silently convert invalid clock inputs to midnight', () => {
    for (const value of ['', '24:00', '12:60', '-1:00', '7:0', 'bad']) expect(sleepClockParts(value)).toBeNull();
    for (const hour of [0, 13, 1.5, NaN]) expect(sleepClockValue({ hour, minute: 0, period: 'AM' })).toBeNull();
    for (const minute of [-1, 60, 1.5, NaN]) expect(sleepClockValue({ hour: 1, minute, period: 'AM' })).toBeNull();
  });

  it('snaps to the closest row and safely bounds overscroll for every column', () => {
    expect(sleepWheelIndex(48 * 32 + 25, 48, 60)).toBe(33);
    expect(sleepWheelIndex(-100, 48, 12)).toBe(0);
    expect(sleepWheelIndex(9999, 48, 12)).toBe(11);
    expect(sleepWheelIndex(9999, 48, 2)).toBe(1);
    expect(sleepWheelIndex(9999, 48, 60)).toBe(59);
    expect(sleepWheelIndex(NaN, 48, 60)).toBe(0);
    expect(sleepWheelIndex(30, 0, 60)).toBe(0);
  });

  it('keeps the existing fifteen-minute adjustments and midnight wrapping', () => {
    expect(adjustSleepWindowClock('23:52', 15)).toBe('00:07');
    expect(adjustSleepWindowClock('00:07', -15)).toBe('23:52');
  });

  it('feeds exact clock choices through existing overnight/awake validation', () => {
    const record = inferSleepWindow({ date: '2026-09-09', timezone: 'America/Los_Angeles', sessions: [], preferredBedtime: '23:00', preferredWakeTime: '07:00' });
    const result = correctSleepWindow(record, {
      start_time: sleepClockValue({ hour: 11, minute: 52, period: 'PM' })!,
      end_time: sleepClockValue({ hour: 8, minute: 7, period: 'AM' })!,
      awake_periods: [{ id: 'awake', start_time: '03:02', end_time: '03:17' }]
    });
    expect(result?.elapsed_minutes).toBe(495);
    expect(result?.asleep_minutes).toBe(480);
    expect(result?.source).toBe('user_corrected');
    expect(correctSleepWindow(record, { start_time: '23:52', end_time: '08:07', awake_periods: [{ id: 'outside', start_time: '10:00', end_time: '10:15' }] })).toBeNull();
  });
});
