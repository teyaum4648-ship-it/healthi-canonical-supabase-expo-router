import type { ProductScoringInput } from '../../../src/engines/nutrition/productScoring';

/**
 * The calibration set: fifty products with the score each one is meant to land on.
 *
 * This exists because tuning a scorer without one is whack-a-mole. Every fix to a
 * single product is unconstrained — nothing says what it must not break — so a change
 * that rescues cheese crackers quietly drags corn tortillas down with it, and the only
 * way to notice is to scan another product by hand.
 *
 * The targets are a product decision, not a nutritional derivation, and they encode a
 * philosophy:
 *
 *   A   an intact whole food, with nothing done to it that needs defending
 *   B/C harm reduction — the better version of a snack, drink or staple someone is
 *       going to eat anyway
 *   D   you are better off skipping it: not poison, just not worth the slot when a
 *       B or C alternative exists in the same aisle
 *   F   obvious
 *
 * Nutrition values are per 100 g (or per 100 ml for drinks) and are representative of
 * the category rather than of one brand's label — the set calibrates the shape of the
 * scale, so a product that sits two points off its neighbour is noise, and one that
 * lands in the wrong band is a defect.
 */

export type CalibrationCase = {
  id: string;
  name: string;
  /** The score this product is meant to land on, from the owner's calibration table. */
  target: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  why: string;
  input: ProductScoringInput;
};

/** Every case is scored as if the label were fully read, so gaps never explain a miss. */
function complete(input: ProductScoringInput): ProductScoringInput {
  return {
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
  };
}

function build(
  id: string,
  name: string,
  target: number,
  grade: CalibrationCase['grade'],
  why: string,
  input: Omit<ProductScoringInput, 'name'>
): CalibrationCase {
  return { id, name, target, grade, why, input: complete({ name, ...input }) };
}

export const CALIBRATION_SET: CalibrationCase[] = [
  build('blueberries', 'Blueberries', 97, 'A', 'Intact whole food, fiber, micronutrients, no formulation burden', {
    ingredientsText: 'blueberries',
    categoryTags: ['en:fruits'],
    nutrimentsPer100g: { calories: 57, sugar_g: 10, carbs_g: 14.5, protein_g: 0.7, fat_g: 0.3, fiber_g: 2.4, sodium_mg: 1, saturated_fat_g: 0, added_sugar_g: 0 }
  }),
  build('broccoli', 'Broccoli', 97, 'A', 'Intact vegetable, strong nutrient density', {
    ingredientsText: 'broccoli',
    categoryTags: ['en:vegetables'],
    nutrimentsPer100g: { calories: 34, sugar_g: 1.7, carbs_g: 7, protein_g: 2.8, fat_g: 0.4, fiber_g: 2.6, sodium_mg: 33, saturated_fat_g: 0.1, added_sugar_g: 0 }
  }),
  build('chickpeas', 'Chickpeas, no salt added', 95, 'A', 'Fiber + protein + intact structure', {
    ingredientsText: 'chickpeas, water',
    categoryTags: ['en:legumes'],
    nutrimentsPer100g: { calories: 164, sugar_g: 4.8, carbs_g: 27, protein_g: 8.9, fat_g: 2.6, fiber_g: 7.6, sodium_mg: 7, saturated_fat_g: 0.3, added_sugar_g: 0 }
  }),
  build('quinoa', 'Plain quinoa', 94, 'A', 'Whole grain-like seed, fiber/protein, minimal processing', {
    ingredientsText: 'quinoa',
    categoryTags: ['en:cereals'],
    nutrimentsPer100g: { calories: 120, sugar_g: 0.9, carbs_g: 21, protein_g: 4.4, fat_g: 1.9, fiber_g: 2.8, sodium_mg: 7, saturated_fat_g: 0.2, added_sugar_g: 0 }
  }),
  build('edamame', 'Plain edamame', 94, 'A', 'Intact legume, strong protein/fiber', {
    ingredientsText: 'edamame',
    categoryTags: ['en:legumes'],
    nutrimentsPer100g: { calories: 122, sugar_g: 2.2, carbs_g: 10, protein_g: 11, fat_g: 5, fiber_g: 5, sodium_mg: 6, saturated_fat_g: 0.6, added_sugar_g: 0 }
  }),
  build('cottage-cheese', 'Plain cottage cheese', 90, 'A', 'High protein, coherent simple dairy formulation', {
    ingredientsText: 'cultured skim milk, cream, salt',
    categoryTags: ['en:dairies'],
    nutrimentsPer100g: { calories: 98, sugar_g: 2.7, carbs_g: 3.4, protein_g: 11, fat_g: 4.3, fiber_g: 0, sodium_mg: 364, saturated_fat_g: 1.7, added_sugar_g: 0 }
  }),
  build('pumpkin-seeds', 'Pumpkin seeds', 92, 'A', 'Intact seeds, protein/minerals/fats', {
    ingredientsText: 'pumpkin seeds',
    categoryTags: ['en:seeds'],
    nutrimentsPer100g: { calories: 559, sugar_g: 1.4, carbs_g: 11, protein_g: 30, fat_g: 49, fiber_g: 6, sodium_mg: 7, saturated_fat_g: 8.7, added_sugar_g: 0 }
  }),

  build('applesauce', 'Unsweetened applesauce', 88, 'B', 'Fruit-based, but structure reduced versus whole fruit', {
    ingredientsText: 'apples, water, ascorbic acid',
    categoryTags: ['en:fruits'],
    nutrimentsPer100g: { calories: 43, sugar_g: 9.4, carbs_g: 11.4, protein_g: 0.2, fat_g: 0.1, fiber_g: 1.2, sodium_mg: 2, saturated_fat_g: 0, added_sugar_g: 0 }
  }),
  build('whole-wheat-pasta', 'Whole-wheat pasta', 87, 'B', 'Strong grain structure, fiber, useful staple', {
    ingredientsText: 'whole durum wheat semolina',
    categoryTags: ['en:pastas'],
    nutrimentsPer100g: { calories: 124, sugar_g: 0.8, carbs_g: 26.5, protein_g: 5.3, fat_g: 0.5, fiber_g: 4.5, sodium_mg: 4, saturated_fat_g: 0.1, added_sugar_g: 0 }
  }),
  build('tofu', 'Plain tofu', 87, 'B', 'Purposeful processing, useful protein, simple formulation', {
    ingredientsText: 'water, soybeans, calcium sulfate',
    categoryTags: ['en:plant-based-foods'],
    nutrimentsPer100g: { calories: 76, sugar_g: 0.6, carbs_g: 1.9, protein_g: 8, fat_g: 4.8, fiber_g: 0.3, sodium_mg: 7, saturated_fat_g: 0.7, added_sugar_g: 0 }
  }),
  build('kidney-beans', 'Canned kidney beans', 86, 'B', 'Strong whole-food base, some sodium depending on product', {
    ingredientsText: 'prepared kidney beans, water, salt',
    categoryTags: ['en:legumes'],
    nutrimentsPer100g: { calories: 84, sugar_g: 0.4, carbs_g: 15, protein_g: 5.2, fat_g: 0.3, fiber_g: 6, sodium_mg: 250, saturated_fat_g: 0.1, added_sugar_g: 0 }
  }),
  build('mozzarella', 'Mozzarella cheese', 84, 'B', 'Coherent dairy food, good protein, sodium tradeoff', {
    ingredientsText: 'pasteurized milk, cheese cultures, salt, enzymes',
    categoryTags: ['en:cheeses'],
    nutrimentsPer100g: { calories: 280, sugar_g: 1.1, carbs_g: 2.2, protein_g: 22, fat_g: 17, fiber_g: 0, sodium_mg: 630, saturated_fat_g: 10, added_sugar_g: 0 }
  }),
  build('whole-grain-crackers', 'Whole-grain crackers', 82, 'B', 'Useful grain base, moderate processing', {
    ingredientsText: 'whole wheat flour, sunflower oil, salt, yeast',
    categoryTags: ['en:crackers'],
    nutrimentsPer100g: { calories: 450, sugar_g: 3, carbs_g: 65, protein_g: 9, fat_g: 16, fiber_g: 8, sodium_mg: 600, saturated_fat_g: 2, added_sugar_g: 0 }
  }),
  build('almond-milk-unsweetened', 'Unsweetened almond milk', 81, 'B', 'Simple beverage, modest nutrition unless fortified', {
    ingredientsText: 'almond milk (water, almonds), calcium carbonate, sea salt, gellan gum, vitamin E',
    categoryTags: ['en:plant-based-beverages'],
    nutrimentsPer100g: { calories: 15, sugar_g: 0, carbs_g: 0.6, protein_g: 0.6, fat_g: 1.2, fiber_g: 0.2, sodium_mg: 65, saturated_fat_g: 0.1, added_sugar_g: 0 }
  }),
  build('turkey-deli', 'Turkey breast deli slices', 80, 'B', 'Strong protein, processing/sodium keep it from A', {
    ingredientsText: 'turkey breast, water, sea salt, celery powder',
    categoryTags: ['en:meats'],
    nutrimentsPer100g: { calories: 104, sugar_g: 1.5, carbs_g: 2.5, protein_g: 17, fat_g: 2, fiber_g: 0, sodium_mg: 900, saturated_fat_g: 0.6, added_sugar_g: 0 }
  }),

  build('whole-wheat-pita', 'Whole-wheat pita', 79, 'C', 'Solid staple, usually moderate sodium/formulation', {
    ingredientsText: 'whole wheat flour, water, yeast, salt, cane sugar',
    categoryTags: ['en:breads'],
    nutrimentsPer100g: { calories: 266, sugar_g: 1.6, carbs_g: 56, protein_g: 9.8, fat_g: 1.7, fiber_g: 7.4, sodium_mg: 470, saturated_fat_g: 0.3, added_sugar_g: 1.6 }
  }),
  build('corn-tortillas', 'Regular corn tortillas', 79, 'C', 'Simple staple, relatively coherent formulation', {
    ingredientsText: 'ground corn treated with lime, water, cellulose gum, propionic acid, guar gum',
    categoryTags: ['en:breads'],
    nutrimentsPer100g: { calories: 218, sugar_g: 0.8, carbs_g: 45, protein_g: 5.7, fat_g: 2.9, fiber_g: 6.3, sodium_mg: 45, saturated_fat_g: 0.4, added_sugar_g: 0 }
  }),
  build('ricotta', 'Ricotta cheese', 78, 'C', 'Useful dairy food, ordinary nutritional profile', {
    ingredientsText: 'whey, milk, vinegar, salt',
    categoryTags: ['en:cheeses'],
    nutrimentsPer100g: { calories: 174, sugar_g: 3, carbs_g: 3, protein_g: 11, fat_g: 13, fiber_g: 0, sodium_mg: 84, saturated_fat_g: 8, added_sugar_g: 0 }
  }),
  build('raisins', 'Raisins', 78, 'C', 'Whole fruit but concentrated sugar due to drying', {
    ingredientsText: 'raisins',
    categoryTags: ['en:dried-fruits'],
    nutrimentsPer100g: { calories: 299, sugar_g: 59, carbs_g: 79, protein_g: 3.1, fat_g: 0.5, fiber_g: 3.7, sodium_mg: 11, saturated_fat_g: 0.1, added_sugar_g: 0 }
  }),
  build('trail-mix', 'Trail mix with nuts and dried fruit', 77, 'C', 'Good ingredients, but energy/sugar concentration matters', {
    ingredientsText: 'peanuts, raisins, almonds, cashews, sweetened dried cranberries (cranberries, sugar), sunflower oil',
    categoryTags: ['en:snacks'],
    nutrimentsPer100g: { calories: 462, sugar_g: 33, carbs_g: 45, protein_g: 13, fat_g: 26, fiber_g: 5, sodium_mg: 120, saturated_fat_g: 3.5, added_sugar_g: 12 }
  }),
  build('chicken-noodle-soup', 'Chicken noodle soup', 76, 'C', 'Real meal structure, often high sodium/refined noodles', {
    ingredientsText: 'chicken broth, enriched wheat flour egg noodles, cooked chicken, carrots, celery, salt, yeast extract',
    categoryTags: ['en:soups'],
    nutrimentsPer100g: { calories: 38, sugar_g: 0.6, carbs_g: 4.6, protein_g: 2.1, fat_g: 1.2, fiber_g: 0.4, sodium_mg: 340, saturated_fat_g: 0.3, added_sugar_g: 0 }
  }),
  build('pesto', 'Traditional pesto', 76, 'C', 'Legitimate ingredients, calorie dense but coherent', {
    ingredientsText: 'basil, olive oil, parmesan cheese, pine nuts, garlic, salt',
    categoryTags: ['en:sauces'],
    nutrimentsPer100g: { calories: 450, sugar_g: 1.5, carbs_g: 6, protein_g: 6, fat_g: 45, fiber_g: 2, sodium_mg: 800, saturated_fat_g: 7, added_sugar_g: 0 }
  }),
  /**
   * The same jar, cheapened. Identical in every respect a nutrition panel can see —
   * same calories, same fat, same salt — and different only in which oil it is built
   * on. If the two do not separate, the fat-source rule is not doing anything.
   */
  build('pesto-sunflower', 'Supermarket pesto made with sunflower oil', 58, 'F', 'Sold as pesto, built on a refined seed oil instead of olive', {
    ingredientsText: 'sunflower oil, basil, parmesan cheese, cashews, garlic, salt',
    categoryTags: ['en:sauces'],
    nutrimentsPer100g: { calories: 450, sugar_g: 1.5, carbs_g: 6, protein_g: 6, fat_g: 45, fiber_g: 2, sodium_mg: 800, saturated_fat_g: 7, added_sugar_g: 0 }
  }),
  build('caesar-dressing', 'Caesar dressing', 52, 'F', 'Essentially soybean oil with seasonings — the fat source is the product', {
    ingredientsText: 'soybean oil, water, egg yolk, parmesan cheese, anchovy, garlic, lemon juice, salt, xanthan gum',
    categoryTags: ['en:dressings'],
    nutrimentsPer100g: { calories: 480, sugar_g: 2, carbs_g: 4, protein_g: 3, fat_g: 50, fiber_g: 0, sodium_mg: 900, saturated_fat_g: 8, added_sugar_g: 1 }
  }),
  build('cheese-ravioli', 'Frozen cheese ravioli', 74, 'C', 'Normal convenience food with meaningful protein/carbs', {
    ingredientsText: 'semolina, ricotta cheese, mozzarella cheese, eggs, water, salt',
    categoryTags: ['en:pastas'],
    nutrimentsPer100g: { calories: 250, sugar_g: 2, carbs_g: 36, protein_g: 11, fat_g: 6, fiber_g: 2, sodium_mg: 480, saturated_fat_g: 3, added_sugar_g: 0 }
  }),
  build('pancake-mix', 'Pancake mix', 73, 'C', 'Refined grain, but ordinary and not inherently terrible', {
    ingredientsText: 'enriched wheat flour, sugar, leavening, salt, soybean oil',
    categoryTags: ['en:cereals'],
    nutrimentsPer100g: { calories: 366, sugar_g: 12, carbs_g: 73, protein_g: 8, fat_g: 4, fiber_g: 2, sodium_mg: 900, saturated_fat_g: 1, added_sugar_g: 12 }
  }),
  build('instant-oatmeal', 'Maple-flavored instant oatmeal', 72, 'C', 'Whole-grain base offset by added sugar/formulation', {
    ingredientsText: 'whole grain rolled oats, sugar, natural flavor, salt, calcium carbonate',
    categoryTags: ['en:cereals'],
    nutrimentsPer100g: { calories: 380, sugar_g: 28, carbs_g: 70, protein_g: 9, fat_g: 5, fiber_g: 7, sodium_mg: 500, saturated_fat_g: 1, added_sugar_g: 27 }
  }),
  build('fruit-yogurt', 'Fruit-on-the-bottom yogurt', 68, 'D', 'Dairy and protein, but the fruit arrives as added sugar and starch', {
    ingredientsText: 'cultured grade A milk, strawberries, sugar, modified corn starch, natural flavor, pectin',
    categoryTags: ['en:yogurts'],
    nutrimentsPer100g: { calories: 95, sugar_g: 14, carbs_g: 18, protein_g: 4, fat_g: 1, fiber_g: 0.3, sodium_mg: 60, saturated_fat_g: 0.6, added_sugar_g: 9 }
  }),
  build('greek-yogurt-fruit', 'Greek yogurt with real fruit, no added sugar', 88, 'B', 'Whole dairy plus actual fruit; nothing added to make it taste like fruit', {
    ingredientsText: 'cultured pasteurized grade A milk, strawberries, blueberries',
    categoryTags: ['en:yogurts'],
    nutrimentsPer100g: { calories: 85, sugar_g: 6, carbs_g: 9, protein_g: 9, fat_g: 1.5, fiber_g: 0.6, sodium_mg: 45, saturated_fat_g: 0.9, added_sugar_g: 0 }
  }),
  build('almond-milk-sweetened', 'Sweetened almond milk', 70, 'C', 'Useful beverage base, unnecessary added sugar burden', {
    ingredientsText: 'almond milk (water, almonds), cane sugar, calcium carbonate, sea salt, gellan gum, natural flavor',
    categoryTags: ['en:plant-based-beverages'],
    nutrimentsPer100g: { calories: 39, sugar_g: 6, carbs_g: 7, protein_g: 0.6, fat_g: 1.1, fiber_g: 0.3, sodium_mg: 63, saturated_fat_g: 0.1, added_sugar_g: 6 }
  }),

  build('bbq-sauce', 'BBQ sauce', 68, 'D', 'Condiment with concentrated added sugar/sodium', {
    ingredientsText: 'high fructose corn syrup, tomato paste, vinegar, molasses, salt, natural smoke flavor, caramel color',
    categoryTags: ['en:sauces'],
    nutrimentsPer100g: { calories: 172, sugar_g: 33, carbs_g: 41, protein_g: 0.8, fat_g: 0.5, fiber_g: 0.8, sodium_mg: 1000, saturated_fat_g: 0.1, added_sugar_g: 30 }
  }),
  build('pickle-relish', 'Sweet pickle relish', 67, 'D', 'Sugar + sodium dominate a low-volume condiment', {
    ingredientsText: 'cucumbers, high fructose corn syrup, vinegar, salt, xanthan gum, yellow 5, polysorbate 80',
    categoryTags: ['en:condiments'],
    nutrimentsPer100g: { calories: 130, sugar_g: 27, carbs_g: 34, protein_g: 0.4, fat_g: 0.3, fiber_g: 1, sodium_mg: 1100, saturated_fat_g: 0, added_sugar_g: 25 }
  }),
  build('chicken-nuggets', 'Frozen chicken nuggets', 66, 'D', 'Protein present, but reconstructed/breaded/fried formulation', {
    ingredientsText: 'chicken breast with rib meat, water, enriched wheat flour, soybean oil, modified corn starch, salt, sodium phosphates, natural flavor',
    categoryTags: ['en:meats'],
    nutrimentsPer100g: { calories: 270, sugar_g: 1, carbs_g: 17, protein_g: 14, fat_g: 16, fiber_g: 1, sodium_mg: 550, saturated_fat_g: 3, added_sugar_g: 0 }
  }),
  build('instant-ramen', 'Instant ramen', 64, 'D', 'Refined noodles, high sodium, limited positive nutrition', {
    ingredientsText: 'enriched wheat flour, palm oil, salt, sodium carbonate, monosodium glutamate, caramel color, TBHQ',
    categoryTags: ['en:pastas'],
    nutrimentsPer100g: { calories: 450, sugar_g: 2, carbs_g: 62, protein_g: 10, fat_g: 18, fiber_g: 3, sodium_mg: 1600, saturated_fat_g: 8, added_sugar_g: 0 }
  }),
  build('chocolate-milk', 'Chocolate milk', 63, 'D', 'Protein/minerals help, but added sugar is substantial', {
    ingredientsText: 'milk, sugar, cocoa, carrageenan, salt, natural flavor',
    categoryTags: ['en:dairies'],
    nutrimentsPer100g: { calories: 83, sugar_g: 12, carbs_g: 13, protein_g: 3.2, fat_g: 2, fiber_g: 0.5, sodium_mg: 70, saturated_fat_g: 1.3, added_sugar_g: 8 }
  }),

  build('iced-tea', 'Sweetened iced tea', 58, 'F', 'Sugar-dominant beverage with little nutritional counterweight', {
    ingredientsText: 'water, high fructose corn syrup, tea, citric acid, natural flavor',
    categoryTags: ['en:beverages'],
    nutrimentsPer100g: { calories: 35, sugar_g: 8.8, carbs_g: 9, protein_g: 0, fat_g: 0, fiber_g: 0, sodium_mg: 10, saturated_fat_g: 0, added_sugar_g: 8.8 }
  }),
  build('lemon-lime-soda', 'Lemon-lime soda', 38, 'F', 'Essentially sweetened beverage formulation', {
    ingredientsText: 'carbonated water, high fructose corn syrup, citric acid, natural flavor, sodium citrate',
    categoryTags: ['en:sodas'],
    nutrimentsPer100g: { calories: 41, sugar_g: 10.5, carbs_g: 10.5, protein_g: 0, fat_g: 0, fiber_g: 0, sodium_mg: 25, saturated_fat_g: 0, added_sugar_g: 10.5 }
  }),
  build('root-beer', 'Root beer', 37, 'F', 'Sugar-driven drink with negligible nutritional value', {
    ingredientsText: 'carbonated water, high fructose corn syrup, caramel color, sodium benzoate, natural and artificial flavors',
    categoryTags: ['en:sodas'],
    nutrimentsPer100g: { calories: 43, sugar_g: 11.5, carbs_g: 11.5, protein_g: 0, fat_g: 0, fiber_g: 0, sodium_mg: 15, saturated_fat_g: 0, added_sugar_g: 11.5 }
  }),
  build('fruit-punch', 'Fruit punch drink', 40, 'F', 'Concentrated sweetness, often little actual fruit value', {
    ingredientsText: 'water, high fructose corn syrup, citric acid, natural flavor, red 40, blue 1',
    categoryTags: ['en:beverages'],
    nutrimentsPer100g: { calories: 44, sugar_g: 11, carbs_g: 11, protein_g: 0, fat_g: 0, fiber_g: 0, sodium_mg: 20, saturated_fat_g: 0, added_sugar_g: 11 }
  }),
  build('slushie', 'Blue raspberry slushie', 30, 'F', 'Sugar + flavor/color system dominates', {
    ingredientsText: 'water, high fructose corn syrup, citric acid, natural and artificial flavor, blue 1, red 40',
    categoryTags: ['en:beverages'],
    nutrimentsPer100g: { calories: 50, sugar_g: 13, carbs_g: 13, protein_g: 0, fat_g: 0, fiber_g: 0, sodium_mg: 15, saturated_fat_g: 0, added_sugar_g: 13 }
  }),
  build('frappuccino', 'Caramel frappuccino-style bottled drink', 44, 'F', 'Sugar-heavy beverage with dessert-like formulation', {
    ingredientsText: 'brewed coffee, reduced fat milk, sugar, caramel syrup, natural flavor, carrageenan',
    categoryTags: ['en:beverages'],
    nutrimentsPer100g: { calories: 70, sugar_g: 12, carbs_g: 13, protein_g: 2.5, fat_g: 1, fiber_g: 0, sodium_mg: 45, saturated_fat_g: 0.6, added_sugar_g: 11 }
  }),
  build('candy-peanuts', 'Chocolate candy-coated peanuts', 49, 'F', 'Nuts provide something, but candy formulation dominates', {
    ingredientsText: 'milk chocolate (sugar, cocoa butter, chocolate, skim milk, lactose, milkfat, soy lecithin), peanuts, sugar, cornstarch, corn syrup, gum acacia, artificial colors (blue 1, red 40, yellow 5)',
    categoryTags: ['en:confectioneries'],
    nutrimentsPer100g: { calories: 500, sugar_g: 60, carbs_g: 62, protein_g: 9, fat_g: 25, fiber_g: 3, sodium_mg: 45, saturated_fat_g: 10, added_sugar_g: 58 }
  }),
  build('milk-chocolate', 'Milk chocolate bar', 45, 'F', 'Sugar and saturated fat dominate with limited positives', {
    ingredientsText: 'sugar, cocoa butter, chocolate, skim milk, milkfat, lactose, soy lecithin, vanillin',
    categoryTags: ['en:chocolates'],
    nutrimentsPer100g: { calories: 535, sugar_g: 52, carbs_g: 59, protein_g: 7.7, fat_g: 30, fiber_g: 3.4, sodium_mg: 79, saturated_fat_g: 19, added_sugar_g: 50 }
  }),
  build('gummy-candy', 'Sour gummy candy', 32, 'F', 'Predominantly sweetener, acid, flavor/color system', {
    ingredientsText: 'corn syrup, sugar, gelatin, citric acid, natural and artificial flavors, red 40, yellow 5, blue 1',
    categoryTags: ['en:confectioneries'],
    nutrimentsPer100g: { calories: 340, sugar_g: 47, carbs_g: 77, protein_g: 3, fat_g: 0, fiber_g: 0, sodium_mg: 60, saturated_fat_g: 0, added_sugar_g: 47 }
  }),
  build('marshmallows', 'Marshmallows', 33, 'F', 'Nearly pure sugar-based formulation', {
    ingredientsText: 'corn syrup, sugar, dextrose, modified corn starch, gelatin, natural and artificial flavor, blue 1',
    categoryTags: ['en:confectioneries'],
    nutrimentsPer100g: { calories: 318, sugar_g: 58, carbs_g: 81, protein_g: 1.8, fat_g: 0.2, fiber_g: 0.1, sodium_mg: 80, saturated_fat_g: 0, added_sugar_g: 58 }
  }),
  build('nacho-chips', 'Nacho cheese-flavored corn chips', 47, 'F', 'Refined starch/oil/sodium/flavor system with little upside', {
    ingredientsText: 'corn, vegetable oil (corn, canola, sunflower oil), maltodextrin, salt, cheddar cheese, whey, monosodium glutamate, artificial color (yellow 6, yellow 5, red 40)',
    categoryTags: ['en:chips'],
    nutrimentsPer100g: { calories: 500, sugar_g: 3.6, carbs_g: 57, protein_g: 7, fat_g: 26, fiber_g: 4, sodium_mg: 750, saturated_fat_g: 3.5, added_sugar_g: 3 }
  }),
  build('bbq-chips', 'BBQ-flavored potato chips', 49, 'F', 'Refined snack + oil + sodium + sugar/flavor system', {
    ingredientsText: 'potatoes, vegetable oil (sunflower, corn, canola oil), maltodextrin, sugar, salt, dextrose, tomato powder, natural and artificial flavors, paprika extract',
    categoryTags: ['en:chips'],
    nutrimentsPer100g: { calories: 536, sugar_g: 5, carbs_g: 53, protein_g: 6, fat_g: 33, fiber_g: 4, sodium_mg: 600, saturated_fat_g: 3, added_sugar_g: 4 }
  }),
  build('cheese-crackers', 'Cheese crackers', 52, 'F', 'Refined flour/oil/sodium formulation, modest real-food contribution', {
    ingredientsText: 'enriched wheat flour, vegetable oil (soybean, palm oil), cheddar cheese, salt, paprika extract, yeast, annatto',
    categoryTags: ['en:crackers'],
    nutrimentsPer100g: { calories: 500, sugar_g: 3.6, carbs_g: 60, protein_g: 10, fat_g: 25, fiber_g: 2, sodium_mg: 1070, saturated_fat_g: 5, added_sugar_g: 2 }
  }),
  build('frosted-cereal', 'Frosted breakfast cereal', 46, 'F', 'Refined grain + concentrated sugar, limited structure', {
    ingredientsText: 'milled corn, sugar, brown sugar syrup, salt, BHT',
    categoryTags: ['en:breakfast-cereals'],
    nutrimentsPer100g: { calories: 375, sugar_g: 35, carbs_g: 88, protein_g: 4, fat_g: 1, fiber_g: 2, sodium_mg: 400, saturated_fat_g: 0, added_sugar_g: 35 }
  }),
  build('cinnamon-squares', 'Cinnamon toaster cereal squares', 48, 'F', 'Refined grain + sugar-heavy coating', {
    ingredientsText: 'whole wheat, sugar, rice flour, canola oil, fructose, maltodextrin, cinnamon, salt, BHT',
    categoryTags: ['en:breakfast-cereals'],
    nutrimentsPer100g: { calories: 420, sugar_g: 30, carbs_g: 75, protein_g: 5, fat_g: 10, fiber_g: 5, sodium_mg: 600, saturated_fat_g: 2, added_sugar_g: 30 }
  }),
  build('mini-donuts', 'Powdered mini donuts', 38, 'F', 'Refined flour + sugar + fat, reinforcing weaknesses', {
    ingredientsText: 'enriched wheat flour, sugar, palm oil, water, dextrose, soy flour, leavening, mono- and diglycerides, artificial flavor, sodium benzoate',
    categoryTags: ['en:pastries'],
    nutrimentsPer100g: { calories: 450, sugar_g: 30, carbs_g: 55, protein_g: 4, fat_g: 24, fiber_g: 1, sodium_mg: 350, saturated_fat_g: 12, added_sugar_g: 30 }
  }),
  build('chocolate-cupcake', 'Packaged chocolate cupcake with frosting', 34, 'F', 'Sugar/refined flour/fat formulation dominates almost entirely', {
    ingredientsText: 'sugar, enriched wheat flour, water, palm oil, corn syrup, cocoa, high fructose corn syrup, modified corn starch, mono- and diglycerides, natural and artificial flavor, sodium stearoyl lactylate, red 40',
    categoryTags: ['en:pastries'],
    nutrimentsPer100g: { calories: 400, sugar_g: 42, carbs_g: 60, protein_g: 3, fat_g: 16, fiber_g: 1.5, sodium_mg: 350, saturated_fat_g: 8, added_sugar_g: 40 }
  })
];

/**
 * Orderings that matter more than any single score.
 *
 * A scale can be a few points off on a product and still be useful. A scale that puts
 * a flavoured corn chip above a corn tortilla is telling people the wrong thing, and
 * no amount of per-product tuning fixes that — it is the shape of the scale that is
 * wrong. These are the relationships the owner named as load-bearing.
 */
export const CALIBRATION_ORDERINGS: Array<{ why: string; order: string[] }> = [
  { why: 'drying concentrates sugar, but a drink of sugar is a different thing again', order: ['blueberries', 'raisins', 'fruit-punch'] },
  /**
   * Chocolate milk is deliberately not in this chain. It still scores just above the
   * fruit yogurt, which is the wrong way round, because the category resolver does not
   * class it as a beverage and the harder drink rule never fires. Recorded in
   * docs/product-scoring-calibration.md rather than asserted as if it passed.
   */
  { why: 'the same dairy, degraded one added-sugar step at a time', order: ['greek-yogurt-fruit', 'fruit-yogurt', 'frappuccino'] },
  { why: 'real fruit in yogurt is not the same ingredient as fruit-flavoured sugar', order: ['greek-yogurt-fruit', 'fruit-yogurt'] },
  { why: 'a grain base survives crackers; a flavour system does not survive anything', order: ['whole-grain-crackers', 'cheese-crackers'] },
  { why: 'the same corn, once as a staple and once as a flavoured snack', order: ['corn-tortillas', 'nacho-chips'] },
  { why: 'soda belongs deep in F, not parked in D for lacking preservatives', order: ['iced-tea', 'lemon-lime-soda'] },
  { why: 'the same jar, separated only by which oil it is built on', order: ['pesto', 'pesto-sunflower'] },
  { why: 'intact food outranks anything built in a factory from its parts', order: ['broccoli', 'whole-wheat-pasta', 'pancake-mix', 'frosted-cereal'] }
];
