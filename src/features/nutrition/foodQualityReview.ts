import type { ProductLetterGrade } from '../../engines/nutrition/productScoring';
import { productLetterGrade } from '../../engines/nutrition/productScoring';
import {
  FOOD_ROLES,
  roleIngredients,
  type IngredientRole
} from '../../engines/nutrition/productScoring/ingredientRoles';
import { splitIngredientList } from '../../engines/nutrition/productScoring';

/**
 * What you actually ate, graded.
 *
 * This replaces a page called Guidance, which showed a verdict, a confidence meter, a
 * list headed "Priorities" and two blocks called "Adaptive nutrient field" and
 * "Coverage builder". All of it was about the app's reasoning and none of it named a
 * single thing the person had eaten. A page that cannot say "the ranch dressing was
 * the D" is not guidance; it is a status readout.
 *
 * The scanner already decides what a product is worth, and every logged item carries
 * the grade it was given. So the question this answers is the one the scanner exists
 * for and the diary cannot show: across everything you logged, what did it come to,
 * what was the best of it, what was the worst, and what is the pattern underneath.
 *
 * The rule the whole file follows: never average away an item that has no grade.
 * A home-cooked meal is not a bad product, it is an unmeasured one, and folding it in
 * either way would be an invention.
 */

export type GradedItem = {
  id: string;
  name: string;
  grade: ProductLetterGrade;
  score: number;
  loggedAt: string;
};

export type RoleBurden = {
  role: IngredientRole;
  label: string;
  /** Distinct logged products this role appeared in. */
  products: string[];
};

export type FoodQualityReview = {
  /** Every logged item that carries a score, worst first — the useful end. */
  graded: GradedItem[];
  /** Items logged without one. Counted and named, never folded into the average. */
  ungradedCount: number;
  distribution: Array<{ grade: ProductLetterGrade; count: number; share: number }>;
  /** Mean of the graded items only, or null when nothing logged carries a grade. */
  average: number | null;
  averageGrade: ProductLetterGrade | null;
  best: GradedItem | null;
  worst: GradedItem | null;
  /** What the lower grades were made of, most widespread first. */
  burdens: RoleBurden[];
  /** True when there is nothing to say yet, so the screen can say that instead. */
  empty: boolean;
};

/** The roles worth naming back to someone. Water and salt are not findings. */
const BURDEN_LABELS: Partial<Record<IngredientRole, string>> = {
  added_sugar: 'Added sugar',
  seed_oil: 'Refined seed oils',
  industrial_fat: 'Hydrogenated fats',
  refined_starch: 'Refined starches',
  flavor_system: 'Flavour systems',
  color: 'Added colours',
  isolate: 'Isolated proteins and fibres',
  high_intensity_sweetener: 'High-intensity sweeteners'
};

const GRADE_ORDER: ProductLetterGrade[] = ['A', 'B', 'C', 'D', 'F'];

export type ReviewItemInput = {
  id: string;
  name: string;
  quality_score?: number | null;
  logged_at: string;
  /** Used to find the product's ingredient list, when it came from a scan. */
  barcode?: string | null;
};

export type ReviewProductInput = {
  barcode: string | null;
  name: string;
  ingredients_text: string | null;
};

/**
 * A role counts as a burden only where it leads or nearly leads the list.
 *
 * Every packaged food contains something on the list somewhere. Naming all of them
 * would produce the same four findings for every person forever, which is the failure
 * the old page had in a different costume. Position is the filter: an oil in second
 * place is what the product is made of, and one in eleventh is a trace.
 */
const LEADING_POSITIONS = 4;

export function buildFoodQualityReview(params: {
  items: ReviewItemInput[];
  products: ReviewProductInput[];
}): FoodQualityReview {
  const graded: GradedItem[] = [];
  let ungradedCount = 0;

  for (const item of params.items) {
    const score = typeof item.quality_score === 'number' && Number.isFinite(item.quality_score)
      ? item.quality_score
      : null;
    if (score === null) {
      ungradedCount += 1;
      continue;
    }
    graded.push({
      id: item.id,
      name: item.name,
      grade: productLetterGrade(score),
      score,
      loggedAt: item.logged_at
    });
  }

  graded.sort((left, right) => left.score - right.score);

  const distribution = GRADE_ORDER.map((grade) => {
    const count = graded.filter((item) => item.grade === grade).length;
    return { grade, count, share: graded.length === 0 ? 0 : count / graded.length };
  });

  const average = graded.length === 0
    ? null
    : Math.round(graded.reduce((sum, item) => sum + item.score, 0) / graded.length);

  /**
   * Burdens are read from the products behind the lower-graded items only. A seed oil
   * in something that still scored an A is not what is holding the day back, and
   * listing it would bury the finding that is.
   */
  const byBarcode = new Map(params.products.filter((product) => product.barcode).map((product) => [product.barcode!, product]));
  const found = new Map<IngredientRole, Set<string>>();
  for (const item of params.items) {
    const score = typeof item.quality_score === 'number' ? item.quality_score : null;
    if (score === null || score >= 70) continue;
    const product = item.barcode ? byBarcode.get(item.barcode) : undefined;
    if (!product?.ingredients_text) continue;
    const leading = roleIngredients(splitIngredientList(product.ingredients_text)).slice(0, LEADING_POSITIONS);
    for (const ingredient of leading) {
      if (FOOD_ROLES.has(ingredient.role) || !BURDEN_LABELS[ingredient.role]) continue;
      const bucket = found.get(ingredient.role) ?? new Set<string>();
      bucket.add(product.name);
      found.set(ingredient.role, bucket);
    }
  }

  const burdens: RoleBurden[] = [...found.entries()]
    .map(([role, products]) => ({ role, label: BURDEN_LABELS[role]!, products: [...products] }))
    .sort((left, right) => right.products.length - left.products.length);

  return {
    graded,
    ungradedCount,
    distribution,
    average,
    averageGrade: average === null ? null : productLetterGrade(average),
    best: graded.at(-1) ?? null,
    worst: graded[0] ?? null,
    burdens,
    empty: graded.length === 0
  };
}

/** "3 of 5 things you logged were graded" — the honest denominator, in words. */
export function reviewCoverageLine(review: FoodQualityReview): string {
  const total = review.graded.length + review.ungradedCount;
  if (total === 0) return 'Nothing logged yet.';
  if (review.ungradedCount === 0) {
    return `All ${total} logged ${total === 1 ? 'item carries' : 'items carry'} a grade.`;
  }
  if (review.graded.length === 0) {
    return `Nothing logged carries a grade yet — ${review.ungradedCount} ${review.ungradedCount === 1 ? 'item was' : 'items were'} entered by hand or cooked.`;
  }
  const other = review.ungradedCount === 1
    ? 'the other one was entered by hand or cooked'
    : `the other ${review.ungradedCount} were entered by hand or cooked`;
  return `${review.graded.length} of ${total} logged items carry a grade; ${other}, and ${review.ungradedCount === 1 ? 'is' : 'are'} not averaged in.`;
}
