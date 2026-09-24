/**
 * What each ingredient *is*, rather than which red flags it trips.
 *
 * The scoring this feeds asks a different question from the one the earlier kernels
 * asked. They asked whether a product contained anything objectionable, which a can of
 * soda answers well: carbonated water, sweetener, an acid, a flavour, a salt. Five
 * ingredients, no preservatives, no colours — and a high score for a drink that is
 * sugar and water. Absence of adulteration is not presence of food.
 *
 * So every ingredient is given a role, and the roles say what the product is made of.
 * A product whose leading roles are sweetener and refined starch is a confection no
 * matter how short its list; a product whose leading roles are whole foods is food no
 * matter how long.
 *
 * On fat, the role is the source, not the saturated-fat figure. Avocado oil, olive oil,
 * butter, ghee, tallow and coconut are traditional culinary fats and are judged as
 * food. Industrially refined seed oils — canola, soybean, corn, cottonseed and the
 * unnamed "vegetable oil" blends — are judged as a processing input, because that is
 * what they are: the fat left after a seed is crushed, solvent-extracted, degummed,
 * bleached and deodorised. Hydrogenated and interesterified fats are worse again. A
 * kernel that reads only `saturated_fat_g` cannot tell these apart, which is why this
 * file exists.
 */

import { isVocabularyFood } from './foodVocabulary';
import { correctSpelling, repairTowardFood } from './ingredientAliases';

export type IngredientRole =
  | 'whole_food'
  | 'culinary_fat'
  | 'seed_oil'
  | 'industrial_fat'
  | 'added_sugar'
  | 'refined_starch'
  | 'isolate'
  | 'flavor_system'
  | 'color'
  | 'preservative'
  | 'texturizer'
  | 'high_intensity_sweetener'
  | 'sugar_alcohol'
  | 'fortificant'
  | 'neutral'
  | 'unknown';

/** Roles that are food. Everything a person would recognise on a farm or in a kitchen. */
export const FOOD_ROLES: ReadonlySet<IngredientRole> = new Set(['whole_food', 'culinary_fat']);

/**
 * Roles that constitute a product rather than contribute to it. When these lead an
 * ingredient list, the product's identity is the formulation, not the food.
 */
export const FORMULATION_ROLES: ReadonlySet<IngredientRole> = new Set([
  'added_sugar', 'refined_starch', 'seed_oil', 'industrial_fat', 'isolate',
  'flavor_system', 'color', 'high_intensity_sweetener', 'sugar_alcohol'
]);

type Rule = {
  role: IngredientRole;
  pattern: RegExp;
  /**
   * What this particular ingredient is worth, where the role's own number is too blunt.
   *
   * A role answers "what kind of thing is this", and for most ingredients that is the
   * whole answer. It is not for all of them: maltodextrin, enriched wheat flour and
   * cassava flour are all refined starch, and treating them as one number says that a
   * hydrolysed processing aid and a dried ground root are the same proposition. They
   * are not, and an ingredient list is the only place that difference is visible.
   */
  value?: number;
};

/**
 * What a role is worth when the ingredient itself has nothing more specific to say.
 * On a gradient from 1 (arrived as it grew) to 0 (doing a cosmetic job).
 */
export const ROLE_FOOD_VALUE: Record<IngredientRole, number> = {
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

/**
 * Order matters: the first match wins, so the specific precedes the general. "cocoa
 * butter" must be read before "butter", and "palm kernel oil" before "palm oil".
 */
const RULES: Rule[] = [
  // Industrial fats first — these names contain other fat names inside them.
  { role: 'industrial_fat', pattern: /\b(partially hydrogenated|fully hydrogenated|hydrogenated|interesterified|shortening|palm kernel oil|margarine)\b/ },

  /*
   * Nut and seed butters are the nut, ground. The whole-food rule below has always listed
   * almond and peanut butter, and could never reach them: "butter" is a culinary fat one
   * rule down, and the first match wins. Cocoa butter is a pressed fat and stays with the
   * fats, which is why it is not here.
   */
  { role: 'whole_food', pattern: /\b(?:almond|peanut|cashew|hazelnut|walnut|pecan|pistachio|macadamia|sunflower seed|pumpkin seed|sesame|nut|seed) butters?\b/ },

  /*
   * Traditional culinary fats, judged by source rather than by saturation, and graded
   * within that. An avocado or an olive gives up its oil to pressure alone, which is
   * why those two sit at the top rather than merely out of the seed-oil bucket.
   */
  { role: 'culinary_fat', pattern: /\b(extra virgin olive oil|avocado oil|virgin coconut oil)\b/, value: 1 },
  { role: 'culinary_fat', pattern: /\b(olive oil|coconut oil|cocoa butter|butter|clarified butter|ghee|butterfat|milkfat|beef tallow|tallow|lard|duck fat)\b/ },
  // Usually refined on the way to the bottle, even when the seed is a food.
  { role: 'culinary_fat', pattern: /\b(sesame oil|peanut oil|palm fruit oil|red palm oil)\b/, value: 0.82 },

  // Industrially refined seed and vegetable oils, including unnamed blends.
  // An unnamed blend is worse than a named oil: you cannot know what you are eating.
  { role: 'seed_oil', pattern: /\b(vegetable oil|vegetable oils|vegetable oil blend|oil blend|blend of [a-z ,]*oils?)\b/, value: 0.32 },
  { role: 'seed_oil', pattern: /\b(canola oil|rapeseed oil|soybean oil|soy oil|corn oil|cottonseed oil|sunflower oil|high oleic sunflower oil|safflower oil|grapeseed oil|rice bran oil|palm oil)\b/ },

  /**
   * Whole grains, read before the refined rule below. "whole durum wheat semolina" and
   * "whole wheat flour" both contain a refined form inside them, and a list-order match
   * would call a whole-grain pasta a refined starch.
   */
  { role: 'whole_food', pattern: /\bwhole[- ](?:durum[- ])?(?:wheat|grain|grains|oat|oats|rye|corn|barley|spelt|durum)\b/ },
  { role: 'whole_food', pattern: /\b(sprouted|stone[- ]ground) [a-z]+\b/ },

  // A confection named after its first ingredient is still a confection.
  { role: 'added_sugar', pattern: /\b(milk chocolate|white chocolate|semi-?sweet chocolate|chocolate chips?|candy|frosting|icing)\b/ },

  // Sweeteners. "fruit juice concentrate" is sugar with a friendly name.
  { role: 'added_sugar', pattern: /\b(high fructose corn syrup|corn syrup( solids)?|cane sugar|brown sugar( syrup)?|invert sugar|raw sugar|sugar|sucrose|glucose(-fructose)?|dextrose|fructose|maltose|lactose|molasses|honey|agave|rice syrup|tapioca syrup|maple syrup|brown rice syrup|fruit juice concentrate|cane juice|caramel syrup|golden syrup|treacle)\b/ },
  { role: 'high_intensity_sweetener', pattern: /\b(aspartame|sucralose|acesulfame potassium|acesulfame k|ace-?k|saccharin|neotame|advantame|stevia|steviol glycosides?|monk fruit|luo han guo)\b/ },
  { role: 'sugar_alcohol', pattern: /\b(erythritol|xylitol|sorbitol|maltitol|mannitol|isomalt|lactitol|allulose|sugar alcohols?)\b/ },

  // Refined carbohydrate structure. Whole flours are caught by the whole-food rule below.
  /**
   * Refined starch, graded by how much of the food is still in it.
   *
   * One number for this whole role said that maltodextrin, enriched wheat flour and
   * cassava flour are the same proposition, which is the one-size-fits-all the roles
   * were supposed to replace. The gradient is how far the milling went: a root dried
   * and ground keeps its fibre, an endosperm milled to flour keeps its protein, an
   * extracted starch keeps neither, and a hydrolysed one is a processing aid that was
   * food two steps ago.
   *
   * Order runs most-specific first, because these names nest: "modified corn starch"
   * contains "corn starch", and "sweet potato flour" contains "potato flour".
   */
  // Hydrolysed or chemically modified: the furthest from the food it started as.
  { role: 'refined_starch', pattern: /\b(maltodextrin|dextrin|modified (?:food |corn |potato |tapioca |rice |wheat )?starch)\b/, value: 0.4 },
  // The whole root or fruit, dried and ground. The fibre survives the milling.
  { role: 'refined_starch', pattern: /\b(cassava flour|cassava|yuca|plantain flour|green banana flour|sweet potato flour|water chestnut flour)\b/, value: 0.8 },
  // Starch extracted out of the food, with the fibre and protein left behind.
  { role: 'refined_starch', pattern: /\b(tapioca starch|tapioca|potato starch|corn ?starch|rice starch|arrowroot(?: flour| starch)?|sago)\b/, value: 0.52 },
  // Milled to flour, but carrying little of the protein that makes a flour worth eating.
  { role: 'refined_starch', pattern: /\b(rice flour|soy flour|potato flour)\b/, value: 0.6 },
  // Endosperm milled and refortified: refined, and still the flour most food is made of.
  { role: 'refined_starch', pattern: /\b(enriched (?:wheat |bleached |unbleached )*flour|bleached flour|white flour|refined (?:wheat )?flour|wheat flour|semolina|milled corn|degerminated corn ?meal)\b/ },



  // Fractions of food standing in for the food.
  { role: 'isolate', pattern: /\b(protein isolate|protein concentrate|isolated protein|hydroly[sz]ed (?:protein|collagen)|whey protein|pea protein|soy protein isolate|milk protein concentrate|inulin|chicory root fiber|soluble (?:corn )?fiber|acacia fiber|fiber isolate|yeast extract|monosodium glutamate|msg)\b/ },

  { role: 'flavor_system', pattern: /\b(natural flavou?rs?|artificial flavou?rs?|natural and artificial flavou?rs?|flavou?ring|smoke flavou?r|vanillin|essence)\b/ },
  { role: 'color', pattern: /\b(caramel color|color added|colors?\b|red 40|yellow 5|yellow 6|blue 1|blue 2|green 3|artificial colou?rs?|titanium dioxide|annatto|paprika extract|beta ?carotene)\b/ },
  { role: 'preservative', pattern: /\b(potassium sorbate|sodium benzoate|calcium propionate|propionic acid|sorbic acid|sodium nitrite|sodium nitrate|bha|bht|tbhq|edta|benzoate|preservative)\b/ },
  { role: 'texturizer', pattern: /\b(carrageenan|cellulose gum|carboxymethylcellulose|xanthan gum|guar gum|gellan gum|locust bean gum|gum acacia|gum arabic|lecithin|mono-? and diglycerides|mono and diglycerides|polysorbate \d+|sodium citrate|sodium phosphates?|sodium stearoyl lactylate|calcium silicate|silicon dioxide|tricalcium phosphate|pectin|gelatin|emulsifier|stabili[sz]er|thickener|cellulose)\b/ },
  { role: 'fortificant', pattern: /\b(calcium carbonate|calcium sulfate|vitamin [a-z]\d*|ascorbic acid|niacinamide|riboflavin|thiamine|folic acid|ferrous sulfate|zinc oxide|potassium iodide|iron\b)\b/ },

  /**
   * A food named with a fraction after it is the fraction.
   *
   * The whole-food rules below match a food's name anywhere in an ingredient, which is
   * right for "organic diced tomatoes" and wrong for "tomato fiber". Before this block,
   * anything processed that no earlier rule named explicitly fell through to them and was
   * credited as the food it came from: hydrolyzed vegetable protein, vegetable glycerin,
   * pea starch, almond oil, fish oil, apple juice concentrate, and every spice, herb and
   * mushroom extract — 31 of 35 such names probed. Each rule here is general on purpose,
   * so the next fraction nobody thought to list is still read as one; every specific rule
   * above keeps its priority because it runs first.
   */
  // Plants and roots used to colour food, which is what their concentrates are sold for.
  { role: 'color', pattern: /\b(?:vegetable|carrot|black carrot|purple carrot|beet|beetroot|red beet|red cabbage|purple sweet potato|radish|spirulina) juice concentrates?\b/ },
  // Fruit juice concentrated is sugar with a friendly name, whichever fruit it came from.
  { role: 'added_sugar', pattern: /\b[a-z]+(?: [a-z]+)? juice concentrates?\b/ },
  { role: 'added_sugar', pattern: /\b(?:barley )?malt (?:extract|syrup)\b/ },
  // Antioxidant extracts, added to keep fats from going off.
  { role: 'preservative', pattern: /\b(?:rosemary|green tea|acerola cherry) extracts?\b|\bmixed tocopherols\b/ },
  { role: 'flavor_system', pattern: /\b(?:extracts?|extractives|oleoresins?)\b/ },
  { role: 'isolate', pattern: /\bproteins?\b|\bfib(?:er|re)s?\b/ },
  { role: 'refined_starch', pattern: /\bstarch(?:es)?\b/, value: 0.52 },
  { role: 'sugar_alcohol', pattern: /\bglycer(?:in|ine|ol)\b/ },
  { role: 'texturizer', pattern: /\bgums?\b/ },
  // An oil nobody listed above is still an extraction, not the nut or fish it came from.
  { role: 'seed_oil', pattern: /\boils?\b/ },

  /**
   * Whole foods. The list is long on purpose: an ingredient this does not recognise is
   * scored as unknown rather than as food, so a gap here costs a product points it may
   * deserve. Whole-grain forms are listed explicitly so they beat the refined rule.
   */
  { role: 'whole_food', pattern: /\b(whole (?:wheat|grain|oat|rye|corn|barley|spelt) ?(?:flour|berries)?|whole wheat|whole grain|whole durum wheat semolina|sprouted [a-z]+|rolled oats?|steel[- ]cut oats?|oats?|oatmeal|quinoa|amaranth|buckwheat|millet|barley|farro|brown rice|wild rice|rice\b|corn\b|ground corn|hominy|masa)\b/ },
  { role: 'whole_food', pattern: /\b(blueberr(?:y|ies)|strawberr(?:y|ies)|raspberr(?:y|ies)|blackberr(?:y|ies)|cranberr(?:y|ies)|berries|apples?|bananas?|oranges?|lemons?|limes?|pears?|peach(?:es)?|nectarines?|plums?|mangoe?s?|pineapples?|grapes?|raisins?|dates?|figs?|prunes?|apricots?|cherr(?:y|ies)|berr(?:y|ies)|fruit|tomato(?:es)?|tomato paste|tomato powder)\b/ },
  { role: 'whole_food', pattern: /\b(broccoli|spinach|kale|carrots?|celery|onions?|garlic|peppers?|cucumbers?|lettuce|cabbage|cauliflower|zucchini|squash|sweet potato(?:es)?|potato(?:es)?|mushrooms?|peas?|green beans?|asparagus|beets?|vegetables?|basil|herbs?|spices?|cinnamon|parsley|oregano|thyme|rosemary|ginger|turmeric)\b/ },
  { role: 'whole_food', pattern: /\b(chickpeas?|garbanzo beans?|black beans?|kidney beans?|pinto beans?|navy beans?|white beans?|lentils?|edamame|soybeans?|beans?|tofu|tempeh)\b/ },
  { role: 'whole_food', pattern: /\b(almonds?|cashews?|walnuts?|pecans?|pistachios?|hazelnuts?|macadamias?|peanuts?|nuts?|pumpkin seeds?|sunflower seeds?|chia seeds?|flax ?seeds?|hemp seeds?|sesame seeds?|seeds?|almond butter|peanut butter|tahini)\b/ },
  { role: 'whole_food', pattern: /\b(chicken|turkey|beef|pork|lamb|bison|tuna|salmon|cod|sardines?|anchov(?:y|ies)|shrimp|fish|eggs?|egg whites?|egg yolks?)\b/ },
  { role: 'whole_food', pattern: /\b(milk|whole milk|skim milk|reduced fat milk|cream|heavy cream|yogurt|greek yogurt|kefir|cheese|cheddar cheese|mozzarella cheese|parmesan cheese|ricotta cheese|cottage cheese|whey\b|cultured (?:skim )?milk|cultured cream)\b/ },
  { role: 'whole_food', pattern: /\b(cocoa|cacao|chocolate liquor|unsweetened chocolate|chocolate|coffee|brewed coffee|tea\b|green tea|black tea|matcha)\b/ },

  /**
   * Neutral: present for a culinary reason and carrying neither nutrition nor burden.
   * Salt is here rather than penalised as an ingredient, because sodium is a nutrient
   * question that the nutrition dimension already answers from the label.
   */
  { role: 'neutral', pattern: /\b(water|carbonated water|filtered water|sea salt|kosher salt|salt|sodium chloride|yeast|baking soda|baking powder|leavening|sodium bicarbonate|sodium carbonate|vinegar|apple cider vinegar|citric acid|lactic acid|malic acid|phosphoric acid|caffeine|carbon dioxide|cultures?|cheese cultures|live cultures|enzymes?|rennet|lime\b|calcium hydroxide|air|nitrogen)\b/ }
];

/** The first rule whose pattern matches, which is where all the judgment lives. */
function ruleReading(text: string): { role: IngredientRole; foodValue: number } | null {
  for (const rule of RULES) {
    if (rule.pattern.test(text)) {
      return { role: rule.role, foodValue: rule.value ?? ROLE_FOOD_VALUE[rule.role] };
    }
  }
  return null;
}

/**
 * The role of one ingredient name, and what it is worth, read left to right.
 *
 * The rules decide first and alone: everything after them runs only for a name no rule
 * placed, so no fallback can overturn a judgment the table already made. The order of
 * what follows is deliberate — the curated spelling map may land on any role, because
 * reading "hydrogenatd oil" as a hydrogenated fat is correct; the fuzzy repair runs last
 * and is checked against food names only, so a guess can credit but never penalise.
 */
export function ingredientReading(name: string): { role: IngredientRole; foodValue: number } {
  const text = name.toLowerCase().trim();
  if (text) {
    const matched = ruleReading(text);
    if (matched) return matched;

    if (isVocabularyFood(text)) {
      return { role: 'whole_food', foodValue: ROLE_FOOD_VALUE.whole_food };
    }

    const corrected = correctSpelling(text);
    if (corrected !== text) {
      const repaired = ruleReading(corrected);
      if (repaired) return repaired;
      if (isVocabularyFood(corrected)) {
        return { role: 'whole_food', foodValue: ROLE_FOOD_VALUE.whole_food };
      }
    }

    if (isVocabularyFood(repairTowardFood(corrected))) {
      return { role: 'whole_food', foodValue: ROLE_FOOD_VALUE.whole_food };
    }
  }
  return { role: 'unknown', foodValue: ROLE_FOOD_VALUE.unknown };
}

/** The role of one ingredient name, read left to right so the specific wins. */
export function ingredientRole(name: string): IngredientRole {
  return ingredientReading(name).role;
}

export type RoledIngredient = {
  name: string;
  role: IngredientRole;
  /** Zero-based position in the list, which is the only quantity hint a label gives. */
  position: number;
  /** Share of the product this position implies, normalised across the list. */
  weight: number;
  /**
   * What this ingredient is worth, from the rule that matched rather than from the role
   * alone — so cassava flour and maltodextrin are not one number because both are
   * starch.
   */
  foodValue: number;
};

/**
 * Position weights.
 *
 * An ingredient list is ordered by mass, and that ordering is the only quantity
 * information most labels give. A geometric decay treats the first ingredient as
 * roughly the whole product when the list is short, and lets a colour in fourteenth
 * place count for almost nothing — which is the right reading of both a soda and a
 * loaf of bread.
 */
export function roleIngredients(names: string[]): RoledIngredient[] {
  const decay = 0.55;
  const raw = names.map((_, index) => decay ** index);
  const total = raw.reduce((sum, value) => sum + value, 0) || 1;
  return names.map((name, index) => ({
    name,
    ...ingredientReading(name),
    position: index,
    weight: raw[index] / total
  }));
}

/** Share of the product, by position weight, held by ingredients of the given roles. */
export function roleShare(ingredients: RoledIngredient[], roles: ReadonlySet<IngredientRole>): number {
  return ingredients
    .filter((ingredient) => roles.has(ingredient.role))
    .reduce((sum, ingredient) => sum + ingredient.weight, 0);
}
