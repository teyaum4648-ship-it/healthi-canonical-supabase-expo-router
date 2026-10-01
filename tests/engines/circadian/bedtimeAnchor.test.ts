import { describe, expect, it } from 'vitest';

import { generateCircadianBriefing } from '../../../src/engines/circadian';
import type { SleepNeedEstimate, SleepSession } from '../../../src/engines/circadian';

const sleepNeed: SleepNeedEstimate = { minutes: 480, confidence: 'high', basis: ['onboarding'], updated_at: '2026-09-01T12:00:00.000Z' };

function night(date: string, bed: string, wake: string, minutes: number): SleepSession {
  return {
    date,
    sleep_start_at: `${date}T${bed}:00.000Z`,
    sleep_end_at: `${date}T${wake}:00.000Z`,
    duration_minutes: minutes,
    sleep_quality: 4,
    source: 'manual',
    source_confidence: 'high',
    reason_codes: [],
    created_at: `${date}T12:00:00.000Z`
  };
}

const HOUR = 3_600_000;

describe('the day between wake and bedtime', () => {
  /*
   * The case seen on a phone at 8:24 PM Pacific: the evening was asked about as the next
   * UTC date, the newest night was the morning's, and a preferred bedtime was set. The
   * bedtime landed on the next date and the "day" ran 38 hours.
   */
  it('stays under a day when the newest night is from the day before the date asked about', () => {
    const sessions = [night('2026-09-30', '00:30', '08:19', 469), night('2026-09-29', '23:40', '07:50', 490)];
    const briefing = generateCircadianBriefing({
      date: '2026-10-01', timezone: 'America/Los_Angeles', recentSleepSessions: sessions, sleepNeed,
      preferredBedtime: '22:39', now: '2026-09-30T20:24:00.000Z'
    });
    const span = Date.parse(briefing.target_bedtime!) - Date.parse(briefing.wake_time!);
    expect(briefing.wake_time).toBe('2026-09-30T08:19:00.000Z');
    expect(briefing.target_bedtime).toBe('2026-09-30T22:39:00.000Z');
    expect(span).toBeLessThan(24 * HOUR);
  });

  it('puts a bedtime after midnight on the next day, still under a day from waking', () => {
    const briefing = generateCircadianBriefing({
      date: '2026-09-30', timezone: 'UTC', recentSleepSessions: [night('2026-09-30', '01:00', '09:00', 480)], sleepNeed,
      preferredBedtime: '00:30', now: '2026-09-30T12:00:00.000Z'
    });
    expect(briefing.target_bedtime).toBe('2026-10-01T00:30:00.000Z');
  });
});
