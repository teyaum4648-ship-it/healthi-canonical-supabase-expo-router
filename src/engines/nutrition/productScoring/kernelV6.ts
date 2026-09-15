import type { ProductArchetype } from './archetypes';
import type {
  ProductDimensionContribution,
  ProductDimensionScore,
  ProductScoreDimension,
  ProductScoreDimensionId
} from './dimensions';
import type { DataConfidence, ProductNutrientBasis, ProductScoringInput } from './engine';
import {
  FOOD_ROLES,
  FORMULATION_ROLES,
  roleIngredients,
  type IngredientRole,
  type RoledIngredient
} from './ingredientRoles';
import { parseIngredients } from './ingredientParser';

/**
 * Product Quality V6 — scored on what a product is made of.
 *
 * The kernel it replaces asked, for each dimension, whether anything objectionable was
 * present, and started every answer near the top. A can of lemon-lime soda scored 91
 * for ingredient integrity, 93 for formulation burden and 78 for *food structure*,
 * because it contains no preservatives, no colours and only five ingredients. Four of
 * the five dimensions measured the absence of bad things, they carried 62.5% of the
 * weight between them, and sugar water came out at 71 — a C.
 *
 * The change here is not a new set of constants. Every dimension now starts from what
 * the product is made of and adds, rather than starting at a hundred and subtracting.
 * A product made of food scores well because it is made of food; a product made of
 * sweetener, refined starch and a flavour system scores badly because that is what it
 * is, however short its list and however few additives it carries.
 *
 * Three consequences worth stating because they are deliberate:
 *
 * A whole food needs no defence. One intact ingredient is scored confidently across
 * every dimension rather than abstaining for want of a formulation to judge — the old
 * kernel could not grade a blueberry at all, because three dimensions found nothing to
 * say and the eligibility gate then refused a score.
 *
 * Fat is judged by source, not by saturation. Avocado oil, olive oil, butter and
 * coconut are food; canola, soybean and unnamed "vegetable oil" are a processing
 * input. `saturated_fat_g` cannot tell those apart, so it is not what decides.
 *
 * Sodium and sugar are read against what the product is for. A sauce is salty because
 * sauces are; a drink has no reason to carry sugar at all.
 */

export const PRODUCT_QUALITY_V6_DIMENSION_WEIGHTS: Record<ProductScoreDimensionId, number> = {
  ingredient_integrity: 0.22,
  food_structure: 0.13,
  category_nutrition_fit: 0.3,
  processing_purpose: 0.18,
  formulation_burden: 0.17
};

type EvidenceState = ProductScoreDimension['evidenceState'];

type Assessment = {
  score: number | null;
  confidence: DataConfidence;
  evidence: string[];
  evidenceFields: string[];
  evidenceState: EvidenceState;
  anchor: ProductScoreDimension['anchor'];
  positive: ProductDimensionContribution[];
  negative: ProductDimensionContribution[];
  missing: string[];
};

const clamp = (value: number, low = 0, high = 100): number => Math.max(low, Math.min(high, value));
const rounded = (value: number): number => Math.round(clamp(value));
const unique = (values: string[]): string[] => [...new Set(values)];
const finite = (value: number | null | undefined): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

/** Present because the recipe needs it, and carrying no nutritional claim either way. */
const PASSIVE_ROLES: ReadonlySet<IngredientRole> = new Set(['neutral', 'fortificant']);

/**
 * How much food each role is, on a scale where an intact ingredient is one.
 *
 * A gradient rather than a yes or no, because most of the shelf lives between the two.
 * White flour is not a blueberry, but it is not a colour either — it is a food with its
 * structure milled out, and a pancake mix built on it is ordinary rather than ruinous.
 * Reading it as "not food" was what collapsed the middle of the scale: every everyday
 * staple fell to the bottom alongside sweets.
 */
const FOOD_VALUE: Record<IngredientRole, number> = {
  whole_food: 1,
  culinary_fat: 0.9,
  refined_starch: 0.68,
  isolate: 0.4,
  seed_oil: 0.4,
  texturizer: 0.25,
  preservative: 0.15,
  added_sugar: 0.1,
  sugar_alcohol: 0.1,
  industrial_fat: 0.05,
  high_intensity_sweetener: 0.05,
  flavor_system: 0.05,
  color: 0,
  // Neither credited nor punished; an unrecognised name should not decide a grade.
  unknown: 0.55,
  neutral: 0,
  fortificant: 0
};

type Composition = {
  ingredients: RoledIngredient[];
  /** Position-weighted food value across the list, on the gradient above. */
  foodValue: number;
  /** Share of the product that is unambiguously food, used where the line is binary. */
  foodShare: number;
  /** Share that exists to constitute the product rather than to feed anyone. */
  formulationShare: number;
  unknownShare: number;
  /** The first ingredient that is not water, salt or a vitamin: what this mostly is. */
  leadRole: IngredientRole;
  roles: Set<IngredientRole>;
  count: number;
};

function composition(names: string[]): Composition {
  const ingredients = roleIngredients(names);
  const active = ingredients.filter((ingredient) => !PASSIVE_ROLES.has(ingredient.role));
  const activeWeight = active.reduce((sum, ingredient) => sum + ingredient.weight, 0);
  const share = (roles: ReadonlySet<IngredientRole>): number => activeWeight === 0
    ? 0
    : active.filter((item) => roles.has(item.role)).reduce((sum, item) => sum + item.weight, 0) / activeWeight;

  const foodValue = activeWeight === 0
    ? 0
    : active.reduce((sum, item) => sum + FOOD_VALUE[item.role] * item.weight, 0) / activeWeight;

  return {
    ingredients,
    foodValue,
    foodShare: share(FOOD_ROLES),
    formulationShare: share(FORMULATION_ROLES),
    unknownShare: activeWeight === 0 ? 0 : active.filter((item) => item.role === 'unknown').reduce((sum, item) => sum + item.weight, 0) / activeWeight,
    leadRole: active[0]?.role ?? 'unknown',
    roles: new Set(ingredients.map((ingredient) => ingredient.role)),
    count: ingredients.length
  };
}

/** Calories a gram of each macronutrient carries, for reading a label as proportions. */
const KCAL = { carb: 4, protein: 4, fat: 9 } as const;

type NutritionRead = {
  calories: number | null;
  /** Share of calories coming from sugar the product did not grow with. */
  addedSugarShare: number | null;
  /** Share from all sugar, which is what matters when added sugar is not declared. */
  sugarShare: number | null;
  proteinShare: number | null;
  /** Share of calories from fat, which says how much of the product the oil is. */
  fatShare: number | null;
  fiberPer100kcal: number | null;
  sodiumPerKcal: number | null;
  known: boolean;
};

function readNutrition(basis: ProductNutrientBasis): NutritionRead {
  const nutrients = basis.nutrients;
  const calories = finite(nutrients.calories);
  const sugar = finite(nutrients.sugar_g);
  const addedSugar = finite(nutrients.added_sugar_g);
  const protein = finite(nutrients.protein_g);
  const fiber = finite(nutrients.fiber_g);
  const sodium = finite(nutrients.sodium_mg);
  const usable = calories !== null && calories > 0;

  return {
    calories,
    addedSugarShare: usable && addedSugar !== null ? clamp((addedSugar * KCAL.carb) / calories, 0, 1) : null,
    sugarShare: usable && sugar !== null ? clamp((sugar * KCAL.carb) / calories, 0, 1) : null,
    proteinShare: usable && protein !== null ? clamp((protein * KCAL.protein) / calories, 0, 1) : null,
    fatShare: usable && finite(nutrients.fat_g) !== null ? clamp((finite(nutrients.fat_g)! * KCAL.fat) / calories, 0, 1) : null,
    fiberPer100kcal: usable && fiber !== null ? (fiber / calories) * 100 : null,
    sodiumPerKcal: usable && sodium !== null ? sodium / calories : null,
    known: usable
  };
}

const note = (ruleId: string, label: string, delta: number, evidence: string[] = []): ProductDimensionContribution => ({
  ruleId,
  label,
  delta: Math.round(delta * 10) / 10,
  evidence,
  effect: 'score_contribution'
});

/**
 * How much of this is food.
 *
 * Position-weighted, because an ingredient list is ordered by mass and that ordering is
 * the only quantity information most labels carry. Water and salt are set aside rather
 * than counted against: a canned bean is not less of a food for being packed in water.
 */
function ingredientIntegrity(parts: Composition, confidence: DataConfidence): Assessment {
  if (parts.count === 0) {
    return {
      score: null, confidence: 'low', evidence: [], evidenceFields: ['ingredients_text'],
      evidenceState: 'unsupported', anchor: null, positive: [], negative: [], missing: ['ingredients_text']
    };
  }

  // An intact ingredient list has nothing held against it; the curve reaches 100 there.
  const score = parts.foodValue >= 0.98 ? 100 : 10 + parts.foodValue * 88;
  const positive = parts.foodValue > 0.6
    ? [note('v6_food_share', `${Math.round(parts.foodValue * 100)}% of this, by position, reads as food`, parts.foodValue * 90)]
    : [];
  const negative = parts.foodValue < 0.75
    ? [note('v6_formulation_share', `Only ${Math.round(parts.foodValue * 100)}% of this, by position, reads as food`, -(1 - parts.foodValue) * 90)]
    : [];

  return {
    score: rounded(score),
    confidence,
    evidence: [`food_share:${parts.foodShare.toFixed(2)}`, `lead:${parts.leadRole}`],
    evidenceFields: ['ingredients_text'],
    evidenceState: parts.foodShare >= 0.6 ? 'positive_evidence' : parts.foodShare <= 0.3 ? 'negative_evidence' : 'mixed',
    anchor: { ruleId: 'v6_ingredient_identity', label: 'What the product is made of', score: rounded(score), evidence: [] },
    positive,
    negative,
    missing: parts.unknownShare > 0.15 ? ['ingredient_identity'] : []
  };
}

/** How intact the food arrives: what a mill, a press or an extruder did to it. */
function foodStructure(
  parts: Composition,
  nutrition: NutritionRead,
  archetype: ProductArchetype,
  confidence: DataConfidence
): Assessment {
  if (parts.count === 0) {
    return {
      score: null, confidence: 'low', evidence: [], evidenceFields: ['ingredients_text'],
      evidenceState: 'unsupported', anchor: null, positive: [], negative: [], missing: ['ingredients_text']
    };
  }

  const STRUCTURE_BY_LEAD: Partial<Record<IngredientRole, number>> = {
    whole_food: 92,
    culinary_fat: 62,
    refined_starch: 50,
    isolate: 34,
    added_sugar: 8,
    high_intensity_sweetener: 8,
    sugar_alcohol: 10,
    seed_oil: 18,
    industrial_fat: 10,
    flavor_system: 8,
    color: 8
  };
  let score = STRUCTURE_BY_LEAD[parts.leadRole] ?? 45;

  // Structure is a property of the whole product, not only of its first ingredient.
  score -= parts.formulationShare * 28;
  if (parts.roles.has('refined_starch') && parts.leadRole === 'whole_food') score -= 10;

  /**
   * A dressing is not a failed vegetable. Sauces and condiments have no intact form to
   * lose, so scoring them on structure at all was punishing them for being what they
   * are — a caesar dressing came out at 1 out of 100, below a marshmallow. The question
   * is answered for them at a neutral middle, and their sugar, salt and fat source are
   * left to the dimensions that can actually read them.
   */
  if (archetype.intent === 'condiment') score = 45 + (score - 45) * 0.35;

  /**
   * Fibre is the measurable trace of intact structure. A fruit dried into a raisin
   * keeps some of it; a fruit pressed into juice keeps none, and the sugar is what is
   * left — so a sugar-dense product with no fibre reads as structure that was removed.
   */
  if (nutrition.fiberPer100kcal !== null) {
    if (nutrition.fiberPer100kcal >= 2.5) score += 8;
    else if (nutrition.fiberPer100kcal < 0.5 && (nutrition.sugarShare ?? 0) > 0.5) score -= 12;
  }

  return {
    score: rounded(score),
    confidence,
    evidence: [`lead:${parts.leadRole}`, `formulation_share:${parts.formulationShare.toFixed(2)}`],
    evidenceFields: ['ingredients_text', 'fiber_g'],
    evidenceState: score >= 70 ? 'positive_evidence' : score <= 35 ? 'negative_evidence' : 'mixed',
    anchor: { ruleId: 'v6_structure', label: 'How intact the food is', score: rounded(score), evidence: [] },
    positive: score >= 70 ? [note('v6_structure_intact', 'Arrives close to the form it grew in', score - 45)] : [],
    negative: score < 45 ? [note('v6_structure_rebuilt', 'Rebuilt from fractions rather than kept whole', score - 45)] : [],
    missing: []
  };
}

/**
 * Nutrition, read against what the product is for.
 *
 * Sugar is judged by the share of calories it carries rather than by grams, so a drink
 * and a cracker are compared on the same terms. Fat is judged by the source named in
 * the ingredients, because saturation alone cannot separate butter from shortening.
 */
function nutrition(
  parts: Composition,
  read: NutritionRead,
  archetype: ProductArchetype
): Assessment {
  if (!read.known) {
    return {
      score: null, confidence: 'low', evidence: [], evidenceFields: ['calories'],
      evidenceState: 'unsupported', anchor: null, positive: [], negative: [], missing: ['nutrition_panel']
    };
  }

  const beverage = archetype.form === 'beverage';
  /**
   * A condiment is measured per 100 g like everything else, but nobody eats 100 g of
   * barbecue sauce. Reading its label as a meal is what drove ordinary sauces and
   * dressings into F — worse than the soda they sit next to in the fridge. The sugar
   * and salt are still counted, at the weight a spoonful deserves.
   */
  const spoonful = archetype.intent === 'condiment';
  const positive: ProductDimensionContribution[] = [];
  const negative: ProductDimensionContribution[] = [];
  let score = 62;

  /**
   * Added sugar. A drink is held to a harder line than a food: nobody needs a beverage
   * to carry calories, so sugar in one is the whole product rather than part of it.
   */
  const sweetShare = read.addedSugarShare ?? (parts.roles.has('added_sugar') ? read.sugarShare : 0) ?? 0;
  if (sweetShare > 0.02) {
    const ceiling = beverage ? 54 : spoonful ? 22 : 42;
    const penalty = ceiling * Math.min(1, sweetShare / 0.55);
    score -= penalty;
    negative.push(note('v6_added_sugar', `${Math.round(sweetShare * 100)}% of the calories are added sugar`, -penalty));
  }

  if (read.proteinShare !== null && read.proteinShare > 0.12) {
    const gain = Math.min(18, (read.proteinShare - 0.12) * 60);
    score += gain;
    positive.push(note('v6_protein', 'Carries real protein for its calories', gain));
  }

  if (read.fiberPer100kcal !== null && read.fiberPer100kcal >= 1.2) {
    const gain = Math.min(16, (read.fiberPer100kcal - 1.2) * 4.5);
    score += gain;
    positive.push(note('v6_fiber', 'Fibre in proportion to its calories', gain));
  }

  /**
   * Fat by source. The ingredient list says which fat this is; the saturated-fat figure
   * only says how much of it is saturated, which is a different question and not the
   * one that separates an avocado oil from a canola oil.
   */
  if (parts.roles.has('industrial_fat')) {
    score -= 20;
    negative.push(note('v6_industrial_fat', 'Built on a hydrogenated or interesterified fat', -20));
  } else if (parts.roles.has('seed_oil')) {
    /**
     * Scaled by how much of the product the oil actually is.
     *
     * Being a condiment is not a defence here. A caesar dressing is ninety-odd percent
     * soybean oil by calories — the oil is not an ingredient in the product, it is the
     * product — and softening the rule for it was the kernel deciding that a thing used
     * by the spoonful cannot be mostly seed oil. Portion still softens sugar and salt
     * below, where how much you eat genuinely changes the answer; it does not soften
     * what the product is made of.
     */
    const fatShare = read.fatShare ?? 0.3;
    const penalty = 38 * Math.min(1, fatShare / 0.5);
    score -= penalty;
    negative.push(note('v6_seed_oil', 'Built on an industrially refined seed oil', -penalty));
  } else if (parts.roles.has('culinary_fat')) {
    score += 5;
    positive.push(note('v6_culinary_fat', 'The fat here is a traditional culinary one', 5));
  }

  /** Sodium against calories, so a low-calorie sauce is not flattered by its portion. */
  if (read.sodiumPerKcal !== null) {
    const generous = spoonful ? 9 : archetype.intent === 'staple' ? 3.2 : 2.2;
    if (read.sodiumPerKcal > generous) {
      const penalty = Math.min(14, (read.sodiumPerKcal - generous) * 4);
      score -= penalty;
      negative.push(note('v6_sodium', 'Salt heavy for the calories it carries', -penalty));
    }
  }

  return {
    score: rounded(score),
    confidence: 'high',
    evidence: [`sweet_share:${sweetShare.toFixed(2)}`, `beverage:${beverage}`],
    evidenceFields: ['calories', 'sugar_g', 'added_sugar_g', 'protein_g', 'fiber_g', 'sodium_mg'],
    evidenceState: score >= 70 ? 'positive_evidence' : score <= 40 ? 'negative_evidence' : 'mixed',
    anchor: { ruleId: 'v6_nutrition', label: 'What the label delivers', score: rounded(score), evidence: [] },
    positive,
    negative,
    missing: read.addedSugarShare === null ? ['added_sugar_g'] : []
  };
}

/** Whether the processing serves the food or stands in for it. */
function processingPurpose(
  parts: Composition,
  archetype: ProductArchetype,
  confidence: DataConfidence
): Assessment {
  if (parts.count === 0) {
    return {
      score: null, confidence: 'low', evidence: [], evidenceFields: ['ingredients_text'],
      evidenceState: 'unsupported', anchor: null, positive: [], negative: [], missing: ['ingredients_text']
    };
  }

  let score = 26 + parts.foodValue * 66;
  const negative: ProductDimensionContribution[] = [];

  /**
   * Reconstruction: a product assembled from a refined carbohydrate, a fraction of a
   * protein and a flavour that supplies the taste the food no longer has. Each of these
   * alone is ordinary; together they describe something built rather than cooked.
   */
  const rebuilt = ['refined_starch', 'isolate', 'flavor_system', 'color'].filter((role) => parts.roles.has(role as IngredientRole));
  if (rebuilt.length >= 2) {
    const penalty = 8 + rebuilt.length * 5;
    score -= penalty;
    negative.push(note('v6_reconstruction', 'Assembled from refined parts with the taste added back', -penalty));
  }
  if (parts.roles.has('industrial_fat')) {
    score -= 10;
    negative.push(note('v6_industrial_processing', 'Uses a fat that only industry makes', -10));
  }

  /**
   * Purpose is deliberately not read here.
   *
   * The obvious move is to judge a snack harder than a staple — the same refined flour
   * is a different proposition in a pancake mix and in a flavoured cracker. It was
   * tried and removed: the upstream archetype calls cinnamon toaster squares a staple
   * and whole-grain crackers a snack, so an adjustment hung on it moved those two the
   * wrong way and cost more than it paid. Composition and the label are read directly
   * and are reliable; intent is not, yet. See docs/product-scoring-calibration.md.
   */

  /**
   * Nothing was done to this. A single intact ingredient has no processing to justify,
   * so it is not held at the middle of a scale built for formulations.
   */
  if (parts.foodValue >= 0.98 && parts.count <= 2) score = Math.max(score, 96);

  return {
    score: rounded(score),
    confidence,
    evidence: [`rebuilt:${rebuilt.join('+') || 'none'}`],
    evidenceFields: ['ingredients_text'],
    evidenceState: score >= 70 ? 'positive_evidence' : score <= 40 ? 'negative_evidence' : 'mixed',
    anchor: { ruleId: 'v6_processing', label: 'What the processing is for', score: rounded(score), evidence: [] },
    positive: parts.foodValue > 0.7 ? [note('v6_processing_light', 'Processing serves the food rather than replacing it', 30)] : [],
    negative,
    missing: []
  };
}

/** The additive load, which is a real cost but a smaller one than what the product is. */
function formulationBurden(parts: Composition, confidence: DataConfidence): Assessment {
  if (parts.count === 0) {
    return {
      score: null, confidence: 'low', evidence: [], evidenceFields: ['ingredients_text'],
      evidenceState: 'unsupported', anchor: null, positive: [], negative: [], missing: ['ingredients_text']
    };
  }

  const counts = (role: IngredientRole): number => parts.ingredients.filter((item) => item.role === role).length;
  const colors = counts('color');
  const flavors = counts('flavor_system');
  const preservatives = counts('preservative');
  const texturizers = counts('texturizer');
  const sweeteners = counts('high_intensity_sweetener') + counts('sugar_alcohol');

  let score = 100;
  const negative: ProductDimensionContribution[] = [];
  const charge = (amount: number, ruleId: string, label: string) => {
    if (amount <= 0) return;
    score -= amount;
    negative.push(note(ruleId, label, -amount));
  };

  charge(colors * 11, 'v6_colors', colors === 1 ? 'Carries an added colour' : `Carries ${colors} added colours`);
  charge(flavors * 9, 'v6_flavors', 'Taste supplied by a flavour system');
  charge(preservatives * 7, 'v6_preservatives', 'Shelf life bought with preservatives');
  charge(Math.max(0, texturizers - 1) * 5, 'v6_texturizers', 'Texture built from gums and emulsifiers');
  charge(sweeteners * 8, 'v6_sweeteners', 'Sweetness without sugar, from a sweetener system');

  return {
    score: rounded(score),
    confidence,
    evidence: [`colors:${colors}`, `flavors:${flavors}`, `preservatives:${preservatives}`],
    evidenceFields: ['ingredients_text'],
    evidenceState: score >= 90 ? 'supported_absence' : 'negative_evidence',
    anchor: { ruleId: 'v6_formulation', label: 'Additive load', score: rounded(score), evidence: [] },
    positive: score >= 95 ? [note('v6_clean', 'Nothing here is doing a cosmetic job', 0)] : [],
    negative,
    missing: []
  };
}

function buildDimension(
  id: ProductScoreDimensionId,
  label: string,
  value: Assessment
): ProductScoreDimension {
  return {
    id,
    label,
    score: value.score,
    weight: PRODUCT_QUALITY_V6_DIMENSION_WEIGHTS[id],
    effectiveWeight: 0,
    contribution: 0,
    confidence: value.confidence,
    evidence: unique(value.evidence),
    evidenceFields: unique(value.evidenceFields),
    evidenceState: value.score === null ? 'unsupported' : value.evidenceState,
    anchor: value.score === null ? null : value.anchor,
    rulesEvaluated: unique([...(value.anchor ? [value.anchor.ruleId] : [])]),
    rulesFired: unique([...(value.anchor ? [value.anchor.ruleId] : []), ...value.positive.map((item) => item.ruleId), ...value.negative.map((item) => item.ruleId)]),
    rulesSuppressed: [],
    positiveContributions: value.positive,
    negativeContributions: value.negative,
    missingEvidence: unique(value.missing),
    range: null
  };
}

function rangeFor(dimension: ProductScoreDimension): [number, number] {
  const spread = dimension.confidence === 'high' ? 4 : dimension.confidence === 'medium' ? 9 : 16;
  const missingSpread = Math.min(8, dimension.missingEvidence.length * 2);
  return [rounded((dimension.score ?? 0) - spread - missingSpread), rounded((dimension.score ?? 0) + spread + missingSpread)];
}

export function scoreProductDimensionsV6(params: {
  input: ProductScoringInput;
  archetype: ProductArchetype;
  basis: ProductNutrientBasis;
  sourceConfidence: DataConfidence;
}): ProductDimensionScore {
  const { input, archetype, basis, sourceConfidence } = params;
  const parsed = parseIngredients(input.ingredientsText, input.ingredientEvidenceStatus ?? 'unknown');
  const parts = composition(parsed.topLevelIngredients);
  const read = readNutrition(basis);

  const dimensions = [
    buildDimension('ingredient_integrity', 'Ingredient integrity', ingredientIntegrity(parts, sourceConfidence)),
    buildDimension('formulation_burden', 'Additives and formulation', formulationBurden(parts, sourceConfidence)),
    buildDimension('category_nutrition_fit', 'Nutrition profile', nutrition(parts, read, archetype)),
    buildDimension('food_structure', 'Food structure', foodStructure(parts, read, archetype, sourceConfidence)),
    buildDimension('processing_purpose', 'Processing profile', processingPurpose(parts, archetype, sourceConfidence))
  ];

  const supported = dimensions.filter((dimension) => dimension.score !== null);
  const supportedWeight = Math.round(supported.reduce((sum, dimension) => sum + dimension.weight, 0) * 10000) / 10000;
  const unknownWeight = Math.max(0, Math.round((1 - supportedWeight) * 10000) / 10000);
  const materialUnknownDimensions = dimensions
    .filter((dimension) => dimension.score === null && dimension.weight >= 0.15)
    .map((dimension) => dimension.id);
  const scoreScope = supportedWeight >= 0.85 && materialUnknownDimensions.length === 0
    ? 'overall' as const
    : 'supported_evidence' as const;
  const aggregation: ProductDimensionScore['aggregation'] = {
    method: 'conditional_supported_evidence_with_unknown_interval',
    formula: 'sum(weight * supported score) / supported weight',
    supportedWeightedSum: 0,
    supportedWeight,
    unknownWeight,
    supportedDimensionCount: supported.length,
    conditionalCentralScore: null,
    scoreScope,
    materialUnknownDimensions
  };

  if (supported.length === 0 || supportedWeight === 0) {
    return { score: null, range: null, dimensions, supportedWeight, scoreScope, aggregation };
  }

  for (const dimension of supported) {
    dimension.effectiveWeight = dimension.weight / supportedWeight;
    dimension.contribution = dimension.score! * dimension.effectiveWeight;
    dimension.range = rangeFor(dimension);
  }

  const central = rounded(supported.reduce((sum, dimension) => sum + dimension.contribution, 0));
  const supportedWeightedSum = supported.reduce((sum, dimension) => sum + dimension.score! * dimension.weight, 0);
  const conflictSpread = input.evidenceContext?.providerConflict || input.evidenceContext?.ingredientConflict ? 6 : 0;
  const low = rounded(supported.reduce((sum, dimension) => sum + dimension.range![0] * dimension.weight, 0) - conflictSpread);
  const high = rounded(supported.reduce((sum, dimension) => sum + dimension.range![1] * dimension.weight, 0) + unknownWeight * 100 + conflictSpread);

  return {
    score: central,
    range: [Math.min(low, central), Math.max(high, central)],
    dimensions,
    supportedWeight,
    scoreScope,
    aggregation: {
      ...aggregation,
      supportedWeightedSum: Math.round(supportedWeightedSum * 10) / 10,
      conditionalCentralScore: central
    }
  };
}
