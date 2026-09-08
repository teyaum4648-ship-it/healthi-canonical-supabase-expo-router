import { PRODUCT_CATEGORIES, type ProductCategory, type ProductForm } from './categories';
import { parseIngredients } from './ingredientParser';

export type CategoryEvidenceSource =
  | 'explicit'
  | 'provider_specific'
  | 'provider_product_form'
  | 'ingredient_form_pattern'
  | 'product_name'
  | 'ingredient_token'
  | 'provider_broad';

export type CategoryEvidenceLevel =
  | 'exact_product_category'
  | 'product_form_and_use'
  | 'composition'
  | 'product_name_context'
  | 'individual_ingredient_token';

export type CategoryContradictionLevel =
  | 'compatible'
  | 'weak_disagreement'
  | 'material_contradiction'
  | 'unsafe_narrow_classification';

export type CategoryCompatibilityStatus = 'compatible' | 'limited' | 'incompatible';

export type CategoryEvidence = {
  source: CategoryEvidenceSource;
  value: string;
  weight: number;
  specificity: 'exact' | 'specific' | 'broad' | 'incidental';
  detail: string;
  level: CategoryEvidenceLevel;
  evidenceType: string;
  precedence: number;
  positiveSignals: string[];
  contradictorySignals: string[];
};

export type CategoryCandidate = {
  categoryId: string;
  categoryLabel: string;
  productForm: ProductForm;
  score: number;
  confidence: 'low' | 'medium' | 'high';
  evidence: CategoryEvidence[];
  suppressions: string[];
  positiveSignals: string[];
  contradictorySignals: string[];
  contradictionLevel: CategoryContradictionLevel;
  compatibilityStatus: CategoryCompatibilityStatus;
  compatibilitySignals: string[];
  incompatibilitySignals: string[];
  precedence: number;
  selected: boolean;
  selectionReason: string | null;
  rejectionReason: string | null;
};

export type CategoryResolution = {
  selected: ProductCategory | null;
  selectedCategoryId: string | null;
  selectedCategoryLabel: string | null;
  productForm: ProductForm | null;
  candidates: CategoryCandidate[];
  conflicts: string[];
  contradictionLevel: CategoryContradictionLevel;
  selectionReason: string;
  interpretationConfidence: 'low' | 'medium' | 'high';
};

export type CategoryResolutionInput = {
  name: string;
  explicitCategory?: string | null;
  categoryTags?: string[];
  ingredientsText?: string | null;
  ingredientEvidenceStatus?: 'complete' | 'partial' | 'reconstructed' | 'absent';
  servingNutrients?: { fiber_g?: number | null };
};

const TOKEN_VARIANTS: Record<string, string> = {
  bars: 'bar', beverages: 'beverage', breads: 'bread', breasts: 'breast', chips: 'chip', chocolates: 'chocolate', cookies: 'cookie',
  cereals: 'cereal', colas: 'cola', crackers: 'cracker', creams: 'cream', crisps: 'crisp', desserts: 'dessert', drinks: 'drink',
  meats: 'meat', milks: 'milk', pastas: 'pasta', powders: 'powder', puffs: 'puff', sauces: 'sauce',
  sodas: 'soda', soups: 'soup', snacks: 'snack', waters: 'water', yogurts: 'yogurt'
};

const GENERIC_FORM_KEYWORDS = new Set(['chip', 'crisp', 'puff', 'soda', 'soft drink', 'cereal', 'salt', 'sauce', 'condiment', 'frozen dessert']);

const EVIDENCE_PRECEDENCE: Record<CategoryEvidenceLevel, number> = {
  exact_product_category: 500,
  product_form_and_use: 400,
  composition: 300,
  product_name_context: 200,
  individual_ingredient_token: 100
};

const COMPATIBLE_CATEGORY_REFINEMENTS = new Set([
  'chips:protein_chip',
  'cereal:cereal_bar',
  'cereal_bar:protein_bar',
  'condiments:marinara',
  'energy_drink:soda',
  'frozen_dairy_dessert:ice_cream',
  'prebiotic_soda:soda',
  'sparkling_water:still_water'
]);

const CATEGORY_REFINEMENT_DIRECTIONS = new Set([
  'protein_chip>chips',
  'cereal_bar>cereal',
  'protein_bar>cereal_bar',
  'marinara>condiments',
  'energy_drink>soda',
  'ice_cream>frozen_dairy_dessert',
  'prebiotic_soda>soda',
  'sparkling_water>still_water'
]);

function normalized(value: string | null | undefined): string {
  const expanded = (value ?? '')
    .toLowerCase()
    .replace(/\b(almond|oat|cashew|coconut)milk\b/g, '$1 milk')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  return expanded.split(/\s+/).filter(Boolean).map((token) => TOKEN_VARIANTS[token] ?? token).join(' ');
}

function hasPhrase(value: string, phrase: string): boolean {
  const haystack = normalized(value);
  const needle = normalized(phrase);
  return Boolean(needle && ` ${haystack} `.includes(` ${needle} `));
}

function anyPhrase(values: string[], phrases: string[]): boolean {
  return values.some((value) => phrases.some((phrase) => hasPhrase(value, phrase)));
}

function isBroadKeyword(category: ProductCategory, keyword: string): boolean {
  const normalizedKeyword = normalized(keyword);
  return GENERIC_FORM_KEYWORDS.has(normalizedKeyword) || (
    category.broadKeywords?.some((item) => normalized(item) === normalizedKeyword) ?? false
  );
}

function evidenceLevel(source: CategoryEvidenceSource): CategoryEvidenceLevel {
  if (source === 'explicit' || source === 'provider_specific') return 'exact_product_category';
  if (source === 'provider_product_form') return 'product_form_and_use';
  if (source === 'ingredient_form_pattern' || source === 'provider_broad') return 'composition';
  if (source === 'ingredient_token') return 'individual_ingredient_token';
  return 'product_name_context';
}

function evidenceRecord(
  source: CategoryEvidenceSource,
  value: string,
  weight: number,
  specificity: CategoryEvidence['specificity'],
  detail: string,
  evidenceType?: string
): CategoryEvidence {
  const level = evidenceLevel(source);
  return {
    source,
    value,
    weight,
    specificity,
    detail,
    level,
    evidenceType: evidenceType ?? source,
    precedence: EVIDENCE_PRECEDENCE[level],
    positiveSignals: [detail],
    contradictorySignals: []
  };
}

function isProductTypeTag(tag: string, keyword: string): boolean {
  const normalizedTag = normalized(tag);
  const normalizedKeyword = normalized(keyword);
  if (normalizedTag === normalizedKeyword) return true;
  const tagTokens = normalizedTag.split(' ');
  // Provider taxonomy groupings such as "cereals and potatoes" are parent
  // composition context, not declarations of the package's product form.
  // Keep them below direct form tags even when they start or end with a
  // category keyword.
  if (tagTokens.includes('and') || tagTokens.includes('or')) return false;
  return tagTokens.length <= 4 && (
    normalizedTag.endsWith(` ${normalizedKeyword}`)
  );
}

function categoriesCompatible(left: CategoryCandidate, right: CategoryCandidate): boolean {
  if (left.categoryId === right.categoryId) return true;
  const pair = [left.categoryId, right.categoryId].sort().join(':');
  return COMPATIBLE_CATEGORY_REFINEMENTS.has(pair);
}

function isCategoryRefinement(candidate: CategoryCandidate, parent: CategoryCandidate): boolean {
  return CATEGORY_REFINEMENT_DIRECTIONS.has(`${candidate.categoryId}>${parent.categoryId}`);
}

type ProviderProductRole = 'beverage' | 'snack' | 'meal' | 'condiment' | 'dessert' | 'pantry' | 'powder';

const PROVIDER_ROLE_PATTERNS: Array<{ role: ProviderProductRole; pattern: RegExp }> = [
  { role: 'beverage', pattern: /\b(beverage|drink|water|soda|cola|juice|shake)\b/ },
  { role: 'snack', pattern: /\b(snack|chip|crisp|cracker|bar|cookie)\b/ },
  { role: 'meal', pattern: /\b(meal|entree|soup|pasta|prepared food)\b/ },
  { role: 'condiment', pattern: /\b(condiment|sauce|dressing|spread)\b/ },
  { role: 'dessert', pattern: /\b(dessert|ice cream|confection)\b/ },
  { role: 'pantry', pattern: /\b(pantry|staple|salt|spice|seasoning|oil|flour|sugar)\b/ },
  { role: 'powder', pattern: /\b(powder|dry mix)\b/ }
];

function providerProductRoles(tags: string[]): Set<ProviderProductRole> {
  const productLevelTags = tags.filter((tag) => {
    const tokens = tag.split(' ');
    return !tokens.includes('and') && !tokens.includes('or') && tokens.length <= 5;
  });
  return new Set(PROVIDER_ROLE_PATTERNS.flatMap(({ role, pattern }) => (
    productLevelTags.some((tag) => pattern.test(tag)) ? [role] : []
  )));
}

function categoryRoleConflict(category: ProductCategory, roles: Set<ProviderProductRole>): string | null {
  if (roles.size === 0) return null;
  if (category.form === 'salt') {
    const incompatible = [...roles].filter((role) => role !== 'pantry');
    return incompatible.length > 0
      ? `Provider product-role evidence identifies ${incompatible.join(', ')} rather than a commodity pantry product.`
      : null;
  }
  if (category.form === 'beverage') {
    return !roles.has('beverage') && (roles.has('snack') || roles.has('meal') || roles.has('condiment') || roles.has('dessert'))
      ? 'Provider product-role evidence is incompatible with a beverage form.'
      : null;
  }
  if (category.form === 'powder_mix') {
    return !roles.has('powder') && roles.has('beverage')
      ? 'Provider product-role evidence identifies a ready-to-drink beverage rather than a powder or dry mix.'
      : null;
  }
  if (category.form === 'ready_to_eat') {
    return roles.has('beverage') && !roles.has('snack') && !roles.has('meal') && !roles.has('dessert')
      ? 'Provider product-role evidence identifies a beverage rather than a ready-to-eat solid.'
      : null;
  }
  if (category.form === 'condiment_or_sauce') {
    return roles.has('beverage') && !roles.has('condiment')
      ? 'Provider product-role evidence identifies a beverage rather than a condiment or sauce.'
      : null;
  }
  if (category.form === 'frozen_dessert') {
    return roles.has('beverage') && !roles.has('dessert')
      ? 'Provider product-role evidence identifies a beverage rather than a frozen dessert.'
      : null;
  }
  return null;
}

function ingredientParts(value: string | null | undefined): string[] {
  return parseIngredients(value).topLevelIngredients.map(normalized).filter(Boolean);
}

function candidateCompatibility(
  category: ProductCategory,
  evidence: CategoryEvidence[],
  input: CategoryResolutionInput,
  tags: string[]
): Pick<CategoryCandidate, 'compatibilityStatus' | 'compatibilitySignals' | 'incompatibilitySignals'> {
  const compatibilitySignals: string[] = [];
  const incompatibilitySignals: string[] = [];
  const roles = providerProductRoles(tags);
  const curated = evidence.some((item) => item.source === 'explicit');
  const productLevelEvidence = evidence.some((item) => (
    item.level === 'exact_product_category' || item.level === 'product_form_and_use' || item.level === 'composition'
  ));
  const roleConflict = curated ? null : categoryRoleConflict(category, roles);
  if (roleConflict) incompatibilitySignals.push(roleConflict);
  else if (roles.size > 0) compatibilitySignals.push(`Compatible provider product role: ${[...roles].sort().join(', ')}.`);

  const ingredients = ingredientParts(input.ingredientsText);
  const matchingIngredientIndexes = ingredients.flatMap((ingredient, index) => (
    category.keywords.some((keyword) => hasPhrase(ingredient, keyword)) ? [index] : []
  ));
  const completeIngredients = input.ingredientEvidenceStatus === 'complete';
  const soleMatchingIngredient = completeIngredients && ingredients.length === 1 && matchingIngredientIndexes[0] === 0;
  const dominantMatchingIngredient = completeIngredients && matchingIngredientIndexes[0] === 0;

  if (curated) {
    compatibilitySignals.push('A curated exact category establishes product-level compatibility.');
  } else if (category.compatibilityMode === 'commodity') {
    if (soleMatchingIngredient) compatibilitySignals.push('The complete ingredient list contains one matching commodity ingredient.');
    else if (dominantMatchingIngredient && productLevelEvidence) {
      compatibilitySignals.push('A dominant matching ingredient is corroborated by product-level category evidence.');
    } else if (completeIngredients && ingredients.length > 1) {
      incompatibilitySignals.push('The matching commodity term is part of a multi-ingredient formulation and is not independently established as the primary product.');
    } else {
      incompatibilitySignals.push('Commodity classification requires a complete sole or dominant matching ingredient plus compatible product-level context.');
    }
  } else if (productLevelEvidence) {
    compatibilitySignals.push('Independent provider or composition evidence supports the product category.');
  } else if (ingredients.length > 0 && !roleConflict) {
    compatibilitySignals.push('Ingredient-list structure provides independent evidence with no incompatible product-form signal.');
  } else if (roles.size > 0 && !roleConflict) {
    compatibilitySignals.push('Provider product-role evidence is compatible with the candidate form.');
  }

  const compatibilityStatus: CategoryCompatibilityStatus = incompatibilitySignals.length > 0
    ? 'incompatible'
    : compatibilitySignals.length > 0
      ? 'compatible'
      : 'limited';
  return { compatibilityStatus, compatibilitySignals, incompatibilitySignals };
}

function addEvidence(
  map: Map<string, CategoryEvidence[]>,
  categoryId: string,
  evidence: CategoryEvidence
): void {
  const current = map.get(categoryId) ?? [];
  if (!current.some((item) => item.source === evidence.source && item.value === evidence.value)) current.push(evidence);
  map.set(categoryId, current);
}

function patternEvidence(input: CategoryResolutionInput): Array<{ categoryId: string; evidence: CategoryEvidence }> {
  const ingredients = normalized(input.ingredientsText);
  const name = normalized(input.name);
  const tags = (input.categoryTags ?? []).map(normalized).filter(Boolean);
  const identityValues = [name, ...tags];
  const evidence: Array<{ categoryId: string; evidence: CategoryEvidence }> = [];
  const push = (categoryId: string, value: string, weight: number, detail: string) => {
    evidence.push({
      categoryId,
      evidence: evidenceRecord(
        'ingredient_form_pattern', value, weight, 'specific', detail, 'multi_signal_composition_pattern'
      )
    });
  };

  const prebioticIngredient = /\b(inulin|chicory root|cassava root fiber|acacia fiber)\b/.test(ingredients);
  const carbonated = hasPhrase(ingredients, 'carbonated water') || anyPhrase(identityValues, ['soda', 'sparkling', 'cola']);
  if (prebioticIngredient && carbonated) {
    const meaningfulFiber = (input.servingNutrients?.fiber_g ?? 0) >= 5;
    push('prebiotic_soda', 'prebiotic ingredient + carbonated beverage pattern', meaningfulFiber ? 89 : 86, meaningfulFiber
      ? 'A named prebiotic ingredient and meaningful serving fiber support the more specific beverage category.'
      : 'A named prebiotic ingredient supports the more specific beverage category.');
  }

  const dairyBase = /\b(cream|milk)\b/.test(ingredients) && /\bsugar\b/.test(ingredients);
  const traditionalIceCream = dairyBase && /\b(egg yolks?|vanilla|cocoa|chocolate)\b/.test(ingredients);
  if (traditionalIceCream && anyPhrase(identityValues, ['ice cream', 'gelato'])) {
    push('ice_cream', 'traditional dairy dessert ingredient pattern', 88, 'Cream or milk with a traditional flavor base supports ice cream over a broad frozen-dessert parent.');
  }
  const formulatedFrozen = dairyBase && /\b(palm oil|corn syrup|mono-? ?and di-?glycerides|artificial flavou?r|artificial colou?r|red 40|yellow 5|yellow 6)\b/.test(ingredients);
  if (formulatedFrozen && anyPhrase(identityValues, ['frozen dairy dessert', 'frozen dessert', 'ice cream cone'])) {
    push('frozen_dairy_dessert', 'formulated frozen-dessert ingredient pattern', 88, 'A dairy base plus a broader formulation system supports frozen dairy dessert.');
  }

  const plantBase = /\b(filtered )?water\b/.test(ingredients) && /\b(almonds?|oats?|cashews?|coconut)\b/.test(ingredients);
  const plantBeverageContext = anyPhrase(identityValues, [
    'almond milk', 'oat milk', 'cashew milk', 'coconut milk', 'plant milk', 'plant based milk',
    'almond beverage', 'oat beverage', 'plant based beverage', 'milk substitute', 'almond based drink', 'oat based drink'
  ]);
  if (plantBase && plantBeverageContext) {
    push('plant_milk', 'water + plant base beverage pattern', 88, 'A water and almond, oat, cashew, or coconut base supports plant milk when provider tags are incomplete.');
  }

  const sauceBase = /\btomato(es)?\b/.test(ingredients) && /\b(olive oil|onion|garlic|basil|oregano)\b/.test(ingredients);
  const condimentContext = anyPhrase(identityValues, ['ketchup', 'mustard', 'mayonnaise', 'mayo', 'dressing', 'condiment']);
  const pastaSauceContext = anyPhrase(identityValues, ['marinara', 'pasta sauce']) || (
    !condimentContext && anyPhrase(identityValues, ['tomato sauce'])
  );
  if (sauceBase && pastaSauceContext) {
    push('marinara', 'tomato + culinary oil/seasoning pattern', 86, 'A tomato, oil, and seasoning pattern supports marinara over a broad sauce category.');
  }

  const electrolyteMineral = /\b(sodium|potassium|magnesium)\b/.test(ingredients);
  const electrolyteContext = anyPhrase(identityValues, ['electrolyte', 'electrolyte powder', 'hydration mix', 'hydration powder', 'drink mix']);
  if (electrolyteMineral && electrolyteContext) {
    push('electrolyte', 'mineral + explicit hydration-mix pattern', 88, 'Named electrolyte minerals plus explicit hydration-mix context support an electrolyte mix.');
  }

  const nonnutritiveSweetener = /\b(aspartame|acesulfame potassium|ace k|sucralose|saccharin)\b/.test(ingredients);
  const sodaIdentity = anyPhrase(identityValues, [
    'artificially sweetened beverage', 'carbonated soft drink', 'diet beverage', 'zero sugar',
    'sugar free', 'diet cola', 'diet soda', 'cola', 'soda', 'soft drink', 'root beer'
  ]);
  if (carbonated && nonnutritiveSweetener && sodaIdentity) {
    push('soda', 'carbonated beverage + nonnutritive sweetener pattern', 88, 'A carbonated beverage with an explicitly declared nonnutritive sweetener supports the soda category when provider tags are broad.');
  }

  const energyIdentity = anyPhrase(identityValues, ['energy drink', 'energy beverage', 'power drink']);
  const energyFormulation = /\bcaffeine\b/.test(ingredients) && (
    /\btaurine\b/.test(ingredients) || energyIdentity
  );
  if (energyIdentity && energyFormulation) {
    push('energy_drink', 'caffeine + explicit energy-beverage pattern', 90, 'Caffeine plus explicit energy-beverage identity supports the energy-drink category.');
  }

  const waterIdentity = anyPhrase(identityValues, ['sparkling water', 'sparkling mineral water', 'carbonated water', 'seltzer']);
  const simpleSparklingWater = hasPhrase(ingredients, 'carbonated water') &&
    !/\b(aspartame|acesulfame potassium|ace k|sucralose|saccharin|stevia|monk fruit|allulose|sugar|syrup|juice concentrate)\b/.test(ingredients);
  if (waterIdentity && simpleSparklingWater) {
    push('sparkling_water', 'simple carbonated-water pattern', 90, 'A simple carbonated-water formulation supports sparkling water rather than soda.');
  }

  const electrolyteBeverageIdentity = anyPhrase(identityValues, [
    'electrolyte beverage', 'electrolyte drink', 'sports drink', 'hydration drink', 'thirst quencher'
  ]);
  const electrolyteSignals = [
    /\b(sodium|salt|sodium citrate)\b/.test(ingredients),
    /\b(potassium|monopotassium phosphate|potassium chloride)\b/.test(ingredients),
    /\b(magnesium|magnesium oxide|magnesium citrate)\b/.test(ingredients),
    /\b(calcium|calcium lactate)\b/.test(ingredients)
  ].filter(Boolean).length;
  const hydrationFormulation = /\bwater\b/.test(ingredients) &&
    /\bcitric acid\b/.test(ingredients) &&
    /\b(stevia|sucralose|acesulfame|colour|color|yellow 5|yellow 6|red 40)\b/.test(ingredients) &&
    !/\b(almonds?|oats?|cashews?|coconut|milk)\b/.test(ingredients);
  if (electrolyteBeverageIdentity && electrolyteSignals >= 1 && /\bwater\b/.test(ingredients)) {
    push('electrolyte_beverage', 'mineral + explicit electrolyte-beverage pattern', 90, 'Named minerals plus explicit hydration-beverage identity support an electrolyte beverage.');
  } else if (electrolyteSignals >= 2 && hydrationFormulation) {
    push('electrolyte_beverage', 'water + multiple electrolyte minerals pattern', 86, 'A water base and multiple named electrolyte minerals support an electrolyte beverage when provider categories are incomplete.');
  }

  const proteinIngredient = /\b(whey|milk protein|protein isolate|pea protein|casein)\b/.test(ingredients);
  if (proteinIngredient && anyPhrase(identityValues, ['protein chip', 'protein puff', 'protein snack'])) {
    push('protein_chip', 'protein ingredient + explicit chip/snack form', 88, 'Protein ingredients and chip form support the protein-snack category.');
  }
  if (anyPhrase(identityValues, ['protein milk shake', 'high protein milk', 'protein shake', 'protein beverage', 'ready to drink protein'])) {
    push('ready_to_drink_protein', 'explicit ready-to-drink protein beverage pattern', 90, 'Explicit protein-shake or protein-beverage identity supports the ready-to-drink protein category.');
  }
  if (proteinIngredient && anyPhrase(identityValues, ['protein cereal', 'breakfast cereal'])) {
    push('cereal', 'protein ingredient + explicit cereal form', 86, 'Protein ingredients and cereal form support the cereal category.');
  }

  return evidence;
}

function candidateScore(items: CategoryEvidence[]): number {
  const sorted = [...items].sort((left, right) => right.weight - left.weight);
  const strongest = sorted[0]?.weight ?? 0;
  const corroboration = sorted.slice(1).reduce((sum, item) => sum + Math.min(5, Math.round(item.weight / 20)), 0);
  return Math.min(100, strongest + Math.min(12, corroboration));
}

function confidence(score: number): 'low' | 'medium' | 'high' {
  if (score >= 80) return 'high';
  if (score >= 55) return 'medium';
  return 'low';
}

export function resolveProductCategory(input: CategoryResolutionInput): CategoryResolution {
  const evidenceByCategory = new Map<string, CategoryEvidence[]>();
  const explicit = normalized(input.explicitCategory);
  if (explicit) {
    const exact = PRODUCT_CATEGORIES.find((category) => category.id === explicit.replace(/ /g, '_'));
    if (exact) addEvidence(
      evidenceByCategory,
      exact.id,
      evidenceRecord(
        'explicit', explicit, 100, 'exact',
        'An explicit curated/internal category was supplied.',
        'curated_exact_product_category'
      )
    );
  }

  const productName = normalized(input.name);
  const tags = (input.categoryTags ?? []).map(normalized).filter(Boolean);
  const specificProviderCategories = new Set<string>();
  for (const category of PRODUCT_CATEGORIES) {
    for (const keyword of category.keywords) {
      const broad = isBroadKeyword(category, keyword);
      if (!broad && tags.some((tag) => hasPhrase(tag, keyword))) specificProviderCategories.add(category.id);
    }
  }
  const strongNameCategories = new Set(PRODUCT_CATEGORIES.flatMap((category) => (
    category.keywords.some((keyword) => {
      const broad = isBroadKeyword(category, keyword);
      return !broad && hasPhrase(productName, keyword);
    }) ? [category.id] : []
  )));
  const incompatibleSaltContext = [...specificProviderCategories, ...strongNameCategories].some((categoryId) => categoryId !== 'salt' && categoryId !== 'low_sodium_salt');
  const condimentContext = anyPhrase([productName, ...tags], ['ketchup', 'mustard', 'mayonnaise', 'mayo', 'dressing', 'condiment']);
  const pastaSauceContext = anyPhrase([productName, ...tags], ['marinara', 'pasta sauce']) || (
    !condimentContext && anyPhrase([productName, ...tags], ['tomato sauce'])
  );
  for (const category of PRODUCT_CATEGORIES) {
    for (const keyword of category.keywords) {
      const normalizedKeyword = normalized(keyword);
      const saltCategorySuppressed = (category.id === 'salt' || category.id === 'low_sodium_salt') && incompatibleSaltContext;
      const marinaraSuppressed = category.id === 'marinara' && condimentContext && !pastaSauceContext;
      const pastaSuppressed = category.id === 'pasta' && pastaSauceContext;
      if (!saltCategorySuppressed && !marinaraSuppressed && !pastaSuppressed && hasPhrase(productName, normalizedKeyword)) {
        const broad = isBroadKeyword(category, keyword);
        const competingSpecificCategory = specificProviderCategories.size > 0 && !specificProviderCategories.has(category.id);
        const detail = competingSpecificCategory
          ? 'A name phrase is retained as incidental because stronger product-level evidence identifies another product form.'
          : broad ? 'The product name contains a broad category term.' : 'The product name contains specific category terminology.';
        addEvidence(
          evidenceByCategory,
          category.id,
          evidenceRecord(
            'product_name', keyword,
            competingSpecificCategory ? 38 : broad ? 58 : 78 + Math.min(5, Math.floor(normalizedKeyword.length / 5)),
            competingSpecificCategory ? 'incidental' : broad ? 'broad' : 'specific',
            detail,
            competingSpecificCategory ? 'incidental_name_modifier' : 'descriptive_product_name'
          )
        );
      }
      for (const tag of tags) {
        if (marinaraSuppressed || pastaSuppressed || !hasPhrase(tag, normalizedKeyword)) continue;
        const broad = isBroadKeyword(category, keyword);
        const productTypeTag = isProductTypeTag(tag, normalizedKeyword);
        const exactCategoryTag = normalized(tag) === normalizedKeyword || productTypeTag;
        const source: CategoryEvidenceSource = !broad && exactCategoryTag
          ? 'provider_specific'
          : productTypeTag
            ? 'provider_product_form'
            : 'provider_broad';
        const detail = source === 'provider_specific'
          ? 'A specific provider product category matched.'
          : source === 'provider_product_form'
            ? 'A provider tag directly identifies the product form or use.'
            : 'A broad provider parent category matched.';
        addEvidence(
          evidenceByCategory,
          category.id,
          evidenceRecord(
            source,
            tag,
            source === 'provider_specific' ? 90 + Math.min(4, Math.floor(normalizedKeyword.length / 6))
              : source === 'provider_product_form' ? 72
                : 32,
            source === 'provider_specific' ? 'specific' : source === 'provider_product_form' ? 'specific' : 'broad',
            detail,
            source === 'provider_specific' ? 'provider_product_category'
              : source === 'provider_product_form' ? 'provider_product_form'
                : 'provider_parent_category'
          )
        );
      }
    }
  }

  for (const match of patternEvidence(input)) addEvidence(evidenceByCategory, match.categoryId, match.evidence);

  const candidates: CategoryCandidate[] = [...evidenceByCategory.entries()].flatMap(([categoryId, evidence]): CategoryCandidate[] => {
    const category = PRODUCT_CATEGORIES.find((item) => item.id === categoryId);
    if (!category) return [];
    const orderedEvidence = [...evidence].sort((left, right) => (
      right.precedence - left.precedence ||
      right.weight - left.weight ||
      left.source.localeCompare(right.source) ||
      left.value.localeCompare(right.value)
    ));
    const score = candidateScore(orderedEvidence);
    const compatibility = candidateCompatibility(category, orderedEvidence, input, tags);
    return [{
      categoryId, categoryLabel: category.label, productForm: category.form, score,
      confidence: confidence(score), evidence: orderedEvidence, suppressions: [],
      positiveSignals: [...new Set(orderedEvidence.flatMap((item) => item.positiveSignals))],
      contradictorySignals: [],
      contradictionLevel: 'compatible',
      ...compatibility,
      precedence: Math.max(...orderedEvidence.map((item) => item.precedence)),
      selected: false,
      selectionReason: null,
      rejectionReason: null
    }];
  }).sort((left, right) => (
    right.precedence - left.precedence ||
    right.score - left.score ||
    right.evidence.length - left.evidence.length ||
    left.categoryId.localeCompare(right.categoryId)
  ));

  const selectableCandidates = candidates.filter((candidate) => candidate.compatibilityStatus === 'compatible');
  const top = selectableCandidates[0] ?? null;
  const conflicts: string[] = [];
  let contradictionLevel: CategoryContradictionLevel = 'compatible';
  let unsafeNarrowSelection = false;
  for (const candidate of candidates.filter((item) => item.compatibilityStatus !== 'compatible')) {
    candidate.contradictionLevel = 'unsafe_narrow_classification';
    candidate.contradictorySignals.push(...candidate.incompatibilitySignals);
    const reason = candidate.compatibilityStatus === 'incompatible'
      ? `${candidate.categoryLabel} failed product-level compatibility: ${candidate.incompatibilitySignals.join(' ')}`
      : `${candidate.categoryLabel} lacked independent product-level compatibility evidence.`;
    conflicts.push(reason);
    if (contradictionLevel === 'compatible') contradictionLevel = 'unsafe_narrow_classification';
  }
  if (!top && candidates.length > 0) unsafeNarrowSelection = true;
  if (top) {
    for (const candidate of selectableCandidates.slice(1)) {
      if (categoriesCompatible(top, candidate)) {
        if (top.precedence >= EVIDENCE_PRECEDENCE.exact_product_category && candidate.precedence === top.precedence) {
          const message = `${top.categoryLabel} and ${candidate.categoryLabel} are compatible refinements, but exact product-level sources disagree.`;
          if (contradictionLevel === 'compatible') contradictionLevel = 'weak_disagreement';
          top.contradictionLevel = 'weak_disagreement';
          candidate.contradictionLevel = 'weak_disagreement';
          top.contradictorySignals.push(message);
          candidate.contradictorySignals.push(message);
          conflicts.push(message);
        }
        continue;
      }
      const samePrecedence = top.precedence === candidate.precedence;
      const scoreGap = top.score - candidate.score;
      const meaningfulCandidate = candidate.score >= 55 || candidate.evidence.length >= 2;
      const message = `${top.categoryLabel} conflicts with ${candidate.categoryLabel}.`;
      if (samePrecedence && meaningfulCandidate && scoreGap < 10) {
        const materialLevel: CategoryContradictionLevel = top.productForm === candidate.productForm
          ? 'material_contradiction'
          : 'unsafe_narrow_classification';
        contradictionLevel = materialLevel;
        unsafeNarrowSelection = true;
        top.contradictionLevel = materialLevel;
        candidate.contradictionLevel = materialLevel;
        top.contradictorySignals.push(message);
        candidate.contradictorySignals.push(message);
        conflicts.push(`${message} Evidence at the same precedence cannot safely establish one narrow category.`);
      } else if (meaningfulCandidate) {
        if (contradictionLevel === 'compatible') contradictionLevel = 'weak_disagreement';
        top.contradictionLevel = top.contradictionLevel === 'compatible' ? 'weak_disagreement' : top.contradictionLevel;
        candidate.contradictionLevel = 'weak_disagreement';
        top.contradictorySignals.push(message);
        candidate.contradictorySignals.push(message);
        conflicts.push(`${message} Stronger evidence precedence selected ${top.categoryLabel}.`);
      }
    }
    if (top.precedence <= EVIDENCE_PRECEDENCE.individual_ingredient_token) {
      unsafeNarrowSelection = true;
      contradictionLevel = 'unsafe_narrow_classification';
      top.contradictionLevel = 'unsafe_narrow_classification';
      top.contradictorySignals.push('An individual ingredient token cannot establish the primary product category.');
      conflicts.push('Individual ingredient evidence was rejected as an unsafe primary category source.');
    }
  }

  const refinementCandidate = top && !unsafeNarrowSelection && top.precedence === EVIDENCE_PRECEDENCE.product_form_and_use
    ? selectableCandidates.find((candidate) => (
        candidate !== top &&
        isCategoryRefinement(candidate, top) &&
        candidate.evidence.some((item) => item.level === 'composition') &&
        candidate.score >= 80
      )) ?? null
    : null;
  const selectedCandidate = top && !unsafeNarrowSelection ? refinementCandidate ?? top : null;
  const strongestIncompatibleRunner = selectedCandidate
    ? selectableCandidates.find((candidate) => candidate !== selectedCandidate && !categoriesCompatible(selectedCandidate, candidate)) ?? null
    : null;
  const scoreGap = selectedCandidate ? selectedCandidate.score - (strongestIncompatibleRunner?.score ?? 0) : 0;
  const supportedCompatibleRefinement = refinementCandidate === selectedCandidate;
  const interpretationConfidence = !selectedCandidate
    ? 'low'
    : contradictionLevel !== 'compatible'
      ? 'medium'
    : (selectedCandidate.precedence >= EVIDENCE_PRECEDENCE.exact_product_category || supportedCompatibleRefinement) &&
      selectedCandidate.score >= 80 && (!strongestIncompatibleRunner || scoreGap >= 10)
      ? 'high'
      : selectedCandidate.score >= 55 && (!strongestIncompatibleRunner || scoreGap >= 5 || selectedCandidate.precedence > strongestIncompatibleRunner.precedence)
        ? 'medium'
        : 'low';
  const selected = selectedCandidate
    ? PRODUCT_CATEGORIES.find((category) => category.id === selectedCandidate.categoryId) ?? null
    : null;
  const selectionReason = selectedCandidate
    ? supportedCompatibleRefinement
      ? `${selectedCandidate.categoryLabel} safely refines compatible product-form evidence using corroborated composition evidence.`
      : `${selectedCandidate.categoryLabel} was selected from ${selectedCandidate.evidence[0]?.level.replaceAll('_', ' ') ?? 'available'} evidence at precedence ${selectedCandidate.precedence}.`
    : top
      ? 'Conflicting or unsafe evidence prevented a narrow category selection; broad context remains available.'
      : 'No defensible narrow category evidence was available.';
  for (const candidate of candidates) {
    candidate.selected = candidate === selectedCandidate;
    candidate.selectionReason = candidate.selected ? selectionReason : null;
    candidate.rejectionReason = candidate.selected
      ? null
      : candidate.compatibilityStatus === 'incompatible'
        ? `Rejected because product-level compatibility failed: ${candidate.incompatibilitySignals.join(' ')}`
        : candidate.compatibilityStatus === 'limited'
          ? 'Rejected because independent product-level compatibility evidence was insufficient.'
          : unsafeNarrowSelection && candidate === top
            ? 'Rejected because materially conflicting evidence made the narrow classification unsafe.'
            : candidate.precedence < (selectedCandidate?.precedence ?? Infinity)
              ? `Rejected because stronger evidence precedence supported ${selectedCandidate?.categoryLabel ?? 'broad fallback'}.`
              : `Rejected because ${selectedCandidate?.categoryLabel ?? 'broad fallback'} had stronger corroborated evidence.`;
  }

  candidates.sort((left, right) => (
    Number(right.selected) - Number(left.selected) ||
    right.precedence - left.precedence ||
    right.score - left.score ||
    left.categoryId.localeCompare(right.categoryId)
  ));

  return {
    selected,
    selectedCategoryId: selected?.id ?? null,
    selectedCategoryLabel: selected?.label ?? null,
    productForm: selected?.form ?? null,
    candidates,
    conflicts: [...new Set(conflicts)],
    contradictionLevel,
    selectionReason,
    interpretationConfidence
  };
}
