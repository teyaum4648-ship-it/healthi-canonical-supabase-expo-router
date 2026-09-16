import { describe, expect, it } from 'vitest';

import { BREATH_RHYTHMS } from '../../../src/features/practice/practiceModel';
import {
  REGION_RELEASES,
  regionRelease,
  summariseZoneDay,
  zoneDayLine,
  type TensionRegion,
  type ZoneSession
} from '../../../src/features/practice/zoneModel';

function session(region: TensionRegion, seconds = 120, finishedAt = '2026-09-16T08:00:00.000Z'): ZoneSession {
  return { id: `z-${region}-${finishedAt}`, date: '2026-09-16', region, seconds, finishedAt };
}

describe('REGION_RELEASES', () => {
  it('covers every region exactly once', () => {
    const ids = REGION_RELEASES.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(['jaw', 'chest', 'upper_back', 'low_back', 'hips']);
  });

  it('paces every movement with a rhythm that exists', () => {
    for (const release of REGION_RELEASES) {
      expect(BREATH_RHYTHMS.some((rhythm) => rhythm.id === release.rhythmId)).toBe(true);
    }
  });

  it('gives each region something to recognise it by, a mechanism, and real steps', () => {
    for (const release of REGION_RELEASES) {
      expect(release.label.length).toBeGreaterThan(3);
      expect(release.recognise.length).toBeGreaterThan(20);
      expect(release.mechanism.length).toBeGreaterThan(40);
      expect(release.steps.length).toBeGreaterThanOrEqual(4);
      expect(release.minutes).toBeGreaterThan(0);
      expect(release.minutes).toBeLessThanOrEqual(20);
    }
  });

  it('cautions on the two that load the spine and the knee', () => {
    expect(regionRelease('low_back').caution).toBeTruthy();
    expect(regionRelease('hips').caution).toBeTruthy();
    // And does not pad the harmless ones with a warning that means nothing.
    expect(regionRelease('jaw').caution).toBeUndefined();
  });

  it('describes mechanism without diagnosing anything', () => {
    /*
     * Tight hips have a dozen causes and this app can distinguish none of them. Naming
     * one would move a wellness feature toward a clinical claim.
     */
    const forbidden = /\byou have\b|diagnos|disorder|disease|syndrome|dysfunction|injur(y|ed) is|treat(s|ment) (your|the)|cure/i;
    for (const release of REGION_RELEASES) {
      expect(release.mechanism, release.id).not.toMatch(forbidden);
      expect(release.recognise, release.id).not.toMatch(forbidden);
    }
  });

  it('routes sharp pain to a professional rather than through the movement', () => {
    expect(regionRelease('low_back').caution).toMatch(/professional/i);
  });
});

describe('regionRelease', () => {
  it('falls back rather than returning undefined for an unknown region', () => {
    expect(regionRelease('nonsense' as TensionRegion).id).toBe('jaw');
  });
});

describe('summariseZoneDay', () => {
  it('keeps only today, ordered, and dedupes the regions worked', () => {
    const rows = [
      session('hips', 120, '2026-09-16T09:00:00.000Z'),
      session('jaw', 60, '2026-09-16T07:00:00.000Z'),
      session('hips', 90, '2026-09-16T11:00:00.000Z'),
      { ...session('chest'), date: '2026-09-15' }
    ];
    const day = summariseZoneDay(rows, '2026-09-16');

    expect(day.sessions).toHaveLength(3);
    expect(day.sessions[0].region).toBe('jaw');
    expect(day.regions).toEqual(['jaw', 'hips']);
    expect(day.totalSeconds).toBe(270);
  });

  it('reads as a sentence, singular and plural', () => {
    expect(zoneDayLine(summariseZoneDay([], '2026-09-16'))).toMatch(/Nothing released/);
    expect(zoneDayLine(summariseZoneDay([session('jaw', 120)], '2026-09-16'))).toMatch(/2 minutes on jaw/);
    expect(zoneDayLine(summariseZoneDay([session('jaw', 30)], '2026-09-16'))).toMatch(/1 minute on/);

    const two = summariseZoneDay(
      [session('jaw', 60, '2026-09-16T07:00:00.000Z'), session('hips', 60, '2026-09-16T08:00:00.000Z')],
      '2026-09-16'
    );
    expect(zoneDayLine(two)).toMatch(/ and /);
  });
});
