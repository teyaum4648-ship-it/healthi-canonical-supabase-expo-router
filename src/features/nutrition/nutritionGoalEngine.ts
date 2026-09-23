import type { FoodPatternProfile, NutritionTargets } from '../../engines/nutrition';

export type GoalAnswers = {
  age: number; heightCm: number; weightKg: number;
  equation: 'female' | 'male' | 'unspecified';
  activity: 'seated' | 'light' | 'active' | 'very_active';
  goal: 'maintain' | 'lose' | 'gain';
  needsGuidance: 'no' | 'yes' | 'unsure';
};
export type GoalSetup = {
  version: 'nutrition_goals_v1'; completedAt: string; answers: GoalAnswers;
  status: 'estimated' | 'guidance'; targets: NutritionTargets;
  reasons: string[]; explanation: string; range: [number, number] | null;
  /** The food pattern this setup was built with, so a reload reproduces the same numbers. */
  pattern: GoalPatternInput | null;
  trace: { restingKcal: number; activityMultiplier: number; maintenanceKcal: number; adjustmentKcal: number; proteinFraction: number; fatFraction: number } | null;
};
/**
 * How much of the split a food pattern is allowed to move.
 *
 * Deliberately one notch. The evidence for individual differences in how people respond
 * to macronutrient ratios is strong — in PREDICT 1, a thousand people eating identical
 * meals varied by 103% in triglyceride response and 68% in glucose. The evidence that a
 * questionnaire can say in advance which split suits someone is not: DIETFITS set out to
 * show exactly that in 609 people over a year, testing genotype and insulin secretion,
 * and found nothing (p = .20 and p = .47).
 *
 * So a pattern nudges and never prescribes. Five percent of calories moved between
 * protein and carbohydrate is enough for a person to notice a difference in what the app
 * suggests, and small enough that being wrong costs them little.
 */
const PATTERN_PROTEIN_STEP = 0.05;
const PROTEIN_FRACTION_FLOOR = 0.15;
const PROTEIN_FRACTION_CEILING = 0.30;

const GOAL_PATTERN_LABELS = ['steady_balanced', 'protein_forward', 'carb_supported', 'lighter_frequent', 'evening_sensitive', 'calibrating'] as const;
const GOAL_PATTERN_CONFIDENCE = ['low', 'medium', 'high'] as const;

export type GoalPatternInput = {
  label: (typeof GOAL_PATTERN_LABELS)[number];
  confidence: (typeof GOAL_PATTERN_CONFIDENCE)[number];
};

/** The part of a saved food pattern that goals are allowed to read. */
export function goalPatternInput(profile: FoodPatternProfile | null | undefined): GoalPatternInput | null {
  if (!profile) return null;
  return { label: profile.pattern_label, confidence: profile.confidence };
}

/** Patterns arrive from storage as well as from the app, so read them defensively. */
export function parseGoalPattern(value: unknown): GoalPatternInput | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as GoalPatternInput;
  if (!GOAL_PATTERN_LABELS.includes(record.label) || !GOAL_PATTERN_CONFIDENCE.includes(record.confidence)) return null;
  return { label: record.label, confidence: record.confidence };
}

export type GoalPatternShift = 'higher_protein' | 'lower_protein' | 'none';

/**
 * Which way a pattern moves the split, if at all.
 *
 * The setup screen needs this to say what a pattern is doing, and to tell a changed pattern
 * that matters from one that does not: going from medium to high confidence on the same
 * label reads as a change but moves no numbers, and is not worth asking someone to redo
 * their goals over.
 */
export function patternSplitShift(pattern: GoalPatternInput | null | undefined): GoalPatternShift {
  const reason = patternAdjustedProtein(0.20, parseGoalPattern(pattern)).reason;
  if (reason === 'pattern_protein_forward') return 'higher_protein';
  if (reason === 'pattern_carb_supported') return 'lower_protein';
  return 'none';
}

/**
 * The protein fraction after the pattern has had its say.
 *
 * Two of the five patterns are about timing rather than macronutrients — eating lighter
 * and more often, or reacting badly to a late dinner — and neither says anything about
 * the split, so neither touches it. A low-confidence profile does not move targets at
 * all: a pattern read from a half-answered quiz is a guess, and guesses do not get to
 * change somebody's numbers.
 */
function patternAdjustedProtein(base: number, pattern: GoalPatternInput | null | undefined): { fraction: number; reason: string | null } {
  if (!pattern || pattern.confidence === 'low' || pattern.label === 'calibrating') return { fraction: base, reason: null };
  if (pattern.label === 'protein_forward') {
    return { fraction: Math.min(PROTEIN_FRACTION_CEILING, base + PATTERN_PROTEIN_STEP), reason: 'pattern_protein_forward' };
  }
  if (pattern.label === 'carb_supported') {
    return { fraction: Math.max(PROTEIN_FRACTION_FLOOR, base - PATTERN_PROTEIN_STEP), reason: 'pattern_carb_supported' };
  }
  return { fraction: base, reason: null };
}

export const unsetNutritionTargets: NutritionTargets = { calories_target: null, protein_g_target: null, carbs_g_target: null, fat_g_target: null, fiber_g_target: null, sodium_mg_limit: null, confidence: 'low', basis: [] };
const activity = { seated: 1.2, light: 1.375, active: 1.55, very_active: 1.725 };
export function goalInputError(a: GoalAnswers): string | null {
  if (!Number.isInteger(a.age) || a.age < 1 || a.age > 120) return 'Enter your age in whole years.';
  if (!Number.isFinite(a.heightCm) || a.heightCm < 80 || a.heightCm > 250) return 'Check your height and unit.';
  if (!Number.isFinite(a.weightKg) || a.weightKg < 20 || a.weightKg > 350) return 'Check your weight and unit.';
  if (!['female', 'male', 'unspecified'].includes(a.equation) || !Object.hasOwn(activity, a.activity) || !['maintain', 'lose', 'gain'].includes(a.goal) || !['no', 'yes', 'unsure'].includes(a.needsGuidance)) return 'Complete each question.';
  return null;
}
/** Mifflin–St Jeor resting estimate; activity/goal policy is explicitly versioned.
 * Not measured metabolism. Never derives a readiness or Product Quality score.
 */
export function estimateNutritionGoals(a: GoalAnswers, completedAt = new Date().toISOString(), pattern?: GoalPatternInput | null): GoalSetup {
  const error = goalInputError(a);
  if (error) throw new Error(error);
  const bmi = a.weightKg / (a.heightCm / 100) ** 2;
  const reasons: string[] = [];
  if (a.age < 18 || a.age > 78) reasons.push('age_outside_estimator_scope');
  if (a.needsGuidance !== 'no') reasons.push('professional_guidance_requested');
  if (a.equation === 'unspecified') reasons.push('equation_input_not_selected');
  if (bmi < 18.5 || bmi > 45) reasons.push('outside_general_estimator_scope');
  const base = { version: 'nutrition_goals_v1' as const, completedAt, answers: { ...a } };
  /* A guidance result carries no numbers, so a pattern has nothing to move and is not recorded. */
  const guidance = (): GoalSetup => ({ ...base, status: 'guidance', targets: { ...unsetNutritionTargets, basis: ['onboarding'] }, reasons, explanation: 'A qualified dietitian or your care team can help set appropriate goals. You can still log foods without calorie or macro targets.', range: null, pattern: null, trace: null });
  if (reasons.length) return guidance();
  const resting = 10 * a.weightKg + 6.25 * a.heightCm - 5 * a.age + (a.equation === 'male' ? 5 : -161);
  const maintenance = resting * activity[a.activity];
  const adjustment = a.goal === 'lose' ? -Math.min(300, maintenance * 0.1) : a.goal === 'gain' ? Math.min(200, maintenance * 0.05) : 0;
  const calories = Math.round((maintenance + adjustment) / 25) * 25;
  // Conservative scope guard, not a universal minimum intake prescription.
  if (calories < 1500 || calories < resting || calories > 4500) { reasons.push('energy_estimate_needs_review'); return guidance(); }
  const baseProtein = a.activity === 'active' || a.activity === 'very_active' || a.goal === 'gain' ? 0.25 : 0.20;
  /* Only the split moves. A pattern says nothing about how much energy somebody needs. */
  const usedPattern = parseGoalPattern(pattern);
  const adjusted = patternAdjustedProtein(baseProtein, usedPattern);
  const proteinFraction = adjusted.fraction;
  const fatFraction = 0.30;
  reasons.push('mifflin_st_jeor_estimate', `activity_${a.activity}`, `goal_${a.goal}`, 'self_reported_inputs', 'not_yet_calibrated');
  if (adjusted.reason) reasons.push(adjusted.reason);
  return { ...base, status: 'estimated', reasons, explanation: adjusted.reason
      ? 'A starting estimate from your answers—not measured metabolism. Your food pattern shifted the protein and carbohydrate split a little; the calories are unchanged. Review how it fits your energy, hunger, and progress after 2–3 weeks; targets do not change automatically.'
      : 'A starting estimate from your answers—not measured metabolism. Review how it fits your energy, hunger, and progress after 2–3 weeks; targets do not change automatically.',
    targets: { calories_target: calories, protein_g_target: Math.round(calories * proteinFraction / 4), carbs_g_target: Math.round(calories * (1 - proteinFraction - fatFraction) / 4), fat_g_target: Math.round(calories * fatFraction / 9), fiber_g_target: null, sodium_mg_limit: null, confidence: 'low', basis: ['onboarding'] },
    range: [Math.round(calories * 0.9 / 25) * 25, Math.round(calories * 1.1 / 25) * 25], pattern: usedPattern,
    trace: { restingKcal: resting, activityMultiplier: activity[a.activity], maintenanceKcal: maintenance, adjustmentKcal: adjustment, proteinFraction, fatFraction }
  };
}
export function parseGoalSetup(value: unknown): GoalSetup | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as GoalSetup;
  if (record.version !== 'nutrition_goals_v1' || !record.answers || !Number.isFinite(Date.parse(record.completedAt))) return null;
  try { return estimateNutritionGoals(record.answers, record.completedAt, parseGoalPattern(record.pattern)); } catch { return null; }
}
export function metricGoalInputs(height: string, weight: string, unit: 'metric' | 'imperial') {
  const number = (s: string) => /^\d+(\.\d+)?$/.test(s.trim()) ? Number(s) : NaN;
  return { heightCm: number(height) * (unit === 'imperial' ? 2.54 : 1), weightKg: number(weight) * (unit === 'imperial' ? 0.45359237 : 1) };
}
