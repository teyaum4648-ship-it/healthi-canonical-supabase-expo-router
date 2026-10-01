import { describe, expect, it } from 'vitest';

import { wallClockIso } from '../../src/utils/localDay';

/** A Date as a phone in a given UTC offset would report it. */
function atOffset(instant: string, offsetMinutes: number): Date {
  const date = new Date(instant);
  date.getTimezoneOffset = () => offsetMinutes;
  return date;
}

describe('the wall clock on the UTC axis', () => {
  it('keeps a US evening on its own date', () => {
    // 8:24 PM Pacific daylight time on the 30th is 03:24 UTC on the 1st.
    expect(wallClockIso(atOffset('2026-10-01T03:24:00.000Z', 420))).toBe('2026-09-30T20:24:00.000Z');
  });

  it('reads the same as the instant where the phone is on UTC', () => {
    expect(wallClockIso(atOffset('2026-09-30T09:47:00.000Z', 0))).toBe('2026-09-30T09:47:00.000Z');
  });

  it('works east of UTC too', () => {
    // 1:30 AM in Tokyo on the 1st is 16:30 UTC on the 30th.
    expect(wallClockIso(atOffset('2026-09-30T16:30:00.000Z', -540))).toBe('2026-10-01T01:30:00.000Z');
  });
});
