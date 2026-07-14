import { describe, expect, it } from 'vitest';

import { composeProfileScreenModel, loadProfileScreenModel } from '../../../src/features/profile/profileComposer';

describe('profile composer', () => {
  it('handles signed-out data without crashing', async () => {
    const model = await loadProfileScreenModel({ is_demo_mode: false });

    expect(model.account.label).toBe('Not signed in');
    expect(model.baseline.status).toBe('needs_setup');
  });

  it('maps demo data coverage into the baseline summary', () => {
    const model = composeProfileScreenModel({
      profile: { display_name: 'Demo User', goal: 'sleep_optimization' },
      onboarding: { completed: true, baseline_profile: { primary_goal: 'sleep_optimization' } },
      source_label: 'demo',
      nutrition_dates: ['2026-07-14', '2026-07-13', '2026-07-12'],
      movement_dates: ['2026-07-14', '2026-07-13', '2026-07-12'],
      schedule_dates: ['2026-07-14'],
      sleep_dates: ['2026-07-14', '2026-07-13', '2026-07-12', '2026-07-11'],
      food_pattern_label: 'steady_balanced',
      movement_readiness_label: 'steady',
      rhythm_confidence: 'medium'
    });

    expect(model.account.source_label).toBe('demo');
    expect(model.baseline.status).toBe('ready');
    expect(model.baseline.calibration.domains.find((domain) => domain.domain === 'nourishment')?.status).toBe('partial');
  });

  it('keeps sparse data calibrating and serializable', () => {
    const model = composeProfileScreenModel({
      profile: { display_name: 'Taylor', goal: 'energy_focus' },
      onboarding: { completed: true },
      source_label: 'logged',
      nutrition_dates: ['2026-07-14']
    });

    expect(model.baseline.status).toBe('calibrating');
    expect(model.baseline.missing_data).toContain('movement_capacity');
    expect(JSON.parse(JSON.stringify(model))).toEqual(model);
  });
});
