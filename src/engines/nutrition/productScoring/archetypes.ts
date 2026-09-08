import type { DataConfidence, ProductNutrients, ProductScoringInput } from './engine';
import type { CategoryResolution } from './categoryResolution';
import { parseIngredients } from './ingredientParser';

export type ProductFormArchetype = 'beverage' | 'solid' | 'powder' | 'pantry' | 'mixed';
export type ProductBaseArchetype =
  | 'water'
  | 'dairy'
  | 'grain'
  | 'legume'
  | 'nut_seed'
  | 'fruit_vegetable'
  | 'meat_fish'
  | 'mixed';
export type ProductIntentArchetype =
  | 'staple'
  | 'meal'
  | 'snack'
  | 'dessert'
  | 'hydration'
  | 'performance'
  | 'condiment';
export type ProductFormulationArchetype = 'simple' | 'processed' | 'functional' | 'highly_formulated';

export type ProductArchetype = {
  form: ProductFormArchetype;
  base: ProductBaseArchetype;
  intent: ProductIntentArchetype;
  formulation: ProductFormulationArchetype;
  confidence: DataConfidence;
  contextMode: 'narrow_category' | 'broad_identity' | 'evidence_fallback';
  contextSignalCount: number;
  evidence: string[];
  missingEvidence: string[];
};

const CATEGORY_ARCHETYPES: Record<string, Pick<ProductArchetype, 'form' | 'base' | 'intent'>> = {
  salt: { form: 'pantry', base: 'mixed', intent: 'staple' },
  low_sodium_salt: { form: 'pantry', base: 'mixed', intent: 'staple' },
  electrolyte: { form: 'powder', base: 'mixed', intent: 'hydration' },
  electrolyte_beverage: { form: 'beverage', base: 'water', intent: 'hydration' },
  sparkling_water: { form: 'beverage', base: 'water', intent: 'hydration' },
  soda: { form: 'beverage', base: 'water', intent: 'snack' },
  prebiotic_soda: { form: 'beverage', base: 'water', intent: 'performance' },
  still_water: { form: 'beverage', base: 'water', intent: 'hydration' },
  energy_drink: { form: 'beverage', base: 'water', intent: 'performance' },
  juice: { form: 'beverage', base: 'fruit_vegetable', intent: 'snack' },
  plant_milk: { form: 'beverage', base: 'nut_seed', intent: 'staple' },
  ready_to_drink_protein: { form: 'beverage', base: 'mixed', intent: 'performance' },
  yogurt: { form: 'solid', base: 'dairy', intent: 'staple' },
  cottage_cheese: { form: 'solid', base: 'dairy', intent: 'staple' },
  ice_cream: { form: 'solid', base: 'dairy', intent: 'dessert' },
  frozen_dairy_dessert: { form: 'solid', base: 'dairy', intent: 'dessert' },
  bread: { form: 'solid', base: 'grain', intent: 'staple' },
  pasta: { form: 'solid', base: 'grain', intent: 'staple' },
  pancake_mix: { form: 'powder', base: 'grain', intent: 'staple' },
  cereal: { form: 'solid', base: 'grain', intent: 'staple' },
  cereal_bar: { form: 'solid', base: 'grain', intent: 'snack' },
  crackers: { form: 'solid', base: 'grain', intent: 'snack' },
  chips: { form: 'solid', base: 'fruit_vegetable', intent: 'snack' },
  protein_chip: { form: 'solid', base: 'legume', intent: 'performance' },
  protein_bar: { form: 'solid', base: 'mixed', intent: 'performance' },
  protein_powder: { form: 'powder', base: 'mixed', intent: 'performance' },
  marinara: { form: 'mixed', base: 'fruit_vegetable', intent: 'condiment' },
  condiments: { form: 'mixed', base: 'mixed', intent: 'condiment' },
  soup: { form: 'mixed', base: 'mixed', intent: 'meal' },
  broth: { form: 'mixed', base: 'meat_fish', intent: 'meal' },
  tofu: { form: 'solid', base: 'legume', intent: 'staple' },
  canned_fish: { form: 'solid', base: 'meat_fish', intent: 'staple' },
  plant_based_meat: { form: 'solid', base: 'legume', intent: 'meal' },
  prepared_meat: { form: 'solid', base: 'meat_fish', intent: 'meal' },
  meat_snack: { form: 'solid', base: 'meat_fish', intent: 'snack' },
  chocolate: { form: 'solid', base: 'nut_seed', intent: 'dessert' },
  cookies: { form: 'solid', base: 'grain', intent: 'dessert' }
};

function ingredientCount(text: string): number {
  return parseIngredients(text).topLevelIngredients.length;
}

function nutrients(input: ProductScoringInput): ProductNutrients {
  return input.servingNutrients ?? input.preparedServingNutrients ?? input.nutrimentsPer100g ?? {};
}

const BROAD_IDENTITY_SIGNALS: Array<{
  pattern: RegExp;
  form: ProductFormArchetype;
  base: ProductBaseArchetype;
  intent: ProductIntentArchetype;
  id: string;
}> = [
  { id: 'nut_seed_spread', pattern: /\b(peanut butter|almond butter|cashew butter|nut butter|seed butter|nut spread|seed spread|tahini)\b/, form: 'pantry', base: 'nut_seed', intent: 'staple' },
  { id: 'still_water', pattern: /\b(still water|spring water|purified water|bottled water)\b/, form: 'beverage', base: 'water', intent: 'hydration' },
  { id: 'tofu', pattern: /\btofu\b/, form: 'solid', base: 'legume', intent: 'staple' },
  { id: 'canned_fish', pattern: /\b(canned|pouch|chunk light|solid white).*(tuna|salmon|sardines?|fish)\b|\b(tuna|salmon|sardines?) in (water|oil)\b/, form: 'solid', base: 'meat_fish', intent: 'staple' },
  { id: 'plant_based_meat', pattern: /\b(plant[- ]based|meatless|veggie) (burger|patty|meat|sausage|grounds?)\b/, form: 'solid', base: 'legume', intent: 'meal' },
  { id: 'pancake_mix', pattern: /\b(pancake|waffle) mix\b/, form: 'powder', base: 'grain', intent: 'staple' },
  { id: 'protein_beverage', pattern: /\b(protein shake|protein drink|protein beverage)\b/, form: 'beverage', base: 'mixed', intent: 'performance' },
  { id: 'condiment', pattern: /\b(ketchup|mustard|mayonnaise|mayo|dressing|condiment|barbecue sauce|hot sauce)\b/, form: 'mixed', base: 'mixed', intent: 'condiment' },
  { id: 'frozen_mixed_meal', pattern: /\b(frozen (meal|dinner|bowl|entree)|prepared meal|meal bowl)\b/, form: 'mixed', base: 'mixed', intent: 'meal' }
];

export function resolveProductArchetype(
  input: ProductScoringInput,
  category: CategoryResolution
): ProductArchetype | null {
  const text = (input.ingredientsText ?? '').toLowerCase();
  const identity = `${input.name} ${(input.categoryTags ?? []).join(' ')}`.toLowerCase();
  const mapped = category.selectedCategoryId ? CATEGORY_ARCHETYPES[category.selectedCategoryId] : null;
  const broad = BROAD_IDENTITY_SIGNALS.find((signal) => signal.pattern.test(identity));
  const evidence: string[] = [];
  const missingEvidence: string[] = [];

  let form = mapped?.form ?? broad?.form;
  if (!form) {
    if (/\b(drink|beverage|water|soda|cola|juice|milk)\b/.test(identity)) form = 'beverage';
    else if (/\b(powder|mix)\b/.test(identity)) form = 'powder';
    else if (/\b(sauce|soup|broth)\b/.test(identity)) form = 'mixed';
    else if (text) form = 'solid';
  }
  if (!form) return null;
  evidence.push(mapped ? `category:${category.selectedCategoryId}` : broad ? `broad_identity:${broad.id}` : `form:${form}`);

  let base = mapped?.base ?? broad?.base;
  if (!base) {
    if (/\b(water|carbonated water)\b/.test(text)) base = 'water';
    else if (/\b(milk|cream|whey|casein)\b/.test(text)) base = 'dairy';
    else if (/\b(wheat|oat|rice|corn|barley|flour)\b/.test(text)) base = 'grain';
    else if (/\b(beans?|chickpeas?|lentils?|peas?|soy|tofu)\b/.test(text)) base = 'legume';
    else if (/\b(almonds?|cashews?|peanuts?|seeds?)\b/.test(text)) base = 'nut_seed';
    else if (/\b(tomato|fruit|vegetable|potato)\b/.test(text)) base = 'fruit_vegetable';
    else if (/\b(chicken|turkey|beef|pork|tuna|salmon|fish)\b/.test(text)) base = 'meat_fish';
    else base = 'mixed';
  }
  evidence.push(`base:${base}`);

  let intent = mapped?.intent ?? broad?.intent;
  if (!intent) {
    if (/\b(electrolyte|hydration|water)\b/.test(identity)) intent = 'hydration';
    else if (/\b(protein|energy|performance)\b/.test(identity)) intent = 'performance';
    else if (/\b(cookie|candy|dessert|ice cream|chocolate)\b/.test(identity)) intent = 'dessert';
    else if (/\b(chips?|crackers?|bars?|snacks?)\b/.test(identity)) intent = 'snack';
    else if (/\b(sauce|condiment|ketchup|mustard)\b/.test(identity)) intent = 'condiment';
    else intent = form === 'solid' || form === 'mixed' ? 'staple' : 'snack';
  }
  evidence.push(`intent:${intent}`);

  const count = ingredientCount(text);
  const formulationSignals = [
    /\b(natural flavors?|artificial flavors?)\b/.test(text),
    /\b(sucralose|aspartame|acesulfame potassium|saccharin)\b/.test(text),
    /\b(xanthan gum|guar gum|carrageenan|cellulose gum|lecithin)\b/.test(text),
    /\b(red 40|yellow 5|yellow 6|blue 1|artificial colors?)\b/.test(text),
    /\b(protein isolate|protein concentrate|inulin|soluble fiber)\b/.test(text),
    /\b(corn syrup|maltodextrin|modified food starch)\b/.test(text),
    /\b(partially hydrogenated|hydrogenated oil|shortening)\b/.test(text)
  ].filter(Boolean).length;
  const functional = /\b(protein isolate|protein concentrate|inulin|prebiotic|electrolyte|caffeine)\b/.test(text);
  const formulation: ProductFormulationArchetype = formulationSignals >= 3 || count > 15
    ? 'highly_formulated'
    : functional
      ? 'functional'
      : formulationSignals > 0 || count > 7
        ? 'processed'
        : 'simple';
  evidence.push(`formulation:${formulation}`);

  if (!text) missingEvidence.push('ingredient_list');
  if (!Object.values(nutrients(input)).some((value) => typeof value === 'number')) missingEvidence.push('nutrition_panel');
  const broadIngredientSupport = Boolean(broad && (
    broad.base === 'nut_seed' ? /\b(peanuts?|almonds?|cashews?|nuts?|seeds?|sesame)\b/.test(text) :
    broad.base === 'water' ? /\bwater\b/.test(text) :
    broad.base === 'legume' ? /\b(soybeans?|tofu|peas?|beans?|lentils?)\b/.test(text) :
    broad.base === 'meat_fish' ? /\b(tuna|salmon|sardines?|fish)\b/.test(text) :
    text.length > 0
  ));
  if (broadIngredientSupport) evidence.push(`broad_identity_ingredient_support:${broad!.id}`);
  const contextMode: ProductArchetype['contextMode'] = mapped
    ? 'narrow_category'
    : broadIngredientSupport
      ? 'broad_identity'
      : 'evidence_fallback';
  const categorySources = new Set(
    category.candidates.find((candidate) => candidate.selected)?.evidence.map((item) => item.source) ?? []
  );
  const directContextSignals = [
    text ? 'ingredients' : null,
    Object.values(nutrients(input)).some((value) => typeof value === 'number') ? 'nutrition' : null,
    (input.categoryTags?.length ?? 0) > 0 ? 'provider_category' : null,
    broad ? 'broad_identity' : null,
    ...categorySources
  ].filter((value): value is string => Boolean(value));
  const contextSignalCount = new Set(directContextSignals).size;
  evidence.push(`context_mode:${contextMode}`, `context_signals:${contextSignalCount}`);
  const confidence: DataConfidence = mapped && text
    ? category.interpretationConfidence === 'high' ? 'high' : 'medium'
    : broadIngredientSupport
      ? 'medium'
      : text && (mapped || broad || category.interpretationConfidence !== 'low')
      ? 'medium'
      : 'low';

  return { form, base, intent, formulation, confidence, contextMode, contextSignalCount, evidence, missingEvidence };
}
