import { productLetterGrade, type ProductLetterGrade } from '../../engines/nutrition/productScoring';
import { grade, ink } from '../../styles/daywoven1c';

/**
 * What colour a score reads as, at a glance.
 *
 * Three colours rather than five, because this sits in a list row and answers one
 * question: is this worth a second look. They are derived from the letter grade rather
 * than from their own thresholds — green is A or B, amber is C or D, red is F, which
 * lands on exactly the 80 and 60 cuts the bands already use. Writing `score >= 80` here
 * as well would be a second source of truth that drifts the first time a band moves.
 */

const RING_COLOR: Record<ProductLetterGrade, string> = {
  A: grade.A,
  B: grade.A,
  C: grade.C,
  D: grade.C,
  F: grade.F
};

/** The colour for a score, or muted ink when there is no score to show. Colours come from the 1c grade scale. */
export function scoreRingColor(score: number | null | undefined, unscored: string = ink.muted): string {
  if (typeof score !== 'number' || !Number.isFinite(score)) return unscored;
  return RING_COLOR[productLetterGrade(score)];
}

/** Whether a score is a number the ring can draw an arc for. */
export function hasScore(score: number | null | undefined): score is number {
  return typeof score === 'number' && Number.isFinite(score);
}
