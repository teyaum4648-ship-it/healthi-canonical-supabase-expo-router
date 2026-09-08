import { describe, expect, it } from 'vitest';

import { calculateSleepDuration } from '../../../src/engines/circadian';

describe('calculateSleepDuration', () => {
  it('calculates sleep duration across midnight from full timestamps', () => {
    expect(
      calculateSleepDuration('2026-06-10T23:15:00.000Z', '2026-06-11T06:45:00.000Z')
    ).toBe(450);
  });

  it('calculates sleep duration across midnight from time-only input', () => {
    expect(calculateSleepDuration('23:00', '07:00')).toBe(480);
  });

  it('returns null when start or end is missing', () => {
    expect(calculateSleepDuration(null, '2026-06-11T06:45:00.000Z')).toBeNull();
    expect(calculateSleepDuration('2026-06-10T23:15:00.000Z', null)).toBeNull();
  });

  it('returns null for invalid dates', () => {
    expect(calculateSleepDuration('not-a-date', '2026-06-11T06:45:00.000Z')).toBeNull();
    expect(calculateSleepDuration('25:00', '07:00')).toBeNull();
  });
});

