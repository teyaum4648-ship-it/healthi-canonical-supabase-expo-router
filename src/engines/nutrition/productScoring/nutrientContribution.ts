/**
 * Nutrient contribution model + cap layer.
 *
 * Replaces the penalty-only `nutrition()` behaviour in kernelV5, which had
 * three defects that together made the highest-weighted dimension (0.375)
 * nearly inert:
 *
 *  1. It anchored at 70 and ONLY subtracted. A product with no measurable
 *     nutrients (Crisco: no sugar, no sodium, no fiber, no protein) had
 *     nothing to subtract and therefore scored ~72 — one point below
 *     sardines. Absence of bad was being read as presence of good.
 *
 *  2. It penalized saturated fat up to -12 with no regard for fat
 *     provenance, which points the wrong way for a whole-food philosophy.
 *     Butter, tallow, and egg yolks were docked for being what they are.
 *
 *  3. It had no micronutrient or fat-quality term at all, so liver — the
 *     most nutrient-dense food in the catalogue — could not score above a
 *     protein shake.
 *
 * The model here scores CONTRIBUTION (what the food gives you) and LOAD
 * (what it costs you) on separate axes, then lets caps override the
 * weighted mean. Caps matter because a linear weighted mean cannot produce
 * an F: with one dimension pinned near 70 at weight 0.375, roughly 26
 * points are guaranteed before anything else is counted.
 */

import type { FatClass, SweetenerClass } from './ingredientLexicon';

export type NutrientInput = {
  calories?: number | null;
  protein_g?: number | null;
  carbs_g?: number | null;
  fat_g?: number | null;
  saturated_fat_g?: number | null;
  fiber_g?: number | null;
  sugar_g?: number | null;
  added_sugar_g?: number | null;
  sodium_mg?: number | null;
};

export type ContributionSignals = {
  /** Fat classes present anywhere in the ingredient list. */
  fatClasses: FatClass[];
  /** Sweetener classes present anywhere in the ingredient list. */
  sweetenerClasses: SweetenerClass[];
  /** Share of top-level ingredients that count as whole foods (0..1). */
  wholeFoodFraction: number;
  /** Count of top-level ingredients resolved to a lexicon entry. */
  identifiedCount: number;
  /** Count of top-level ingredients with no lexicon match. */
  unknownCount: number;
  /** True when the label is known to be complete. */
  completeLabel: boolean;
};

export type ContributionResult = {
  /** 0..100. What the food actively provides. Null when evidence is too thin. */
  contribution: number | null;
  /** 0..100. What the food costs. Higher = more burden. Null when unknown. */
  load: number | null;
  positives: Array<{ id: string; label: string; delta: number }>;
  negatives: Array<{ id: string; label: string; delta: number }>;
  /** Hard ceiling on the final product score, or null when nothing caps it. */
  cap: number | null;
  capReasons: string[];
};

function finite(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function ramp(value: number, low: number, high: number, maximum: number): number {
  if (value <= low) return 0;
  if (value >= high) return maximum;
  return ((value - low) / (high - low)) * maximum;
}

function clamp(value: number, minimum = 0, maximum = 100): number {
  return Math.min(maximum, Math.max(minimum, value));
}

/**
 * CAP TABLE — the Yuka-style override you already implemented for A-grade
 * denial, but pointing downward. Each entry sets a hard ceiling regardless
 * of how well the product scores on the weighted mean.
 *
 * Ordered most severe first; the lowest applicable cap wins.
 */
const CAPS: Array<{ id: string; ceiling: number; label: string; test: (s: ContributionSignals) => boolean }> = [
  {
    id: 'industrial_fat_cap',
    ceiling: 25,
    label: 'Contains an industrially modified fat (hydrogenated, interesterified, or shortening)',
    test: (s) => s.fatClasses.includes('industrial')
  }
];

/**
 * Only industrial fat keeps a HARD ceiling. Synthetic sweeteners and refined
 * seed oils moved to graded load instead.
 *
 * Reason: a hard ceiling destroys ordering inside the capped set. Everything
 * that trips the cap lands on the same number, so a diet soda and a protein
 * bar with sucralose become indistinguishable — and a sugared soda with no cap
 * can score ABOVE both. That is what broke the existing pairwise-ordering
 * tests, and those tests were right. Graded load preserves the ordering while
 * still keeping capped products out of the top bands.
 */

export function resolveCap(signals: ContributionSignals): { cap: number | null; reasons: string[] } {
  const applicable = CAPS.filter((entry) => entry.test(signals));
  if (applicable.length === 0) return { cap: null, reasons: [] };
  const lowest = applicable.reduce((best, entry) => (entry.ceiling < best.ceiling ? entry : best));
  return { cap: lowest.ceiling, reasons: applicable.map((entry) => entry.label) };
}

/**
 * Nutrient contribution on a per-100g basis.
 *
 * Key inversion from the old model: this STARTS AT 0 and earns upward.
 * A food with no measurable nutrients scores near 0, not near 70.
 */
export function scoreContribution(
  nutrients: NutrientInput,
  signals: ContributionSignals
): ContributionResult {
  const protein = finite(nutrients.protein_g);
  const fiber = finite(nutrients.fiber_g);
  const fat = finite(nutrients.fat_g);
  const addedSugar = finite(nutrients.added_sugar_g);
  const totalSugar = finite(nutrients.sugar_g);
  const sodium = finite(nutrients.sodium_mg);

  const observed = [protein, fiber, fat, totalSugar, sodium].filter((value) => value !== null).length;
  if (observed === 0 && signals.identifiedCount === 0) {
    return { contribution: null, load: null, positives: [], negatives: [], cap: null, capReasons: [] };
  }

  const positives: ContributionResult['positives'] = [];
  const negatives: ContributionResult['negatives'] = [];

  // ---- CONTRIBUTION: starts at zero, earns upward -----------------------
  let contribution = 0;

  if (protein !== null) {
    const gain = ramp(protein, 0, 25, 30);
    if (gain > 0) positives.push({ id: 'meaningful_role_protein', label: `${protein} g protein`, delta: gain });
    contribution += gain;
  }
  if (fiber !== null) {
    const gain = ramp(fiber, 0, 10, 22);
    if (gain > 0) positives.push({ id: 'meaningful_role_fiber', label: `${fiber} g fiber`, delta: gain });
    contribution += gain;
  }

  // Fat contributes by PROVENANCE, never penalized by quantity. This is the
  // clean break from Nutri-Score: EVOO and canola are both ~100% fat and must
  // not score alike.
  if (fat !== null && fat > 3) {
    const hasTraditional = signals.fatClasses.some((c) => c === 'traditional_animal' || c === 'traditional_plant');
    const hasRefinedPlant = signals.fatClasses.includes('refined_plant');
    if (hasTraditional) {
      const gain = ramp(fat, 3, 40, 26);
      positives.push({ id: 'traditional_fat_contribution', label: 'Fat comes from a traditional source', delta: gain });
      contribution += gain;
    } else if (hasRefinedPlant) {
      const gain = ramp(fat, 3, 40, 10);
      positives.push({ id: 'refined_plant_fat_contribution', label: 'Fat comes from a refined plant source', delta: gain });
      contribution += gain;
    }
    // Refined seed and industrial fats contribute nothing. They are handled
    // entirely through load and caps.
  }

  // Whole-food matrix is itself a contribution — this is what lets liver,
  // sardines, and berries clear the top band without needing a macro story.
  if (signals.completeLabel && signals.wholeFoodFraction > 0) {
    const gain = signals.wholeFoodFraction * 34;
    positives.push({ id: 'whole_food_matrix', label: `${Math.round(signals.wholeFoodFraction * 100)}% recognizable whole-food ingredients`, delta: gain });
    contribution += gain;
  }

  // ---- LOAD: starts at zero, accumulates cost ---------------------------
  let load = 0;

  // Sugar is judged by matrix, not grams. Whole-matrix sugar (dates) carries
  // almost no load; refined sugar carries full load.
  const sugarForLoad = addedSugar ?? (signals.sweetenerClasses.includes('refined') ? totalSugar : null);
  if (sugarForLoad !== null && sugarForLoad > 0) {
    const matrixFactor = signals.sweetenerClasses.includes('refined')
      ? 1
      : signals.sweetenerClasses.includes('traditional')
        ? 0.45
        : signals.sweetenerClasses.includes('whole_matrix')
          ? 0.12
          : 0.7;
    const cost = ramp(sugarForLoad, 0, 15, 38) * matrixFactor;
    if (cost > 0) {
      const inferredFromIngredient = addedSugar === null;
      negatives.push({
        id: inferredFromIngredient ? 'measured_total_sugar_with_added_sugar_ingredient' : 'measured_added_sugar',
        label: `${sugarForLoad} g sugar (matrix factor ${matrixFactor})`,
        delta: -cost
      });
      load += cost;
    }
  }

  if (signals.fatClasses.includes('refined_seed')) {
    negatives.push({ id: 'refined_seed_oil_load', label: 'Refined seed oil', delta: -38 });
    load += 38;
  }
  if (signals.fatClasses.includes('industrial')) {
    negatives.push({ id: 'industrial_fat_load', label: 'Industrially modified fat', delta: -40 });
    load += 40;
  }
  if (signals.sweetenerClasses.includes('synthetic_high_intensity')) {
    negatives.push({ id: 'synthetic_sweetener_load', label: 'Synthetic high-intensity sweetener', delta: -20 });
    load += 20;
  }
  if (sodium !== null) {
    const cost = ramp(sodium, 400, 1400, 14);
    if (cost > 0) {
      negatives.push({ id: 'measured_sodium', label: `${sodium} mg sodium`, delta: -cost });
      load += cost;
    }
  }

  const { cap, reasons } = resolveCap(signals);

  return {
    contribution: clamp(contribution),
    load: clamp(load),
    positives,
    negatives,
    cap,
    capReasons: reasons
  };
}

/**
 * Apply the cap layer to a weighted-mean score.
 *
 * Call this AFTER the dimension aggregation in kernelV5. The weighted mean
 * stays as the nuance signal; the cap is what makes an F reachable.
 */
export function applyCap(weightedScore: number, cap: number | null): number {
  if (cap === null) return weightedScore;
  return Math.min(weightedScore, cap);
}


// ---------------------------------------------------------------- TIERS

export type ProductTier = 'A' | 'B' | 'C' | 'D' | 'F';

export type TierVerdict = {
  tier: ProductTier;
  /** Decision-shaped copy, not a grade. */
  verdict: string;
  /** Why this tier, in one line. */
  rationale: string;
};

/**
 * Tier is a REGION in (contribution, load) space, not a threshold on one
 * number. This is what lets Siete (clean but inert) and Olipop (engineered
 * but genuinely additive) land in different tiers despite similar scores,
 * and it is why a single number cannot carry the decision on its own.
 *
 *   A — high contribution, near-zero load, minimally processed
 *   B — real contribution, low-to-moderate load (processed but net-positive)
 *   C — low contribution, low load (clean but inert)
 *   D — any contribution, high load
 *   F — no contribution, high load
 */
export function resolveTier(
  contribution: number | null,
  load: number | null,
  processingIntensity: number,
  signals?: ContributionSignals
): TierVerdict {
  if (contribution === null || load === null) {
    return { tier: 'C', verdict: 'Not enough label evidence', rationale: 'Insufficient data to place this product.' };
  }
  // Tier gate, not a score cap. A synthetic high-intensity sweetener holds the
  // tier at D no matter how good the macros are — this is the rule that stops
  // 15g of protein from buying out a sucralose formulation. It does NOT flatten
  // the score, so ordering inside the gated set is preserved.
  const syntheticSweetener = signals?.sweetenerClasses.includes('synthetic_high_intensity') ?? false;
  if (syntheticSweetener && load > 45) {
    return { tier: 'F', verdict: 'Put it back', rationale: 'Synthetic sweetener on top of a heavy formulation burden.' };
  }
  if (syntheticSweetener) {
    return { tier: 'D', verdict: "There's better in this aisle", rationale: 'A synthetic high-intensity sweetener holds this out of the upper tiers.' };
  }
  if (contribution >= 60 && load <= 12 && processingIntensity <= 2) {
    return { tier: 'A', verdict: 'Stock it', rationale: 'Whole, minimally processed, actively nourishing.' };
  }
  if (contribution >= 35 && load <= 25) {
    return { tier: 'B', verdict: 'Good pick', rationale: 'Processed, but you come out ahead on balance.' };
  }
  if (load <= 25) {
    return { tier: 'C', verdict: 'Fine if you want it', rationale: 'Nothing working against you, not much working for you.' };
  }
  if (contribution >= 25 || load <= 55) {
    return { tier: 'D', verdict: "There's better in this aisle", rationale: 'Something in the formulation is working against you.' };
  }
  return { tier: 'F', verdict: 'Put it back', rationale: 'High formulation burden with little to show for it.' };
}
