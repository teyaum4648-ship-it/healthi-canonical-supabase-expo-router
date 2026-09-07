import { describe, expect, it } from 'vitest';
import {
  productLetterGrade,
  scoreProductLabel,
  type ProductScoringInput
} from '../../../src/engines/nutrition/productScoring';
import { calculateProductQuality } from '../../../src/features/nutrition/productLookup/productQuality';
import type { HealthiProductSnapshot } from '../../../src/features/nutrition/productLookup/productLookupTypes';

const traceFixtures: Record<string, ProductScoringInput> = {
  regular_cola: {
    name: 'Regular Cola', categoryTags: ['carbonated soft drinks'],
    ingredientsText: 'carbonated water, sugar, caramel color, phosphoric acid, natural flavor, caffeine',
    servingNutrients: { calories: 150, sugar_g: 39, sodium_mg: 35 }
  },
  zero_sugar_cola: {
    name: 'Zero Sugar Cola', categoryTags: ['zero sugar cola'],
    ingredientsText: 'carbonated water, caramel color, phosphoric acid, aspartame, natural flavor, caffeine',
    servingNutrients: { calories: 0, sugar_g: 0, sodium_mg: 40 }
  },
  still_water: {
    name: 'Purified Water', categoryTags: ['bottled waters'],
    ingredientsText: 'purified water',
    ingredientEvidenceStatus: 'complete', sourceConfidence: 'high',
    servingNutrients: { calories: 0, sugar_g: 0, sodium_mg: 0 }
  },
  olipop_vintage_cola: {
    name: 'Olipop Vintage Cola', categoryTags: ['prebiotic sodas'],
    ingredientsText: 'carbonated water, cassava root fiber, natural flavor, stevia, citric acid',
    servingNutrients: { calories: 25, sugar_g: 2, fiber_g: 9, sodium_mg: 30 }
  },
  fairlife_core_power_chocolate: {
    name: 'fairlife Core Power Chocolate', categoryTags: ['protein drinks'],
    ingredientsText: 'filtered milk, milk protein concentrate, cocoa, natural flavor, cellulose gum, stevia',
    servingNutrients: { calories: 170, protein_g: 26, sugar_g: 5, sodium_mg: 240 }
  },
  cinnamon_raisin_bread: {
    name: 'Ezekiel Cinnamon Raisin Bread', categoryTags: ['whole grain breads'],
    ingredientsText: 'organic sprouted wheat, raisins, barley, millet, cinnamon, yeast, sea salt',
    servingNutrients: { calories: 90, protein_g: 4, fiber_g: 3, sugar_g: 5, sodium_mg: 80 }
  },
  protein_pasta: {
    name: 'Barilla Protein+ Penne', categoryTags: ['protein pasta'],
    ingredientsText: 'semolina, lentil flour, pea protein, barley flour',
    servingNutrients: { calories: 190, protein_g: 10, fiber_g: 4, sugar_g: 2, sodium_mg: 0 }
  },
  sea_salt_chips: {
    name: 'Kettle Sea Salt Potato Chips', categoryTags: ['potato chips'],
    ingredientsText: 'potatoes, avocado oil, sea salt',
    servingNutrients: { calories: 150, protein_g: 2, fiber_g: 1, sugar_g: 0, sodium_mg: 110 }
  },
  unsalted_bone_broth: {
    name: 'Pacific Unsalted Chicken Bone Broth', categoryTags: ['bone broths'],
    ingredientsText: 'chicken stock, chicken, onions, carrots, celery, vinegar',
    servingNutrients: { calories: 40, protein_g: 9, sugar_g: 1, sodium_mg: 95 }
  },
  tofu: {
    name: 'Organic Extra Firm Tofu', categoryTags: ['tofu'],
    ingredientsText: 'water, organic soybeans, calcium sulfate',
    servingNutrients: { calories: 90, protein_g: 10, fiber_g: 2, sodium_mg: 15 }
  },
  canned_tuna: {
    name: 'Chunk Light Tuna in Water', categoryTags: ['canned tuna'],
    ingredientsText: 'light tuna, water, sea salt',
    servingNutrients: { calories: 90, protein_g: 20, sodium_mg: 280 }
  },
  plant_burger: {
    name: 'Plant Based Burger', categoryTags: ['plant based burgers'],
    ingredientsText: 'water, pea protein isolate, canola oil, coconut oil, natural flavor, methylcellulose, potato starch, beet color',
    servingNutrients: { calories: 230, protein_g: 20, fiber_g: 2, sodium_mg: 390, saturated_fat_g: 5 }
  },
  plain_peanut_butter: {
    name: 'Plain peanut butter', categoryTags: ['nut and seed spreads'],
    ingredientsText: 'peanuts',
    servingNutrients: { calories: 190, protein_g: 8, fiber_g: 3, sugar_g: 2, sodium_mg: 0 }
  }
};

describe('Product Quality Engine V5 compatibility and invariants', () => {
  it('uses supported dimensions rather than a shared neutral baseline', () => {
    const result = scoreProductLabel(traceFixtures.sea_salt_chips!);
    expect(result.engineVersion).toBe('product_quality_v5');
    expect(result.scoreBaseline).toBeNull();
    expect(result.dimensions.map((dimension) => dimension.id)).toEqual([
      'ingredient_integrity',
      'formulation_burden',
      'category_nutrition_fit',
      'food_structure',
      'processing_purpose'
    ]);
    expect(result.displayScore).toBe(Math.round(result.dimensions.reduce((sum, dimension) => sum + dimension.contribution, 0)));
    expect(result.supportedDimensionWeight).toBeGreaterThanOrEqual(0.5);
  });

  it('keeps nutrition-only evidence unsupported when too few material dimensions can be scored', () => {
    const result = scoreProductLabel({
      name: 'Whole Grain Bread',
      categoryTags: ['whole grain breads'],
      servingNutrients: { calories: 100, fiber_g: 3, protein_g: 4, sodium_mg: 120 },
      sourceConfidence: 'low',
      ingredientEvidenceStatus: 'absent'
    });
    expect(result.displayScore).toBeNull();
    expect(result.dimensions.find((item) => item.id === 'ingredient_integrity')).toMatchObject({ score: null });
    expect(result.scoreRange).toBeNull();
    expect(result.scoreEligibility.deniedReasons).toContain('insufficient_supported_dimension_count');
  });

  it('preserves grade thresholds and permits both strong and severe outcomes', () => {
    const water = scoreProductLabel(traceFixtures.still_water!);
    const severe = scoreProductLabel({
      name: 'Formulated Cola', categoryTags: ['colas'],
      ingredientsText: 'carbonated water, high fructose corn syrup, maltodextrin, caramel color, artificial flavor, sucralose, acesulfame potassium, red 40, yellow 5, xanthan gum, modified starch, hydrogenated palm oil',
      servingNutrients: { calories: 190, sugar_g: 48, sodium_mg: 90 }
    });
    expect(water.letterGrade).toBe(productLetterGrade(water.displayScore!));
    expect(water.displayScore).toBeGreaterThanOrEqual(80);
    expect(severe.displayScore!).toBeLessThan(55);
    expect(productLetterGrade(90)).toBe('A');
    expect(productLetterGrade(80)).toBe('B');
    expect(productLetterGrade(70)).toBe('C');
    expect(productLetterGrade(60)).toBe('D');
    expect(productLetterGrade(59)).toBe('F');
  });

  it('keeps ordinary regular cola materially below a severe formulation without collapsing either result to zero', () => {
    const regular = scoreProductLabel(traceFixtures.regular_cola!);
    const severe = scoreProductLabel({
      name: 'Severely formulated sugar-sweetened cola', categoryTags: ['colas'],
      ingredientsText: 'carbonated water, high fructose corn syrup, maltodextrin, artificial flavor, sucralose, acesulfame potassium, red 40, yellow 5, xanthan gum, modified starch, hydrogenated palm oil',
      servingNutrients: { calories: 190, sugar_g: 48, sodium_mg: 90 }
    });
    expect(regular.letterGrade).toBe('D');
    expect(regular.displayScore).toBeGreaterThan(20);
    expect(severe.displayScore!).toBeLessThan(regular.displayScore!);
    expect(regular.dimensions.every((dimension) => dimension.score === null || dimension.score > 0)).toBe(true);
  });

  it('keeps zero-sugar cola materially above regular cola without making a sweetener an automatic F', () => {
    const regular = scoreProductLabel(traceFixtures.regular_cola!);
    const zero = scoreProductLabel(traceFixtures.zero_sugar_cola!);
    const singleSweetener = scoreProductLabel({
      name: 'Diet sparkling drink', categoryTags: ['diet sodas'],
      ingredientsText: 'carbonated water, sucralose', ingredientEvidenceStatus: 'complete', sourceConfidence: 'high',
      servingNutrients: { calories: 0, sugar_g: 0, sodium_mg: 20 }
    });
    expect(zero.displayScore!).toBeGreaterThan(regular.displayScore!);
    expect(zero.dimensions.find((dimension) => dimension.id === 'category_nutrition_fit')).toMatchObject({
      evidenceState: 'supported_absence', anchor: { ruleId: 'nutrition_reference' }
    });
    expect(singleSweetener.letterGrade).not.toBe('F');
    expect(singleSweetener.dimensions.find((dimension) => dimension.id === 'formulation_burden')?.rulesFired).toContain('synthetic_high_intensity_sweetener');
  });

  it('prevents ordinary packaged-food concerns from creating near-zero dimensions', () => {
    const ordinary = scoreProductLabel({
      name: 'Flavored corn chips', categoryTags: ['potato chips'],
      ingredientsText: 'corn, vegetable oil, natural flavor, sea salt',
      servingNutrients: { calories: 150, fiber_g: 1, sugar_g: 1, sodium_mg: 180 }
    });
    for (const dimension of ordinary.dimensions.filter((item) => item.score !== null)) {
      expect(dimension.score, dimension.id).toBeGreaterThan(20);
    }
  });

  it('awards bounded supported-absence credit only when ingredient evidence is complete', () => {
    const complete = scoreProductLabel({
      name: 'Simple category beverage', categoryTags: ['diet sodas'],
      ingredientsText: 'carbonated water, sucralose', ingredientEvidenceStatus: 'complete', sourceConfidence: 'high',
      servingNutrients: { sugar_g: 0, sodium_mg: 20 }
    });
    const partial = scoreProductLabel({
      name: 'Simple category beverage', categoryTags: ['diet sodas'],
      ingredientsText: 'carbonated water, sucralose', ingredientEvidenceStatus: 'partial', sourceConfidence: 'low',
      servingNutrients: { sugar_g: 0, sodium_mg: 20 }
    });
    expect(complete.dimensions.find((dimension) => dimension.id === 'category_nutrition_fit')?.evidenceState).toBe('supported_absence');
    expect(partial.dimensions.find((dimension) => dimension.id === 'formulation_burden')?.evidenceState).not.toBe('supported_absence');
    expect(partial.dimensions.find((dimension) => dimension.id === 'formulation_burden')?.score).not.toBeNull();
    expect(partial.scoreRange![1] - partial.scoreRange![0]).toBeGreaterThan(complete.scoreRange![1] - complete.scoreRange![0]);
  });

  it('gives performance nutrition visible credit without letting it erase formulation burden', () => {
    const result = scoreProductLabel(traceFixtures.fairlife_core_power_chocolate!);
    const category = result.dimensions.find((dimension) => dimension.id === 'category_nutrition_fit');
    const formulation = result.dimensions.find((dimension) => dimension.id === 'formulation_burden');
    expect(category?.score).toBeGreaterThanOrEqual(65);
    expect(category?.rulesFired).toContain('meaningful_role_protein');
    expect(result.dimensions.find((dimension) => dimension.id === 'processing_purpose')?.score).toBeLessThan(category!.score!);
    expect(result.displayScore!).toBeLessThan(category!.score!);
  });

  it('keeps simple staples strong and requires A grades to pass multidimensional eligibility', () => {
    const chips = scoreProductLabel(traceFixtures.sea_salt_chips!);
    const tofu = scoreProductLabel(traceFixtures.tofu!);
    const tuna = scoreProductLabel(traceFixtures.canned_tuna!);
    const peanut = scoreProductLabel(traceFixtures.plain_peanut_butter!);
    for (const result of [chips, tofu, tuna, peanut]) {
      expect(result.displayScore).toBeGreaterThanOrEqual(70);
      if (result.letterGrade === 'A') expect(result.gradeEligibility).toMatchObject({ aEligible: true });
    }
  });

  it('records overlap ownership and does not charge leading liquid sugar inside formulation burden', () => {
    const result = scoreProductLabel(traceFixtures.regular_cola!);
    const ingredient = result.dimensions.find((dimension) => dimension.id === 'ingredient_integrity')!;
    const formulation = result.dimensions.find((dimension) => dimension.id === 'formulation_burden')!;
    const processing = result.dimensions.find((dimension) => dimension.id === 'processing_purpose')!;
    expect(formulation.negativeContributions.map((entry) => entry.ruleId)).not.toContain('measured_sugar_density_consequence');
    expect(processing.negativeContributions.some((entry) => entry.ruleId === 'ingredient_processing_intensity')).toBe(true);
    expect(ingredient.negativeContributions.filter((entry) => entry.ruleId === 'added_sugar_ingredient_order')).toHaveLength(1);
    expect(result.dimensions.find((dimension) => dimension.id === 'category_nutrition_fit')?.rulesFired).toContain('measured_total_sugar_with_added_sugar_ingredient');
  });

  it('keeps claim alignment from overpowering formulation and ingredient dimensions', () => {
    const prebiotic = scoreProductLabel(traceFixtures.olipop_vintage_cola!);
    const proteinDrink = scoreProductLabel(traceFixtures.fairlife_core_power_chocolate!);
    const plantBurger = scoreProductLabel(traceFixtures.plant_burger!);
    for (const result of [prebiotic, proteinDrink, plantBurger]) {
      expect(result.dimensions.find((item) => item.id === 'processing_purpose')?.score).toBeLessThan(80);
      expect(result.letterGrade).not.toBe('A');
    }
  });

  it('makes every supported dimension evidence-derived and leaves unsupported dimensions unscored', () => {
    const complete = scoreProductLabel(traceFixtures.tofu!);
    for (const dimension of complete.dimensions.filter((item) => item.score !== null)) {
      expect(dimension.anchor, dimension.id).not.toBeNull();
      expect(dimension.evidenceFields.length, dimension.id).toBeGreaterThan(0);
      expect(dimension.rulesEvaluated.length, dimension.id).toBeGreaterThan(0);
      expect(dimension.rulesFired.length, dimension.id).toBeGreaterThan(0);
      expect(dimension.anchor, dimension.id).not.toBeNull();
      expect(dimension.range, dimension.id).not.toBeNull();
      expect(dimension.evidenceState, dimension.id).not.toBe('unsupported');
    }

    const incomplete = scoreProductLabel({
      name: 'Partially reported nut spread', categoryTags: ['nut spreads'],
      ingredientsText: 'peanuts', ingredientEvidenceStatus: 'partial', sourceConfidence: 'low'
    });
    expect(incomplete.dimensions.find((item) => item.id === 'category_nutrition_fit')?.score).toBeNull();
    expect(incomplete.dimensions.find((item) => item.id === 'food_structure')?.score).toBeNull();
    expect(incomplete.dimensions.find((item) => item.id === 'ingredient_integrity')?.score).toBeNull();
    expect(incomplete.scoreRange).toBeNull();
    expect(incomplete.scoreEligibility).toMatchObject({ eligible: false });
  });

  it('resolves plain nut and seed spreads through broad evidence without a narrow category', () => {
    const result = scoreProductLabel(traceFixtures.plain_peanut_butter!);
    expect(result.displayScore).not.toBeNull();
    expect(result.archetype).toMatchObject({ form: 'pantry', base: 'nut_seed', intent: 'staple' });
    expect(result.archetype?.evidence).toEqual(expect.arrayContaining(['broad_identity:nut_seed_spread']));
    expect(result.reasonCodes).toContain('generalized_evidence_fallback');
  });

  it('uses broad archetypes for common product families without endless narrow categories', () => {
    const fixtures: Array<[string, ProductScoringInput]> = [
      ['nut_seed', { name: 'Plain seed butter', categoryTags: ['seed spreads'], ingredientsText: 'sunflower seeds', servingNutrients: { protein_g: 7, fiber_g: 3 } }],
      ['water', traceFixtures.still_water!],
      ['legume', traceFixtures.tofu!],
      ['meat_fish', traceFixtures.canned_tuna!],
      ['legume', traceFixtures.plant_burger!],
      ['grain', { name: 'Whole grain pancake mix', categoryTags: ['pancake mixes'], ingredientsText: 'whole wheat flour, oat flour, baking powder, sea salt', preparedServingNutrients: { protein_g: 6, fiber_g: 4, sugar_g: 2, sodium_mg: 300 } }],
      ['mixed', traceFixtures.fairlife_core_power_chocolate!],
      ['mixed', { name: 'Tomato ketchup condiment', categoryTags: ['condiments'], ingredientsText: 'tomatoes, vinegar, sea salt, spices', servingNutrients: { sugar_g: 3, sodium_mg: 140 } }],
      ['mixed', { name: 'Frozen vegetable meal bowl', categoryTags: ['frozen meals'], ingredientsText: 'brown rice, broccoli, carrots, chickpeas, olive oil, sea salt', servingNutrients: { protein_g: 12, fiber_g: 8, sodium_mg: 420 } }]
    ];
    for (const [base, fixture] of fixtures) {
      const result = scoreProductLabel(fixture);
      expect(result.displayScore, fixture.name).not.toBeNull();
      expect(result.archetype?.base, fixture.name).toBe(base);
    }
  });

  it('keeps live-shaped partial evidence distinct from idealized synthetic evidence', () => {
    const synthetic = scoreProductLabel({ ...traceFixtures.olipop_vintage_cola!, ingredientEvidenceStatus: 'complete', sourceConfidence: 'high' });
    const liveShaped = scoreProductLabel({
      name: traceFixtures.olipop_vintage_cola!.name,
      categoryTags: ['carbonated drinks', 'prebiotic beverages'],
      ingredientsText: 'carbonated water, cassava root fiber, natural flavor, stevia, citric acid',
      ingredientEvidenceStatus: 'partial',
      sourceConfidence: 'medium',
      servingNutrients: { calories: 25, sugar_g: 2, sodium_mg: 30 }
    });
    expect(liveShaped.displayScore).not.toBe(synthetic.displayScore);
    expect(liveShaped.supportedDimensionWeight).toBeLessThanOrEqual(synthetic.supportedDimensionWeight);
    expect(liveShaped.scoreRange![1] - liveShaped.scoreRange![0]).toBeGreaterThan(synthetic.scoreRange![1] - synthetic.scoreRange![0]);
    expect(liveShaped.archetype?.missingEvidence).toEqual(expect.arrayContaining([]));
  });

  it('preserves generalized monotonic quality invariants', () => {
    const water = scoreProductLabel(traceFixtures.still_water!);
    const zeroSugarCola = scoreProductLabel(traceFixtures.zero_sugar_cola!);
    const regularCola = scoreProductLabel(traceFixtures.regular_cola!);
    const simpleCulturedDairy = scoreProductLabel({
      name: 'Plain cultured yogurt', categoryTags: ['yogurts'],
      ingredientsText: 'cultured milk, live active cultures',
      servingNutrients: { calories: 100, protein_g: 15, sugar_g: 5, sodium_mg: 60 }
    });
    const dessertCulturedDairy = scoreProductLabel({
      name: 'Dessert style cultured yogurt', categoryTags: ['yogurts'],
      ingredientsText: 'cultured milk, sugar, corn syrup, natural flavor, modified starch, xanthan gum',
      servingNutrients: { calories: 190, protein_g: 6, sugar_g: 24, sodium_mg: 90 }
    });
    const wholeGrainBread = scoreProductLabel({
      name: 'Whole grain bread', categoryTags: ['whole grain breads'],
      ingredientsText: 'whole wheat, water, flax seeds, yeast, sea salt',
      servingNutrients: { calories: 100, protein_g: 5, fiber_g: 4, sugar_g: 1, sodium_mg: 120 }
    });
    const refinedSweetBread = scoreProductLabel({
      name: 'Sweetened white bread', categoryTags: ['breads'],
      ingredientsText: 'refined wheat flour, sugar, soybean oil, corn syrup, natural flavor, mono and diglycerides',
      servingNutrients: { calories: 140, protein_g: 3, fiber_g: 1, sugar_g: 10, sodium_mg: 190 }
    });
    const simpleTofu = scoreProductLabel(traceFixtures.tofu!);
    const plantBurger = scoreProductLabel(traceFixtures.plant_burger!);
    const simpleChips = scoreProductLabel(traceFixtures.sea_salt_chips!);
    const formulatedChips = scoreProductLabel({
      name: 'Formulated flavored chips', categoryTags: ['potato chips'],
      ingredientsText: 'potatoes, vegetable oil blend, maltodextrin, natural flavor, artificial color, modified starch, monosodium glutamate, xanthan gum',
      servingNutrients: { calories: 160, fiber_g: 1, sugar_g: 2, sodium_mg: 390 }
    });
    const incompleteBread = scoreProductLabel({
      name: wholeGrainBread.categoryLabel ?? 'Whole grain bread',
      categoryTags: ['whole grain breads'],
      ingredientsText: null,
      servingNutrients: { calories: 100, protein_g: 5, fiber_g: 4, sugar_g: 1, sodium_mg: 120 },
      sourceConfidence: 'low',
      ingredientEvidenceStatus: 'absent'
    });
    const width = (result: ReturnType<typeof scoreProductLabel>) => result.scoreRange
      ? result.scoreRange[1] - result.scoreRange[0]
      : null;

    expect(water.displayScore!).toBeGreaterThan(zeroSugarCola.displayScore!);
    expect(zeroSugarCola.displayScore!).toBeGreaterThan(regularCola.displayScore!);
    expect(simpleCulturedDairy.displayScore!).toBeGreaterThan(dessertCulturedDairy.displayScore!);
    expect(wholeGrainBread.displayScore!).toBeGreaterThan(refinedSweetBread.displayScore!);
    expect(simpleTofu.displayScore!).toBeGreaterThan(plantBurger.displayScore!);
    expect(simpleChips.displayScore!).toBeGreaterThan(formulatedChips.displayScore!);
    expect(width(wholeGrainBread)).not.toBeNull();
    expect(width(incompleteBread)).toBeNull();
    expect(incompleteBread.scoreEligibility.eligible).toBe(false);
  });

  it('preserves the approved qualitative anchors across realistic alternatives', () => {
    const water = scoreProductLabel(traceFixtures.still_water!);
    const sparkling = scoreProductLabel({
      name: 'Unsweetened sparkling water', categoryTags: ['sparkling waters'],
      ingredientsText: 'carbonated water', ingredientEvidenceStatus: 'complete', sourceConfidence: 'high',
      servingNutrients: { calories: 0, sugar_g: 0, sodium_mg: 0 }
    });
    const zero = scoreProductLabel(traceFixtures.zero_sugar_cola!);
    const regular = scoreProductLabel(traceFixtures.regular_cola!);
    expect(water.displayScore!).toBeGreaterThanOrEqual(sparkling.displayScore!);
    expect(sparkling.displayScore!).toBeGreaterThan(zero.displayScore!);
    expect(zero.displayScore!).toBeGreaterThan(regular.displayScore!);

    const wholeBread = scoreProductLabel({
      name: 'Whole-grain bread', categoryTags: ['whole grain breads'],
      ingredientsText: 'whole wheat, water, flax seeds, yeast, sea salt',
      servingNutrients: { calories: 100, protein_g: 5, fiber_g: 4, sugar_g: 1, sodium_mg: 120 }
    });
    const sweetRefinedBread = scoreProductLabel({
      name: 'Sweetened white bread', categoryTags: ['breads'],
      ingredientsText: 'refined wheat flour, sugar, soybean oil, corn syrup, natural flavor, mono and diglycerides',
      servingNutrients: { calories: 140, protein_g: 3, fiber_g: 1, sugar_g: 10, sodium_mg: 190 }
    });
    expect(wholeBread.displayScore!).toBeGreaterThan(sweetRefinedBread.displayScore!);

    const enrichedPasta = scoreProductLabel(traceFixtures.protein_pasta!);
    const refinedPasta = scoreProductLabel({
      name: 'Conventional refined pasta', categoryTags: ['pastas'],
      ingredientsText: 'refined wheat flour, water',
      servingNutrients: { calories: 200, protein_g: 6, fiber_g: 2, sugar_g: 2, sodium_mg: 0 }
    });
    expect(enrichedPasta.displayScore!).toBeGreaterThan(refinedPasta.displayScore!);
    expect(enrichedPasta.letterGrade).not.toBe('A');

    const simplePlantPatty = scoreProductLabel({
      name: 'Simple plant-based patty', categoryTags: ['plant based burgers'],
      ingredientsText: 'black beans, mushrooms, oats, onions, olive oil, sea salt',
      servingNutrients: { calories: 190, protein_g: 10, fiber_g: 7, sodium_mg: 280 }
    });
    const formulatedPlantPatty = scoreProductLabel(traceFixtures.plant_burger!);
    expect(simplePlantPatty.displayScore!).toBeGreaterThan(formulatedPlantPatty.displayScore!);
    expect(simplePlantPatty.letterGrade).not.toBe('F');
    expect(formulatedPlantPatty.dimensions.find((dimension) => dimension.id === 'category_nutrition_fit')?.score).toBeGreaterThanOrEqual(65);
  });

  it('produces complete review traces for the approved archetype fixtures', () => {
    for (const [fixtureId, fixture] of Object.entries(traceFixtures)) {
      const result = scoreProductLabel(fixture);
      expect(result.displayScore, fixtureId).not.toBeNull();
      expect(result.archetype, fixtureId).not.toBeNull();
      expect(result.categoryResolution.candidates.length + (result.archetype?.evidence.length ?? 0), fixtureId).toBeGreaterThan(0);
      expect(result.dimensions.length, fixtureId).toBe(5);
      expect(result.scoreRange, fixtureId).not.toBeNull();
      expect(result.reasonCodes.length, fixtureId).toBeGreaterThan(0);
      for (const dimension of result.dimensions.filter((item) => item.score !== null)) {
        expect(dimension.evidence.length + dimension.missingEvidence.length, `${fixtureId}:${dimension.id}`).toBeGreaterThan(0);
      }
    }
  });

  it('distributes 100 deterministic fixtures without a default-score cluster', () => {
    const bases = Object.values(traceFixtures);
    const generatedInputs = Array.from({ length: 100 }, (_, index) => {
      const base = bases[index % bases.length]!;
      const variation = index % 5;
      return {
        ...base,
        name: `${base.name} fixture ${index}`,
        ingredientsText: variation === 0
          ? base.ingredientsText
          : variation === 1
            ? `${base.ingredientsText}, natural flavor`
            : variation === 2
              ? `${base.ingredientsText}, xanthan gum`
              : variation === 3
                ? `${base.ingredientsText}, maltodextrin, artificial color`
                : `${base.ingredientsText}, whole flax seeds`,
        sourceConfidence: variation === 4 ? 'medium' as const : 'high' as const
      };
    });
    const results = generatedInputs.map((input) => scoreProductLabel(input));
    const scores = results.flatMap((result) => result.displayScore === null ? [] : [result.displayScore]);
    const mean = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    const variance = scores.reduce((sum, score) => sum + (score - mean) ** 2, 0) / scores.length;
    const sorted = [...scores].sort((left, right) => left - right);
    const stats = (values: number[]) => {
      const ordered = [...values].sort((left, right) => left - right);
      const average = values.reduce((sum, value) => sum + value, 0) / values.length;
      return {
        min: ordered[0],
        max: ordered.at(-1),
        mean: Math.round(average * 10) / 10,
        median: (ordered[49]! + ordered[50]!) / 2,
        standardDeviation: Math.round(Math.sqrt(values.reduce((sum, value) => sum + (value - average) ** 2, 0) / values.length) * 10) / 10,
        exact75: values.filter((value) => value === 75).length,
        grades: Object.fromEntries(['A', 'B', 'C', 'D', 'F'].map((grade) => [grade, values.filter((value) => productLetterGrade(value) === grade).length]))
      };
    };
    const legacyScores = results.map((result) => {
      const raw = Math.max(0, Math.min(100, Math.round(75 + result.scoreLedger.reduce((sum, entry) => sum + entry.delta, 0))));
      return raw;
    });
    const qualities = results.map((result, index) => {
      const input = Array.from({ length: 100 }, (_, fixtureIndex) => {
        const base = bases[fixtureIndex % bases.length]!;
        const variation = fixtureIndex % 5;
        return {
          ...base,
          ingredientsText: variation === 4 ? null : variation === 0
            ? base.ingredientsText
            : `${base.ingredientsText}, ${variation === 1 ? 'natural flavor' : variation === 2 ? 'xanthan gum' : 'maltodextrin, artificial color'}`
        };
      })[index]!;
      const ingredientStatus = index % 5 === 4 ? 'absent' as const : index % 5 === 3 ? 'partial' as const : 'complete' as const;
      const nutrients = input.servingNutrients ?? {};
      const snapshot: HealthiProductSnapshot = {
        barcode: `fixture-${index}`,
        provider: 'demo',
        name: input.name,
        categories_tags: input.categoryTags,
        ingredients_text: input.ingredientsText,
        ingredient_evidence: {
          resolved_text: input.ingredientsText ?? null,
          raw_text: input.ingredientsText ?? null,
          source_field: input.ingredientsText ? 'fixture' : null,
          language: 'en',
          structured_ingredients: [],
          status: ingredientStatus,
          confidence: ingredientStatus === 'complete' ? 'high' : ingredientStatus === 'partial' ? 'medium' : 'low',
          reconstructed: false,
          conflicts: []
        },
        evidence_confidence: {
          identity: 'high',
          ingredients: ingredientStatus === 'complete' ? 'high' : ingredientStatus === 'partial' ? 'medium' : 'low',
          nutrition: 'medium',
          serving: 'high',
          category: 'high',
          product_form: 'medium',
          provider: 'medium',
          overall: ingredientStatus === 'complete' ? 'high' : 'medium'
        },
        serving_size: '1 fixture serving',
        serving_quantity_g: 100,
        calories_per_serving: nutrients.calories,
        protein_g: nutrients.protein_g,
        carbs_g: nutrients.carbs_g,
        fat_g: nutrients.fat_g,
        saturated_fat_g: nutrients.saturated_fat_g,
        fiber_g: nutrients.fiber_g,
        sugar_g: nutrients.sugar_g,
        sodium_mg: nutrients.sodium_mg,
        quality_flags: [],
        confidence: ingredientStatus === 'complete' ? 'high' : 'medium',
        reason_codes: []
      };
      return calculateProductQuality(snapshot);
    });
    const dimensionCause: Record<string, string> = {
      ingredient_integrity: 'ingredient_integrity_penalty',
      formulation_burden: 'formulation_burden_penalty',
      category_nutrition_fit: 'category_relative_nutrition_failure',
      food_structure: 'food_structure_penalty',
      processing_purpose: 'processing_purpose_penalty'
    };
    const fFixtures = results.flatMap((result, index) => {
      if (result.letterGrade !== 'F') return [];
      const limiting = result.dimensions
        .filter((dimension) => dimension.score !== null && dimension.score < 60)
        .map((dimension) => ({
          id: dimension.id,
          impact: (60 - dimension.score!) * dimension.effectiveWeight
        }))
        .sort((left, right) => right.impact - left.impact)[0];
      return [{
        name: generatedInputs[index]!.name,
        score: result.displayScore,
        dominantCause: limiting ? dimensionCause[limiting.id] : 'score_aggregation_behavior'
      }];
    });
    const fCauseFlags = {
      strong_direct_negative_evidence: results.filter((result) => result.letterGrade === 'F' && result.dimensions.some((dimension) => dimension.negativeContributions.some((entry) => entry.delta <= -10))).length,
      weak_positive_evidence: results.filter((result) => result.letterGrade === 'F' && result.dimensions.reduce((sum, dimension) => sum + dimension.positiveContributions.length, 0) <= 3).length,
      negative_only_dimension_support: results.filter((result) => result.letterGrade === 'F' && result.dimensions.some((dimension) => dimension.evidenceState === 'negative_evidence')).length,
      category_relative_nutrition_failure: results.filter((result) => result.letterGrade === 'F' && (result.dimensions.find((dimension) => dimension.id === 'category_nutrition_fit')?.score ?? 100) < 60).length,
      processing_purpose_penalty: results.filter((result) => result.letterGrade === 'F' && (result.dimensions.find((dimension) => dimension.id === 'processing_purpose')?.score ?? 100) < 60).length,
      formulation_burden_penalty: results.filter((result) => result.letterGrade === 'F' && (result.dimensions.find((dimension) => dimension.id === 'formulation_burden')?.score ?? 100) < 60).length,
      ingredient_integrity_penalty: results.filter((result) => result.letterGrade === 'F' && (result.dimensions.find((dimension) => dimension.id === 'ingredient_integrity')?.score ?? 100) < 60).length,
      missing_positive_evidence: results.filter((result) => result.letterGrade === 'F' && result.dimensions.filter((dimension) => dimension.score !== null).every((dimension) => dimension.positiveContributions.length === 0)).length,
      unsupported_dimensions: results.filter((result) => result.letterGrade === 'F' && result.dimensions.some((dimension) => dimension.score === null)).length,
      score_aggregation_behavior: results.filter((result) => result.letterGrade === 'F' && result.dimensions.filter((dimension) => dimension.score !== null).every((dimension) => dimension.score! >= 60)).length,
      category_archetype_weights: results.filter((result) => {
        if (result.letterGrade !== 'F') return false;
        const supported = result.dimensions.filter((dimension) => dimension.score !== null);
        const unweighted = supported.reduce((sum, dimension) => sum + dimension.score!, 0) / supported.length;
        return unweighted >= 60 && (result.displayScore ?? 100) < 60;
      }).length
    };
    const preCalibrationNamedScores: Record<string, number> = {
      regular_cola: 8,
      zero_sugar_cola: 23,
      still_water: 96,
      olipop_vintage_cola: 68,
      fairlife_core_power_chocolate: 53,
      cinnamon_raisin_bread: 77,
      protein_pasta: 88,
      sea_salt_chips: 84,
      unsalted_bone_broth: 74,
      tofu: 86,
      canned_tuna: 84,
      plant_burger: 33,
      plain_peanut_butter: 89
    };
    const namedAfter = Object.fromEntries(Object.entries(traceFixtures).map(([name, input]) => [name, scoreProductLabel(input).displayScore]));
    const audit = {
      before: {
        min: 3, max: 96, mean: 55.4, median: 57, standardDeviation: 25,
        grades: { A: 2, B: 16, C: 19, D: 10, F: 53 },
        states: { final: 55, estimated: 19, provisional: 23, more_data_needed: 3 },
        confidence: { high: 55, medium: 19, low: 26 },
        unsupportedDimensions: 40, favorableUnsupportedDefaults: 0
      },
      legacySharedBaselineReference: stats(legacyScores),
      after: stats(scores),
      namedScoreChangesGreaterThan10: Object.fromEntries(Object.entries(preCalibrationNamedScores).flatMap(([name, before]) => {
        const after = namedAfter[name];
        return typeof after === 'number' && Math.abs(after - before) > 10 ? [[name, { before, after, delta: after - before }]] : [];
      })),
      corpusComposition: Object.fromEntries([...new Set(results.map((result) => `${result.archetype?.form}/${result.archetype?.intent}/${result.archetype?.base}`))].map((archetype) => [
        archetype,
        results.filter((result) => `${result.archetype?.form}/${result.archetype?.intent}/${result.archetype?.base}` === archetype).length
      ])),
      states: Object.fromEntries(['final', 'estimated', 'provisional', 'more_data_needed'].map((state) => [
        state, qualities.filter((quality) => quality.result_state === state).length
      ])),
      confidence: Object.fromEntries(['high', 'medium', 'low'].map((confidence) => [
        confidence, qualities.filter((quality) => quality.confidence === confidence).length
      ])),
      defaults: results.filter((result) => result.scoreBaseline !== null).length,
      unsupportedDimensions: results.reduce((sum, result) => sum + result.dimensions.filter((dimension) => dimension.score === null).length, 0),
      favorableUnsupportedDefaults: results.reduce((sum, result) => sum + result.dimensions.filter((dimension) => (
        dimension.score !== null && dimension.evidenceState === 'unsupported'
      )).length, 0),
      fDominantCauses: Object.fromEntries([...new Set(fFixtures.map((fixture) => fixture.dominantCause))].map((cause) => [
        cause, fFixtures.filter((fixture) => fixture.dominantCause === cause).length
      ])),
      fCauseFlags,
      fFixtures,
      aGrades: results.filter((result) => result.letterGrade === 'A').length,
      aEvidence: results.filter((result) => result.letterGrade === 'A').map((result) => ({
        name: result.archetype?.evidence[0] ?? 'unknown',
        ingredient: result.dimensions.find((dimension) => dimension.id === 'ingredient_integrity')?.score,
        formulation: result.dimensions.find((dimension) => dimension.id === 'formulation_burden')?.score,
        category: result.dimensions.find((dimension) => dimension.id === 'category_nutrition_fit')?.score,
        scoreScope: result.scoreScope
      }))
    };
    console.info('PRODUCT_QUALITY_V3_AUDIT', JSON.stringify(audit));
    expect(scores).toHaveLength(100);
    expect(Math.min(...scores)).toBeLessThan(60);
    expect(Math.max(...scores)).toBeGreaterThanOrEqual(90);
    expect(Math.sqrt(variance)).toBeGreaterThan(8);
    expect(scores.filter((score) => score === 75).length).toBeLessThan(10);
    expect(new Set(scores).size).toBeGreaterThan(20);
    expect(sorted[0]).toBe(audit.after.min);
    expect(audit.defaults).toBe(0);
    expect(audit.favorableUnsupportedDefaults).toBe(0);
    for (const result of results.filter((item) => item.letterGrade === 'A')) {
      expect(result.displayScore).toBe(result.rawScore);
      expect(result.gradeEligibility).toMatchObject({ aEligible: true });
      for (const id of ['ingredient_integrity', 'formulation_burden', 'category_nutrition_fit'] as const) {
        const dimension = result.dimensions.find((item) => item.id === id);
        expect(dimension?.score, id).toBeGreaterThanOrEqual(id === 'category_nutrition_fit' ? 70 : 85);
        expect(dimension?.anchor, id).not.toBeNull();
        expect(dimension?.evidenceFields.length, id).toBeGreaterThan(0);
      }
    }
  });
});
