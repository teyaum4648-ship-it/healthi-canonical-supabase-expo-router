import type { NutritionTargets } from '../../engines/nutrition';

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
  trace: { restingKcal: number; activityMultiplier: number; maintenanceKcal: number; adjustmentKcal: number; proteinFraction: number; fatFraction: number } | null;
};
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
export function estimateNutritionGoals(a: GoalAnswers, completedAt = new Date().toISOString()): GoalSetup {
  const error = goalInputError(a);
  if (error) throw new Error(error);
  const bmi = a.weightKg / (a.heightCm / 100) ** 2;
  const reasons: string[] = [];
  if (a.age < 18 || a.age > 78) reasons.push('age_outside_estimator_scope');
  if (a.needsGuidance !== 'no') reasons.push('professional_guidance_requested');
  if (a.equation === 'unspecified') reasons.push('equation_input_not_selected');
  if (bmi < 18.5 || bmi > 45) reasons.push('outside_general_estimator_scope');
  const base = { version: 'nutrition_goals_v1' as const, completedAt, answers: { ...a } };
  const guidance = (): GoalSetup => ({ ...base, status: 'guidance', targets: { ...unsetNutritionTargets, basis: ['onboarding'] }, reasons, explanation: 'A qualified dietitian or your care team can help set appropriate goals. You can still log foods without calorie or macro targets.', range: null, trace: null });
  if (reasons.length) return guidance();
  const resting = 10 * a.weightKg + 6.25 * a.heightCm - 5 * a.age + (a.equation === 'male' ? 5 : -161);
  const maintenance = resting * activity[a.activity];
  const adjustment = a.goal === 'lose' ? -Math.min(300, maintenance * 0.1) : a.goal === 'gain' ? Math.min(200, maintenance * 0.05) : 0;
  const calories = Math.round((maintenance + adjustment) / 25) * 25;
  // Conservative scope guard, not a universal minimum intake prescription.
  if (calories < 1500 || calories < resting || calories > 4500) { reasons.push('energy_estimate_needs_review'); return guidance(); }
  const proteinFraction = a.activity === 'active' || a.activity === 'very_active' || a.goal === 'gain' ? 0.25 : 0.20;
  const fatFraction = 0.30;
  reasons.push('mifflin_st_jeor_estimate', `activity_${a.activity}`, `goal_${a.goal}`, 'self_reported_inputs', 'not_yet_calibrated');
  return { ...base, status: 'estimated', reasons, explanation: 'A starting estimate from your answers—not measured metabolism. Review how it fits your energy, hunger, and progress after 2–3 weeks; targets do not change automatically.',
    targets: { calories_target: calories, protein_g_target: Math.round(calories * proteinFraction / 4), carbs_g_target: Math.round(calories * (1 - proteinFraction - fatFraction) / 4), fat_g_target: Math.round(calories * fatFraction / 9), fiber_g_target: null, sodium_mg_limit: null, confidence: 'low', basis: ['onboarding'] },
    range: [Math.round(calories * 0.9 / 25) * 25, Math.round(calories * 1.1 / 25) * 25],
    trace: { restingKcal: resting, activityMultiplier: activity[a.activity], maintenanceKcal: maintenance, adjustmentKcal: adjustment, proteinFraction, fatFraction }
  };
}
export function parseGoalSetup(value: unknown): GoalSetup | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as GoalSetup;
  if (record.version !== 'nutrition_goals_v1' || !record.answers || !Number.isFinite(Date.parse(record.completedAt))) return null;
  try { return estimateNutritionGoals(record.answers, record.completedAt); } catch { return null; }
}
export function metricGoalInputs(height: string, weight: string, unit: 'metric' | 'imperial') {
  const number = (s: string) => /^\d+(\.\d+)?$/.test(s.trim()) ? Number(s) : NaN;
  return { heightCm: number(height) * (unit === 'imperial' ? 2.54 : 1), weightKg: number(weight) * (unit === 'imperial' ? 0.45359237 : 1) };
}
