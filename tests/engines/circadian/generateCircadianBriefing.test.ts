import { describe, expect, it } from 'vitest';

import { generateCircadianBriefing } from '../../../src/engines/circadian';
import type { SleepNeedEstimate, SleepSession } from '../../../src/engines/circadian';

const sleepNeed: SleepNeedEstimate = {
  minutes: 480,
  confidence: 'high',
  basis: ['onboarding'],
  updated_at: '2026-06-10T12:00:00.000Z'
};

function session(date: string, durationMinutes: number, wakeHour = 6): SleepSession {
  return {
    date,
    sleep_start_at: `${date}T22:00:00.000Z`,
    sleep_end_at: `${date}T${String(wakeHour).padStart(2, '0')}:00:00.000Z`,
    duration_minutes: durationMinutes,
    sleep_quality: 7,
    source: 'demo',
    source_confidence: 'high',
    reason_codes: [],
    created_at: `${date}T12:00:00.000Z`
  };
}

function recentSessions(durationMinutes: number): SleepSession[] {
  return Array.from({ length: 14 }, (_, index) => {
    const day = String(10 - index).padStart(2, '0');
    return session(`2026-06-${day}`, durationMinutes);
  });
}

describe('generateCircadianBriefing', () => {
  it('uses wake time to generate deterministic energy windows', () => {
    const briefing = generateCircadianBriefing({
      date: '2026-06-10',
      timezone: 'UTC',
      recentSleepSessions: recentSessions(480),
      sleepNeed,
      preferredBedtime: '22:00',
      now: '2026-06-10T08:30:00.000Z'
    });

    expect(briefing.current_phase).toBe('morning_peak');
    const first = briefing.energy_curve[0];
    expect(first.time).toBe('2026-06-10T06:00:00.000Z');
    expect(first.label).toBe('wake_grogginess');
    expect(first.estimated_energy).toBeGreaterThanOrEqual(0);
    expect(first.estimated_energy).toBeLessThanOrEqual(100);
    // Curve is sampled every 20 minutes for smooth scrubbing.
    expect(briefing.energy_curve[1]?.time).toBe('2026-06-10T06:20:00.000Z');
    // Wake +2.5 h, centred on the modelled morning peak rather than starting while
    // sleep inertia is still clearing.
    expect(briefing.rhythm_plan.deep_work_windows[0]?.start_at).toBe('2026-06-10T08:30:00.000Z');
  });

  it('reduces estimated energy amplitude when sleep debt is high', () => {
    const rested = generateCircadianBriefing({
      date: '2026-06-10',
      timezone: 'UTC',
      recentSleepSessions: recentSessions(480),
      sleepNeed,
      preferredBedtime: '22:00'
    });
    const highDebt = generateCircadianBriefing({
      date: '2026-06-10',
      timezone: 'UTC',
      recentSleepSessions: recentSessions(240),
      sleepNeed,
      preferredBedtime: '22:00'
    });

    const restedPeak = Math.max(...rested.energy_curve.map((point) => point.estimated_energy));
    const highDebtPeak = Math.max(...highDebt.energy_curve.map((point) => point.estimated_energy));

    expect(highDebtPeak).toBeLessThan(restedPeak);
    expect(highDebt.sleep_debt_7_day.reason_codes).toContain('sleep_debt_high');
  });

  it('exposes contiguous energy zones covering the whole curve', () => {
    const briefing = generateCircadianBriefing({
      date: '2026-06-10',
      timezone: 'UTC',
      recentSleepSessions: recentSessions(480),
      sleepNeed,
      preferredBedtime: '22:00'
    });

    expect(briefing.energy_zones.length).toBeGreaterThan(0);
    expect(briefing.energy_zones[0].start_at).toBe(briefing.energy_curve[0].time);
    expect(briefing.energy_zones[briefing.energy_zones.length - 1].end_at).toBe(
      briefing.energy_curve[briefing.energy_curve.length - 1].time
    );
    for (let i = 1; i < briefing.energy_zones.length; i++) {
      expect(briefing.energy_zones[i].start_at).toBe(briefing.energy_zones[i - 1].end_at);
    }
  });

  it('surfaces a morning peak and an afternoon low as energy extrema', () => {
    const briefing = generateCircadianBriefing({
      date: '2026-06-10',
      timezone: 'UTC',
      recentSleepSessions: recentSessions(480),
      sleepNeed,
      preferredBedtime: '22:00'
    });

    expect(briefing.energy_extrema.some((point) => point.type === 'peak')).toBe(true);
    expect(briefing.energy_extrema.some((point) => point.type === 'low')).toBe(true);
  });

  it('scales the caffeine cutoff with the dose', () => {
    const briefing = generateCircadianBriefing({
      date: '2026-06-10',
      timezone: 'UTC',
      recentSleepSessions: recentSessions(480),
      sleepNeed,
      preferredBedtime: '22:00'
    });

    // A standard 107 mg coffee measures 8.8 h before bed, rounded up to 9.
    expect(briefing.rhythm_plan.caffeine_cutoff).toBe('2026-06-10T13:00:00.000Z');
    // A pre-workout serving (~217 mg) measures 13.2 h, so it needs its own line.
    expect(briefing.rhythm_plan.caffeine_cutoff_large_dose).toBe('2026-06-10T09:00:00.000Z');
  });

  it('places exercise at the temperature peak and clear of bedtime', () => {
    const briefing = generateCircadianBriefing({
      date: '2026-06-10',
      timezone: 'UTC',
      recentSleepSessions: recentSessions(480),
      sleepNeed,
      preferredBedtime: '22:00'
    });

    // Wake is 06:00 in these fixtures, so wake +8 to +10 is 14:00-16:00, and
    // bedtime - 4 h (18:00) does not bite.
    const [primary] = briefing.rhythm_plan.best_exercise_windows;
    expect(primary.start_at).toBe('2026-06-10T14:00:00.000Z');
    expect(primary.end_at).toBe('2026-06-10T16:00:00.000Z');
    expect(primary.label).toBe('suggested exercise timing');

    // The morning slot survives, but labelled as an accommodation rather than the optimum.
    expect(briefing.rhythm_plan.best_exercise_windows[1].label)
      .toBe('earlier option if mornings suit you better');
  });

  it('never suggests training inside four hours of bedtime', () => {
    // An early bedtime pulls the cap below wake +10, so the window must shorten.
    const briefing = generateCircadianBriefing({
      date: '2026-06-10',
      timezone: 'UTC',
      recentSleepSessions: recentSessions(480),
      sleepNeed,
      preferredBedtime: '19:00'
    });

    const [primary] = briefing.rhythm_plan.best_exercise_windows;
    expect(primary.label).toBe('suggested exercise timing');
    expect(primary.end_at).toBe('2026-06-10T15:00:00.000Z');
  });

  it('withholds the window rather than showing a sliver', () => {
    // Bedtime - 4 h lands before wake +8, leaving nothing worth drawing.
    const briefing = generateCircadianBriefing({
      date: '2026-06-10',
      timezone: 'UTC',
      recentSleepSessions: recentSessions(480),
      sleepNeed,
      preferredBedtime: '17:30'
    });

    expect(briefing.rhythm_plan.best_exercise_windows.map((window) => window.label))
      .toEqual(['earlier option if mornings suit you better']);
  });

  it('suggests morning light and an evening dimming time', () => {
    const briefing = generateCircadianBriefing({
      date: '2026-06-10',
      timezone: 'UTC',
      recentSleepSessions: recentSessions(480),
      sleepNeed,
      preferredBedtime: '22:00'
    });

    const [light] = briefing.rhythm_plan.morning_light_windows;
    expect(light.start_at).toBe('2026-06-10T06:00:00.000Z');
    expect(light.end_at).toBe('2026-06-10T07:00:00.000Z');
    expect(briefing.rhythm_plan.evening_dim_light_start).toBe('2026-06-10T19:00:00.000Z');
    expect(briefing.rhythm_plan.reason_codes).toContain('morning_light_recommended');
  });

  it('sets wind-down start ninety minutes before target bedtime', () => {
    const briefing = generateCircadianBriefing({
      date: '2026-06-10',
      timezone: 'UTC',
      recentSleepSessions: recentSessions(480),
      sleepNeed,
      preferredBedtime: '22:00'
    });

    expect(briefing.rhythm_plan.wind_down_start).toBe('2026-06-10T20:30:00.000Z');
  });

  it('returns unknown phase and low confidence when wake time is missing', () => {
    const briefing = generateCircadianBriefing({
      date: '2026-06-10',
      timezone: 'UTC',
      recentSleepSessions: [
        {
          ...session('2026-06-10', 420),
          sleep_end_at: null
        }
      ],
      sleepNeed,
      preferredBedtime: '22:00'
    });

    expect(briefing.current_phase).toBe('unknown');
    expect(briefing.confidence).toBe('low');
    expect(briefing.energy_curve).toEqual([]);
    expect(briefing.reason_codes).toContain('sleep_data_missing');
  });

  it('includes day organization windows when debt is high', () => {
    const briefing = generateCircadianBriefing({
      date: '2026-06-10',
      timezone: 'UTC',
      recentSleepSessions: recentSessions(240),
      sleepNeed,
      preferredBedtime: '22:00'
    });

    expect(briefing.rhythm_plan.deep_work_windows.length).toBeGreaterThan(0);
    expect(briefing.rhythm_plan.best_exercise_windows.length).toBeGreaterThan(0);
    expect(briefing.rhythm_plan.best_walk_windows.length).toBeGreaterThan(0);
    expect(briefing.rhythm_plan.breathing_windows.length).toBeGreaterThan(0);
    expect(briefing.rhythm_plan.nap_windows.length).toBeGreaterThan(0);
  });

  it('keeps briefing output serializable', () => {
    const briefing = generateCircadianBriefing({
      date: '2026-06-10',
      timezone: 'UTC',
      recentSleepSessions: recentSessions(480),
      sleepNeed,
      preferredBedtime: '22:00'
    });

    expect(() => JSON.stringify(briefing)).not.toThrow();
    expect(JSON.parse(JSON.stringify(briefing))).toEqual(briefing);
  });

  it('preserves source and confidence', () => {
    const briefing = generateCircadianBriefing({
      date: '2026-06-10',
      timezone: 'UTC',
      recentSleepSessions: [
        {
          ...session('2026-06-10', 480),
          source: 'user_corrected',
          source_confidence: 'high',
          corrected_by_user: true
        }
      ],
      sleepNeed,
      preferredBedtime: '22:00'
    });

    expect(briefing.source_summary).toEqual({
      sleep_source: 'user_corrected',
      source_confidence: 'high'
    });
    expect(briefing.reason_codes).toContain('user_corrected_sleep');
  });

  it('does not introduce blocked language in generated output', () => {
    const briefing = generateCircadianBriefing({
      date: '2026-06-10',
      timezone: 'UTC',
      recentSleepSessions: recentSessions(240),
      sleepNeed,
      preferredBedtime: '22:00'
    });
    const blockedTerms = [
      'diag' + 'nosis',
      'diag' + 'nose',
      'treat' + 'ment',
      'c' + 'ure',
      'pre' + 'scribe',
      'pre' + 'scription',
      'ad' + 'renal',
      'h' + 'pa',
      'cor' + 'tisol',
      'hor' + 'mone',
      'clin' + 'ical',
      'medical ' + 'decision',
      'dys' + 'regulated',
      'dys' + 'function',
      'de' + 'tox'
    ];
    const output = JSON.stringify(briefing).toLowerCase();

    for (const term of blockedTerms) {
      expect(output).not.toContain(term);
    }
  });
});


describe('rhythm anchoring, staleness and the day outlook', () => {
  const need: SleepNeedEstimate = { minutes: 480, confidence: 'high', basis: ['onboarding'], updated_at: '2026-09-01T00:00:00.000Z' };

  /** A night ending on `date`, given in local clock times. */
  function night(date: string, bedHour: number, wakeHour: number): SleepSession {
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
      sleep_quality: 4,
      source: 'manual',
      source_confidence: 'high'
    } as SleepSession;
  }

  const steady = Array.from({ length: 12 }, (_, i) =>
    night(`2026-09-${String(i + 1).padStart(2, '0')}`, 23, 7));

  it('produces a day outlook with a band and carries input coverage', () => {
    const briefing = generateCircadianBriefing({
      date: '2026-09-12',
      timezone: 'UTC',
      recentSleepSessions: steady,
      sleepNeed: need,
      refreshment: 4,
      now: '2026-09-12T10:00:00'
    });

    expect(briefing.day_outlook).not.toBeNull();
    expect(briefing.day_outlook!.score).toBeGreaterThan(0);
    expect(['sharp', 'steady', 'slow', 'flat']).toContain(briefing.day_outlook!.band);
    expect(briefing.input_coverage).toBeGreaterThan(0.5);
    expect(briefing.circadian_phase).not.toBeNull();
    expect(briefing.circadian_phase!.regularityScore).toBeGreaterThan(0.8);
  });

  it('reports a lie-in as misalignment instead of moving the whole rhythm', () => {
    const lieIn = [...steady, night('2026-09-13', 2, 11)];
    const briefing = generateCircadianBriefing({
      date: '2026-09-13',
      timezone: 'UTC',
      recentSleepSessions: lieIn,
      sleepNeed: need,
      refreshment: 4,
      now: '2026-09-13T13:00:00'
    });

    expect(Math.abs(briefing.circadian_phase!.misalignmentMinutes!)).toBeGreaterThan(90);
    expect(briefing.reason_codes).toContain('rhythm_out_of_step');
  });

  it('falls back to the clock rather than anchoring to a week-old wake time', () => {
    /*
     * findMostRecentSession will return any session dated on or before today, so a
     * week-old record used to anchor the curve at full confidence.
     */
    const briefing = generateCircadianBriefing({
      date: '2026-09-20',
      timezone: 'UTC',
      recentSleepSessions: steady, // newest is 2026-09-12, eight days earlier
      sleepNeed: need,
      now: '2026-09-20T10:00:00'
    });

    expect(briefing.reason_codes).toContain('sleep_data_stale');
    expect(briefing.confidence).toBe('low');
    // Still useful: the clock's own expected wake keeps a curve on screen.
    expect(briefing.wake_time).not.toBeNull();
    expect(briefing.energy_curve.length).toBeGreaterThan(0);
  });

  it('drops last night from restoration when it is stale, rather than crediting it', () => {
    const fresh = generateCircadianBriefing({
      date: '2026-09-12', timezone: 'UTC', recentSleepSessions: steady, sleepNeed: need, now: '2026-09-12T10:00:00'
    });
    const stale = generateCircadianBriefing({
      date: '2026-09-20', timezone: 'UTC', recentSleepSessions: steady, sleepNeed: need, now: '2026-09-20T10:00:00'
    });
    expect(stale.input_coverage).toBeLessThan(fresh.input_coverage);
    expect(stale.reason_codes).toContain('sleep_inputs_thin');
  });

  it('flags an irregular schedule', () => {
    const irregular = [
      night('2026-09-01', 22, 6), night('2026-09-02', 1, 9), night('2026-09-03', 23, 6),
      night('2026-09-04', 3, 11), night('2026-09-05', 21, 5), night('2026-09-06', 2, 10)
    ];
    const briefing = generateCircadianBriefing({
      date: '2026-09-06', timezone: 'UTC', recentSleepSessions: irregular, sleepNeed: need, now: '2026-09-06T12:00:00'
    });
    expect(briefing.reason_codes).toContain('schedule_irregular');
  });

  it('lets caffeine lift the day and says nothing when it is unknown', () => {
    const base = { date: '2026-09-12', timezone: 'UTC', recentSleepSessions: steady, sleepNeed: need, refreshment: 3, now: '2026-09-12T13:00:00' };
    const plain = generateCircadianBriefing(base);
    const caffeinated = generateCircadianBriefing({ ...base, caffeineOnBoardMg: 150 });
    expect(caffeinated.day_outlook!.score).toBeGreaterThan(plain.day_outlook!.score);
  });
});
