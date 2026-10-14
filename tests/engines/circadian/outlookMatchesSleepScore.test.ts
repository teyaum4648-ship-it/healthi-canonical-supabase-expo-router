import { describe, expect, it } from 'vitest';

import { generateCircadianBriefing } from '../../../src/engines/circadian';
import { alignOutlookWithRecovery, recoveryTier, type DayOutlook } from '../../../src/engines/circadian/energyModel';
import type { SleepSession } from '../../../src/engines/circadian/types';
import { createDefaultSleepNeedEstimate } from '../../../src/features/sleepRhythm/rhythmInputs';

const outlook = (score: number): DayOutlook => ({
  score,
  band: score >= 70 ? 'sharp' : score >= 45 ? 'steady' : score >= 25 ? 'slow' : 'flat',
  peakEnergy: 80,
  highMinutes: 120,
  lowMinutes: 60,
  coverage: 1
});

describe('the day outlook stays inside the Sleep score', () => {
  it('caps a partly recovered morning at Steady', () => {
    const result = alignOutlookWithRecovery(outlook(72), 62);
    expect(result.adjusted).toBe(true);
    expect(result.outlook.band).toBe('steady');
    expect(result.outlook.score).toBe(69);
  });

  it('caps an under-recovered morning at Slow', () => {
    expect(alignOutlookWithRecovery(outlook(60), 40).outlook.band).toBe('slow');
  });

  it('keeps a well recovered morning from reading Flat', () => {
    expect(alignOutlookWithRecovery(outlook(20), 85).outlook.band).toBe('steady');
  });

  it('leaves an outlook that already agrees untouched', () => {
    const result = alignOutlookWithRecovery(outlook(58), 62);
    expect(result.adjusted).toBe(false);
    expect(result.outlook.score).toBe(58);
  });

  it('holds across real briefings, whatever the night', () => {
    const date = '2026-07-14';
    for (const minutes of [270, 330, 390, 450, 510]) {
      for (const refreshment of [1, 3, 5]) {
        const wake = `${date}T07:00:00.000Z`;
        const session: SleepSession = {
          id: `n-${minutes}`,
          date,
          sleep_start_at: new Date(Date.parse(wake) - minutes * 60_000).toISOString(),
          sleep_end_at: wake,
          duration_minutes: minutes,
          source: 'manual',
          source_confidence: 'medium',
          reason_codes: [],
          created_at: wake
        };
        const briefing = generateCircadianBriefing({
          date,
          timezone: 'UTC',
          recentSleepSessions: [session],
          sleepNeed: createDefaultSleepNeedEstimate(`${date}T12:00:00.000Z`),
          now: `${date}T09:00:00.000Z`,
          refreshment
        });
        if (!briefing.sleep_recovery || !briefing.day_outlook) continue;
        const tier = recoveryTier(briefing.sleep_recovery.score);
        const band = briefing.day_outlook.band;
        if (tier === 'partly') expect(band).not.toBe('sharp');
        if (tier === 'under') expect(['slow', 'flat']).toContain(band);
        if (tier === 'well') expect(band).not.toBe('flat');
      }
    }
  });
});
