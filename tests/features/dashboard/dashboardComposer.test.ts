import { describe, expect, it } from 'vitest';

import { generateCircadianBriefing, type CircadianBriefing, type RhythmPlan, type SleepDebtSummary, type SleepSession } from '../../../src/engines/circadian';
import { composeDashboardModel } from '../../../src/features/dashboard/dashboardComposer';
import { createDefaultSleepNeedEstimate, createDemoSleepSessions } from '../../../src/features/sleepRhythm/rhythmInputs';

type BriefingOverrides = Partial<Omit<CircadianBriefing, 'rhythm_plan' | 'sleep_debt_7_day'>> & {
  rhythm_plan?: Partial<RhythmPlan>;
  sleep_debt_7_day?: Partial<SleepDebtSummary>;
};

function createBriefing(overrides: BriefingOverrides = {}): CircadianBriefing {
  const sessions = createDemoSleepSessions('2026-06-12');
  const briefing = generateCircadianBriefing({
    date: '2026-06-12',
    timezone: 'UTC',
    recentSleepSessions: sessions,
    sleepNeed: createDefaultSleepNeedEstimate('2026-06-12T12:00:00.000Z'),
    preferredBedtime: '22:30',
    now: '2026-06-12T09:30:00.000Z'
  });

  return {
    ...briefing,
    ...overrides,
    sleep_debt_7_day: {
      ...briefing.sleep_debt_7_day,
      ...overrides.sleep_debt_7_day
    },
    rhythm_plan: {
      ...briefing.rhythm_plan,
      ...overrides.rhythm_plan
    }
  };
}

function createSession(overrides: Partial<SleepSession> = {}): SleepSession {
  return {
    date: '2026-06-12',
    sleep_start_at: '2026-06-11T22:35:00.000Z',
    sleep_end_at: '2026-06-12T06:35:00.000Z',
    duration_minutes: 480,
    sleep_quality: 4,
    source: 'manual',
    source_confidence: 'medium',
    corrected_by_user: false,
    reason_codes: ['user_confirmed_sleep'],
    created_at: '2026-06-12T12:00:00.000Z',
    ...overrides
  };
}

describe('composeDashboardModel', () => {
  it('produces a serializable dashboard model', () => {
    const model = composeDashboardModel({
      date: '2026-06-12',
      circadianBriefing: createBriefing(),
      recentSleepSession: createSession(),
      demoMode: true
    });

    expect(JSON.parse(JSON.stringify(model))).toEqual(model);
  });

  it('maps readiness score to the correct readiness state', () => {
    const primed = composeDashboardModel({
      date: '2026-06-12',
      circadianBriefing: createBriefing({
        current_phase: 'morning_peak',
        sleep_debt_7_day: { nightly_average_debt_minutes: 0 }
      }),
      recentSleepSession: createSession({ duration_minutes: 500 })
    });

    expect(primed.readiness.state).toBe('primed');
    expect(primed.readiness.label).toBe("You're primed");
  });

  it('lowers confidence when key data is missing', () => {
    const model = composeDashboardModel({ date: '2026-06-12' });

    expect(model.readiness.confidence).toBe('low');
    expect(model.readiness.reason_codes).toContain('sleep_signal_missing');
  });

  it("lets sleep and circadian data influence Today's Focus", () => {
    const model = composeDashboardModel({
      date: '2026-06-12',
      circadianBriefing: createBriefing({
        current_phase: 'morning_peak',
        sleep_debt_7_day: { nightly_average_debt_minutes: 0 }
      }),
      recentSleepSession: createSession({ duration_minutes: 500 })
    });

    expect(model.focus.directive).toBe('stronger_output');
    expect(model.focus.title).toBe('High-output window');
    expect(model.focus.why).toContain('Favorable rhythm phase');
  });

  it('uses high sleep debt to create a recovery or maintain style directive', () => {
    const model = composeDashboardModel({
      date: '2026-06-12',
      circadianBriefing: createBriefing({
        sleep_debt_7_day: { nightly_average_debt_minutes: 130 }
      }),
      recentSleepSession: createSession({ duration_minutes: 390 })
    });

    expect(['controlled_output', 'recovery_led']).toContain(model.focus.directive);
    expect(model.focus.why).toContain('Sleep debt is asking for control');
  });

  it('keeps recovery tile honest when live wearable data is unavailable', () => {
    const model = composeDashboardModel({
      date: '2026-06-12',
      circadianBriefing: createBriefing(),
      recentSleepSession: createSession()
    });
    const recovery = model.drivers.find((driver) => driver.id === 'recovery');

    expect(recovery?.source).toBe('No live HRV data');
  });

  it('includes the expected quick actions', () => {
    const model = composeDashboardModel({ date: '2026-06-12' });

    expect(model.quickActions.map((action) => action.id)).toEqual(['log_meal', 'start_workout', 'log_sleep']);
  });

  it('does not introduce blocked language in generated dashboard copy', () => {
    const model = composeDashboardModel({
      date: '2026-06-12',
      circadianBriefing: createBriefing(),
      recentSleepSession: createSession()
    });
    const output = JSON.stringify(model).toLowerCase();
    const blockedTerms = [
      'che' + 'k',
      'h' + 'lc',
      'primal ' + 'pattern',
      'work-' + 'in',
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

    for (const term of blockedTerms) {
      expect(output).not.toContain(term);
    }
  });
});
