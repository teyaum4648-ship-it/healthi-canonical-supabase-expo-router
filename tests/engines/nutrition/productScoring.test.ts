import { describe, expect, it } from 'vitest';

import {
  productLetterGrade,
  scoreProductLabel,
  splitIngredientList,
  type ProductScoringInput
} from '../../../src/engines/nutrition/productScoring';
import { resolveProductCategory } from '../../../src/engines/nutrition/productScoring/categoryResolution';
import { CATEGORY_PROFILES, RULE_FAMILIES } from '../../../src/engines/nutrition/productScoring/profiles';

function score(input: ProductScoringInput) {
  return scoreProductLabel({
    sourceConfidence: 'high',
    servingNutrients: { calories: 100, protein_g: 2, fiber_g: 1, sugar_g: 2, sodium_mg: 100 },
    ...input
  });
}

describe('Healthi Scanner Engine V2', () => {
  it('ranks specific category and ingredient/form evidence above broad provider parents', () => {
    const resolution = resolveProductCategory({
      name: 'Vanilla ice cream',
      categoryTags: ['frozen desserts', 'ice cream'],
      ingredientsText: 'cream, milk, sugar, egg yolks, vanilla extract'
    });
    expect(resolution.selectedCategoryId).toBe('ice_cream');
    expect(resolution.candidates.map((candidate) => candidate.categoryId)).toEqual(expect.arrayContaining(['ice_cream', 'frozen_dairy_dessert']));
    expect(resolution.candidates[0]?.evidence.map((item) => item.source)).toContain('ingredient_form_pattern');
    expect(resolution.interpretationConfidence).toBe('high');
  });

  it('lets high-confidence ingredient/form evidence refine broad beverage metadata', () => {
    const prebiotic = resolveProductCategory({
      name: 'Vintage cola',
      categoryTags: ['sodas'],
      ingredientsText: 'carbonated water, cassava root fiber, chicory root inulin, natural flavors',
      servingNutrients: { fiber_g: 9 }
    });
    const plantMilk = resolveProductCategory({
      name: 'Unsweetened almond beverage',
      categoryTags: ['plant-based beverages'],
      ingredientsText: 'filtered water, almonds, sea salt'
    });
    expect(prebiotic.selectedCategoryId).toBe('prebiotic_soda');
    expect(plantMilk.selectedCategoryId).toBe('plant_milk');
    for (const resolution of [prebiotic, plantMilk]) {
      expect(resolution.candidates[0]).toMatchObject({ confidence: 'high' });
      expect(resolution.candidates[0]?.evidence.length).toBeGreaterThan(0);
    }
  });

  it('resolves adjacent beverage categories without relying on brand or barcode identity', () => {
    const fixtures = [
      {
        name: 'Zero sugar cola',
        categoryTags: ['carbonated drinks', 'artificially sweetened beverages', 'diet sodas'],
        ingredientsText: 'carbonated water, caramel color, phosphoric acid, aspartame, caffeine, acesulfame potassium',
        expected: 'soda'
      },
      {
        name: 'Unsweetened sparkling water',
        categoryTags: ['beverages', 'waters'],
        ingredientsText: 'carbonated water',
        expected: 'sparkling_water'
      },
      {
        name: 'Original energy drink',
        categoryTags: ['beverages', 'sodas', 'energy drinks'],
        ingredientsText: 'carbonated water, sugar, citric acid, taurine, caffeine, natural flavors',
        expected: 'energy_drink'
      },
      {
        name: 'Zero sugar hydration beverage',
        categoryTags: ['beverages', 'sweetened beverages', 'thirst quenchers'],
        ingredientsText: 'water, citric acid, sodium citrate, salt, monopotassium phosphate, natural flavor, sucralose',
        expected: 'electrolyte_beverage'
      },
      {
        name: 'Mineral hydration beverage',
        categoryTags: [],
        ingredientsText: 'water, citric acid, salt, calcium lactate, potassium chloride, magnesium oxide, natural flavor, stevia',
        expected: 'electrolyte_beverage'
      }
    ];

    for (const fixture of fixtures) {
      const resolution = resolveProductCategory(fixture);
      expect(resolution.selectedCategoryId).toBe(fixture.expected);
      expect(resolution.interpretationConfidence).not.toBe('low');
      expect(CATEGORY_PROFILES[fixture.expected]).toBeDefined();
    }
  });

  it('keeps sparkling water distinct from soda and specific beverages above broad soda tags', () => {
    const sparkling = resolveProductCategory({
      name: 'Pure sparkling water',
      categoryTags: ['beverages', 'sodas', 'carbonated waters'],
      ingredientsText: 'carbonated water'
    });
    const energy = resolveProductCategory({
      name: 'Caffeinated energy drink',
      categoryTags: ['beverages', 'sodas', 'energy drinks'],
      ingredientsText: 'carbonated water, sugar, taurine, caffeine, natural flavors'
    });

    expect(sparkling.selectedCategoryId).toBe('sparkling_water');
    expect(energy.selectedCategoryId).toBe('energy_drink');
    expect(sparkling.candidates[0]?.score).toBeGreaterThan(sparkling.candidates.find((item) => item.categoryId === 'soda')?.score ?? 0);
    expect(energy.candidates[0]?.score).toBeGreaterThan(energy.candidates.find((item) => item.categoryId === 'soda')?.score ?? 0);
  });

  it('gives every ranked category candidate evidence and confidence', () => {
    const resolution = resolveProductCategory({
      name: 'Vanilla ice cream',
      categoryTags: ['frozen desserts', 'ice cream'],
      ingredientsText: 'cream, milk, sugar, egg yolks, vanilla extract'
    });
    expect(resolution.candidates.length).toBeGreaterThan(1);
    for (const candidate of resolution.candidates) {
      expect(candidate.evidence.length).toBeGreaterThan(0);
      expect(candidate.evidence.every((item) => Boolean(item.specificity))).toBe(true);
      expect(candidate.suppressions).toEqual(expect.any(Array));
      expect(['low', 'medium', 'high']).toContain(candidate.confidence);
      expect(candidate.score).toBeGreaterThan(0);
    }
  });

  it('uses token boundaries so internal substrings cannot create unrelated candidates', () => {
    const resolution = resolveProductCategory({
      name: 'Dark chocolate bar',
      categoryTags: ['dark chocolates'],
      ingredientsText: 'cacao, cocoa butter, coconut sugar'
    });
    expect(resolution.selectedCategoryId).toBe('chocolate');
    expect(resolution.candidates.map((candidate) => candidate.categoryId)).not.toContain('soda');
  });

  it('keeps incidental flavor words below specific product-form evidence', () => {
    const resolution = resolveProductCategory({
      name: 'Chocolate sea salt snack',
      categoryTags: ['energy bars'],
      ingredientsText: 'dates, egg whites, almonds, cashews'
    });
    expect(resolution.selectedCategoryId).toBe('protein_bar');
    expect(resolution.interpretationConfidence).toBe('high');
    expect(resolution.candidates.map((candidate) => candidate.categoryId)).not.toContain('salt');

    const proteinSnack = resolveProductCategory({
      name: 'Seasoned protein chips',
      categoryTags: ['crisps', 'salty snacks'],
      ingredientsText: 'milk protein isolate, whey protein isolate, corn starch, sunflower oil'
    });
    expect(proteinSnack.selectedCategoryId).toBe('protein_chip');
    expect(proteinSnack.interpretationConfidence).toBe('high');
  });

  it('normalizes approved singular and plural category forms deterministically', () => {
    const resolution = resolveProductCategory({
      name: 'Zero sugar vanilla',
      categoryTags: ['greek style yogurts'],
      ingredientsText: 'skim milk, live cultures, vanilla'
    });
    expect(resolution.selectedCategoryId).toBe('yogurt');
    expect(resolution.interpretationConfidence).toBe('high');
  });

  it('resolves common packaged-food forms from specific provider categories', () => {
    const fixtures = [
      { name: 'Chickpea noodles', categoryTags: ['pastas'], expected: 'pasta' },
      { name: 'Multigrain loaf', categoryTags: ['multigrain sliced breads'], expected: 'bread' },
      { name: 'Lentil meal', categoryTags: ['canned soups', 'lentil soups'], expected: 'soup' },
      { name: 'Toasted oat rings', categoryTags: ['breakfast cereals', 'extruded cereals'], expected: 'cereal' },
      { name: 'Oven-roasted poultry slices', categoryTags: ['prepared meats', 'turkey breasts'], expected: 'prepared_meat' },
      { name: 'Crunchy oat snack', categoryTags: ['cereal bars'], expected: 'cereal_bar' }
    ];

    for (const fixture of fixtures) {
      const resolution = resolveProductCategory(fixture);
      expect(resolution.selectedCategoryId).toBe(fixture.expected);
      expect(resolution.interpretationConfidence).toBe('high');
      expect(CATEGORY_PROFILES[fixture.expected]).toBeDefined();
    }
  });

  it('requires explicit hydration-mix context before minerals support electrolyte form', () => {
    const plantMilk = resolveProductCategory({
      name: 'Almondmilk',
      categoryTags: ['plant based milk alternatives', 'milks liquid and powder'],
      ingredientsText: 'filtered water, almonds, potassium citrate, sea salt'
    });
    const genericPowder = resolveProductCategory({
      name: 'Mineral beverage',
      categoryTags: ['beverage powders'],
      ingredientsText: 'water, potassium citrate, magnesium citrate'
    });
    const fortifiedPlantMilk = resolveProductCategory({
      name: 'Unsweetened almond beverage',
      categoryTags: ['plant based milk alternatives'],
      ingredientsText: 'filtered water, almonds, calcium carbonate, potassium citrate, natural flavor, sea salt'
    });
    expect(plantMilk.selectedCategoryId).toBe('plant_milk');
    expect(plantMilk.candidates.map((candidate) => candidate.categoryId)).not.toContain('electrolyte');
    expect(genericPowder.candidates.map((candidate) => candidate.categoryId)).not.toContain('electrolyte');
    expect(fortifiedPlantMilk.selectedCategoryId).toBe('plant_milk');
    expect(fortifiedPlantMilk.candidates.map((candidate) => candidate.categoryId)).not.toContain('electrolyte_beverage');
  });

  it('keeps condiment identity from being promoted to pasta sauce without pasta-sauce evidence', () => {
    const condiment = resolveProductCategory({
      name: 'Tomato ketchup',
      categoryTags: ['condiments', 'tomato sauces', 'ketchup'],
      ingredientsText: 'tomatoes, vinegar, sugar, onion powder, salt'
    });
    expect(condiment.selectedCategoryId).toBe('condiments');
    expect(condiment.candidates.map((candidate) => candidate.categoryId)).not.toContain('marinara');

    const marinara = resolveProductCategory({
      name: 'Tomato basil pasta sauce',
      categoryTags: ['pasta sauces'],
      ingredientsText: 'tomatoes, olive oil, onion, garlic, basil'
    });
    expect(marinara.selectedCategoryId).toBe('marinara');
    expect(marinara.interpretationConfidence).toBe('high');
    expect(marinara.candidates.map((candidate) => candidate.categoryId)).not.toContain('pasta');
  });

  it('requires every category profile to resolve every rule family explicitly', () => {
    for (const profile of Object.values(CATEGORY_PROFILES)) {
      expect(Object.keys(profile.rulePolicy).sort()).toEqual([...RULE_FAMILIES].sort());
    }
  });

  it('profile policies reject inappropriate generic rules', () => {
    expect(CATEGORY_PROFILES.ice_cream?.rulePolicy).toMatchObject({ sugar_density: 'context_only', calorie_density: 'context_only', fat_density: 'context_only' });
    expect(CATEGORY_PROFILES.salt?.rulePolicy).toMatchObject({ sodium_density: 'context_only', protein_density: 'suppress', fiber_density: 'suppress' });
    expect(CATEGORY_PROFILES.electrolyte?.rulePolicy).toMatchObject({ sodium_density: 'context_only', calorie_density: 'suppress' });
    expect(CATEGORY_PROFILES.chips?.rulePolicy).toMatchObject({ protein_density: 'suppress', fiber_density: 'suppress' });
    expect(CATEGORY_PROFILES.marinara?.rulePolicy).toMatchObject({ calorie_density: 'suppress', ingredient_simplicity: 'apply' });
    expect(CATEGORY_PROFILES.plant_milk?.rulePolicy.protein_density).toBe('suppress');
    expect(CATEGORY_PROFILES.soda?.rulePolicy).toMatchObject({ protein_density: 'suppress', fiber_density: 'suppress', sweeteners: 'context_only' });
    expect(CATEGORY_PROFILES.sparkling_water?.rulePolicy).toMatchObject({ calorie_density: 'suppress', protein_density: 'suppress', fiber_density: 'suppress' });
    expect(CATEGORY_PROFILES.energy_drink?.rulePolicy).toMatchObject({ flavor_systems: 'apply', sweeteners: 'context_only' });
    expect(CATEGORY_PROFILES.electrolyte_beverage?.rulePolicy).toMatchObject({ sodium_density: 'context_only', calorie_density: 'suppress' });
  });

  it('scores formulated beverages from category and ingredient evidence without requiring ordinary food macros', () => {
    const diet = scoreProductLabel({
      name: 'Zero sugar cola',
      categoryTags: ['diet sodas'],
      ingredientsText: 'carbonated water, caramel color, phosphoric acid, aspartame, caffeine, potassium benzoate, natural flavor, acesulfame potassium',
      sourceConfidence: 'high',
      ingredientEvidenceStatus: 'complete',
      servingNutrients: { sugar_g: 0, sodium_mg: 35 }
    });
    const withoutMacros = scoreProductLabel({
      name: 'Zero sugar cola',
      categoryTags: ['diet sodas'],
      ingredientsText: 'carbonated water, caramel color, phosphoric acid, aspartame, caffeine, potassium benzoate, natural flavor, acesulfame potassium',
      sourceConfidence: 'high',
      ingredientEvidenceStatus: 'complete'
    });
    const regular = scoreProductLabel({
      name: 'Regular cola',
      categoryTags: ['colas', 'carbonated soft drinks'],
      ingredientsText: 'carbonated water, high fructose corn syrup, caramel color, phosphoric acid, natural flavors, caffeine',
      sourceConfidence: 'high',
      ingredientEvidenceStatus: 'complete',
      servingNutrients: { calories: 140, sugar_g: 39, sodium_mg: 45 }
    });

    expect(diet).toMatchObject({ categoryId: 'soda', displayScore: expect.any(Number), letterGrade: expect.any(String) });
    expect(withoutMacros).toMatchObject({ categoryId: 'soda', displayScore: expect.any(Number), scoreRange: expect.any(Array) });
    expect(regular.displayScore).toBeLessThan(diet.displayScore!);
    expect(diet.considerations.some((item) => item.includes('Caffeine is declared in the available ingredient list.'))).toBe(true);
    expect(diet.scoreLedger.find((entry) => entry.ruleId === 'caffeine_context')).toMatchObject({ delta: 0 });
  });

  it('retains category-relative beverage context without turning zero macros into bonuses', () => {
    const sparkling = scoreProductLabel({
      name: 'Pure sparkling water',
      categoryTags: ['sparkling waters'],
      ingredientsText: 'carbonated water',
      sourceConfidence: 'high',
      ingredientEvidenceStatus: 'complete',
      servingNutrients: { calories: 0, sugar_g: 0, carbs_g: 0, protein_g: 0, fat_g: 0, fiber_g: 0, sodium_mg: 0 }
    });
    const energy = scoreProductLabel({
      name: 'Sweetened energy drink',
      categoryTags: ['energy drinks'],
      ingredientsText: 'carbonated water, sugar, glucose, citric acid, taurine, caffeine, natural and artificial flavors, red 40',
      sourceConfidence: 'high',
      ingredientEvidenceStatus: 'complete',
      servingNutrients: { calories: 160, sugar_g: 38, sodium_mg: 150 }
    });
    const electrolyte = scoreProductLabel({
      name: 'Zero sugar electrolyte beverage',
      categoryTags: ['sports drinks'],
      ingredientsText: 'water, citric acid, sodium citrate, salt, monopotassium phosphate, natural flavor, sucralose, yellow 6',
      sourceConfidence: 'high',
      ingredientEvidenceStatus: 'complete',
      servingNutrients: { calories: 5, sugar_g: 0, sodium_mg: 780 }
    });

    expect(sparkling.categoryId).toBe('sparkling_water');
    expect(sparkling.scoreLedger.filter((entry) => ['calorie_density', 'protein_density', 'fiber_density'].includes(entry.ruleFamily) && entry.delta > 0)).toEqual([]);
    expect(energy).toMatchObject({ categoryId: 'energy_drink', displayScore: expect.any(Number) });
    expect(energy.considerations.some((item) => item.includes('Caffeine is declared in the available ingredient list.'))).toBe(true);
    expect(electrolyte).toMatchObject({ categoryId: 'electrolyte_beverage', displayScore: expect.any(Number) });
    expect(electrolyte.scoreLedger.find((entry) => entry.ruleId === 'higher_sodium_density')).toMatchObject({ delta: 0 });
  });

  it('never applies a generic rule unless the selected profile allows it', () => {
    const fixtures = [
      score({ name: 'Vanilla ice cream', category: 'ice_cream', ingredientsText: 'cream, milk, sugar, egg yolks, vanilla extract' }),
      score({ name: 'Sea salt', category: 'salt', ingredientsText: 'sea salt' }),
      score({ name: 'Electrolyte powder', category: 'electrolyte', ingredientsText: 'sodium chloride, magnesium malate, natural flavors, stevia' }),
      score({ name: 'Tortilla chips', category: 'chips', ingredientsText: 'corn, vegetable oil, natural flavors, salt' }),
      score({ name: 'Pasta sauce', category: 'marinara', ingredientsText: 'tomatoes, soybean oil, sugar, xanthan gum, salt' })
    ];
    for (const result of fixtures) {
      const profile = CATEGORY_PROFILES[result.categoryId!];
      for (const entry of result.scoreLedger.filter((item) => item.status === 'applied')) {
        expect(profile?.ruleOverrides?.[entry.ruleId] ?? profile?.rulePolicy[entry.ruleFamily]).toBe('apply');
      }
    }
  });

  it('uses standard ten-point bands without exposing plus/minus display grades', () => {
    expect([90, 89, 80, 79, 70, 69, 60, 59].map(productLetterGrade)).toEqual(['A', 'B', 'B', 'C', 'C', 'D', 'D', 'F']);
  });

  it('keeps the output deterministic, serializable, and separated into source and interpretation confidence', () => {
    const input = { name: 'Simple marinara', category: 'marinara', ingredientsText: 'tomatoes, olive oil, basil, sea salt' };
    const first = score(input);
    expect(first).toEqual(score(input));
    expect(first.sourceConfidence).toBe('high');
    expect(first.interpretationConfidence).toBe('high');
    expect(first.categoryComparisonAvailable).toBe(false);
    expect(first.categoryScore).toBeNull();
    expect(first.productForm).toBe('condiment_or_sauce');
    expect(first.macroContext.summary).toContain('do not automatically');
    expect(JSON.parse(JSON.stringify(first))).toEqual(first);
  });

  it('reconciles the final score exactly from supported weighted dimensions', () => {
    const result = score({
      name: 'Flavored tortilla chips', category: 'chips',
      ingredientsText: 'corn, vegetable oil, maltodextrin, natural flavors, monosodium glutamate, red 40, salt'
    });
    expect(result.scoreBaseline).toBeNull();
    expect(result.displayScore).toBe(Math.round(result.dimensions.reduce((sum, dimension) => sum + dimension.contribution, 0)));
    for (const entry of result.scoreLedger.filter((item) => item.status === 'applied' && item.delta < 0)) {
      expect(entry.visibility === 'consider' || Boolean(entry.hiddenReason)).toBe(true);
      if (entry.visibility === 'consider') expect(result.considerations).toContain(entry.userVisibleExplanation);
    }
  });

  it('does not produce a low grade with only positive visible reasons', () => {
    const fixtures = [
      score({ name: 'Flavored chips', category: 'chips', ingredientsText: 'corn, vegetable oil, natural flavors, red 40, salt' }),
      score({ name: 'Protein cereal', category: 'cereal', ingredientsText: 'milk protein blend, corn flour, sunflower oil, natural flavors, sucralose' })
    ];
    for (const result of fixtures.filter((item) => (item.displayScore ?? 100) < 70)) {
      expect(result.dimensions.some((dimension) => dimension.negativeContributions.length > 0 || (dimension.score ?? 100) < 60)).toBe(true);
      expect(result.considerations.length).toBeGreaterThan(0);
    }
  });

  it('allows category excellence without category-specific low starting scores', () => {
    const traditionalIceCream = score({ name: 'Vanilla ice cream', category: 'ice_cream', ingredientsText: 'cream, milk, sugar, egg yolks, vanilla extract' });
    const simpleChips = score({ name: 'Sea salt tortilla chips', category: 'chips', ingredientsText: 'corn, avocado oil, sea salt' });
    const simpleMarinara = score({ name: 'Tomato marinara', category: 'marinara', ingredientsText: 'tomatoes, olive oil, garlic, basil, sea salt' });
    const electrolyte = score({ name: 'Electrolyte powder', category: 'electrolyte', ingredientsText: 'sodium chloride, magnesium malate, citric acid, stevia' });
    expect(traditionalIceCream.displayScore).not.toBeNull();
    expect(traditionalIceCream.scoreScope).toBe('overall');
    expect(simpleChips.displayScore).toBeGreaterThanOrEqual(70);
    expect(simpleMarinara.displayScore).toBeGreaterThanOrEqual(70);
    expect(electrolyte.displayScore).toBeGreaterThanOrEqual(55);
    expect(new Set([traditionalIceCream.scoreBaseline, simpleChips.scoreBaseline, simpleMarinara.scoreBaseline, electrolyte.scoreBaseline])).toEqual(new Set([null]));
  });

  it('requires multidimensional evidence before exposing an A grade', () => {
    const prebiotic = score({
      name: 'Prebiotic sparkling soda', category: 'prebiotic_soda',
      ingredientsText: 'carbonated water, cassava root fiber, chicory root inulin, apple juice concentrate, natural flavors, stevia',
      servingNutrients: { calories: 35, protein_g: 0, fiber_g: 9, sugar_g: 5, sodium_mg: 35 }
    });
    const traditionalIceCream = score({
      name: 'Vanilla ice cream', category: 'ice_cream', ingredientsText: 'cream, milk, sugar, egg yolks, vanilla extract'
    });
    const formulatedCereal = score({
      name: 'Protein cereal', category: 'cereal',
      ingredientsText: 'corn flour, milk protein isolate, sugar, natural flavors',
      servingNutrients: { calories: 150, protein_g: 15, fiber_g: 8, sugar_g: 8, sodium_mg: 180 }
    });
    const claimAlignedCereal = score({
      name: 'Protein cereal', category: 'cereal',
      ingredientsText: 'milk protein isolate, whole oats, natural flavors',
      servingNutrients: { calories: 150, protein_g: 15, fiber_g: 5, sugar_g: 0, sodium_mg: 120 }
    });
    const proteinSnack = score({
      name: 'Protein chips', category: 'protein_chip',
      ingredientsText: 'milk protein isolate, whey protein isolate, vegetable oil, corn starch, natural flavors, sucralose',
      servingNutrients: { calories: 150, protein_g: 19, fiber_g: 1, sugar_g: 1, sodium_mg: 420 }
    });

    const deniedPlantMilk = score({
      name: 'Organic almond milk', category: 'plant_milk',
      ingredientsText: 'water, almonds, sea salt, organic, natural flavors',
      servingNutrients: { calories: 40, protein_g: 1, fiber_g: 1, sugar_g: 0, sodium_mg: 150 }
    });

    expect(prebiotic.letterGrade).not.toBe('A');
    if (prebiotic.rawScore! >= 90) expect(prebiotic.gradeEligibility).toMatchObject({ aEligible: false });
    expect(prebiotic.dimensions.find((dimension) => dimension.id === 'processing_purpose')?.score).toBeLessThan(80);
    expect(deniedPlantMilk.displayScore).not.toBeNull();
    if (deniedPlantMilk.rawScore! >= 90) expect(deniedPlantMilk.gradeEligibility).not.toBeNull();
    expect(claimAlignedCereal.displayScore).toBeLessThan(90);
    expect(claimAlignedCereal.letterGrade).not.toBe('A');
    if (traditionalIceCream.letterGrade === 'A') expect(traditionalIceCream.gradeEligibility).toMatchObject({ aEligible: true });
    expect(formulatedCereal.letterGrade).not.toBe('A');
    expect(proteinSnack.letterGrade).not.toBe('A');
    for (const result of [prebiotic, traditionalIceCream, formulatedCereal, claimAlignedCereal, proteinSnack, deniedPlantMilk]) {
      expect(result.letterGrade).toBe(productLetterGrade(result.displayScore!));
      if (result.gradeEligibility?.aEligible === false) {
        expect(result.displayScore).toBeLessThan(result.rawScore!);
        expect(result.scoreLedger.some((entry) => entry.ruleId === 'grade_eligibility_adjustment')).toBe(true);
      }
    }
  });

  it('uses source confidence to widen uncertainty without lowering the central dimension score', () => {
    const confidenceOnly = score({
      name: 'Organic almond milk', category: 'plant_milk', sourceConfidence: 'medium', labels: ['organic'],
      ingredientsText: 'water, almonds, sea salt',
      servingNutrients: { calories: 40, protein_g: 1, fiber_g: 1, sugar_g: 0, sodium_mg: 150 }
    });
    const highConfidence = score({
      name: 'Organic almond milk', category: 'plant_milk', sourceConfidence: 'high', labels: ['organic'],
      ingredientsText: 'water, almonds, sea salt',
      servingNutrients: { calories: 40, protein_g: 1, fiber_g: 1, sugar_g: 0, sodium_mg: 150 }
    });

    expect(confidenceOnly.rawScore).toBe(highConfidence.rawScore);
    expect(confidenceOnly.displayScore).toBe(highConfidence.displayScore);
    expect(confidenceOnly.letterGrade).toBe(highConfidence.letterGrade);
    expect(confidenceOnly.gradeEligibility?.aEligible).toBe(highConfidence.gradeEligibility?.aEligible);
    expect(confidenceOnly.scoreRange![1] - confidenceOnly.scoreRange![0]).toBeGreaterThan(
      highConfidence.scoreRange![1] - highConfidence.scoreRange![0]
    );
  });

  it('uses neutral lower-result context without an unsupported peer comparison', () => {
    const result = score({
      name: 'Organic seed crackers', category: 'crackers', labels: ['organic'],
      ingredientsText: 'almond flour, sunflower seeds, flax seeds, tapioca starch, rosemary extract, sea salt'
    });
    expect(result.displayScore).not.toBeNull();
    expect(result.considerations.join(' ').toLowerCase()).not.toContain('compared with');
  });

  it('deduplicates user-facing protein and formulation concepts without changing score math', () => {
    const result = score({
      name: 'Protein bar', category: 'protein_bar',
      ingredientsText: 'milk protein isolate, soluble corn fiber, vegetable oils (sunflower oil, canola oil), natural flavors, soy lecithin, sucralose',
      servingNutrients: { calories: 190, protein_g: 20, fiber_g: 10, sugar_g: 2, sodium_mg: 210 }
    });
    const visible = [...result.positives, ...result.considerations];
    expect(new Set(visible).size).toBe(visible.length);
    expect(result.factors.every((item) => item.id.startsWith('dimension_'))).toBe(true);
    expect(result.considerations.some((item) => item.startsWith('Additives and formulation:'))).toBe(true);
    expect(result.displayScore).toBe(Math.round(result.dimensions.reduce((sum, dimension) => sum + dimension.contribution, 0)));
  });

  it('keeps every public score aligned with its displayed grade', () => {
    const fixtures = [
      score({ name: 'Vanilla ice cream', category: 'ice_cream', ingredientsText: 'cream, milk, sugar, egg yolks, vanilla extract' }),
      score({ name: 'Organic almond milk', category: 'plant_milk', ingredientsText: 'water, almonds, sea salt, organic, natural flavors' }),
      score({ name: 'Classic soda', category: 'soda', ingredientsText: 'carbonated water, cane sugar, natural flavors', servingNutrients: { sugar_g: 39 } }),
      score({ name: 'Sparse cereal', category: 'cereal', ingredientsText: 'whole oats, cinnamon, sea salt' })
    ];
    for (const result of fixtures) {
      expect(result.displayScore).not.toBeNull();
      expect(productLetterGrade(result.displayScore!)).toBe(result.letterGrade);
    }
    for (const result of fixtures.filter((item) => item.scoreLedger.some((entry) => entry.ruleId === 'grade_eligibility_adjustment'))) {
      expect(result.gradeEligibility).toMatchObject({ aEligible: false, deniedReasons: expect.any(Array) });
    }
  });

  it('keeps allulose, stevia, and monk fruit neutral and out of default considerations', () => {
    const combined = score({
      name: 'Prebiotic sparkling soda', category: 'prebiotic_soda',
      ingredientsText: 'carbonated water, chicory root inulin, allulose, stevia, monk fruit, natural flavors',
      servingNutrients: { calories: 25, fiber_g: 7, sugar_g: 3, sodium_mg: 20 }
    });
    const neutralIds = ['allulose_context', 'stevia_context', 'monk_fruit_context'];
    const neutralEntries = combined.scoreLedger.filter((entry) => neutralIds.includes(entry.ruleId));
    expect(neutralEntries).toHaveLength(3);
    expect(neutralEntries.every((entry) => entry.delta === 0 && entry.visibility === 'none')).toBe(true);
    expect(neutralEntries.reduce((sum, entry) => sum + entry.delta, 0)).toBe(0);
    expect(combined.factors.map((item) => item.id)).not.toEqual(expect.arrayContaining(neutralIds));
    expect(combined.considerations.join(' ').toLowerCase()).not.toMatch(/allulose|stevia|monk fruit|sugar alcohol|artificial sweetener/);
    expect(combined.evidence_refs.map((item) => item.id)).not.toContain('fda_sugar_alcohol_notice');
  });

  it('keeps fiber contribution distinct from added-fiber and sweetener formulation burden', () => {
    const higherFiber = score({
      name: 'Prebiotic sparkling soda', category: 'prebiotic_soda',
      ingredientsText: 'carbonated water, cassava root fiber, chicory root inulin, apple juice concentrate, natural flavors, stevia',
      servingNutrients: { calories: 35, fiber_g: 9, sugar_g: 5, sodium_mg: 35 }
    });
    const lowerFiber = score({
      name: 'Prebiotic sparkling soda', category: 'prebiotic_soda',
      ingredientsText: 'carbonated water, apple cider vinegar, cane sugar, natural flavors, stevia',
      servingNutrients: { calories: 25, fiber_g: 2, sugar_g: 5, sodium_mg: 15 }
    });
    expect(higherFiber.letterGrade).not.toBe('A');
    expect(lowerFiber.scoreLedger.find((entry) => entry.ruleId === 'stevia_context')).toMatchObject({ delta: 0, visibility: 'none' });
    expect(higherFiber.dimensions.find((dimension) => dimension.id === 'category_nutrition_fit')?.positiveContributions.map((entry) => entry.ruleId)).toContain('meaningful_role_fiber');
    expect(higherFiber.dimensions.find((dimension) => dimension.id === 'ingredient_integrity')?.rulesFired).toContain('isolated_fiber_ingredient_order');
  });

  it('deduplicates positioning bonuses and keeps formulated cereal below a traditional ingredient pattern', () => {
    const traditional = score({
      name: 'Traditional oat cereal', category: 'cereal',
      ingredientsText: 'whole oats, cinnamon, sea salt',
      servingNutrients: { calories: 150, protein_g: 5, fiber_g: 4, sugar_g: 0, sodium_mg: 120 }
    });
    const formulated = score({
      name: 'Protein fiber cereal', category: 'cereal',
      ingredientsText: 'milk protein isolate, chicory root inulin, whole oats, natural flavors',
      servingNutrients: { calories: 150, protein_g: 15, fiber_g: 8, sugar_g: 0, sodium_mg: 120 }
    });
    expect(formulated.scoreLedger.filter((entry) => entry.delta !== 0).every((entry) => entry.ruleId === 'grade_eligibility_adjustment')).toBe(true);
    expect(formulated.factors.every((item) => item.id.startsWith('dimension_'))).toBe(true);
    expect(formulated.dimensions.find((dimension) => dimension.id === 'ingredient_integrity')?.rulesFired).toContain('isolated_protein_ingredient_order');
    expect(traditional.displayScore!).toBeGreaterThan(formulated.displayScore!);
    expect(formulated.displayScore).toBeLessThan(90);
    expect(formulated.letterGrade).not.toBe('A');
  });

  it('keeps sodium expected for salt without turning package testing language into quality points', () => {
    const refined = score({
      name: 'Iodized table salt', category: 'salt',
      ingredientsText: 'sodium chloride, dextrose, potassium iodide, calcium silicate',
      servingNutrients: { sodium_mg: 590, calories: 0, protein_g: 0, fiber_g: 0, sugar_g: 0 }
    });
    const simple = score({ name: 'Sea salt', category: 'salt', ingredientsText: 'sea salt' });
    const tested = score({ name: 'Mineral salt', category: 'salt', ingredientsText: 'sea salt', labels: ['third-party purity tested'] });

    expect(refined.summary).toContain('Sodium is expected for salt');
    expect(refined.dimensions.find((dimension) => dimension.id === 'formulation_burden')?.rulesFired).toContain('emulsifier_or_stabilizer_system');
    expect(refined.scoreLedger).toEqual(expect.arrayContaining([expect.objectContaining({ ruleId: 'iodine_context', delta: 0, visibility: 'none' })]));
    expect(refined.factors.map((item) => item.id)).not.toContain('added_sugar');
    expect(refined.displayScore!).toBeLessThan(simple.displayScore!);
    expect(tested.displayScore).toBe(simple.displayScore);
    expect(tested.factors.map((item) => item.id)).not.toContain('documented_quality_testing');
    expect(tested.letterGrade).toBe(simple.letterGrade);
    if (refined.better_options[0]) {
      expect(refined.better_options[0].criteria.join(' ').toLowerCase()).not.toMatch(/protein|fiber|calorie/);
    }
  });

  it('treats electrolyte powder as prepared-use context rather than punishing expected sodium or stevia', () => {
    const electrolyte = score({
      name: 'Citrus electrolyte mix', category: 'electrolyte',
      ingredientsText: 'sodium chloride, citric acid, magnesium malate, natural flavors, stevia leaf extract',
      servingNutrients: { sodium_mg: 1000, calories: 10, protein_g: 0, fiber_g: 0, sugar_g: 0 }
    });
    expect(electrolyte.productForm).toBe('powder_mix');
    expect(electrolyte.preparedUse?.toLowerCase()).toContain('prepared serving');
    expect(electrolyte.factors.map((item) => item.id)).not.toContain('higher_sodium_context');
    expect(electrolyte.factors.map((item) => item.id)).not.toContain('stevia_context');
    expect(electrolyte.dimensions.find((dimension) => dimension.id === 'formulation_burden')?.rulesSuppressed.join(' ')).toContain('plant_high_intensity_sweetener');
    expect(electrolyte.dimensions.find((dimension) => dimension.id === 'formulation_burden')?.rulesFired).not.toContain('synthetic_high_intensity_sweetener');
  });

  it('keeps prepared-use electrolyte sodium neutral without changing the score ledger', () => {
    const electrolyte = score({
      name: 'Citrus electrolyte mix', category: 'electrolyte',
      ingredientsText: 'sodium chloride, magnesium malate, citric acid, natural flavors',
      preparedServingNutrients: { sodium_mg: 1000, calories: 10, protein_g: 0, fiber_g: 0, sugar_g: 0 }
    });

    const sodium = electrolyte.scoreLedger.find((entry) => entry.ruleId === 'higher_sodium_density');
    expect(electrolyte.nutrientBasis.type).toBe('prepared_serving');
    expect(sodium).toMatchObject({ status: 'context_only', delta: 0, presentation: 'neutral_detail', visibility: 'none' });
    expect(electrolyte.considerations.join(' ')).not.toMatch(/sodium is higher/i);
    expect(electrolyte.scoreLedger.every((entry) => entry.delta === 0)).toBe(true);
    expect(electrolyte.displayScore).toBe(Math.round(electrolyte.dimensions.reduce((sum, dimension) => sum + dimension.contribution, 0)));
  });

  it('withholds electrolyte serving rules for per-100-g evidence while preserving other sodium policies', () => {
    const per100Electrolyte = score({
      name: 'Electrolyte powder', category: 'electrolyte',
      ingredientsText: 'sodium chloride, magnesium malate, citric acid',
      servingNutrients: undefined,
      nutrimentsPer100g: { sodium_mg: 1000, sugar_g: 5 }
    });
    const cereal = score({
      name: 'Salted cereal', category: 'cereal', ingredientsText: 'whole oats, sea salt',
      servingNutrients: { calories: 150, protein_g: 4, fiber_g: 5, sugar_g: 2, sodium_mg: 700 }
    });
    const salt = score({
      name: 'Sea salt', category: 'salt', ingredientsText: 'sea salt',
      servingNutrients: { sodium_mg: 590 }
    });

    expect(per100Electrolyte.nutrientBasis.type).toBe('per_100g');
    expect(per100Electrolyte.scoreLedger.map((entry) => entry.ruleId)).not.toContain('higher_sodium_density');
    expect(cereal.scoreLedger.find((entry) => entry.ruleId === 'higher_sodium_density')).toMatchObject({ presentation: 'consideration', visibility: 'consider' });
    expect(cereal.considerations.join(' ')).toMatch(/sodium is higher/i);
    expect(salt.macroContext.highlights.join(' ')).toMatch(/sodium is interpreted as category context/i);
    expect(salt.considerations.join(' ')).not.toMatch(/sodium is higher/i);
  });

  it('places supportive fiber context in What Helps and hides it when a stronger category story already explains it', () => {
    const simpleFiberCereal = score({
      name: 'Whole oat cereal', category: 'cereal', ingredientsText: 'whole oats, cinnamon, sea salt',
      servingNutrients: { calories: 150, protein_g: 5, fiber_g: 8, sugar_g: 2, sodium_mg: 120 }
    });
    const wholeIngredientBar = score({
      name: 'Date and egg protein bar', category: 'protein_bar', ingredientsText: 'dates, egg whites, almonds, sea salt',
      servingNutrients: { calories: 180, protein_g: 12, fiber_g: 7, sugar_g: 14, sodium_mg: 160 }
    });
    const formulatedCereal = score({
      name: 'Protein fiber cereal', category: 'cereal',
      ingredientsText: 'milk protein isolate, chicory root inulin, whole oats, natural flavors',
      servingNutrients: { calories: 150, protein_g: 15, fiber_g: 8, sugar_g: 0, sodium_mg: 120 }
    });
    const missingPrebiotic = score({
      name: 'Prebiotic soda', category: 'prebiotic_soda', ingredientsText: 'carbonated water, cane sugar, natural flavors',
      servingNutrients: { calories: 80, protein_g: 0, fiber_g: 0, sugar_g: 20, sodium_mg: 15 }
    });

    expect(simpleFiberCereal.positives.some((item) => item.includes('Meaningful measured fiber'))).toBe(true);
    expect(simpleFiberCereal.scoreLedger.find((entry) => entry.ruleId === 'fiber_density_context')).toMatchObject({ delta: 0, presentation: 'help', visibility: 'helps' });
    for (const result of [wholeIngredientBar, formulatedCereal]) {
      expect(result.considerations).not.toContain('Fiber is meaningful on the category-selected nutrient basis.');
      expect(result.positives).not.toContain('Fiber is meaningful on the category-selected nutrient basis.');
      expect(result.scoreLedger.find((entry) => entry.ruleId === 'fiber_density_context')).toMatchObject({ delta: 0, presentation: 'neutral_detail', visibility: 'none' });
    }
    expect(missingPrebiotic.scoreLedger.find((entry) => entry.ruleId === 'prebiotic_claim_gap')).toMatchObject({
      status: 'context_only', delta: 0, visibility: 'none'
    });
    expect(missingPrebiotic.considerations.join(' ')).toMatch(/measured sugar|concentrated sweetness/i);
  });

  it('keeps presentation polarity independent from score-delta placement', () => {
    const result = score({
      name: 'Protein cereal', category: 'cereal',
      ingredientsText: 'milk protein isolate, chicory root inulin, whole oats, natural flavors',
      servingNutrients: { calories: 150, protein_g: 15, fiber_g: 8, sugar_g: 0, sodium_mg: 700 }
    });

    for (const entry of result.scoreLedger) {
      if (entry.presentation === 'help') expect(entry.visibility).toBe('helps');
      if (entry.presentation === 'consideration') expect(entry.visibility).toBe('consider');
      if (entry.presentation === 'neutral_detail' || entry.presentation === 'hidden') expect(entry.visibility).toBe('none');
    }
    expect(result.positives.join(' ')).not.toMatch(/sodium is higher|formulation complexity/i);
    expect(result.considerations.filter((item) => /fiber is meaningful|protein is meaningful/i.test(item)).every((item) => item.startsWith('Context only'))).toBe(true);
  });

  it('keeps plant milk focused on label simplicity rather than low protein', () => {
    const milk = score({
      name: 'Unsweetened almond milk', category: 'plant_milk', ingredientsText: 'water, almonds, sea salt',
      servingNutrients: { calories: 40, protein_g: 1, fiber_g: 1, sugar_g: 0, sodium_mg: 150 }
    });
    expect(milk.displayScore).toBeGreaterThanOrEqual(70);
    expect(milk.factors.map((item) => item.id)).not.toContain('protein_low');
    expect(milk.dimensions.find((dimension) => dimension.id === 'category_nutrition_fit')?.negativeContributions.map((entry) => entry.ruleId)).not.toContain('protein_low');
  });

  it('keeps a straightforward marinara out of generic highly-formulated scoring', () => {
    const marinara = score({ name: 'Tomato basil marinara', category: 'marinara', ingredientsText: 'tomatoes, olive oil, onions, basil, sea salt' });
    expect(marinara.displayScore).toBeGreaterThanOrEqual(70);
    expect(marinara.factors.every((item) => item.id.startsWith('dimension_'))).toBe(true);
    expect(marinara.factors.map((item) => item.id)).not.toContain('higher_sodium_context');
  });

  it('ranks traditional ice cream above complex ice cream and a formulated frozen dessert', () => {
    const traditional = score({ name: 'Vanilla ice cream', category: 'ice_cream', ingredientsText: 'cream, milk, sugar, egg yolks, vanilla extract' });
    const mixIn = score({ name: 'Cookie mix-in ice cream', category: 'ice_cream', ingredientsText: 'cream, milk, sugar, cookie pieces (wheat flour, sugar), chocolate, vanilla extract' });
    const frozenDessert = score({ name: 'Frozen dairy dessert cone', category: 'frozen_dairy_dessert', ingredientsText: 'milk, sugar, palm oil, corn syrup, mono and diglycerides, artificial flavor, red 40' });
    expect(traditional.displayScore!).toBeGreaterThan(mixIn.displayScore!);
    expect(mixIn.displayScore!).toBeGreaterThan(frozenDessert.displayScore!);
    expect(traditional.factors.map((item) => item.id)).not.toContain('higher_sugar_context');
  });

  it('uses prebiotic ingredients and fiber amount, not sweetener fear, to compare prebiotic sodas', () => {
    const higherFiber = score({
      name: 'Prebiotic sparkling soda', category: 'prebiotic_soda',
      ingredientsText: 'carbonated water, cassava root fiber, chicory root inulin, apple juice concentrate, natural flavors, stevia',
      servingNutrients: { calories: 35, protein_g: 0, fiber_g: 9, sugar_g: 5, sodium_mg: 35 }
    });
    const lowerFiber = score({
      name: 'Prebiotic sparkling soda', category: 'prebiotic_soda',
      ingredientsText: 'carbonated water, apple cider vinegar, apple juice concentrate, natural flavors, stevia',
      servingNutrients: { calories: 25, protein_g: 0, fiber_g: 2, sugar_g: 5, sodium_mg: 15 }
    });
    const regularSoda = score({
      name: 'Classic soda', category: 'soda',
      ingredientsText: 'carbonated water, cane sugar, natural flavors',
      servingNutrients: { calories: 150, protein_g: 0, fiber_g: 0, sugar_g: 39, sodium_mg: 35 }
    });
    expect(lowerFiber.displayScore!).toBeGreaterThan(regularSoda.displayScore!);
    expect(higherFiber.dimensions.find((dimension) => dimension.id === 'category_nutrition_fit')?.rulesFired).toContain('meaningful_role_fiber');
    expect(higherFiber.evidence_refs.map((item) => item.id)).not.toContain('fda_sugar_alcohol_notice');
    expect(higherFiber.factors.map((item) => item.id)).not.toContain('stevia_context');
    expect(higherFiber.dimensions.find((dimension) => dimension.id === 'formulation_burden')?.rulesSuppressed.join(' ')).toContain('plant_high_intensity_sweetener');
  });

  it('keeps soda, cereal, crackers, and protein formats in their own label contexts', () => {
    const cola = score({
      name: 'Classic cola', category: 'soda', ingredientsText: 'carbonated water, high-fructose corn syrup, natural flavors',
      servingNutrients: { calories: 150, protein_g: 0, fiber_g: 0, sugar_g: 39, sodium_mg: 45 }
    });
    const cereal = score({
      name: 'Protein cereal', category: 'cereal', ingredientsText: 'corn flour, milk protein isolate, sugar, natural flavors',
      servingNutrients: { calories: 150, protein_g: 12, fiber_g: 2, sugar_g: 8, sodium_mg: 180 }
    });
    const crackers = score({
      name: 'Seed crackers', category: 'crackers', ingredientsText: 'whole grain seeds, olive oil, sea salt',
      servingNutrients: { calories: 140, protein_g: 3, fiber_g: 3, sugar_g: 0, sodium_mg: 260 }
    });
    const readyToDrink = score({
      name: 'Ready-to-drink protein shake', category: 'ready_to_drink_protein', ingredientsText: 'milk protein isolate, water, cocoa, stevia',
      servingNutrients: { calories: 160, protein_g: 26, fiber_g: 2, sugar_g: 3, sodium_mg: 240 }
    });
    const powder = score({
      name: 'Vanilla protein powder', category: 'protein_powder', ingredientsText: 'whey protein isolate, cocoa, vanilla, stevia',
      servingNutrients: { calories: 120, protein_g: 25, fiber_g: 0, sugar_g: 1, sodium_mg: 180 }
    });
    expect(cola.displayScore!).toBeLessThan(cereal.displayScore!);
    expect(cereal.factors.map((item) => item.id)).not.toContain('protein_density');
    expect(crackers.factors.map((item) => item.id)).not.toContain('higher_sodium_context');
    expect(readyToDrink.productForm).toBe('beverage');
    expect(powder.productForm).toBe('powder_mix');
    expect(powder.preparedUse?.toLowerCase()).toContain('prepared serving');
  });

  it('does not let protein rescue a formulated protein chip or bar', () => {
    const proteinChip = score({
      name: 'Protein chips', category: 'protein_chip',
      ingredientsText: 'milk protein isolate, whey protein isolate, vegetable oil, corn starch, natural flavors, sucralose',
      servingNutrients: { calories: 150, protein_g: 19, fiber_g: 1, sugar_g: 1, sodium_mg: 420 }
    });
    expect(proteinChip.displayScore).toBeLessThan(70);
    expect(proteinChip.factors.map((item) => item.id)).not.toContain('cultured_dairy_base');
    expect(proteinChip.factors.map((item) => item.id)).not.toContain('protein_density');
  });

  it('ranks a simple chip above a flavored chip and a formulated protein chip', () => {
    const simple = score({ name: 'Sea salt tortilla chips', category: 'chips', ingredientsText: 'corn, avocado oil, sea salt' });
    const flavored = score({
      name: 'Flavored tortilla chips', category: 'chips',
      ingredientsText: 'corn, vegetable oil, natural flavors, sea salt'
    });
    const protein = score({
      name: 'Protein chips', category: 'protein_chip',
      ingredientsText: 'milk protein isolate, whey protein isolate, vegetable oil, corn starch, natural flavors, sucralose'
    });
    expect(simple.displayScore!).toBeGreaterThan(flavored.displayScore!);
    expect(flavored.displayScore!).toBeGreaterThan(protein.displayScore!);
  });

  it('ranks straightforward marinara above progressively formulated sauces', () => {
    const simple = score({ name: 'Simple marinara', category: 'marinara', ingredientsText: 'tomatoes, olive oil, garlic, basil, sea salt' });
    const sweetened = score({ name: 'Sweetened marinara', category: 'marinara', ingredientsText: 'tomatoes, soybean oil, sugar, xanthan gum, salt' });
    const formulated = score({
      name: 'Flavored pasta sauce', category: 'marinara',
      ingredientsText: 'tomato paste, corn syrup, soybean oil, modified corn starch, natural flavors, xanthan gum, caramel color, salt'
    });
    expect(simple.displayScore!).toBeGreaterThan(sweetened.displayScore!);
    expect(sweetened.displayScore!).toBeGreaterThan(formulated.displayScore!);
  });

  it('recognizes short-label chocolate without treating dessert sugar as an automatic quality failure', () => {
    const chocolate = score({ name: 'Dark chocolate', category: 'chocolate', ingredientsText: 'cacao, cocoa butter, coconut sugar' });
    expect(chocolate.displayScore).toBeGreaterThanOrEqual(65);
    expect(chocolate.dimensions.find((dimension) => dimension.id === 'ingredient_integrity')?.negativeContributions.map((item) => item.ruleId)).toContain('added_sugar_ingredient_order');
    expect(chocolate.factors.map((item) => item.id)).not.toContain('added_sugar');
  });

  it('uses cultured dairy context while allowing flavors, gums, and sweeteners to hold back zero-sugar yogurt', () => {
    const simple = score({ name: 'Plain cultured yogurt', category: 'yogurt', ingredientsText: 'milk, cream, live active cultures' });
    const formulated = score({ name: 'Zero sugar yogurt', category: 'yogurt', ingredientsText: 'skim milk, milk protein concentrate, natural flavors, stevia, xanthan gum, sucralose' });
    const cottage = score({
      name: 'Cottage cheese', category: 'cottage_cheese', ingredientsText: 'cultured skim milk, cream, salt, live cultures',
      servingNutrients: { calories: 100, protein_g: 14, fiber_g: 0, sugar_g: 3, sodium_mg: 420 }
    });
    expect(simple.displayScore!).toBeGreaterThan(formulated.displayScore!);
    expect(cottage.factors.map((item) => item.id)).not.toContain('higher_sodium_context');
  });

  it('suppresses known ingredient false positives', () => {
    const falsePositive = score({
      name: 'Meat snack', category: 'meat_snack',
      ingredientsText: 'beef, cultured dextrose, cultured celery powder, palm oil, avocado oil, salt'
    });
    expect(falsePositive.factors.map((item) => item.id)).not.toContain('fermented_food');
    expect(falsePositive.factors.map((item) => item.id)).not.toContain('refined_oil_blend');
    expect(falsePositive.factors.map((item) => item.id)).not.toContain('traditional_oil');
    const marketingOnly = score({ name: 'Sparkling drink', category: 'soda', ingredientsText: 'carbonated water, natural flavors', labels: ['prebiotic'] });
    expect(marketingOnly.factors.map((item) => item.id)).not.toContain('prebiotic_fiber');
  });

  it('ranks a whole-ingredient bar above a heavily formulated protein bar', () => {
    const wholeIngredient = score({
      name: 'Cocoa nut bar', category: 'protein_bar',
      ingredientsText: 'dates, egg whites, almonds, cashews, cocoa, sea salt',
      servingNutrients: { calories: 210, protein_g: 12, fiber_g: 4, sugar_g: 13, sodium_mg: 180 }
    });
    const formulated = score({
      name: 'Cocoa protein bar', category: 'protein_bar',
      ingredientsText: 'milk protein isolate, soluble corn fiber, tapioca syrup, vegetable oils, natural flavors, soy lecithin, sucralose',
      servingNutrients: { calories: 190, protein_g: 20, fiber_g: 10, sugar_g: 2, sodium_mg: 210 }
    });
    expect(wholeIngredient.factors.every((item) => item.id.startsWith('dimension_'))).toBe(true);
    expect(wholeIngredient.displayScore!).toBeGreaterThan(formulated.displayScore!);
    expect(wholeIngredient.considerations.join(' ')).not.toMatch(/calorie|natural sugar|lacks isolated fiber/i);
  });

  it('distinguishes single named, high-oleic, blended, and hydrogenated oils', () => {
    const namedSingle = score({ name: 'Simple crackers', category: 'crackers', ingredientsText: 'almond flour, sunflower oil, sea salt' });
    const highOleic = score({ name: 'Simple crackers', category: 'crackers', ingredientsText: 'almond flour, high oleic sunflower oil, sea salt' });
    const blended = score({ name: 'Snack crackers', category: 'crackers', ingredientsText: 'wheat flour, vegetable oil, salt, natural flavors' });
    const hydrogenated = score({ name: 'Snack crackers', category: 'crackers', ingredientsText: 'wheat flour, partially hydrogenated oil, salt' });
    expect(namedSingle.factors.map((item) => item.id)).not.toContain('refined_oil_blend');
    expect(highOleic.scoreLedger.filter((entry) => entry.delta !== 0).every((entry) => entry.ruleId === 'grade_eligibility_adjustment')).toBe(true);
    expect(blended.dimensions.some((dimension) => dimension.negativeContributions.length > 0)).toBe(true);
    expect(namedSingle.displayScore!).toBeGreaterThan(blended.displayScore!);
    expect(hydrogenated.displayScore!).toBeLessThan(blended.displayScore!);
  });

  it('keeps plant sweeteners, sugar alcohols, synthetic sweeteners, and refined sugars distinct', () => {
    const plantSystem = score({
      name: 'Cultured dairy', category: 'yogurt', ingredientsText: 'milk, cultures, allulose, stevia, monk fruit',
      servingNutrients: { sugar_g: 3, protein_g: 12 }
    });
    const sugarAlcohols = score({ name: 'Cocoa bar', category: 'protein_bar', ingredientsText: 'almonds, cocoa, maltitol, xylitol, erythritol' });
    const synthetic = score({ name: 'Cultured dairy', category: 'yogurt', ingredientsText: 'milk, cultures, sucralose, acesulfame potassium' });
    const refined = score({ name: 'Cultured dairy', category: 'yogurt', ingredientsText: 'milk, cultures, cane sugar, corn syrup' });
    expect(plantSystem.scoreLedger.filter((entry) => ['allulose_context', 'stevia_context', 'monk_fruit_context'].includes(entry.ruleId)).every((entry) => entry.delta === 0)).toBe(true);
    expect(plantSystem.scoreLedger.filter((entry) => entry.ruleId === 'reduced_refined_sugar_sweetener_system')).toHaveLength(1);
    expect(plantSystem.considerations.join(' ')).not.toMatch(/allulose|stevia|monk fruit|sugar alcohol|artificial sweetener/i);
    expect(sugarAlcohols.dimensions.find((dimension) => dimension.id === 'formulation_burden')?.rulesFired).toContain('sugar_alcohol_system');
    expect(synthetic.dimensions.find((dimension) => dimension.id === 'formulation_burden')?.rulesFired).toContain('synthetic_high_intensity_sweetener');
    expect(refined.dimensions.some((dimension) => dimension.negativeContributions.some((entry) => /sweet|sugar/i.test(entry.ruleId)))).toBe(true);
  });

  it('lowers interpretation confidence and hides category comparison for ambiguous products', () => {
    const ambiguous = score({ name: 'Everyday item', ingredientsText: 'water, oats, sea salt', sourceConfidence: 'low' });
    expect(ambiguous.sourceConfidence).toBe('low');
    expect(ambiguous.interpretationConfidence).toBe('low');
    expect(ambiguous.confidence).toBe('low');
    expect(ambiguous.categoryScore).toBeNull();
    expect(ambiguous.categoryComparisonAvailable).toBe(false);
  });

  it('keeps source confidence independent from conflicting category interpretation', () => {
    const conflicting = score({
      name: 'Vanilla ice cream',
      category: 'frozen_dairy_dessert',
      categoryTags: ['ice cream'],
      ingredientsText: 'cream, milk, sugar, egg yolks, vanilla extract',
      sourceConfidence: 'high'
    });
    expect(conflicting.sourceConfidence).toBe('high');
    expect(conflicting.interpretationConfidence).not.toBe('high');
    expect(conflicting.categoryResolution.selectedCategoryId).toBe('frozen_dairy_dessert');
    expect(conflicting.categoryResolution.conflicts.length).toBeGreaterThan(0);
  });

  it('resolves product form before choosing its nutrient basis', () => {
    const prepared = scoreProductLabel({
      name: 'Electrolyte powder', category: 'electrolyte', ingredientsText: 'sodium chloride, magnesium malate, citric acid',
      sourceConfidence: 'high',
      servingNutrients: { sodium_mg: 1000, sugar_g: 20 },
      preparedServingNutrients: { sodium_mg: 250, sugar_g: 5 }
    });
    const fallback = scoreProductLabel({
      name: 'Electrolyte powder', category: 'electrolyte', ingredientsText: 'sodium chloride, magnesium malate, citric acid',
      sourceConfidence: 'high', servingNutrients: { sodium_mg: 250, sugar_g: 5 }
    });
    const salt = scoreProductLabel({
      name: 'Sea salt', category: 'salt', ingredientsText: 'sea salt', sourceConfidence: 'high', servingNutrients: { sodium_mg: 590 }
    });
    expect(prepared.nutrientBasis).toMatchObject({ type: 'prepared_serving', source: 'provided', confidence: 'high' });
    expect(prepared.nutrientBasis.nutrients).toMatchObject({ sodium_mg: 250, sugar_g: 5 });
    expect(fallback.nutrientBasis).toMatchObject({ type: 'prepared_serving', source: 'fallback', confidence: 'medium' });
    expect(salt.nutrientBasis).toMatchObject({ type: 'pantry_context', source: 'context_only' });
  });

  it('keeps per-100g fallback distinct and withholds serving-level nutrient rules', () => {
    const per100 = scoreProductLabel({
      name: 'Classic soda', category: 'soda', ingredientsText: 'carbonated water, cane sugar, natural flavors',
      sourceConfidence: 'high', nutrimentsPer100g: { calories: 180, sugar_g: 42, sodium_mg: 20 }
    });
    const providerServing = scoreProductLabel({
      name: 'Classic soda', category: 'soda', ingredientsText: 'carbonated water, cane sugar, natural flavors',
      sourceConfidence: 'high', servingNutrients: { calories: 180, sugar_g: 42, sodium_mg: 20 }
    });
    const unknown = scoreProductLabel({
      name: 'Classic soda', category: 'soda', ingredientsText: 'carbonated water, cane sugar, natural flavors',
      sourceConfidence: 'high'
    });
    expect(per100.nutrientBasis).toMatchObject({ type: 'per_100g', source: 'fallback', confidence: 'medium' });
    expect(per100.scoreLedger.map((entry) => entry.ruleId)).not.toContain('higher_sugar_density');
    expect(providerServing.nutrientBasis).toMatchObject({ type: 'provider_serving', source: 'provided', confidence: 'high' });
    expect(providerServing.scoreLedger.map((entry) => entry.ruleId)).toContain('higher_sugar_density');
    expect(unknown.nutrientBasis).toMatchObject({ type: 'unknown', source: 'unavailable', confidence: 'low' });
  });

  it('keeps nutrition-only category evidence unscored when it supports only one material dimension', () => {
    const sparse = scoreProductLabel({
      name: 'Protein cereal', category: 'cereal', ingredientsText: null, sourceConfidence: 'high',
      servingNutrients: { calories: 150, protein_g: 15, carbs_g: 20, fat_g: 5, fiber_g: 8, sugar_g: 2, sodium_mg: 150 }
    });
    expect(sparse).toMatchObject({ displayScore: null, scoreBaseline: null, confidence: 'low' });
    expect(sparse.scoreRange).toBeNull();
    expect(sparse.scoreEligibility).toMatchObject({
      eligible: false,
      supportedDimensionCount: 1,
      deniedReasons: expect.arrayContaining(['insufficient_supported_dimension_count'])
    });
    expect(sparse.dimensions.find((dimension) => dimension.id === 'ingredient_integrity')).toMatchObject({ score: null });
    expect(sparse.scoreLedger.map((entry) => entry.ruleId)).not.toEqual(expect.arrayContaining([
      'ingredient_simplicity', 'ingredient_complexity', 'added_sugar', 'isolated_nutrition_system'
    ]));
  });

  it('provides criteria-only same-intent comparison guidance', () => {
    const sauce = score({ name: 'Complex pasta sauce', category: 'marinara', ingredientsText: 'tomatoes, soybean oil, sugar, natural flavors, xanthan gum, salt' });
    expect(sauce.better_options[0]).toMatchObject({ title: 'What to Compare', reason_codes: ['compare_sauce_label'] });
    expect(sauce.better_options[0]?.criteria.join(' ').toLowerCase()).not.toMatch(/protein|fiber/);
  });

  it('parses nested ingredient groups without splitting their contents', () => {
    expect(splitIngredientList('oats, oil blend (canola oil, sunflower oil), sea salt')).toEqual([
      'oats', 'oil blend', 'sea salt'
    ]);
  });

  it('keeps colon-delimited subingredients within their declared parent ingredient', () => {
    const ingredients = 'pasteurized skim milk, live active cultures: s. thermophilus, l. bulgaricus, b. lactis';
    expect(splitIngredientList(ingredients)).toEqual([
      'pasteurized skim milk',
      'live active cultures'
    ]);

    const culturedDairy = score({
      name: 'Plain cultured skyr',
      category: 'yogurt',
      ingredientsText: ingredients,
      servingNutrients: { calories: 100, protein_g: 19, fiber_g: 0, sugar_g: 5, sodium_mg: 65 }
    });
    expect(culturedDairy.displayScore).not.toBeNull();
    if (culturedDairy.rawScore! >= 90) expect(culturedDairy.gradeEligibility).not.toBeNull();
  });

  it('keeps generated V2 copy within general-wellness language', () => {
    const output = JSON.stringify([
      score({ name: 'Sea salt', category: 'salt', ingredientsText: 'sea salt' }),
      score({ name: 'Prebiotic soda', category: 'prebiotic_soda', ingredientsText: 'carbonated water, chicory root inulin, stevia' })
    ]).toLowerCase();
    const blockedTerms = ['diag' + 'nosis', 'treat' + 'ment', 'c' + 'ure', 'pre' + 'scribe', 'ad' + 'renal', 'h' + 'pa', 'cor' + 'tisol', 'hor' + 'mone', 'clin' + 'ical', 'de' + 'tox', 'tox' + 'ic', 'harmful ingredients', 'bad ' + 'food', 'toxic'];
    for (const term of blockedTerms) expect(output).not.toContain(term);
  });

});
