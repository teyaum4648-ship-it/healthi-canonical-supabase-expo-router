import { describe, expect, it, vi } from 'vitest';
import { estimateNutritionGoals, metricGoalInputs, parseGoalSetup, unsetNutritionTargets, type GoalAnswers } from '../../../src/features/nutrition/nutritionGoalEngine';
import { readGoalSetup, saveGoalSetup, demoGoalKey, type GoalClient } from '../../../src/features/nutrition/nutritionGoalStore';
import { resettableDemoKeys } from '../../../src/features/auth/demoLifecycle';
const adult: GoalAnswers = { age: 30, heightCm: 175, weightKg: 75, equation: 'male', activity: 'light', goal: 'maintain', needsGuidance: 'no' };
describe('personalized calorie and macro starting targets', () => {
  it('starts without a generic target', () => { expect(unsetNutritionTargets.calories_target).toBeNull(); expect(unsetNutritionTargets.protein_g_target).toBeNull(); });
  it('is deterministic and traces the resting equation, activity, and energy adjustment', () => {
    const a = estimateNutritionGoals(adult, '2026-09-10T12:00:00Z');
    expect(a).toEqual(estimateNutritionGoals(adult, '2026-09-10T12:00:00Z'));
    expect(a.trace?.restingKcal).toBe(10 * 75 + 6.25 * 175 - 5 * 30 + 5);
    expect(a.trace?.maintenanceKcal).toBe(a.trace!.restingKcal * 1.375);
    expect(a.targets.confidence).toBe('low'); expect(a.reasons).toContain('not_yet_calibrated');
  });
  it('responds to body information, activity, and direction instead of fixed targets', () => {
    const basic = estimateNutritionGoals(adult);
    const active = estimateNutritionGoals({ ...adult, activity: 'active' });
    expect(active.targets.calories_target!).toBeGreaterThan(basic.targets.calories_target!);
    expect(estimateNutritionGoals({ ...adult, goal: 'lose' }).targets.calories_target!).toBeLessThan(basic.targets.calories_target!);
    expect(estimateNutritionGoals({ ...adult, goal: 'gain' }).targets.calories_target!).toBeGreaterThan(basic.targets.calories_target!);
    expect(estimateNutritionGoals({ ...adult, weightKg: 85 }).targets.calories_target).not.toBe(basic.targets.calories_target);
  });
  it('keeps rounded macros consistent with calories', () => {
    for (const activity of ['seated','light','active','very_active'] as const) {
      const { targets: t } = estimateNutritionGoals({ ...adult, activity });
      expect(Math.abs(t.protein_g_target! * 4 + t.carbs_g_target! * 4 + t.fat_g_target! * 9 - t.calories_target!)).toBeLessThan(10);
      expect(t.fiber_g_target).toBeNull();
    }
  });
  it.each([{ age: 17 }, { age: 80 }, { needsGuidance: 'yes' }, { needsGuidance: 'unsure' }, { equation: 'unspecified' }, { weightKg: 45 }])('does not auto-assign targets outside scope: %j', change => {
    const result = estimateNutritionGoals({ ...adult, ...change } as GoalAnswers);
    expect(result.status).toBe('guidance'); expect(result.targets.calories_target).toBeNull(); expect(result.targets.protein_g_target).toBeNull(); expect(result.reasons.length).toBeGreaterThan(0);
  });
  it.each([{ age: NaN }, { weightKg: -10 }, { heightCm: Infinity }, { activity: 'invalid' }])('rejects invalid answers: %j', change => {
    expect(() => estimateNutritionGoals({ ...adult, ...change } as GoalAnswers)).toThrow();
  });
  it('converts imperial inputs without guessing feet or silently changing units', () => {
    const value = metricGoalInputs('68', '165', 'imperial');
    expect(value.heightCm).toBeCloseTo(172.72); expect(value.weightKg).toBeCloseTo(74.8427);
    expect(Number.isNaN(metricGoalInputs('5 feet 8', '165', 'imperial').heightCm)).toBe(true);
  });
  it('revalidates saved answers and does not trust injected targets', () => {
    const setup = estimateNutritionGoals(adult);
    expect(parseGoalSetup({ ...setup, targets: { calories_target: 900 } })?.targets).toEqual(setup.targets);
    expect(parseGoalSetup({ ...setup, version: 'future' })).toBeNull();
  });
});
describe('one-time goal persistence', () => {
  const storage = () => { const data = new Map<string,string>(); return { getItem: vi.fn(async(k:string) => data.get(k) ?? null), setItem: vi.fn(async(k:string,v:string) => { data.set(k,v); }) }; };
  it('remembers demo completion and includes it in explicit demo reset', async () => {
    const s = storage(); const saved = await saveGoalSetup(adult, 'demo-user', true, null, s);
    expect(await readGoalSetup('demo-user', true, null, s)).toEqual(saved);
    expect(resettableDemoKeys).toContain(demoGoalKey);
  });
  it('never falls back to demo storage when an account write fails', async () => {
    const s = storage(); const rpc = vi.fn(async() => ({ data: null, error: { message: 'offline' } }));
    await expect(saveGoalSetup(adult, 'user-1', false, { rpc } as unknown as GoalClient, s)).rejects.toThrow('previous goals');
    expect(s.setItem).not.toHaveBeenCalled();
  });
  it('uses an owner-derived atomic RPC without a caller-selected user id', async () => {
    const rpc = vi.fn(async() => ({ data: null, error: null }));
    await saveGoalSetup(adult, 'user-1', false, { rpc } as unknown as GoalClient, storage());
    expect(rpc.mock.calls[0]).toMatchObject(['save_nutrition_goal_setup', { setup: { version: 'nutrition_goals_v1' } }]);
  });
  it('blocks unsigned account access', async () => {
    await expect(saveGoalSetup(adult, null, false, null, storage())).rejects.toThrow('Sign in');
    await expect(readGoalSetup('demo-user', false, null, storage())).rejects.toThrow('Sign in');
  });
});
