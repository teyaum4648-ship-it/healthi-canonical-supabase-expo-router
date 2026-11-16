import type { NutrientSummary, NutritionTargets } from '../../engines/nutrition';
import { intakeProgress } from './dietDashboardModel';

/**
 * The Food band's hero (handoff Phase 5): the day's intake against working targets, as
 * bars with a dashed mark at the target (design language P8). Presentation only: the
 * numbers are the nutrient summary's, the targets are the person's own working targets,
 * and a target that is not set is shown as an outline labelled so, never as a fill.
 */

export type IntakeBar = {
  key: 'energy' | 'protein' | 'carbs' | 'fat';
  label: string;
  /** "520 kcal", "31 g", or "Not logged". */
  value: string;
  /** "of 2,100 kcal" or "No target set". */
  target: string;
  /** Fill as a share of the bar, or null when there is nothing to draw against. */
  fill: number | null;
  /** Where the target sits along the bar, 0–1, or null without a target. */
  targetMark: number | null;
};

const round = (value: number) => Math.round(value).toLocaleString('en-US');

export function intakeBars(summary: Pick<NutrientSummary, 'calories' | 'protein_g' | 'carbs_g' | 'fat_g'>, targets: Pick<NutritionTargets, 'calories_target' | 'protein_g_target' | 'carbs_g_target' | 'fat_g_target'>): IntakeBar[] {
  const rows = [
    { key: 'energy', label: 'Energy', unit: 'kcal', amount: summary.calories, goal: targets.calories_target },
    { key: 'protein', label: 'Protein', unit: 'g', amount: summary.protein_g, goal: targets.protein_g_target },
    { key: 'carbs', label: 'Carbs', unit: 'g', amount: summary.carbs_g, goal: targets.carbs_g_target },
    { key: 'fat', label: 'Fat', unit: 'g', amount: summary.fat_g, goal: targets.fat_g_target }
  ] as const;
  return rows.map((row) => {
    const progress = intakeProgress(row.amount, row.goal);
    /* The bar runs a little past the target, so going over it is visible rather than clipped. */
    const scale = progress.target === null ? null : Math.max(progress.target * 1.15, progress.amount ?? 0);
    return {
      key: row.key,
      label: row.label,
      value: progress.amount === null ? 'Not logged' : `${round(progress.amount)} ${row.unit}`,
      target: progress.target === null ? 'No target set' : `of ${round(progress.target)} ${row.unit}`,
      fill: scale === null || progress.amount === null ? null : progress.amount / scale,
      targetMark: scale === null || progress.target === null ? null : progress.target / scale
    };
  });
}

/** The headline: how many meals are in the diary for the day being shown. */
export function foodHeadline(mealCount: number, isToday: boolean, dayLabel: string): string {
  const when = isToday ? 'today' : `on ${dayLabel}`;
  if (mealCount <= 0) return `Nothing logged ${when} yet.`;
  return `${mealCount} ${mealCount === 1 ? 'meal' : 'meals'} logged ${when}.`;
}

/** The sub-line, in the same words the intake summary has always used. */
export function energyLine(summary: Pick<NutrientSummary, 'calories' | 'reason_codes'>, target: number | null | undefined): string {
  const energy = intakeProgress(summary.calories, target);
  const partial = summary.reason_codes.includes('partial_nutrition_data');
  if (energy.amount === null) return 'Log a food to begin.';
  if (energy.target === null) return 'No working calorie target set. Working targets guide your day; bars show intake, not a health score.';
  if (partial) return 'Includes partial nutrition entries, so totals show reported amounts only.';
  return energy.remaining! >= 0
    ? `${round(energy.remaining!)} kcal to your working target.`
    : `${round(-energy.remaining!)} kcal above your working target.`;
}
