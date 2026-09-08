import { describe, expect, it } from 'vitest';

import {
  productLetterGrade,
  scoreProductLabel,
  type ProductScoringInput
} from '../../../src/engines/nutrition/productScoring';
import { calculateProductQuality } from '../../../src/features/nutrition/productLookup/productQuality';
import type { HealthiProductSnapshot } from '../../../src/features/nutrition/productLookup/productLookupTypes';

const corpusBases: ProductScoringInput[] = [
  { name: 'Generic still water', categoryTags: ['bottled waters'], ingredientsText: 'purified water', servingNutrients: { calories: 0, sugar_g: 0, sodium_mg: 0 } },
  { name: 'Generic zero sugar soft drink', categoryTags: ['diet sodas'], ingredientsText: 'carbonated water, caramel color, phosphoric acid, aspartame, natural flavor, caffeine', servingNutrients: { calories: 0, sugar_g: 0, sodium_mg: 40 } },
  { name: 'Generic sweetened soft drink', categoryTags: ['colas'], ingredientsText: 'carbonated water, sugar, caramel color, phosphoric acid, natural flavor, caffeine', servingNutrients: { calories: 150, sugar_g: 39, added_sugar_g: 39, sodium_mg: 35, serving_quantity_g: 355 } },
  { name: 'Generic energy beverage', categoryTags: ['energy drinks'], ingredientsText: 'carbonated water, sugar, citric acid, natural flavor, caffeine, taurine', servingNutrients: { calories: 120, sugar_g: 28, added_sugar_g: 28, sodium_mg: 90, caffeine_mg: 120, serving_quantity_g: 355 } },
  { name: 'Generic electrolyte beverage', categoryTags: ['electrolyte drinks'], ingredientsText: 'water, sodium citrate, potassium chloride, citric acid, stevia', servingNutrients: { calories: 5, sugar_g: 0, sodium_mg: 380, serving_quantity_g: 500 } },
  { name: 'Generic plain cultured dairy', categoryTags: ['yogurts'], ingredientsText: 'cultured milk, live active cultures', servingNutrients: { calories: 100, protein_g: 15, sugar_g: 5, sodium_mg: 60, serving_quantity_g: 170 } },
  { name: 'Generic dessert cultured dairy', categoryTags: ['yogurts'], ingredientsText: 'cultured milk, sugar, corn syrup, natural flavor, modified starch, xanthan gum', servingNutrients: { calories: 190, protein_g: 6, sugar_g: 24, added_sugar_g: 18, sodium_mg: 90, serving_quantity_g: 170 } },
  { name: 'Generic whole grain bread', categoryTags: ['whole grain breads'], ingredientsText: 'whole wheat, water, flax seeds, yeast, sea salt', servingNutrients: { calories: 100, protein_g: 5, fiber_g: 4, sugar_g: 1, sodium_mg: 120, serving_quantity_g: 40 } },
  { name: 'Generic refined sweet bread', categoryTags: ['breads'], ingredientsText: 'refined wheat flour, sugar, soybean oil, corn syrup, natural flavor, mono and diglycerides', servingNutrients: { calories: 140, protein_g: 3, fiber_g: 1, sugar_g: 10, added_sugar_g: 8, sodium_mg: 190, serving_quantity_g: 40 } },
  { name: 'Generic legume staple', categoryTags: ['tofu'], ingredientsText: 'water, whole soybeans, calcium sulfate', servingNutrients: { calories: 90, protein_g: 10, fiber_g: 2, sodium_mg: 15, serving_quantity_g: 100 } },
  { name: 'Generic simple chips', categoryTags: ['potato chips'], ingredientsText: 'whole potatoes, olive oil, sea salt', servingNutrients: { calories: 150, protein_g: 2, fiber_g: 1, sugar_g: 0, sodium_mg: 110, serving_quantity_g: 28 } },
  { name: 'Generic formulated chips', categoryTags: ['potato chips'], ingredientsText: 'potatoes, vegetable oil blend, maltodextrin, natural flavor, artificial color, modified starch, xanthan gum', servingNutrients: { calories: 160, fiber_g: 1, sugar_g: 2, sodium_mg: 390, serving_quantity_g: 28 } },
  { name: 'Generic short-label confection', categoryTags: ['chocolate'], ingredientsText: 'sugar, cocoa butter, milk powder', servingNutrients: { calories: 230, sugar_g: 23, added_sugar_g: 20, saturated_fat_g: 8, serving_quantity_g: 40 } },
  { name: 'Generic long-label confection', categoryTags: ['cookies'], ingredientsText: 'sugar, refined flour, palm kernel oil, corn syrup, natural flavor, artificial color, lecithin, xanthan gum, modified starch', servingNutrients: { calories: 250, sugar_g: 25, added_sugar_g: 22, saturated_fat_g: 9, serving_quantity_g: 45 } },
  { name: 'Generic tomato sauce', categoryTags: ['marinara sauces'], ingredientsText: 'whole tomatoes, olive oil, onion, garlic, basil, sea salt', servingNutrients: { calories: 70, fiber_g: 2, sugar_g: 5, sodium_mg: 340, serving_quantity_g: 125 } },
  { name: 'Generic plant beverage', categoryTags: ['plant milks'], ingredientsText: 'filtered water, whole almonds, sea salt', servingNutrients: { calories: 40, protein_g: 1, sugar_g: 0, sodium_mg: 150, serving_quantity_g: 240 } },
  { name: 'Generic reconstructed protein food', categoryTags: ['plant based meats'], ingredientsText: 'water, pea protein isolate, vegetable oil blend, natural flavor, methylcellulose, modified starch', servingNutrients: { calories: 220, protein_g: 20, fiber_g: 2, sodium_mg: 420, serving_quantity_g: 110 } },
  { name: 'Generic culinary oil', categoryTags: [], ingredientsText: 'cold pressed culinary oil', servingNutrients: { calories: 120, fat_g: 14, serving_quantity_g: 14 } },
  { name: 'Generic concentrated sweetener', categoryTags: [], ingredientsText: 'granulated sweetener', servingNutrients: { calories: 16, carbs_g: 4, sugar_g: 4, added_sugar_g: 4, serving_quantity_g: 4 } },
  { name: 'Generic isolated powder', categoryTags: [], ingredientsText: 'refined isolated starch', servingNutrients: { calories: 30, carbs_g: 7, serving_quantity_g: 8 } }
];

export const deterministicProductQualityCorpus: ProductScoringInput[] = Array.from({ length: 160 }, (_, index) => {
  const base = corpusBases[index % corpusBases.length]!;
  const variation = Math.floor(index / corpusBases.length);
  const suffix = variation === 1 ? ', natural flavor'
    : variation === 2 ? ', xanthan gum'
      : variation === 3 ? ', sugar syrup'
        : variation === 4 ? ', whole intact seed'
          : '';
  return {
    ...base,
    name: `${base.name} sample ${index}`,
    ingredientsText: variation === 5 ? base.ingredientsText : `${base.ingredientsText}${suffix}`,
    ingredientEvidenceStatus: variation === 5 ? 'partial' : 'complete',
    sourceConfidence: variation === 6 ? 'medium' : 'high',
    evidenceContext: {
      identityConfidence: 'high',
      nutritionConfidence: variation === 7 ? 'medium' : 'high',
      servingConfidence: variation === 7 ? 'medium' : 'high',
      productFormConfidence: 'medium'
    }
  };
});

function statistics(values: number[]) {
  const ordered = [...values].sort((left, right) => left - right);
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const middle = Math.floor(ordered.length / 2);
  const median = ordered.length % 2 === 0 ? (ordered[middle - 1]! + ordered[middle]!) / 2 : ordered[middle]!;
  return {
    min: ordered[0],
    max: ordered.at(-1),
    mean: Math.round(mean * 10) / 10,
    median,
    standardDeviation: Math.round(Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length) * 10) / 10,
    grades: Object.fromEntries(['A', 'B', 'C', 'D', 'F'].map((grade) => [grade, values.filter((value) => productLetterGrade(value) === grade).length]))
  };
}

describe('Product Quality deterministic scoring-kernel corpus', () => {
  const directContext = {
    identityConfidence: 'high' as const,
    nutritionConfidence: 'high' as const,
    servingConfidence: 'high' as const,
    productFormConfidence: 'high' as const
  };

  function direct(input: Partial<ProductScoringInput>): ProductScoringInput {
    return {
      name: 'Generic product',
      ingredientEvidenceStatus: 'complete',
      sourceConfidence: 'high',
      evidenceContext: directContext,
      ...input
    };
  }

  it('keeps completeness, simplicity, and ingredient quality as separate evidence', () => {
    const concentratedSweetener = scoreProductLabel(direct({ ingredientsText: 'granulated sweetener', servingNutrients: { sugar_g: 4, added_sugar_g: 4, serving_quantity_g: 4 } }));
    const isolatedStarch = scoreProductLabel(direct({ ingredientsText: 'refined isolated starch', servingNutrients: { carbs_g: 8, serving_quantity_g: 8 } }));
    const technicalComponent = scoreProductLabel(direct({ ingredientsText: 'technical thickener gum' }));
    const wholeSource = scoreProductLabel(direct({ ingredientsText: 'whole intact seed', categoryTags: ['seeds'], servingNutrients: { protein_g: 6, fiber_g: 5, sugar_g: 1, serving_quantity_g: 30 } }));
    const extractedOil = scoreProductLabel(direct({ ingredientsText: 'cold pressed culinary oil', servingNutrients: { fat_g: 14, serving_quantity_g: 14 } }));

    for (const result of [concentratedSweetener, isolatedStarch, technicalComponent, wholeSource, extractedOil]) {
      expect(result.dimensions.find((dimension) => dimension.id === 'formulation_burden')?.score).not.toBeNull();
    }
    expect(concentratedSweetener.displayScore).not.toBeNull();
    expect(concentratedSweetener.letterGrade).not.toBe('A');
    expect(isolatedStarch.letterGrade).not.toBe('A');
    expect(technicalComponent.letterGrade).not.toBe('A');
    expect(wholeSource.displayScore!).toBeGreaterThan(concentratedSweetener.displayScore!);
    expect(wholeSource.displayScore!).toBeGreaterThan(isolatedStarch.displayScore!);
    expect(extractedOil.letterGrade).not.toBe('A');
  });

  it('uses sugar and added-sugar density without category immunity or duplicate dimension charges', () => {
    const shortHighSugar = scoreProductLabel(direct({
      name: 'Generic short-label dessert', categoryTags: ['chocolate'],
      ingredientsText: 'sugar, cocoa butter, milk powder',
      servingNutrients: { calories: 230, sugar_g: 23, added_sugar_g: 20, saturated_fat_g: 8, serving_quantity_g: 40 }
    }));
    const lowerSugar = scoreProductLabel(direct({
      name: 'Generic lower-sugar dessert', categoryTags: ['chocolate'],
      ingredientsText: 'cocoa mass, milk powder, sugar',
      servingNutrients: { calories: 210, sugar_g: 7, added_sugar_g: 5, saturated_fat_g: 8, serving_quantity_g: 40 }
    }));
    const nutrition = shortHighSugar.dimensions.find((dimension) => dimension.id === 'category_nutrition_fit')!;

    expect(shortHighSugar.letterGrade).not.toBe('A');
    expect(lowerSugar.displayScore!).toBeGreaterThan(shortHighSugar.displayScore!);
    expect(nutrition.rulesFired.filter((rule) => rule === 'measured_added_sugar')).toHaveLength(1);
    expect(nutrition.negativeContributions.filter((item) => item.ruleId === 'measured_added_sugar')).toHaveLength(1);
  });

  it('keeps confidence out of central score and grade math', () => {
    const base = direct({
      name: 'Generic whole-grain staple', categoryTags: ['whole grain breads'],
      ingredientsText: 'whole grain, water, intact seeds, yeast, sea salt',
      servingNutrients: { calories: 120, protein_g: 5, fiber_g: 4, sugar_g: 2, sodium_mg: 120, serving_quantity_g: 45 }
    });
    const results = (['high', 'medium', 'low'] as const).map((confidence) => scoreProductLabel({
      ...base,
      sourceConfidence: confidence,
      evidenceContext: { ...directContext, nutritionConfidence: confidence, servingConfidence: confidence, providerConflict: confidence === 'low' }
    }));
    expect([...new Set(results.map((result) => result.rawScore))]).toHaveLength(1);
    expect([...new Set(results.map((result) => result.displayScore))]).toHaveLength(1);
    expect([...new Set(results.map((result) => result.letterGrade))]).toHaveLength(1);
    expect(results.every((result) => result.scoreEligibility.eligible)).toBe(true);
    expect(results.every((result) => !result.scoreEligibility.deniedReasons.includes('uncertainty_range_not_informative'))).toBe(true);
    expect(results.every((result) => result.displayScore === result.rawScore)).toBe(true);
    expect(results[2]!.scoreRange![1] - results[2]!.scoreRange![0]).toBeGreaterThan(results[0]!.scoreRange![1] - results[0]!.scoreRange![0]);
  });

  it('marks a conditional center as supported evidence when a material dimension is unknown', () => {
    const full = scoreProductLabel(direct({
      name: 'Generic whole-grain snack', categoryTags: ['crackers'],
      ingredientsText: 'whole grain, intact seeds, olive oil, sea salt',
      servingNutrients: { calories: 150, fiber_g: 4, sugar_g: 1, sodium_mg: 140, serving_quantity_g: 30 }
    }));
    const withoutCategoryNutrition = scoreProductLabel(direct({
      name: 'Generic product', categoryTags: [],
      ingredientsText: 'whole grain, intact seeds, olive oil, sea salt',
      servingNutrients: undefined,
      evidenceContext: { ...directContext, nutritionConfidence: 'low', servingConfidence: 'low' }
    }));

    expect(full.scoreScope).toBe('overall');
    expect(withoutCategoryNutrition.scoreScope).toBe('supported_evidence');
    expect(withoutCategoryNutrition.scoreRange![0]).toBeLessThanOrEqual(full.displayScore!);
    expect(withoutCategoryNutrition.scoreRange![1]).toBeGreaterThanOrEqual(full.displayScore!);
  });

  it('makes dimensions authoritative and public explanations ledger-faithful', () => {
    const result = scoreProductLabel(direct({
      name: 'Generic formulated cereal', categoryTags: ['breakfast cereals'], labels: ['high protein', 'high fiber'],
      ingredientsText: 'refined grain flour, protein isolate, sugar, natural flavor, modified starch',
      servingNutrients: { calories: 170, protein_g: 16, fiber_g: 7, sugar_g: 9, added_sugar_g: 7, serving_quantity_g: 40 }
    }));
    expect(result.scoreLedger.every((entry) => entry.delta === 0)).toBe(true);
    expect(result.factors.every((factor) => factor.id.startsWith('dimension_'))).toBe(true);
    expect(result.displayScore).toBe(result.rawScore);
    expect(result.positives.every((copy) => result.dimensions.some((dimension) => copy.startsWith(`${dimension.label}:`)))).toBe(true);
    expect(result.considerations.filter((copy) => !copy.startsWith('Context only')).every((copy) => result.dimensions.some((dimension) => copy.startsWith(`${dimension.label}:`)))).toBe(true);
  });

  it('preserves generalized golden pairwise ordering', () => {
    const result = (input: Partial<ProductScoringInput>) => scoreProductLabel(direct(input)).displayScore!;
    const water = result({ name: 'Generic water', categoryTags: ['bottled waters'], ingredientsText: 'purified water', servingNutrients: { sugar_g: 0, sodium_mg: 0, serving_quantity_g: 355 } });
    const zeroSoda = result({ name: 'Generic zero sugar soda', categoryTags: ['diet sodas'], ingredientsText: 'carbonated water, caramel color, phosphoric acid, aspartame, natural flavor', servingNutrients: { sugar_g: 0, sodium_mg: 35, serving_quantity_g: 355 } });
    const sugaredSoda = result({ name: 'Generic sweetened soda', categoryTags: ['colas'], ingredientsText: 'carbonated water, sugar, caramel color, phosphoric acid, natural flavor', servingNutrients: { sugar_g: 39, added_sugar_g: 39, sodium_mg: 35, serving_quantity_g: 355 } });
    const intactStaple = result({ name: 'Generic staple', categoryTags: ['whole grain breads'], ingredientsText: 'whole intact grain, water, yeast, sea salt', servingNutrients: { fiber_g: 5, sugar_g: 1, sodium_mg: 120, serving_quantity_g: 45 } });
    const refinedStaple = result({ name: 'Generic staple', categoryTags: ['breads'], ingredientsText: 'refined grain flour, modified starch, sugar syrup, natural flavor', servingNutrients: { fiber_g: 1, sugar_g: 10, added_sugar_g: 8, sodium_mg: 180, serving_quantity_g: 45 } });
    const plainCultured = result({ name: 'Generic cultured dairy', categoryTags: ['yogurts'], ingredientsText: 'cultured milk, live cultures', servingNutrients: { protein_g: 15, sugar_g: 5, serving_quantity_g: 170 } });
    const dessertCultured = result({ name: 'Generic cultured dairy dessert', categoryTags: ['yogurts'], ingredientsText: 'cultured milk, sugar, corn syrup, natural flavor, modified starch, gum', servingNutrients: { protein_g: 6, sugar_g: 24, added_sugar_g: 18, serving_quantity_g: 170 } });

    expect(water).toBeGreaterThan(zeroSoda);
    expect(zeroSoda).toBeGreaterThan(sugaredSoda);
    expect(intactStaple).toBeGreaterThan(refinedStaple);
    expect(plainCultured).toBeGreaterThan(dessertCultured);
  });

  it('captures the 160-fixture distribution and evidence coverage', () => {
    const results = deterministicProductQualityCorpus.map(scoreProductLabel);
    const qualities = deterministicProductQualityCorpus.map((input, index) => {
      const ingredientStatus = input.ingredientEvidenceStatus ?? (input.ingredientsText ? 'complete' : 'absent');
      const nutrients = input.servingNutrients ?? {};
      const snapshot: HealthiProductSnapshot = {
        barcode: `kernel-fixture-${index}`,
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
          confidence: ingredientStatus === 'complete' ? 'high' : ingredientStatus === 'absent' ? 'low' : 'medium',
          reconstructed: ingredientStatus === 'reconstructed',
          conflicts: []
        },
        evidence_confidence: {
          identity: input.evidenceContext?.identityConfidence ?? 'high',
          ingredients: input.sourceConfidence ?? 'high',
          nutrition: input.evidenceContext?.nutritionConfidence ?? 'high',
          serving: input.evidenceContext?.servingConfidence ?? 'high',
          category: 'high',
          product_form: input.evidenceContext?.productFormConfidence ?? 'medium',
          provider: 'high',
          overall: input.sourceConfidence ?? 'high'
        },
        serving_size: '1 metric fixture serving',
        serving_quantity: nutrients.serving_quantity_g ?? input.servingQuantity ?? 100,
        serving_unit: input.servingUnit ?? 'g',
        serving_quantity_g: nutrients.serving_quantity_g ?? (input.servingUnit !== 'ml' ? input.servingQuantity ?? 100 : null),
        calories_per_serving: nutrients.calories,
        protein_g: nutrients.protein_g,
        carbs_g: nutrients.carbs_g,
        fat_g: nutrients.fat_g,
        saturated_fat_g: nutrients.saturated_fat_g,
        fiber_g: nutrients.fiber_g,
        sugar_g: nutrients.sugar_g,
        added_sugar_g: nutrients.added_sugar_g,
        sodium_mg: nutrients.sodium_mg,
        caffeine_mg: nutrients.caffeine_mg,
        quality_flags: [],
        confidence: input.sourceConfidence ?? 'high',
        reason_codes: []
      };
      return calculateProductQuality(snapshot);
    });
    const scores = results.flatMap((result) => result.displayScore === null ? [] : [result.displayScore]);
    const fGrades = results.flatMap((result, index) => result.letterGrade === 'F' ? [{
      index,
      score: result.displayScore,
      limiting: result.dimensions.filter((dimension) => dimension.score !== null).sort((left, right) => left.score! - right.score!)[0]?.id ?? 'none'
    }] : []);
    const audit = {
      fixtures: results.length,
      scored: scores.length,
      distribution: statistics(scores),
      resultStates: Object.fromEntries(['final', 'estimated', 'provisional', 'more_data_needed'].map((state) => [
        state, qualities.filter((quality) => quality.result_state === state).length
      ])),
      confidence: Object.fromEntries(['high', 'medium', 'low'].map((confidence) => [confidence, results.filter((result) => result.confidence === confidence).length])),
      gradeCertainty: Object.fromEntries(['stable', 'provisional', 'unresolved', 'none'].map((state) => [state, results.filter((result) => (result.gradeCertainty?.state ?? 'none') === state).length])),
      unsupportedDimensions: results.reduce((sum, result) => sum + result.dimensions.filter((dimension) => dimension.score === null).length, 0),
      supportedEvidenceScores: results.filter((result) => result.scoreScope === 'supported_evidence' && result.displayScore !== null).length,
      defaultOnlyScoreCollisions: results.some((result) => result.scoreBaseline !== null) ? ['unexpected-default-backed-score'] : [],
      baseScores: results.slice(0, corpusBases.length).map((result, index) => ({
        fixture: corpusBases[index]!.name,
        score: result.displayScore,
        grade: result.letterGrade,
        scope: result.scoreScope
      })),
      aGrades: results.flatMap((result, index) => result.letterGrade === 'A' ? [{ index, score: result.displayScore, dimensions: result.dimensions.filter((dimension) => dimension.score !== null).map((dimension) => [dimension.id, dimension.score]) }] : []),
      fGradeDominantCauses: Object.fromEntries(['ingredient_integrity', 'formulation_burden', 'category_nutrition_fit', 'food_structure', 'processing_purpose', 'none'].map((cause) => [
        cause, fGrades.filter((fixture) => fixture.limiting === cause).length
      ])),
      fGrades
    };
    console.info('PRODUCT_QUALITY_KERNEL_CORPUS', JSON.stringify(audit));
    expect(results).toHaveLength(160);
    expect(scores.length).toBeGreaterThan(100);
    expect(audit.defaultOnlyScoreCollisions).toEqual([]);
  });
});
