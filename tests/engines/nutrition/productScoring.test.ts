import { describe, expect, it } from 'vitest';

import {
  detectProductCategory,
  recommendProductAlternatives,
  scoreProductLabel,
  searchScoredProducts,
  splitIngredientList,
  type ScoredCatalogProduct
} from '../../../src/engines/nutrition/productScoring';

const sodaCatalog: ScoredCatalogProduct[] = [
  {
    id: 'cola',
    name: 'Cola drink',
    category: 'soda',
    ingredientsText: 'carbonated water, caramel color, aspartame, phosphoric acid, natural flavors'
  },
  {
    id: 'fiber-soda',
    name: 'Fiber soda',
    category: 'soda',
    ingredientsText: 'carbonated water, chicory root inulin, apple juice concentrate, lime juice concentrate'
  }
];

describe('Healthi product scoring engine', () => {
  it('scores the same label deterministically and preserves factor detail', () => {
    const input = sodaCatalog[0]!;
    const first = scoreProductLabel(input);
    const second = scoreProductLabel(input);

    expect(first).toEqual(second);
    expect(first.tier).toBe(4);
    expect(first.categoryId).toBe('soda');
    expect(first.factors.map((factor) => factor.id)).toEqual(expect.arrayContaining(['artificial_sweetener', 'flavor_blend']));
    expect(first.reasonCodes).toContain('category_soda');
    expect(JSON.parse(JSON.stringify(first))).toEqual(first);
  });

  it('keeps missing ingredient data calibrating instead of assigning a punitive score', () => {
    const result = scoreProductLabel({ name: 'Unknown product', ingredientsText: '' });

    expect(result).toMatchObject({
      absoluteScore: null,
      categoryScore: null,
      displayScore: null,
      label: 'calibrating',
      confidence: 'low'
    });
  });

  it('uses category context for formulated foods while straightforward foods keep their overall score', () => {
    const formulated = scoreProductLabel(sodaCatalog[0]!);
    const straightforward = scoreProductLabel(sodaCatalog[1]!);

    expect(formulated.categoryScore).not.toBeNull();
    expect(formulated.displayScore).toBe(formulated.categoryScore);
    expect(straightforward.tier).toBe(2);
    expect(straightforward.displayScore).toBe(straightforward.absoluteScore);
    expect(straightforward.label).toBe('supportive');
  });

  it('applies one-fire matching and the strongest applicable score cap', () => {
    const result = scoreProductLabel({
      name: 'Colored snack',
      category: 'chips',
      ingredientsText: 'corn, red 40, yellow 5, artificial flavor',
    });
    const capped = scoreProductLabel({
      name: 'Packaged corn',
      category: 'chips',
      ingredientsText: 'organic corn, partially hydrogenated oil',
      labels: ['organic']
    });

    expect(result.factors.filter((factor) => factor.id === 'artificial_color')).toHaveLength(1);
    expect(capped.scoreCap).toMatchObject({ ruleId: 'hydrogenated_oil', cap: 30 });
    expect(capped.absoluteScore).toBeLessThanOrEqual(30);
  });

  it('parses nested ingredient groups without splitting their contents into top-level items', () => {
    expect(splitIngredientList('oats, oil blend (canola oil, sunflower oil), sea salt')).toEqual([
      'oats',
      'oil blend (canola oil, sunflower oil)',
      'sea salt'
    ]);
  });

  it('ranks search results and recommends meaningfully stronger same-category options', () => {
    const search = searchScoredProducts('soda', sodaCatalog);
    const recommendation = recommendProductAlternatives(sodaCatalog[0]!, sodaCatalog);

    expect(search[0]?.product.id).toBe('fiber-soda');
    expect(recommendation.alternatives[0]?.product.id).toBe('fiber-soda');
    expect(recommendation.alternatives[0]!.result.displayScore).toBeGreaterThan(recommendation.scanned.displayScore!);
  });

  it('detects the longest matching category keyword', () => {
    expect(detectProductCategory(null, 'Sea salt tortilla chips')?.id).toBe('chips');
  });

  it('keeps generated product-scoring copy within general wellness language', () => {
    const output = JSON.stringify(sodaCatalog.map((product) => scoreProductLabel(product))).toLowerCase();
    const blockedTerms = [
      'diag' + 'nosis', 'treat' + 'ment', 'c' + 'ure', 'pre' + 'scribe', 'ad' + 'renal',
      'h' + 'pa', 'cor' + 'tisol', 'hor' + 'mone', 'clin' + 'ical', 'de' + 'tox',
      'tox' + 'in', 'tox' + 'ic', 'clean' + 'se', 'cheat ' + 'meal', 'guilt-' + 'free',
      'bad ' + 'food', 'metabolic ' + 'type', 'che' + 'k', 'scout ' + 'score', 'bobby ' + 'approved'
    ];
    for (const term of blockedTerms) expect(output).not.toContain(term);
  });
});
