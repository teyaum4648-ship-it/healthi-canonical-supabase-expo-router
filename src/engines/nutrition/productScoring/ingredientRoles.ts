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

type Rule = { role: IngredientRole; pattern: RegExp };

/**
 * Order matters: the first match wins, so the specific precedes the general. "cocoa
 * butter" must be read before "butter", and "palm kernel oil" before "palm oil".
 */
const RULES: Rule[] = [
  // Industrial fats first — these names contain other fat names inside them.
  { role: 'industrial_fat', pattern: /\b(partially hydrogenated|fully hydrogenated|hydrogenated|interesterified|shortening|palm kernel oil|margarine)\b/ },

  // Traditional culinary fats, judged by source rather than by saturation.
  { role: 'culinary_fat', pattern: /\b(extra virgin olive oil|olive oil|avocado oil|coconut oil|virgin coconut oil|cocoa butter|butter|clarified butter|ghee|butterfat|milkfat|beef tallow|tallow|lard|duck fat|sesame oil|peanut oil|palm fruit oil|red palm oil)\b/ },

  // Industrially refined seed and vegetable oils, including unnamed blends.
  { role: 'seed_oil', pattern: /\b(canola oil|rapeseed oil|soybean oil|soy oil|corn oil|cottonseed oil|sunflower oil|high oleic sunflower oil|safflower oil|grapeseed oil|rice bran oil|palm oil|vegetable oil|vegetable oils|vegetable oil blend|oil blend|blend of [a-z ,]*oils?)\b/ },

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
  { role: 'refined_starch', pattern: /\b(enriched (?:wheat |bleached |unbleached )*flour|bleached flour|white flour|refined (?:wheat )?flour|wheat flour|rice flour|soy flour|modified (?:food |corn |potato |tapioca |rice |wheat )?starch|corn ?starch|tapioca starch|potato starch|rice starch|maltodextrin|dextrin|semolina|milled corn|degerminated corn ?meal)\b/ },

  /**
   * Root starches, which a grain-free product uses in place of flour and which an
   * earlier version of this table did not recognise at all — tapioca and cassava came
   * back `unknown`, so in an almond-flour cracker the second and third ingredients,
   * two fifths of the product, counted as neither food nor formulation. They are the
   * same proposition as white flour and are read that way: a starch stripped of the
   * fibre that would have slowed it down.
   */
  { role: 'refined_starch', pattern: /\b(tapioca|cassava(?: flour| starch| root)?|yuca|arrowroot(?: flour| starch)?|potato flour|sweet potato flour|plantain flour|water chestnut flour|sago)\b/ },

  // Fractions of food standing in for the food.
  { role: 'isolate', pattern: /\b(protein isolate|protein concentrate|isolated protein|hydroly[sz]ed (?:protein|collagen)|whey protein|pea protein|soy protein isolate|milk protein concentrate|inulin|chicory root fiber|soluble (?:corn )?fiber|acacia fiber|fiber isolate|yeast extract|monosodium glutamate|msg)\b/ },

  { role: 'flavor_system', pattern: /\b(natural flavou?rs?|artificial flavou?rs?|natural and artificial flavou?rs?|flavou?ring|smoke flavou?r|vanillin|essence)\b/ },
  { role: 'color', pattern: /\b(caramel color|color added|colors?\b|red 40|yellow 5|yellow 6|blue 1|blue 2|green 3|artificial colou?rs?|titanium dioxide|annatto|paprika extract|beta ?carotene)\b/ },
  { role: 'preservative', pattern: /\b(potassium sorbate|sodium benzoate|calcium propionate|propionic acid|sorbic acid|sodium nitrite|sodium nitrate|bha|bht|tbhq|edta|benzoate|preservative)\b/ },
  { role: 'texturizer', pattern: /\b(carrageenan|cellulose gum|carboxymethylcellulose|xanthan gum|guar gum|gellan gum|locust bean gum|gum acacia|gum arabic|lecithin|mono-? and diglycerides|mono and diglycerides|polysorbate \d+|sodium citrate|sodium phosphates?|sodium stearoyl lactylate|calcium silicate|silicon dioxide|tricalcium phosphate|pectin|gelatin|emulsifier|stabili[sz]er|thickener|cellulose)\b/ },
  { role: 'fortificant', pattern: /\b(calcium carbonate|calcium sulfate|vitamin [a-z]\d*|ascorbic acid|niacinamide|riboflavin|thiamine|folic acid|ferrous sulfate|zinc oxide|potassium iodide|iron\b)\b/ },

  /**
   * Whole foods. The list is long on purpose: an ingredient this does not recognise is
   * scored as unknown rather than as food, so a gap here costs a product points it may
   * deserve. Whole-grain forms are listed explicitly so they beat the refined rule.
   */
  { role: 'whole_food', pattern: /\b(whole (?:wheat|grain|oat|rye|corn|barley|spelt) ?(?:flour|berries)?|whole wheat|whole grain|whole durum wheat semolina|sprouted [a-z]+|rolled oats?|steel[- ]cut oats?|oats?|oatmeal|quinoa|amaranth|buckwheat|millet|barley|farro|brown rice|wild rice|rice\b|corn\b|ground corn|hominy|masa)\b/ },
  { role: 'whole_food', pattern: /\b(blueberr(?:y|ies)|strawberr(?:y|ies)|raspberr(?:y|ies)|blackberr(?:y|ies)|cranberr(?:y|ies)|berries|apples?|bananas?|oranges?|lemons?|limes?|pears?|peaches?|mangoe?s?|pineapples?|grapes?|raisins?|dates?|figs?|prunes?|apricots?|cherries|fruit|tomatoes?|tomato paste|tomato powder)\b/ },
  { role: 'whole_food', pattern: /\b(broccoli|spinach|kale|carrots?|celery|onions?|garlic|peppers?|cucumbers?|lettuce|cabbage|cauliflower|zucchini|squash|sweet potatoes?|potatoes?|mushrooms?|peas?|green beans?|asparagus|beets?|vegetables?|basil|herbs?|spices?|cinnamon|parsley|oregano|thyme|rosemary|ginger|turmeric)\b/ },
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

/** The role of one ingredient name, read left to right so the specific wins. */
export function ingredientRole(name: string): IngredientRole {
  const text = name.toLowerCase().trim();
  if (!text) return 'unknown';
  for (const rule of RULES) {
    if (rule.pattern.test(text)) return rule.role;
  }
  return 'unknown';
}

export type RoledIngredient = {
  name: string;
  role: IngredientRole;
  /** Zero-based position in the list, which is the only quantity hint a label gives. */
  position: number;
  /** Share of the product this position implies, normalised across the list. */
  weight: number;
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
    role: ingredientRole(name),
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
