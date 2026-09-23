import { foodPatternTitle } from '../../engines/nutrition';
import { patternSplitShift, type GoalPatternInput, type GoalSetup } from './nutritionGoalEngine';

export type GoalPatternRow = {
  title: string;
  detail: string;
  /** The saved goals were built on a pattern that would now produce a different split. */
  stale: boolean;
};

/**
 * The Food Pattern Test as it appears beside personalized goals.
 *
 * The row says what the pattern is currently doing to the numbers, including when the answer
 * is "nothing" — a pattern that is still calibrating, or one about meal timing rather than
 * macronutrients, leaves the split alone, and saying so is more useful than implying the quiz
 * did something it did not.
 */
export function goalPatternRow(pattern: GoalPatternInput | null, saved: GoalSetup | null): GoalPatternRow {
  const shift = patternSplitShift(pattern);
  /* Only an estimated setup has a split to be out of date. */
  const stale = saved?.status === 'estimated' && shift !== patternSplitShift(saved.pattern);

  if (!pattern) {
    return { title: 'Take the Food Pattern Test', detail: 'A short quiz about how meals tend to sit with you', stale: false };
  }
  if (stale) {
    return { title: foodPatternTitle(pattern.label), detail: 'Retake anytime · Your goals still use your previous pattern', stale: true };
  }
  if (shift === 'higher_protein') {
    return { title: foodPatternTitle(pattern.label), detail: 'Nudges your goals toward more protein · Retake anytime', stale: false };
  }
  if (shift === 'lower_protein') {
    return { title: foodPatternTitle(pattern.label), detail: 'Nudges your goals toward more carbohydrate · Retake anytime', stale: false };
  }
  if (pattern.label === 'calibrating' || pattern.confidence === 'low') {
    return { title: foodPatternTitle(pattern.label), detail: 'Still calibrating · Your macro split is unchanged for now', stale: false };
  }
  return { title: foodPatternTitle(pattern.label), detail: 'Guides meal rhythm rather than your macro split', stale: false };
}

/**
 * The goals row itself. A pattern that would now produce a different split is worth saying
 * out loud, because nothing changes a saved target on its own.
 */
export function goalsRowCopy(saved: GoalSetup | null, stale: boolean): { title: string; detail: string } {
  if (!saved) return { title: 'Set up my goals', detail: 'A one-time quiz for calorie and macro estimates' };
  if (saved.status !== 'estimated') return { title: 'Your nutrition setup', detail: 'Setup saved · Guidance before numeric targets' };
  if (stale) return { title: 'Your personalized goals', detail: 'Your food pattern changed · Review your estimate' };
  return { title: 'Your personalized goals', detail: 'Starting estimate · Update your answers anytime' };
}
