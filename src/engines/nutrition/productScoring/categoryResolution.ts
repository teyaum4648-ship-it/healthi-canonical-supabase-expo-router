import { PRODUCT_CATEGORIES, type ProductCategory, type ProductForm } from './categories';

export type CategoryEvidenceSource =
  | 'explicit'
  | 'provider_specific'
  | 'ingredient_form_pattern'
  | 'product_name'
  | 'provider_broad';

export type CategoryEvidence = {
  source: CategoryEvidenceSource;
  value: string;
  weight: number;
  specificity: 'exact' | 'specific' | 'broad' | 'incidental';
  detail: string;
};

export type CategoryCandidate = {
  categoryId: string;
  categoryLabel: string;
  productForm: ProductForm;
  score: number;
  confidence: 'low' | 'medium' | 'high';
  evidence: CategoryEvidence[];
  suppressions: string[];
};

export type CategoryResolution = {
  selected: ProductCategory | null;
  selectedCategoryId: string | null;
  selectedCategoryLabel: string | null;
  productForm: ProductForm | null;
  candidates: CategoryCandidate[];
  conflicts: string[];
  interpretationConfidence: 'low' | 'medium' | 'high';
};

export type CategoryResolutionInput = {
  name: string;
  explicitCategory?: string | null;
  categoryTags?: string[];
  ingredientsText?: string | null;
  servingNutrients?: { fiber_g?: number | null };
};

const TOKEN_VARIANTS: Record<string, string> = {
  bars: 'bar', beverages: 'beverage', breads: 'bread', breasts: 'breast', chips: 'chip', chocolates: 'chocolate', cookies: 'cookie',
  cereals: 'cereal', crackers: 'cracker', creams: 'cream', crisps: 'crisp', desserts: 'dessert', drinks: 'drink',
  meats: 'meat', milks: 'milk', pastas: 'pasta', powders: 'powder', puffs: 'puff', sauces: 'sauce',
  sodas: 'soda', soups: 'soup', snacks: 'snack', yogurts: 'yogurt'
};

const GENERIC_FORM_KEYWORDS = new Set(['chip', 'crisp', 'puff', 'soda', 'soft drink', 'cereal', 'salt', 'sauce', 'condiment', 'frozen dessert']);

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
    evidence.push({ categoryId, evidence: { source: 'ingredient_form_pattern', value, weight, specificity: 'specific', detail } });
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

  const proteinIngredient = /\b(whey|milk protein|protein isolate|pea protein|casein)\b/.test(ingredients);
  if (proteinIngredient && anyPhrase(identityValues, ['protein chip', 'protein puff', 'protein snack'])) {
    push('protein_chip', 'protein ingredient + explicit chip/snack form', 88, 'Protein ingredients and chip form support the protein-snack category.');
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

function evidencePriority(candidate: CategoryCandidate): number {
  const priorities: Record<CategoryEvidenceSource, number> = {
    explicit: 5,
    provider_specific: 4,
    ingredient_form_pattern: 3,
    product_name: 2,
    provider_broad: 1
  };
  return Math.max(...candidate.evidence.map((item) => priorities[item.source]));
}

export function resolveProductCategory(input: CategoryResolutionInput): CategoryResolution {
  const evidenceByCategory = new Map<string, CategoryEvidence[]>();
  const explicit = normalized(input.explicitCategory);
  if (explicit) {
    const exact = PRODUCT_CATEGORIES.find((category) => category.id === explicit.replace(/ /g, '_'));
    if (exact) addEvidence(evidenceByCategory, exact.id, {
      source: 'explicit', value: explicit, weight: 100, specificity: 'exact', detail: 'An explicit curated/internal category was supplied.'
    });
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
        addEvidence(evidenceByCategory, category.id, {
          source: 'product_name', value: keyword,
          weight: competingSpecificCategory ? 38 : broad ? 58 : 78 + Math.min(5, Math.floor(normalizedKeyword.length / 5)),
          specificity: competingSpecificCategory ? 'incidental' : broad ? 'broad' : 'specific',
          detail: competingSpecificCategory
            ? 'A name phrase is retained as incidental because specific provider category evidence identifies another product form.'
            : broad ? 'The product name contains a broad category term.' : 'The product name contains specific category terminology.'
        });
      }
      for (const tag of tags) {
        if (marinaraSuppressed || pastaSuppressed || !hasPhrase(tag, normalizedKeyword)) continue;
        const broad = isBroadKeyword(category, keyword);
        addEvidence(evidenceByCategory, category.id, {
          source: broad ? 'provider_broad' : 'provider_specific',
          value: tag,
          weight: broad ? 32 : 90 + Math.min(4, Math.floor(normalizedKeyword.length / 6)),
          specificity: broad ? 'broad' : 'specific',
          detail: broad ? 'A broad provider parent category matched.' : 'A specific provider category matched.'
        });
      }
    }
  }

  for (const match of patternEvidence(input)) addEvidence(evidenceByCategory, match.categoryId, match.evidence);

  const candidates = [...evidenceByCategory.entries()].flatMap(([categoryId, evidence]) => {
    const category = PRODUCT_CATEGORIES.find((item) => item.id === categoryId);
    if (!category) return [];
    const score = candidateScore(evidence);
    return [{
      categoryId, categoryLabel: category.label, productForm: category.form, score,
      confidence: confidence(score), evidence, suppressions: []
    }];
  }).sort((left, right) => (
    right.score - left.score ||
    evidencePriority(right) - evidencePriority(left) ||
    right.evidence.length - left.evidence.length ||
    left.categoryId.localeCompare(right.categoryId)
  ));

  const top = candidates[0] ?? null;
  const runnerUp = candidates[1] ?? null;
  const gap = top ? top.score - (runnerUp?.score ?? 0) : 0;
  const interpretationConfidence = !top
    ? 'low'
    : top.score >= 80 && (!runnerUp || gap >= 10)
      ? 'high'
      : top.score >= 55 && (!runnerUp || gap >= 5)
        ? 'medium'
        : 'low';
  const conflicts = top && runnerUp && gap < 15
    ? [`${top.categoryLabel} and ${runnerUp.categoryLabel} both have meaningful evidence.`]
    : [];
  const selected = top ? PRODUCT_CATEGORIES.find((category) => category.id === top.categoryId) ?? null : null;

  return {
    selected,
    selectedCategoryId: selected?.id ?? null,
    selectedCategoryLabel: selected?.label ?? null,
    productForm: selected?.form ?? null,
    candidates,
    conflicts,
    interpretationConfidence
  };
}
