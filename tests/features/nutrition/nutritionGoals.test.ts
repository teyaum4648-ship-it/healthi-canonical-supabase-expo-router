import { describe, expect, it, vi } from 'vitest';
import { estimateNutritionGoals, goalPatternInput, metricGoalInputs, parseGoalSetup, patternSplitShift, unsetNutritionTargets, type GoalAnswers, type GoalPatternInput } from '../../../src/features/nutrition/nutritionGoalEngine';
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

describe('the Food Pattern Test nudges the split it is evidenced for', () => {
  const pattern = (label: GoalPatternInput['label'], confidence: GoalPatternInput['confidence'] = 'medium'): GoalPatternInput => ({ label, confidence });
  const split = (p?: GoalPatternInput | null) => estimateNutritionGoals(adult, '2026-09-10T12:00:00Z', p);
  const plain = split();

  it('moves protein one step up or down and never the calories', () => {
    const up = split(pattern('protein_forward'));
    const down = split(pattern('carb_supported'));
    expect(up.trace!.proteinFraction).toBeCloseTo(plain.trace!.proteinFraction + 0.05);
    expect(down.trace!.proteinFraction).toBeCloseTo(plain.trace!.proteinFraction - 0.05);
    expect(up.targets.protein_g_target!).toBeGreaterThan(plain.targets.protein_g_target!);
    expect(up.targets.carbs_g_target!).toBeLessThan(plain.targets.carbs_g_target!);
    for (const result of [up, down]) {
      expect(result.targets.calories_target).toBe(plain.targets.calories_target);
      expect(result.targets.fat_g_target).toBe(plain.targets.fat_g_target);
      expect(result.range).toEqual(plain.range);
    }
  });
  it('stays inside the split it is allowed to move', () => {
    for (const activity of ['seated', 'light', 'active', 'very_active'] as const) {
      for (const label of ['protein_forward', 'carb_supported'] as const) {
        for (const confidence of ['medium', 'high'] as const) {
          const result = estimateNutritionGoals({ ...adult, activity }, '2026-09-10T12:00:00Z', pattern(label, confidence));
          expect(result.trace!.proteinFraction).toBeGreaterThanOrEqual(0.15);
          expect(result.trace!.proteinFraction).toBeLessThanOrEqual(0.30);
          const t = result.targets;
          expect(Math.abs(t.protein_g_target! * 4 + t.carbs_g_target! * 4 + t.fat_g_target! * 9 - t.calories_target!)).toBeLessThan(10);
        }
      }
    }
  });
  it.each([
    pattern('protein_forward', 'low'),
    pattern('carb_supported', 'low'),
    pattern('calibrating', 'high'),
    pattern('steady_balanced', 'high'),
    pattern('lighter_frequent', 'high'),
    pattern('evening_sensitive', 'high')
  ])('leaves targets alone when the pattern is weak or is about timing: %j', p => {
    const result = split(p);
    expect(result.targets).toEqual(plain.targets);
    expect(patternSplitShift(p)).toBe('none');
    expect(result.reasons).toEqual(plain.reasons);
    expect(result.explanation).toBe(plain.explanation);
  });
  it('says what moved, in reason codes and in words', () => {
    const up = split(pattern('protein_forward'));
    expect(up.reasons).toContain('pattern_protein_forward');
    expect(up.explanation).toContain('calories are unchanged');
    expect(up.explanation).not.toMatch(/diagnos|treat|prescrib|clinical|guaranteed/i);
  });
  it('reproduces the same numbers after a reload, and ignores an injected pattern', () => {
    const saved = split(pattern('protein_forward'));
    expect(parseGoalSetup(JSON.parse(JSON.stringify(saved)))).toEqual(saved);
    expect(parseGoalSetup({ ...saved, pattern: { label: 'nonsense', confidence: 'high' } })?.targets).toEqual(plain.targets);
    expect(parseGoalSetup({ ...saved, pattern: { label: 'protein_forward', confidence: 'certain' } })?.targets).toEqual(plain.targets);
  });
  it('keeps a pattern out of the guidance path entirely', () => {
    const referred = estimateNutritionGoals({ ...adult, needsGuidance: 'yes' }, '2026-09-10T12:00:00Z', pattern('protein_forward'));
    expect(referred.status).toBe('guidance');
    expect(referred.pattern).toBeNull();
    expect(referred.reasons).not.toContain('pattern_protein_forward');
  });
  it('reads a pattern off a saved profile without reaching for the rest of it', () => {
    expect(goalPatternInput(null)).toBeNull();
    expect(goalPatternInput({ pattern_label: 'carb_supported', confidence: 'high', scores: {} } as never)).toEqual({ label: 'carb_supported', confidence: 'high' });
  });
  it('carries the pattern through saving and loading', async () => {
    const data = new Map<string, string>();
    const s = { getItem: vi.fn(async (k: string) => data.get(k) ?? null), setItem: vi.fn(async (k: string, v: string) => { data.set(k, v); }) };
    const saved = await saveGoalSetup(adult, 'demo-user', true, null, s, pattern('carb_supported'));
    expect(saved.pattern).toEqual({ label: 'carb_supported', confidence: 'medium' });
    expect(await readGoalSetup('demo-user', true, null, s)).toEqual(saved);
  });
});
