import type { DataConfidence } from '../../../types/common';

/** The eight nutrients Healthi logs. Matches foodLoggingNutrition so totals stay comparable. */
export const PHOTO_ESTIMATE_NUTRIENT_KEYS = [
  'calories',
  'protein_g',
  'carbs_g',
  'fat_g',
  'fiber_g',
  'sugar_g',
  'sodium_mg',
  'saturated_fat_g'
] as const;

export type PhotoEstimateNutrientKey = typeof PHOTO_ESTIMATE_NUTRIENT_KEYS[number];
export type PhotoEstimateNutrients = Record<PhotoEstimateNutrientKey, number | null>;

/** Units a portion can be stated in. Counts ("2 eggs") are not masses and never scale per-100 g data. */
export type PhotoEstimatePortionUnit = 'g' | 'ml' | 'count';

export type PhotoEstimatePortion = {
  amount: number;
  unit: PhotoEstimatePortionUnit;
  /** Free text as the model described it: "about a cupped handful". Display only. */
  described_as: string | null;
  /** True once a person has set the amount themselves. */
  corrected: boolean;
};

/**
 * One food the model reports seeing.
 *
 * Identification and portion carry separate confidences on purpose. A model can be
 * near-certain a fillet is salmon and still have no idea whether it is 4 oz or 8 oz,
 * and portion is where almost all of the calorie error lives. Collapsing the two into
 * one number would hide the half that actually matters.
 */
export type PhotoEstimateItem = {
  id: string;
  name: string;
  /** Which thing in the frame this is, e.g. "the pink fillet at the left". Helps a person check the work. */
  detail: string | null;
  portion: PhotoEstimatePortion;
  nutrients: PhotoEstimateNutrients;
  identification_confidence: DataConfidence;
  portion_confidence: DataConfidence;
};

/** Low and high calorie bounds implied by the portion uncertainty. Never a single number. */
export type PhotoEstimateRange = { low: number; high: number };

export type PhotoEstimate = {
  items: PhotoEstimateItem[];
  /** Sum of the item point estimates, with the band the portion confidences imply. */
  calories: number | null;
  calorie_range: PhotoEstimateRange | null;
  /** The lower of every item's identification and portion confidence. */
  confidence: DataConfidence;
  /** Always true for a fresh estimate: nothing reaches the diary without a person confirming it. */
  requires_review: boolean;
  /** Model id that produced this, recorded so a later read knows what made the guess. */
  model: string | null;
  estimated_at: string;
};

/**
 * Why an estimate was not produced. A photo estimator that guesses when it cannot see
 * is worse than one that declines, so every failure names itself instead of returning
 * an empty plate that reads as "0 calories".
 */
export type PhotoEstimateRefusal =
  | { reason: 'not_configured'; detail: string }
  | { reason: 'no_food_found'; detail: string }
  | { reason: 'too_unclear'; detail: string }
  | { reason: 'rate_limited'; detail: string }
  | { reason: 'unavailable'; detail: string }
  | { reason: 'malformed_response'; detail: string };

export type PhotoEstimateResult =
  | { ok: true; estimate: PhotoEstimate }
  | { ok: false; refusal: PhotoEstimateRefusal };
