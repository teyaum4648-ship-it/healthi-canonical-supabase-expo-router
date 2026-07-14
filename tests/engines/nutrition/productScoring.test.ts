import { describe, expect, it } from 'vitest';

import {
  detectProductCategory,
  productLetterGrade,
  recommendProductAlternatives,
  scoreProductLabel,
  searchScoredProducts,
  splitIngredientList,
  type ScoredCatalogProduct
} from '../../../src/engines/nutrition/productScoring';

const regularCola: ScoredCatalogProduct = {
  id: 'regular-cola',
  name: 'Regular cola drink',
  category: 'soda',
  ingredientsText: 'carbonated water, high-fructose corn syrup, caramel color, phosphoric acid, natural flavors, caffeine',
  servingNutrients: { calories: 150, sugar_g: 39, protein_g: 0, fiber_g: 0, sodium_mg: 45 },
  nutrimentsPer100g: { sugar_g: 10.6, protein_g: 0, fiber_g: 0, sodium_mg: 12 }
};

const dietCola: ScoredCatalogProduct = {
  id: 'diet-cola',
  name: 'Zero-sugar cola drink',
  category: 'soda',
  ingredientsText: 'carbonated water, caramel color, aspartame, phosphoric acid, natural flavors, caffeine',
  servingNutrients: { calories: 0, sugar_g: 0, protein_g: 0, fiber_g: 0, sodium_mg: 40 },
  nutrimentsPer100g: { sugar_g: 0, protein_g: 0, fiber_g: 0, sodium_mg: 11 }
};

const prebioticSoda: ScoredCatalogProduct = {
  id: 'prebiotic-soda',
  name: 'Prebiotic sparkling drink',
  category: 'soda',
  ingredientsText: 'carbonated water, chicory root inulin, cassava root fiber, apple juice concentrate, natural flavors, stevia',
  servingNutrients: { calories: 35, sugar_g: 5, protein_g: 0, fiber_g: 9, sodium_mg: 35 },
  nutrimentsPer100g: { sugar_g: 1.4, protein_g: 0, fiber_g: 2.5, sodium_mg: 10 }
};

const simpleChips: ScoredCatalogProduct = {
  id: 'simple-chips',
  name: 'Sea salt tortilla chips',
  category: 'chips',
  ingredientsText: 'cassava flour, avocado oil, sea salt',
  servingNutrients: { calories: 140, sugar_g: 0, protein_g: 1, fiber_g: 2, sodium_mg: 150 },
  nutrimentsPer100g: { sugar_g: 0, protein_g: 4, fiber_g: 5, sodium_mg: 535 }
};

const complexChips: ScoredCatalogProduct = {
  id: 'complex-chips',
  name: 'Flavored corn chips',
  category: 'chips',
  ingredientsText: 'corn, vegetable oil, maltodextrin, natural and artificial flavors, monosodium glutamate, red 40, yellow 6, sugar, salt',
  servingNutrients: { calories: 150, sugar_g: 2, protein_g: 2, fiber_g: 1, sodium_mg: 330 },
  nutrimentsPer100g: { sugar_g: 7, protein_g: 7, fiber_g: 3, sodium_mg: 1178 }
};

const complexCookie: ScoredCatalogProduct = {
  id: 'complex-cookie',
  name: 'Packaged chocolate chip cookies',
  category: 'cookies',
  ingredientsText: 'enriched wheat flour, sugar, canola oil, high-fructose corn syrup, whey, mono and diglycerides, artificial flavor, salt',
  servingNutrients: { calories: 160, sugar_g: 14, protein_g: 1, fiber_g: 1, sodium_mg: 110 },
  nutrimentsPer100g: { sugar_g: 32, protein_g: 4, fiber_g: 2, sodium_mg: 250 }
};

const simpleCookie: ScoredCatalogProduct = {
  id: 'simple-cookie',
  name: 'Thin butter cookies',
  category: 'cookies',
  ingredientsText: 'wheat flour, butter, cane sugar, sea salt',
  servingNutrients: { calories: 150, sugar_g: 12, protein_g: 2, fiber_g: 1, sodium_mg: 100 },
  nutrimentsPer100g: { sugar_g: 28, protein_g: 5, fiber_g: 2, sodium_mg: 235 }
};

const catalog = [regularCola, dietCola, prebioticSoda, simpleChips, complexChips];

describe('Healthi product scoring engine', () => {
  it('uses the exact letter-grade thresholds', () => {
    expect([92, 85, 80, 74, 70, 64, 56, 50, 45, 39, 35, 34].map(productLetterGrade)).toEqual([
      'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'D-', 'F'
    ]);
  });

  it('scores the same label deterministically and preserves serializable factor detail', () => {
    const first = scoreProductLabel(dietCola);
    const second = scoreProductLabel(dietCola);

    expect(first).toEqual(second);
    expect(first.tier).toBe(3);
    expect(first.categoryId).toBe('soda');
    expect(first.factors.map((item) => item.id)).toEqual(expect.arrayContaining(['non_sugar_sweetener', 'zero_sugar_beverage']));
    expect(first.reasonCodes).toEqual(expect.arrayContaining(['category_soda', 'sweetener_watch_signal']));
    expect(JSON.parse(JSON.stringify(first))).toEqual(first);
  });

  it('keeps missing ingredient data calibrating instead of assigning false certainty', () => {
    expect(scoreProductLabel({ name: 'Unknown product', ingredientsText: '' })).toMatchObject({
      absoluteScore: null,
      categoryScore: null,
      displayScore: null,
      letterGrade: null,
      gradeBand: 'calibrating',
      label: 'calibrating',
      confidence: 'low'
    });
  });

  it('uses absolute score as the primary grade while retaining category context', () => {
    const result = scoreProductLabel(regularCola);
    expect(result.categoryScore).not.toBeNull();
    expect(result.displayScore).toBe(result.absoluteScore);
    expect(result.categoryScore).not.toBe(result.displayScore);
    expect(result.letterGrade).toBe('F');
  });

  it('grades a high-sugar cola F and does not let protein or fiber rescue the beverage cap', () => {
    const result = scoreProductLabel({
      ...regularCola,
      servingNutrients: { ...regularCola.servingNutrients, protein_g: 20, fiber_g: 10 }
    });
    expect(result).toMatchObject({ letterGrade: 'F', gradeBand: 'avoid' });
    expect(result.absoluteScore).toBeLessThanOrEqual(22);
    expect(result.reasonCodes).toContain('high_sugar_beverage');
  });

  it('treats non-sugar sweeteners as a moderate watch signal rather than an automatic F', () => {
    const result = scoreProductLabel(dietCola);
    expect(['C-', 'C']).toContain(result.letterGrade);
    expect(result.letterGrade).not.toBe('F');
    expect(result.evidence_refs.map((item) => item.id)).toEqual(expect.arrayContaining([
      'fda_sweeteners_safety',
      'who_nss_weight_control'
    ]));
  });

  it('places a lower-sugar prebiotic soda in B range with response context', () => {
    const result = scoreProductLabel(prebioticSoda);
    expect(['B-', 'B']).toContain(result.letterGrade);
    expect(result.letterGrade).not.toBe('A');
    expect(result.reasonCodes).toEqual(expect.arrayContaining([
      'prebiotic_fiber',
      'possible_gi_response',
      'lower_sugar_beverage',
      'formulated_beverage'
    ]));
    expect(result.evidence_refs.map((item) => item.id)).toContain('fda_sugar_alcohol_notice');
  });

  it('grades straightforward avocado-oil chips above complex flavored chips', () => {
    const simple = scoreProductLabel(simpleChips);
    const complex = scoreProductLabel(complexChips);
    expect(['B-', 'C+']).toContain(simple.letterGrade);
    expect(['D', 'D-', 'F']).toContain(complex.letterGrade);
    expect(simple.displayScore!).toBeGreaterThan(complex.displayScore!);
  });

  it('keeps simple butter cookies in D range and complex packaged cookies at F', () => {
    const simple = scoreProductLabel(simpleCookie);
    const complex = scoreProductLabel(complexCookie);
    expect(simple.letterGrade).toBe('D');
    expect(complex.letterGrade).toBe('F');
    expect(simple.displayScore!).toBeGreaterThan(complex.displayScore!);
  });

  it('returns better-option criteria for C+ or below and omits them for B or above', () => {
    const lower = scoreProductLabel(dietCola);
    const higher = scoreProductLabel({
      name: 'Oat and seed cup',
      category: 'cereal',
      ingredientsText: 'whole oats, chia seeds, pumpkin seeds',
      servingNutrients: { calories: 230, sugar_g: 3, protein_g: 9, fiber_g: 7, sodium_mg: 80 },
      nutrimentsPer100g: { sugar_g: 5, protein_g: 15, fiber_g: 11, sodium_mg: 130 }
    });
    expect(lower.better_options[0]?.criteria.length).toBeGreaterThan(0);
    expect(higher.displayScore).toBeGreaterThanOrEqual(70);
    expect(higher.better_options).toEqual([]);
  });

  it('lowers confidence when nutrition facts are incomplete while keeping output safe', () => {
    const result = scoreProductLabel({
      name: 'Sparse snack',
      category: 'chips',
      ingredientsText: 'corn, avocado oil, sea salt',
      nutrimentsPer100g: { sodium_mg: 200 }
    });
    expect(result.confidence).toBe('low');
    expect(result.letterGrade).not.toBeNull();
  });

  it('attaches Daily Value and processing evidence to matching factors', () => {
    const result = scoreProductLabel(complexChips);
    expect(result.evidence_refs.map((item) => item.id)).toEqual(expect.arrayContaining([
      'fda_daily_values',
      'bmj_ultraprocessed_umbrella_review'
    ]));
  });

  it('applies one-fire matching and the strongest applicable score cap', () => {
    const result = scoreProductLabel({
      name: 'Colored snack',
      category: 'chips',
      ingredientsText: 'corn, red 40, yellow 5, artificial flavor'
    });
    const capped = scoreProductLabel({
      name: 'Packaged corn',
      category: 'chips',
      ingredientsText: 'organic corn, partially hydrogenated oil',
      labels: ['organic']
    });
    expect(result.factors.filter((item) => item.id === 'artificial_color')).toHaveLength(1);
    expect(capped.factors.map((item) => item.id)).toContain('hydrogenated_oil');
    expect(capped.absoluteScore).toBeLessThanOrEqual(30);
  });

  it('parses nested ingredient groups without splitting their contents', () => {
    expect(splitIngredientList('oats, oil blend (canola oil, sunflower oil), sea salt')).toEqual([
      'oats',
      'oil blend (canola oil, sunflower oil)',
      'sea salt'
    ]);
  });

  it('ranks search results and recommends meaningfully stronger same-category options', () => {
    const sodaCatalog = [regularCola, dietCola, prebioticSoda];
    const search = searchScoredProducts('soda', sodaCatalog);
    const recommendation = recommendProductAlternatives(regularCola, sodaCatalog);
    expect(search[0]?.product.id).toBe('prebiotic-soda');
    expect(recommendation.alternatives[0]?.result.displayScore).toBeGreaterThan(recommendation.scanned.displayScore!);
  });

  it('detects the longest matching category keyword', () => {
    expect(detectProductCategory(null, 'Sea salt tortilla chips')?.id).toBe('chips');
  });

  it('keeps generated copy within general wellness language', () => {
    const output = JSON.stringify(catalog.map((product) => scoreProductLabel(product))).toLowerCase();
    const blockedTerms = [
      'diag' + 'nosis', 'treat' + 'ment', 'c' + 'ure', 'pre' + 'scribe', 'ad' + 'renal',
      'h' + 'pa', 'cor' + 'tisol', 'hor' + 'mone', 'clin' + 'ical', 'de' + 'tox',
      'tox' + 'in', 'tox' + 'ic', 'clean' + 'se', 'cheat ' + 'meal', 'guilt-' + 'free',
      'bad ' + 'food', 'metabolic ' + 'type', 'che' + 'k', 'scout ' + 'score', 'bobby ' + 'approved'
    ];
    for (const term of blockedTerms) expect(output).not.toContain(term);
  });
});
