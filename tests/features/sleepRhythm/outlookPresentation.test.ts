import { describe, expect, it } from 'vitest';

import { generateCircadianBriefing } from '../../../src/engines/circadian';
import type { SleepNeedEstimate, SleepSession } from '../../../src/engines/circadian';
import { describeOutlook, REFRESHMENT_CHOICES } from '../../../src/features/sleepRhythm/sleepPresentation';

const need: SleepNeedEstimate = {
  minutes: 480,
  confidence: 'high',
  basis: ['onboarding'],
  updated_at: '2026-09-01T00:00:00.000Z'
};

function night(date: string, bedHour: number, wakeHour: number, quality: number | null = 4): SleepSession {
  const prev = new Date(`${date}T00:00:00`);
  prev.setDate(prev.getDate() - 1);
  const pad = (n: number) => String(n).padStart(2, '0');
  const startDay = bedHour >= 12
    ? `${prev.getFullYear()}-${pad(prev.getMonth() + 1)}-${pad(prev.getDate())}`
    : date;
  return {
    date,
    sleep_start_at: `${startDay}T${pad(bedHour)}:00:00`,
    sleep_end_at: `${date}T${pad(wakeHour)}:00:00`,
    duration_minutes: null,
    sleep_quality: quality,
    source: 'manual',
    source_confidence: 'high'
  } as SleepSession;
}

const steady = Array.from({ length: 12 }, (_, i) =>
  night(`2026-09-${String(i + 1).padStart(2, '0')}`, 23, 7));

function briefingFor(sessions: SleepSession[], date: string, refreshment: number | null = 4) {
  return generateCircadianBriefing({
    date, timezone: 'UTC', recentSleepSessions: sessions, sleepNeed: need,
    refreshment, now: `${date}T11:00:00`
  });
}

describe('REFRESHMENT_CHOICES', () => {
  it('anchors every option with a description rather than a bare number', () => {
    expect(REFRESHMENT_CHOICES).toHaveLength(5);
    for (const choice of REFRESHMENT_CHOICES) {
      expect(choice.label).not.toMatch(/^\d+$/);
      expect(choice.detail.length).toBeGreaterThan(12);
      expect(Number(choice.value)).toBeGreaterThanOrEqual(1);
      expect(Number(choice.value)).toBeLessThanOrEqual(5);
    }
  });

  it('covers the 1-5 range the column already constrains, in order', () => {
    expect(REFRESHMENT_CHOICES.map((choice) => choice.value)).toEqual(['1', '2', '3', '4', '5']);
  });
});

describe('describeOutlook', () => {
  it('gives the band as the headline and the score in the meta line', () => {
    const summary = describeOutlook(briefingFor(steady, '2026-09-12'))!;
    expect(['Sharp', 'Steady', 'Slow', 'Flat']).toContain(summary.headline);
    expect(summary.meta).toMatch(/\d/);
    expect(summary.eyebrow).toMatch(/outlook/i);
  });

  it('names the timing when last night sat out of step, without repeating it as the limiter', () => {
    const lieIn = [...steady, night('2026-09-13', 2, 11)];
    const summary = describeOutlook(briefingFor(lieIn, '2026-09-13'))!;
    expect(summary.timing).toMatch(/later than your usual rhythm/);
    /*
     * Timing has its own line, so it is suppressed as the limiter sentence — either null,
     * or naming a different factor entirely.
     */
    if (summary.body !== null) expect(summary.body).not.toMatch(/timing/i);
  });

  it('stays quiet about timing when the rhythm is in step', () => {
    expect(describeOutlook(briefingFor(steady, '2026-09-12'))!.timing).toBeNull();
  });

  it('flags calibrating when the inputs are thin rather than implying precision', () => {
    // Quality nulled too — the night() helper defaults it to 4, which is not "thin".
    const thin = describeOutlook(briefingFor([night('2026-09-01', 23, 7, null)], '2026-09-01', null))!;
    expect(thin.calibrating).toBe(true);
    const full = describeOutlook(briefingFor(steady, '2026-09-12', 4))!;
    expect(full.calibrating).toBe(false);
  });

  it('has nothing to say when there is no curve', () => {
    const empty = generateCircadianBriefing({
      date: '2026-09-12', timezone: 'UTC', recentSleepSessions: [], sleepNeed: need, now: '2026-09-12T11:00:00'
    });
    expect(empty.day_outlook).toBeNull();
    expect(describeOutlook(empty)).toBeNull();
  });

  it('keeps to estimative language, per the project safety rules', () => {
    const summaries = [
      describeOutlook(briefingFor(steady, '2026-09-12', 1))!,
      describeOutlook(briefingFor([...steady, night('2026-09-13', 2, 11)], '2026-09-13', 2))!
    ];
    const forbidden = /diagnos|treat(ment)?\b|cure|prescrib|clinical|guarantee|adrenal|cortisol/i;
    for (const summary of summaries) {
      for (const text of [summary.headline, summary.meta, summary.body, summary.timing]) {
        if (text) expect(text, text).not.toMatch(forbidden);
      }
    }
  });
});

describe('the typical band the chart reads today against', () => {
  it('is built once there are nights to build it from', () => {
    const band = briefingFor(steady, '2026-09-12').typical_band!;
    expect(band).not.toBeNull();
    expect(band.high).toBeGreaterThan(band.low);
    expect(band.nights).toBeGreaterThan(5);
  });

  it('sits lower for someone who habitually sleeps short', () => {
    const short = Array.from({ length: 12 }, (_, i) =>
      night(`2026-09-${String(i + 1).padStart(2, '0')}`, 1, 6)); // 5h nights
    const shortBand = briefingFor(short, '2026-09-12').typical_band!;
    const fullBand = briefingFor(steady, '2026-09-12').typical_band!;
    expect(shortBand.high).toBeLessThan(fullBand.high);
  });

  it('is absent with no usable nights, so the chart can fall back', () => {
    const none = generateCircadianBriefing({
      date: '2026-09-12', timezone: 'UTC', recentSleepSessions: [], sleepNeed: need, now: '2026-09-12T11:00:00'
    });
    expect(none.typical_band).toBeNull();
  });
});
