import { beforeAll, describe, expect, it } from 'vitest';

import { scoreProductLabel, type ProductScoringInput } from '../../../src/engines/nutrition/productScoring';
import { explainProductScore } from '../../../src/engines/nutrition/productScoring/explain';

/**
 * The scanner's reasons used to be enthymemes: a conclusion with the interesting half
 * left out. These tests hold the half that was missing — that a finding names the
 * actual ingredients and says why they matter, and that the numbers it says out loud
 * come from the label rather than from the copy.
 */

function explain(input: Omit<ProductScoringInput, 'name'> & { name: string }, basisLabel = '100 g') {
  const result = scoreProductLabel({
    sourceConfidence: 'high',
    ingredientEvidenceStatus: 'complete',
    evidenceContext: {
      identityConfidence: 'high',
      ingredientConflict: false,
      nutritionConfidence: 'high',
      providerConflict: false,
      servingConfidence: 'high'
    },
    ...input
  });
  return {
    result,
    explanation: explainProductScore({
      ingredientsText: input.ingredientsText ?? null,
      nutrients: input.nutrimentsPer100g ?? null,
      basisLabel,
      dimensions: result.dimensions,
      grade: result.letterGrade
    })
  };
}

const crackers = {
  name: 'Almond Flour Crackers',
  ingredientsText:
    'nut and seed flour blend (almonds, sunflower seeds, flax seeds), tapioca, cassava, sunflower oil, sea salt, rosemary extract',
  categoryTags: ['en:crackers'],
  nutrimentsPer100g: {
    calories: 536, fat_g: 28.6, saturated_fat_g: 1.8, carbs_g: 60.7,
    fiber_g: 3.6, sugar_g: 0, protein_g: 10.7, sodium_mg: 643, added_sugar_g: 0
  }
} satisfies Omit<ProductScoringInput, 'name'> & { name: string };

const cola = {
  name: 'Cola',
  ingredientsText: 'carbonated water, high fructose corn syrup, caramel color, phosphoric acid, natural flavors, caffeine',
  categoryTags: ['en:sodas'],
  nutrimentsPer100g: {
    calories: 42, fat_g: 0, saturated_fat_g: 0, carbs_g: 10.6,
    fiber_g: 0, sugar_g: 10.6, protein_g: 0, sodium_mg: 4, added_sugar_g: 10.6
  }
} satisfies Omit<ProductScoringInput, 'name'> & { name: string };

beforeAll(() => {
  process.env.EXPO_PUBLIC_PRODUCT_QUALITY_EXPERIMENT = 'v6_composition';
});

describe('why the score is the score', () => {
  it('names the two starches together, because that is the finding', () => {
    // The owner's own reading: tapioca and cassava are not two separate small notes,
    // they are one fast-carbohydrate finding that only exists because both are there.
    const { explanation } = explain(crackers);
    const stack = explanation.findings.find((finding) => finding.id === 'starch_stack');
    expect(stack).toBeDefined();
    expect(stack!.headline).toBe('Tapioca and cassava, 2nd and 3rd');
    expect(stack!.mechanism).toContain('close to glucose for speed');
    // The share and the fibre are read off the label, not asserted.
    expect(stack!.mechanism).toContain('39% of the list');
    expect(stack!.mechanism).toContain('3.6 g of fibre per 100 g');
  });

  it('says why a seed oil is a seed oil, not that it is one', () => {
    const { explanation } = explain(crackers);
    const oil = explanation.findings.find((finding) => finding.id === 'seed_oil');
    expect(oil!.headline).toBe('Sunflower oil, 4th');
    expect(oil!.mechanism).toContain('solvent-extracted');
    // The premise the old copy left unstated: why the panel cannot answer this.
    expect(oil!.mechanism).toContain('saturated-fat line');
  });

  it('gives the lead of the list its due when the lead is food', () => {
    const { explanation } = explain(crackers);
    const lead = explanation.findings.find((finding) => finding.id === 'lead_is_food');
    expect(lead!.tone).toBe('strength');
    // Filtering for food-shaped ingredients once reported a rosemary extract in sixth
    // place as leading this cracker. Only a contiguous run from the front counts.
    expect(lead!.headline).toBe('Nut and seed flour blend leads the list');
    expect(lead!.mechanism).toContain('order of mass');
  });

  it('refuses the absence trap a short ingredient list sets', () => {
    // Six ingredients, no preservatives, no isolates — and not one of them a food.
    const { explanation } = explain(cola, '100 ml');
    const short = explanation.findings.find((finding) => finding.id === 'short_not_clean');
    expect(short).toBeDefined();
    expect(short!.headline).toBe('6 ingredients, and none of them a food');
    const brake = explanation.findings.find((finding) => finding.id === 'nothing_slows_it');
    expect(brake!.headline).toBe('10.6 g of sugar per 100 ml, with nothing to slow it');
  });

  it('orders by what the kernel says weighed most, not by tone', () => {
    const { result, explanation } = explain(crackers);
    const ledger = new Set(
      result.dimensions.flatMap((dimension) =>
        [...dimension.positiveContributions, ...dimension.negativeContributions].map((entry) => entry.ruleId))
    );
    expect(ledger).toContain('v6_seed_oil');
    const weights = explanation.findings.map((finding) => finding.weight);
    expect([...weights].sort((left, right) => right - left)).toEqual(weights);
    // A strength can outrank a cost. The question is what moved it, not what to worry about.
    expect(explanation.findings[0].tone).toBe('strength');
  });

  it('does not bury a reading that has no rule behind it', () => {
    // Nothing slowing the sugar down is the single most important thing about a cola.
    // Anchoring order to the ledger alone sorted it last, behind the caramel colour.
    const { explanation } = explain(cola, '100 ml');
    const ids = explanation.findings.map((finding) => finding.id);
    expect(ids.indexOf('nothing_slows_it')).toBeLessThan(ids.indexOf('color'));
  });

  it('breaks the product into what it is made of, largest part first', () => {
    const { explanation } = explain(crackers);
    const shares = explanation.composition.map((slice) => slice.share);
    expect([...shares].sort((left, right) => right - left)).toEqual(shares);
    expect(explanation.composition[0].role).toBe('whole_food');
    expect(explanation.composition.map((slice) => slice.role)).toContain('refined_starch');
    const total = shares.reduce((sum, share) => sum + share, 0);
    expect(total).toBeCloseTo(1, 5);
  });

  it('names what it could not place instead of quietly scoring it as nothing', () => {
    const { explanation } = explain({
      ...crackers,
      ingredientsText: 'almonds, kaniwa, tapioca, sunflower oil'
    });
    expect(explanation.unrecognised).toContain('kaniwa');
  });

  it('refuses to call two different starches the same thing', () => {
    // "Refined starch" covering maltodextrin, white flour and cassava flour with one
    // number was the one-size-fits-all the roles existed to replace.
    const { explanation } = explain(crackers);
    const stack = explanation.findings.find((finding) => finding.id === 'starch_stack');
    expect(stack!.mechanism).toContain('They are not the same thing');
    expect(stack!.mechanism).toContain('cassava is the whole root dried and ground');
    // And the heavier of the two is the one whose speed the product actually has.
    expect(stack!.mechanism).toContain('Tapioca, the larger of them');
  });

  it('scores a root flour, an extracted starch and a processing aid apart', () => {
    const chip = (starch: string) => explain({
      name: 'Chip',
      ingredientsText: `${starch}, avocado oil, sea salt`,
      categoryTags: ['en:chips'],
      nutrimentsPer100g: {
        calories: 500, fat_g: 25, saturated_fat_g: 3, carbs_g: 64,
        fiber_g: 3, sugar_g: 1, protein_g: 2, sodium_mg: 500, added_sugar_g: 0
      }
    }).result.displayScore!;
    // Identical labels, identical panels: the only difference is which starch it is.
    expect(chip('cassava flour')).toBeGreaterThan(chip('tapioca starch'));
    expect(chip('tapioca starch')).toBeGreaterThan(chip('maltodextrin'));
  });

  it('treats avocado oil as a credit, not as the absence of a seed oil', () => {
    const { explanation } = explain({
      name: 'Chip',
      ingredientsText: 'cassava flour, avocado oil, sea salt',
      categoryTags: ['en:chips'],
      nutrimentsPer100g: {
        calories: 500, fat_g: 25, saturated_fat_g: 3, carbs_g: 64,
        fiber_g: 3, sugar_g: 1, protein_g: 2, sodium_mg: 500, added_sugar_g: 0
      }
    });
    const fat = explanation.findings.find((finding) => finding.id === 'culinary_fat');
    expect(fat!.tone).toBe('strength');
    expect(fat!.mechanism).toContain('a credit, not an absence of harm');
  });

  it('states what the band means rather than how confident the model is', () => {
    const { result, explanation } = explain(crackers);
    expect(result.letterGrade).toBe('D');
    expect(explanation.verdict).toContain('Better off skipping');
    expect(explanation.verdict).not.toContain('confidence');
  });
});
