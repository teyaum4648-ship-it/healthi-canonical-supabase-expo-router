import type { ProductArchetype } from './archetypes';
import type {
  ProductDimensionContribution,
  ProductDimensionScore,
  ProductScoreDimension,
  ProductScoreDimensionId
} from './dimensions';
import type { DataConfidence, ProductNutrientBasis, ProductScoringInput } from './engine';
import { ingredientTextForMatching, parseIngredients, type ParsedIngredients } from './ingredientParser';
import type { CategoryProfile } from './profiles';

/**
 * Product Quality V5 keeps the candidate model's four evidence domains while
 * preserving Healthi's existing five-dimension public trace. The candidate
 * whole-food domain is split into ingredient identity and food structure so
 * each part remains inspectable without being counted twice.
 *
 * Candidate weights, renormalized after excluding Lab Evidence and sourcing:
 * nutrition 37.5%, whole-food integrity 25%, processing 18.75%, additives
 * 18.75%. Lab Evidence remains an independent product surface.
 */
export const PRODUCT_QUALITY_V5_DIMENSION_WEIGHTS: Record<ProductScoreDimensionId, number> = {
  ingredient_integrity: 0.15,
  food_structure: 0.1,
  category_nutrition_fit: 0.375,
  processing_purpose: 0.1875,
  formulation_burden: 0.1875
};

type EvidenceState = ProductScoreDimension['evidenceState'];

type DimensionAssessment = {
  score: number | null;
  confidence: DataConfidence;
  evidence: string[];
  evidenceFields: string[];
  evidenceState: EvidenceState;
  anchor: ProductScoreDimension['anchor'];
  evaluated: string[];
  positive: ProductDimensionContribution[];
  negative: ProductDimensionContribution[];
  missing: string[];
  suppressed?: string[];
};

type IngredientSignal = {
  id: string;
  text: string;
  position: number;
  wholeFood: boolean;
  refinedStarch: boolean;
  addedSugar: boolean;
  proteinIsolate: boolean;
  addedFiber: boolean;
  flavorSystem: boolean;
  color: boolean;
  emulsifierOrStabilizer: boolean;
  preservative: boolean;
  syntheticHighIntensitySweetener: boolean;
  plantHighIntensitySweetener: boolean;
  rareSugar: boolean;
  sugarAlcohol: boolean;
  oilBlend: boolean;
  industrialFat: boolean;
  processingIntensity: 0 | 1 | 2 | 3 | 4 | 5;
};

const ADDED_SUGAR = /\b(cane sugar|brown sugar|invert sugar|raw sugar|sugar|sucrose|glucose|dextrose|fructose|maltose|molasses|honey|agave|corn syrup|rice syrup|tapioca syrup|maple syrup|fruit juice concentrate|concentrated sweetener|granulated sweetener)\b/i;
const REFINED_STARCH = /\b(enriched (?:wheat )?flour|white flour|refined (?:wheat )?flour|modified (?:food |corn |potato |tapioca |rice |wheat )?starch|corn starch|cornstarch|tapioca starch|potato starch|rice starch|maltodextrin|dextrin)\b/i;
const PROTEIN_ISOLATE = /\b(protein isolate|protein concentrate|isolated protein|hydroly[sz]ed protein|milk protein|whey protein|pea protein|soy protein)\b/i;
const ADDED_FIBER = /\b(inulin|chicory root fiber|cassava root fiber|soluble (?:corn )?fiber|acacia fiber|added fiber|fiber isolate)\b/i;
const FLAVOR_SYSTEM = /\b(natural flavou?rs?|artificial flavou?rs?|flavou?ring)\b/i;
const COLOR = /\b(caramel color|color added|red 40|yellow 5|yellow 6|blue 1|artificial colors?|titanium dioxide)\b/i;
const EMULSIFIER_STABILIZER = /\b(carrageenan|cellulose gum|carboxymethylcellulose|xanthan gum|guar gum|gellan gum|locust bean gum|lecithin|mono(?:-| )?and(?:-| )?diglycerides|polysorbate 80|sodium citrate|sodium phosphates?|calcium silicate|silicon dioxide|sodium aluminosilicate|tricalcium phosphate|emulsifier|stabili[sz]er|thickener)\b/i;
const PRESERVATIVE = /\b(potassium sorbate|sodium benzoate|calcium propionate|sorbic acid|sodium nitrite|sodium nitrate|bha|bht|preservative)\b/i;
const SYNTHETIC_HIGH_INTENSITY_SWEETENER = /\b(aspartame|sucralose|acesulfame potassium|acesulfame k|ace-?k|saccharin|neotame|advantame)\b/i;
const PLANT_HIGH_INTENSITY_SWEETENER = /\b(stevia|steviol glycosides?|monk fruit|luo han guo)\b/i;
const RARE_SUGAR = /\ballulose\b/i;
const SUGAR_ALCOHOL = /\b(erythritol|xylitol|sorbitol|maltitol|mannitol|isomalt|lactitol|sugar alcohols?)\b/i;
const OIL_BLEND = /\b(vegetable oil blend|oil blend|blend of [a-z ,]+ oils?)\b/i;
const INDUSTRIAL_FAT = /\b(partially hydrogenated|hydrogenated|interesterified|shortening|palm kernel oil)\b/i;
const RECONSTRUCTION = /\b(isolate|concentrate|modified|maltodextrin|dextrin|starch|cellulose|gums?|extruded|reconstituted|powdered base)\b/i;
const PRESERVED_STRUCTURE = /\b(whole|intact|sprouted|rolled|stone[- ]ground|coarse[- ]ground|cold[- ]pressed|extra virgin|cultured|fermented)\b/i;
const CULINARY_SOURCE = /\b(water|milk|cream|yogurt|cheese|eggs?|wheat|oats?|rice|corn|barley|millet|quinoa|potatoes?|tomatoes?|vegetables?|fruit|berries|apples?|bananas?|beans?|chickpeas?|lentils?|peas?|soybeans?|tofu|peanuts?|almonds?|cashews?|walnuts?|nuts?|seeds?|chicken|turkey|beef|pork|tuna|salmon|fish|cocoa|cacao|coffee|tea|olive oil|avocado oil|coconut oil|salt|herbs?|spices?)\b/i;
const REFINED_CARB = new RegExp(`${ADDED_SUGAR.source}|${REFINED_STARCH.source}`, 'i');
const WHOLE_PLANT = /\b(whole|intact|sprouted|oats?|barley|millet|quinoa|tomatoes?|vegetables?|fruit|berries|apples?|bananas?|beans?|chickpeas?|lentils?|peas?|soybeans?|peanuts?|almonds?|cashews?|walnuts?|nuts?|seeds?|cocoa|cacao|tea|coffee)\b/i;

function clamp(value: number, minimum = 0, maximum = 100): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function rounded(value: number): number {
  return Math.round(clamp(value));
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function finite(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function scale(value: number, low: number, high: number, maximum: number): number {
  if (value <= low) return 0;
  if (value >= high) return maximum;
  return ((value - low) / (high - low)) * maximum;
}

function lowerConfidence(left: DataConfidence, right: DataConfidence): DataConfidence {
  const order: Record<DataConfidence, number> = { low: 0, medium: 1, high: 2 };
  return order[left] <= order[right] ? left : right;
}

function ingredientStatus(input: ProductScoringInput): 'complete' | 'partial' | 'reconstructed' | 'absent' {
  return input.ingredientEvidenceStatus ?? (input.ingredientsText?.trim() ? 'complete' : 'absent');
}

function completeIngredients(input: ProductScoringInput): boolean {
  return ingredientStatus(input) === 'complete' && !input.evidenceContext?.ingredientConflict;
}

function contribution(ruleId: string, label: string, delta: number, evidence: string[]): ProductDimensionContribution {
  return { ruleId, label, delta: Math.round(delta * 10) / 10, evidence, effect: 'score_contribution' };
}

function signalFor(text: string, position: number): IngredientSignal {
  const normalized = text.toLowerCase();
  const addedSugar = ADDED_SUGAR.test(normalized) && !RARE_SUGAR.test(normalized) && !SUGAR_ALCOHOL.test(normalized);
  const refinedStarch = REFINED_STARCH.test(normalized);
  const proteinIsolate = PROTEIN_ISOLATE.test(normalized);
  const addedFiber = ADDED_FIBER.test(normalized);
  const flavorSystem = FLAVOR_SYSTEM.test(normalized);
  const color = COLOR.test(normalized);
  const emulsifierOrStabilizer = EMULSIFIER_STABILIZER.test(normalized);
  const preservative = PRESERVATIVE.test(normalized);
  const syntheticHighIntensitySweetener = SYNTHETIC_HIGH_INTENSITY_SWEETENER.test(normalized);
  const plantHighIntensitySweetener = PLANT_HIGH_INTENSITY_SWEETENER.test(normalized);
  const rareSugar = RARE_SUGAR.test(normalized);
  const sugarAlcohol = SUGAR_ALCOHOL.test(normalized);
  const oilBlend = OIL_BLEND.test(normalized);
  const industrialFat = INDUSTRIAL_FAT.test(normalized);
  const operational = flavorSystem || color || emulsifierOrStabilizer || preservative || syntheticHighIntensitySweetener || oilBlend || industrialFat;
  const wholeFood = CULINARY_SOURCE.test(normalized) && !addedSugar && !refinedStarch && !proteinIsolate && !addedFiber && !operational;
  const processingIntensity: IngredientSignal['processingIntensity'] = color || syntheticHighIntensitySweetener || industrialFat
    ? 5
    : refinedStarch || proteinIsolate || addedFiber || emulsifierOrStabilizer || preservative
      ? 4
      : flavorSystem || sugarAlcohol || plantHighIntensitySweetener
        ? 3
        : addedSugar || rareSugar
          ? 2
          : wholeFood
            ? 1
            : 2;
  return {
    id: normalized.replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || `ingredient_${position}`,
    text: normalized,
    position,
    wholeFood,
    refinedStarch,
    addedSugar,
    proteinIsolate,
    addedFiber,
    flavorSystem,
    color,
    emulsifierOrStabilizer,
    preservative,
    syntheticHighIntensitySweetener,
    plantHighIntensitySweetener,
    rareSugar,
    sugarAlcohol,
    oilBlend,
    industrialFat,
    processingIntensity
  };
}

function ingredientSignals(parsed: ParsedIngredients): IngredientSignal[] {
  return parsed.topLevelIngredients.map((token, index) => signalFor(token, index + 1));
}

function hasInterpretableIdentity(signal: IngredientSignal): boolean {
  return signal.wholeFood || signal.refinedStarch || signal.addedSugar || signal.proteinIsolate || signal.addedFiber || signal.flavorSystem ||
    signal.color || signal.emulsifierOrStabilizer || signal.preservative || signal.syntheticHighIntensitySweetener ||
    signal.plantHighIntensitySweetener || signal.rareSugar || signal.sugarAlcohol || PRESERVED_STRUCTURE.test(signal.text) ||
    signal.oilBlend || signal.industrialFat || RECONSTRUCTION.test(signal.text);
}

function hasDirectUnfavorableIdentity(signal: IngredientSignal): boolean {
  return signal.refinedStarch || signal.addedSugar || signal.proteinIsolate || signal.addedFiber || signal.flavorSystem || signal.color ||
    signal.emulsifierOrStabilizer || signal.preservative || signal.syntheticHighIntensitySweetener || signal.sugarAlcohol ||
    signal.oilBlend || signal.industrialFat || RECONSTRUCTION.test(signal.text);
}

function confidenceForIngredients(input: ProductScoringInput, source: DataConfidence): DataConfidence {
  if (completeIngredients(input)) return source;
  if (ingredientStatus(input) === 'absent') return 'low';
  return lowerConfidence(source, 'medium');
}

function ingredientIntegrity(
  input: ProductScoringInput,
  parsed: ParsedIngredients,
  signals: IngredientSignal[],
  sourceConfidence: DataConfidence
): DimensionAssessment {
  if (signals.length === 0) return unsupported('ingredient label evidence', ['ingredient_order', 'formulation_complexity']);
  if (!signals.some(hasInterpretableIdentity)) {
    return unsupported('interpretable ingredient identity semantics', ['ingredient_order', 'formulation_complexity']);
  }
  if (!completeIngredients(input) && !signals.some(hasDirectUnfavorableIdentity)) {
    return unsupported('complete ingredient evidence or direct unfavorable ingredient identity', ['ingredient_order', 'formulation_complexity']);
  }

  let score = 100;
  const positive: ProductDimensionContribution[] = [];
  const negative: ProductDimensionContribution[] = [];
  for (const signal of signals) {
    const orderWeight = signal.position === 1 ? 1.8 : signal.position === 2 ? 1.4 : signal.position === 3 ? 1.15 : 0.65;
    if (signal.addedSugar) negative.push(contribution('added_sugar_ingredient_order', 'Added sugar appears in the ingredient order', -5.5 * orderWeight, [signal.text]));
    if (signal.refinedStarch) negative.push(contribution('refined_starch_ingredient_order', 'Refined starch appears in the ingredient order', -3.2 * orderWeight, [signal.text]));
    if (signal.flavorSystem) negative.push(contribution('flavor_system_ingredient_order', 'A declared flavor system adds formulation complexity', -2.5 * orderWeight, [signal.text]));
    if (signal.proteinIsolate) negative.push(contribution('isolated_protein_ingredient_order', 'An isolated or concentrated protein source shapes the formulation', -1.5 * orderWeight, [signal.text]));
    if (signal.addedFiber) negative.push(contribution('isolated_fiber_ingredient_order', 'An added or isolated fiber source shapes the formulation', -1.5 * orderWeight, [signal.text]));
    if (signal.industrialFat) negative.push(contribution('industrial_fat_ingredient_order', 'An industrially modified fat appears in the ingredient order', -5 * orderWeight, [signal.text]));
  }
  if (signals.length > 5) {
    const penalty = Math.min(12, Math.log2(signals.length - 4) * 3);
    negative.push(contribution('ingredient_list_complexity', 'The formulation uses a broader ingredient system', -penalty, [`${signals.length} top-level ingredients`]));
  }
  const simpleWholeFood = completeIngredients(input) && signals.length <= 5 && signals.some((signal) => signal.wholeFood) &&
    !signals.some((signal) => signal.addedSugar || signal.flavorSystem || signal.color || signal.syntheticHighIntensitySweetener || signal.sugarAlcohol);
  if (simpleWholeFood) positive.push(contribution('simple_food_formulation', 'A short, recognizable ingredient pattern supports ingredient integrity', 5, [`${signals.length} top-level ingredients`]));
  score += [...positive, ...negative].reduce((sum, item) => sum + item.delta, 0);
  const value = rounded(score);
  return assessment({
    score: value,
    confidence: confidenceForIngredients(input, sourceConfidence),
    evidence: [`${signals.length} top-level ingredients`, `ingredient evidence:${ingredientStatus(input)}`],
    evidenceFields: ['ingredientsText', 'ingredientEvidenceStatus'],
    evidenceState: stateFor(value, positive, negative),
    anchor: { ruleId: 'ingredient_integrity_reference', label: 'Ingredient integrity starts from direct declared-order evidence', score: 100, evidence: ['declared ingredient order'] },
    evaluated: ['ingredient_order', 'refined_starch_identity', 'formulation_complexity'],
    positive,
    negative,
    missing: completeIngredients(input) ? [] : ['complete ingredient list needed to confirm formulation simplicity'],
    suppressed: ['ingredient_name_length:not_quality_evidence']
  });
}

function foodStructure(
  input: ProductScoringInput,
  parsed: ParsedIngredients,
  signals: IngredientSignal[],
  archetype: ProductArchetype,
  sourceConfidence: DataConfidence
): DimensionAssessment {
  if (signals.length === 0) return unsupported('ingredient structure evidence', ['whole_food_fraction', 'reconstructed_structure']);
  if (!signals.some(hasInterpretableIdentity)) {
    return unsupported('interpretable ingredient structure semantics', ['whole_food_fraction', 'reconstructed_structure']);
  }
  if (!completeIngredients(input) && !signals.some(hasDirectUnfavorableIdentity)) {
    return unsupported('complete ingredient evidence or direct reconstructed-structure evidence', ['whole_food_fraction', 'reconstructed_structure']);
  }
  const text = ingredientTextForMatching(parsed);
  const wholeCount = signals.filter((signal) => signal.wholeFood).length;
  const wholeFraction = wholeCount / signals.length;
  const refinedCount = signals.filter((signal) => signal.refinedStarch || signal.proteinIsolate || signal.addedFiber || RECONSTRUCTION.test(signal.text)).length;
  const refinedFraction = refinedCount / signals.length;
  const preserved = parsed.flatTokens.filter((token) => PRESERVED_STRUCTURE.test(token));
  const singleRecognizable = completeIngredients(input) && signals.length === 1 && signals[0]!.wholeFood;
  let score = 100;
  const positive: ProductDimensionContribution[] = [];
  const negative: ProductDimensionContribution[] = [];
  if (wholeFraction < 1) {
    negative.push(contribution('whole_food_fraction', 'A smaller share of the label has recognizable food structure', -(1 - wholeFraction) * 30, [`${wholeCount}/${signals.length} recognizable food-source ingredients`]));
  }
  if (refinedFraction > 0) {
    negative.push(contribution('reconstructed_structure', 'Refined or reconstructed ingredients reduce preserved food structure', -Math.min(18, refinedFraction * 18), [`${refinedCount}/${signals.length} refined or reconstructed ingredients`]));
  }
  if (preserved.length > 0) positive.push(contribution('preserved_structure', 'Direct preserved-structure language appears on the label', Math.min(7, 2 + preserved.length), preserved.slice(0, 5)));
  if (singleRecognizable) positive.push(contribution('single_recognizable_source', 'The product has one recognizable declared source', 4, [signals[0]!.text]));
  if (archetype.form === 'beverage' && archetype.base === 'water' && /\bwater\b/i.test(text)) {
    positive.push(contribution('water_based_structure_context', 'The water-based structure is directly declared', 2, ['water-based beverage']));
  }
  score += [...positive, ...negative].reduce((sum, item) => sum + item.delta, 0);
  const value = rounded(score);
  return assessment({
    score: value,
    confidence: confidenceForIngredients(input, sourceConfidence),
    evidence: [`whole-food signal fraction:${wholeFraction.toFixed(2)}`, `reconstructed fraction:${refinedFraction.toFixed(2)}`],
    evidenceFields: ['ingredientsText'],
    evidenceState: stateFor(value, positive, negative),
    anchor: { ruleId: 'food_structure_reference', label: 'Food structure is assessed from declared ingredient identities', score: 100, evidence: ['ingredient identity signals'] },
    evaluated: ['whole_food_fraction', 'preserved_structure', 'reconstructed_structure'],
    positive,
    negative,
    missing: completeIngredients(input) ? [] : ['complete ingredient list needed to confirm structure across the full formula'],
    suppressed: ['ingredient_count_alone:not_food_structure_evidence']
  });
}

function nutrientSource(input: ProductScoringInput, basis: ProductNutrientBasis): { nutrients: ProductNutrientBasis['nutrients']; label: string } {
  const per100g = input.nutrimentsPer100g ?? {};
  const hasPer100g = Object.values(per100g).some((value) => typeof value === 'number' && Number.isFinite(value));
  return hasPer100g ? { nutrients: per100g, label: 'per 100 g provider basis' } : { nutrients: basis.nutrients, label: basis.type.replaceAll('_', ' ') };
}

function nutrition(
  input: ProductScoringInput,
  basis: ProductNutrientBasis,
  signals: IngredientSignal[],
  archetype: ProductArchetype,
  profile: CategoryProfile | null
): DimensionAssessment {
  const selected = nutrientSource(input, basis);
  const nutrients = selected.nutrients;
  const declaredAddedSugar = finite(nutrients.added_sugar_g);
  const totalSugar = finite(nutrients.sugar_g);
  const ingredientEstablishesAddedSugar = signals.some((signal) => signal.addedSugar);
  const addedSugar = declaredAddedSugar ?? (ingredientEstablishesAddedSugar ? totalSugar : null);
  const sodium = finite(nutrients.sodium_mg);
  const saturatedFat = finite(nutrients.saturated_fat_g);
  const fiber = finite(nutrients.fiber_g);
  const protein = finite(nutrients.protein_g);
  const observed = [addedSugar, sodium, saturatedFat, fiber, protein].filter((value) => value !== null).length;
  if (observed === 0) return unsupported('measured nutrition evidence', ['added_sugar', 'sodium', 'saturated_fat', 'fiber', 'protein']);

  let score = 70;
  const positive: ProductDimensionContribution[] = [];
  const negative: ProductDimensionContribution[] = [];
  if (addedSugar !== null) {
    const penalty = scale(addedSugar, 2, 20, 28);
    if (penalty > 0) negative.push(contribution(
      declaredAddedSugar !== null ? 'measured_added_sugar' : 'measured_total_sugar_with_added_sugar_ingredient',
      'Measured sugar tied to a declared added-sugar ingredient reduces the nutrition profile',
      -penalty,
      [`${addedSugar} g ${declaredAddedSugar !== null ? 'added sugar' : 'total sugar'}`, ...(declaredAddedSugar === null ? ['added-sugar ingredient declared'] : [])]
    ));
  }
  const sodiumExpected = ['salt', 'low_sodium_salt', 'electrolyte', 'electrolyte_beverage'].includes(profile?.categoryId ?? '');
  if (sodium !== null && !sodiumExpected) {
    const penalty = scale(sodium, 120, 900, 16);
    if (penalty > 0) negative.push(contribution('measured_sodium', 'Measured sodium is a nutrition consideration on the selected basis', -penalty, [`${sodium} mg sodium`]))
  }
  if (saturatedFat !== null) {
    let penalty = scale(saturatedFat, 2, 15, 12);
    if (archetype.base === 'dairy') penalty *= 0.55;
    if (penalty > 0) negative.push(contribution('measured_saturated_fat', 'Measured saturated fat affects the nutrition profile', -penalty, [`${saturatedFat} g saturated fat`]))
  }
  if (fiber !== null) {
    const bonus = scale(fiber, 1, 10, 18);
    if (bonus > 0) positive.push(contribution('meaningful_role_fiber', 'Meaningful measured fiber supports the nutrition profile', bonus, [`${fiber} g fiber`]))
  }
  if (protein !== null) {
    const bonus = scale(protein, 4, 25, 9);
    if (bonus > 0) positive.push(contribution('meaningful_role_protein', 'Meaningful measured protein provides a capped nutrition contribution', bonus, [`${protein} g protein`]))
  }
  if (completeIngredients(input) && signals.length > 0) {
    const refinedFraction = signals.filter((signal) => REFINED_CARB.test(signal.text)).length / signals.length;
    const plantFraction = signals.filter((signal) => WHOLE_PLANT.test(signal.text) && !signal.addedSugar).length / signals.length;
    const refinedPenalty = Math.min(18, refinedFraction * 18);
    const plantBonus = Math.min(14, plantFraction * 14);
    if (refinedPenalty > 0) negative.push(contribution('refined_carbohydrate_fraction', 'Refined carbohydrate sources affect the nutrition profile', -refinedPenalty, [`refined fraction:${refinedFraction.toFixed(2)}`]));
    if (plantBonus > 0) positive.push(contribution('whole_plant_fraction', 'Whole plant ingredients support the nutrition profile', plantBonus, [`whole-plant fraction:${plantFraction.toFixed(2)}`]));
  }
  const processedMeatSignal = archetype.base === 'meat_fish' && /\b(cured|smoked|sodium nitrite|sodium nitrate|processed meat|meat stick|jerky)\b/i.test(input.ingredientsText ?? '');
  if (processedMeatSignal) negative.push(contribution('processed_meat_context', 'Processed-meat context is a frequency consideration', -10, ['direct processed-meat signal']));
  score += [...positive, ...negative].reduce((sum, item) => sum + item.delta, 0);
  const value = rounded(score);
  const nutritionConfidence = input.evidenceContext?.nutritionConfidence ?? basis.confidence;
  const confidence = observed >= 4 ? nutritionConfidence : observed >= 2 ? lowerConfidence(nutritionConfidence, 'medium') : 'low';
  const missing = [
    ...(declaredAddedSugar === null ? ['measured added sugar'] : []),
    ...(sodium === null ? ['measured sodium'] : []),
    ...(saturatedFat === null ? ['measured saturated fat'] : []),
    ...(fiber === null ? ['measured fiber'] : []),
    ...(protein === null ? ['measured protein'] : [])
  ];
  return assessment({
    score: value,
    confidence,
    evidence: [`nutrition basis:${selected.label}`, `${observed}/5 core nutrition fields observed`],
    evidenceFields: ['nutrientBasis', ...(['per 100 g provider basis'].includes(selected.label) ? ['nutrimentsPer100g'] : ['servingNutrients'])],
    evidenceState: totalSugar === 0 && negative.length === 0 ? 'supported_absence' : stateFor(value, positive, negative),
    anchor: { ruleId: 'nutrition_reference', label: 'Nutrition starts from a neutral evidence reference', score: 70, evidence: [selected.label] },
    evaluated: ['measured_added_sugar', 'measured_sodium', 'measured_saturated_fat', 'meaningful_role_fiber', 'meaningful_role_protein', 'refined_carbohydrate_fraction', 'whole_plant_fraction'],
    positive,
    negative,
    missing,
    suppressed: [
      ...(declaredAddedSugar === null && !ingredientEstablishesAddedSugar ? ['missing_added_sugar:not_assumed_zero'] : []),
      ...(declaredAddedSugar === null && ingredientEstablishesAddedSugar && totalSugar !== null ? ['added_sugar_amount:bounded_by_total_sugar_and_direct_ingredient_evidence'] : []),
      ...(sodiumExpected ? ['expected_electrolyte_sodium:not_generic_penalty'] : []),
      'calories:not_automatically_rewarded_or_penalized'
    ]
  });
}

function processing(
  input: ProductScoringInput,
  signals: IngredientSignal[],
  archetype: ProductArchetype,
  sourceConfidence: DataConfidence
): DimensionAssessment {
  if (signals.length === 0) return unsupported('ingredient evidence needed to assess processing', ['processing_class', 'formulation_operations']);
  const complete = completeIngredients(input);
  const formulationOperations = signals.filter((signal) => signal.flavorSystem || signal.color || signal.emulsifierOrStabilizer || signal.preservative || signal.syntheticHighIntensitySweetener || signal.plantHighIntensitySweetener || signal.sugarAlcohol || signal.oilBlend || signal.industrialFat).length;
  const intensive = signals.filter((signal) => signal.processingIntensity >= 4).length;
  if (!signals.some(hasInterpretableIdentity)) {
    return unsupported('interpretable ingredient processing semantics', ['processing_class', 'formulation_operations']);
  }
  if (!complete && formulationOperations === 0 && intensive === 0) {
    return unsupported('complete ingredient evidence or a direct processing signal', ['processing_class', 'formulation_operations']);
  }
  const simpleSingle = complete && signals.length === 1 && signals[0]!.wholeFood;
  const classEstimate: 1 | 2 | 3 | 4 = simpleSingle
    ? 1
    : formulationOperations >= 3 || intensive >= 3 || signals.length > 15 || archetype.formulation === 'highly_formulated'
      ? 4
      : complete && formulationOperations === 0 && intensive === 0 && signals.length <= 5
        ? 2
        : 3;
  const base: Record<1 | 2 | 3 | 4, number> = { 1: 100, 2: 90, 3: 72, 4: 42 };
  let score = base[classEstimate];
  const positive: ProductDimensionContribution[] = [];
  const negative: ProductDimensionContribution[] = [];
  const averageIntensity = signals.reduce((sum, signal) => sum + signal.processingIntensity, 0) / signals.length;
  const intensityPenalty = scale(averageIntensity, 1.5, 4.5, 20);
  if (intensityPenalty > 0) negative.push(contribution('ingredient_processing_intensity', 'Ingredient processing intensity affects the processing profile', -intensityPenalty, [`average intensity:${averageIntensity.toFixed(2)}`]));
  const operationPenalty = Math.min(15, Math.max(0, formulationOperations - 1) * 2.4);
  if (operationPenalty > 0) negative.push(contribution('multiple_formulation_operations', 'Multiple formulation systems compound processing complexity', -operationPenalty, [`${formulationOperations} formulation operations`]));
  if (classEstimate <= 2) positive.push(contribution('straightforward_processing_pattern', 'The complete label supports a straightforward processing pattern', 3, [`estimated processing class:${classEstimate}`]));
  score += [...positive, ...negative].reduce((sum, item) => sum + item.delta, 0);
  const value = rounded(score);
  return assessment({
    score: value,
    confidence: complete ? confidenceForIngredients(input, sourceConfidence) : 'low',
    evidence: [`estimated processing class:${classEstimate}`, `${formulationOperations} formulation operations`, `average ingredient intensity:${averageIntensity.toFixed(2)}`],
    evidenceFields: ['ingredientsText', 'ingredientEvidenceStatus'],
    evidenceState: stateFor(value, positive, negative),
    anchor: { ruleId: `processing_class_${classEstimate}`, label: `Declared formulation supports processing class ${classEstimate}`, score: base[classEstimate], evidence: [`class:${classEstimate}`] },
    evaluated: ['processing_class', 'ingredient_processing_intensity', 'multiple_formulation_operations'],
    positive,
    negative,
    missing: complete ? [] : ['complete ingredient list needed to confirm the full processing pattern'],
    suppressed: ['product_name:not_processing_evidence']
  });
}

type Concern = { id: string; level: 'limited' | 'moderate' | 'high'; evidenceTier: 1 | 2 | 3 | 4 | 5 | 6; confidence: number; evidence: string[] };

function concernsFor(signals: IngredientSignal[]): Concern[] {
  const concerns: Concern[] = [];
  const add = (id: string, level: Concern['level'], evidenceTier: Concern['evidenceTier'], confidence: number, matches: IngredientSignal[]) => {
    if (matches.length > 0) concerns.push({ id, level, evidenceTier, confidence, evidence: matches.map((signal) => signal.text) });
  };
  add('synthetic_high_intensity_sweetener', 'limited', 1, 0.72, signals.filter((signal) => signal.syntheticHighIntensitySweetener));
  add('sugar_alcohol_system', 'limited', 2, 0.65, signals.filter((signal) => signal.sugarAlcohol));
  add('declared_flavor_system', 'limited', 2, 0.6, signals.filter((signal) => signal.flavorSystem));
  add('emulsifier_or_stabilizer_system', 'limited', 2, 0.65, signals.filter((signal) => signal.emulsifierOrStabilizer));
  add('preservative_system', 'limited', 1, 0.65, signals.filter((signal) => signal.preservative));
  add('added_color_system', 'moderate', 2, 0.7, signals.filter((signal) => signal.color));
  add('industrial_fat_system', 'moderate', 1, 0.82, signals.filter((signal) => signal.industrialFat));
  return concerns;
}

function additives(
  input: ProductScoringInput,
  signals: IngredientSignal[],
  sourceConfidence: DataConfidence
): DimensionAssessment {
  const concerns = concernsFor(signals);
  if (signals.length === 0) return unsupported('ingredient evidence needed to assess additives', ['additive_concerns']);
  if (!completeIngredients(input) && concerns.length === 0) {
    return unsupported('complete ingredient evidence needed to establish absence of additive signals', ['additive_concerns']);
  }
  let score = 100;
  const negative: ProductDimensionContribution[] = [];
  const positive: ProductDimensionContribution[] = [];
  const tierMultiplier: Record<Concern['evidenceTier'], number> = { 1: 1, 2: 0.92, 3: 0.78, 4: 0.62, 5: 0.48, 6: 0.25 };
  const basePenalty: Record<Concern['level'], number> = { limited: 4, moderate: 10, high: 22 };
  let cumulative = 0;
  for (const concern of concerns) {
    const penalty = basePenalty[concern.level] * tierMultiplier[concern.evidenceTier] * clamp(concern.confidence, 0, 1);
    negative.push(contribution(concern.id, additiveLabel(concern.id), -penalty, concern.evidence));
    cumulative += concern.level === 'limited' ? 1 : concern.level === 'moderate' ? 1.6 : 2.5;
  }
  if (cumulative > 1) {
    const compoundingPenalty = Math.min(18, Math.pow(cumulative - 1, 1.35) * 2.2);
    negative.push(contribution('cumulative_additive_burden', 'Multiple concern signals create cumulative formulation burden', -compoundingPenalty, concerns.flatMap((concern) => concern.evidence)));
  }
  if (completeIngredients(input) && concerns.length === 0) {
    positive.push(contribution('supported_absence_of_additive_concerns', 'The complete label shows no recognized additive concern signals', 0, ['complete ingredient label']));
  }
  score += negative.reduce((sum, item) => sum + item.delta, 0);
  const value = rounded(score);
  const plantSweeteners = signals.filter((signal) => signal.plantHighIntensitySweetener).map((signal) => signal.text);
  const rareSugars = signals.filter((signal) => signal.rareSugar).map((signal) => signal.text);
  return assessment({
    score: value,
    confidence: concerns.length > 0 ? confidenceForIngredients(input, sourceConfidence) : completeIngredients(input) ? confidenceForIngredients(input, sourceConfidence) : 'low',
    evidence: [`${concerns.length} recognized additive concern groups`, ...concerns.flatMap((concern) => concern.evidence)],
    evidenceFields: ['ingredientsText', 'ingredientEvidenceStatus'],
    evidenceState: concerns.length > 0 ? 'negative_evidence' : 'supported_absence',
    anchor: { ruleId: 'additive_evidence_reference', label: 'Additives are assessed from recognized, evidence-weighted signals', score: 100, evidence: ['declared ingredients'] },
    evaluated: ['evidence_weighted_additive_concerns', 'cumulative_additive_burden'],
    positive,
    negative,
    missing: completeIngredients(input) ? [] : ['complete ingredient list needed to assess unobserved additive signals'],
    suppressed: [
      ...plantSweeteners.map((item) => `plant_high_intensity_sweetener:${item}:separate_from_synthetic_sweeteners`),
      ...rareSugars.map((item) => `rare_sugar:${item}:separate_from_sugar_alcohols`)
    ]
  });
}

function additiveLabel(id: string): string {
  if (id === 'synthetic_high_intensity_sweetener') return 'A synthetic high-intensity sweetener is a limited formulation concern';
  if (id === 'sugar_alcohol_system') return 'A sugar-alcohol system is a limited formulation concern';
  if (id === 'declared_flavor_system') return 'A declared flavor system is a limited formulation concern';
  if (id === 'emulsifier_or_stabilizer_system') return 'An emulsifier or stabilizer system is a limited formulation concern';
  if (id === 'preservative_system') return 'A preservative system is a limited formulation concern';
  if (id === 'industrial_fat_system') return 'An industrially modified fat is a moderate formulation concern';
  return 'An added color system is a moderate formulation concern';
}

function unsupported(missing: string, evaluated: string[]): DimensionAssessment {
  return {
    score: null,
    confidence: 'low',
    evidence: [],
    evidenceFields: [],
    evidenceState: 'unsupported',
    anchor: null,
    evaluated,
    positive: [],
    negative: [],
    missing: [missing]
  };
}

function stateFor(score: number, positive: ProductDimensionContribution[], negative: ProductDimensionContribution[]): EvidenceState {
  if (positive.length > 0 && negative.length > 0) return 'mixed';
  if (negative.length > 0) return 'negative_evidence';
  if (positive.length > 0) return 'positive_evidence';
  return score >= 90 ? 'supported_absence' : 'not_detected';
}

function assessment(value: DimensionAssessment): DimensionAssessment {
  return value;
}

function buildDimension(
  id: ProductScoreDimensionId,
  label: string,
  value: DimensionAssessment
): ProductScoreDimension {
  return {
    id,
    label,
    score: value.score,
    weight: PRODUCT_QUALITY_V5_DIMENSION_WEIGHTS[id],
    effectiveWeight: 0,
    contribution: 0,
    confidence: value.confidence,
    evidence: unique(value.evidence),
    evidenceFields: unique(value.evidenceFields),
    evidenceState: value.score === null ? 'unsupported' : value.evidenceState,
    anchor: value.score === null ? null : value.anchor,
    rulesEvaluated: unique(value.evaluated),
    rulesFired: unique([...(value.anchor ? [value.anchor.ruleId] : []), ...value.positive.map((item) => item.ruleId), ...value.negative.map((item) => item.ruleId)]),
    rulesSuppressed: unique(value.suppressed ?? []),
    positiveContributions: value.positive,
    negativeContributions: value.negative,
    missingEvidence: unique(value.missing),
    range: null
  };
}

function rangeFor(dimension: ProductScoreDimension): [number, number] {
  const spread = dimension.confidence === 'high' ? 4 : dimension.confidence === 'medium' ? 9 : 16;
  const missingSpread = Math.min(8, dimension.missingEvidence.length * 2);
  return [rounded((dimension.score ?? 0) - spread - missingSpread), rounded((dimension.score ?? 0) + spread + missingSpread)];
}

export function scoreProductDimensionsV5(params: {
  input: ProductScoringInput;
  archetype: ProductArchetype;
  basis: ProductNutrientBasis;
  sourceConfidence: DataConfidence;
  profile: CategoryProfile | null;
}): ProductDimensionScore {
  const { input, archetype, basis, sourceConfidence, profile } = params;
  const parsed = parseIngredients(input.ingredientsText, ingredientStatus(input));
  const signals = ingredientSignals(parsed);
  const dimensions = [
    buildDimension('ingredient_integrity', 'Ingredient integrity', ingredientIntegrity(input, parsed, signals, sourceConfidence)),
    buildDimension('formulation_burden', 'Additives and formulation', additives(input, signals, sourceConfidence)),
    buildDimension('category_nutrition_fit', 'Nutrition profile', nutrition(input, basis, signals, archetype, profile)),
    buildDimension('food_structure', 'Food structure', foodStructure(input, parsed, signals, archetype, sourceConfidence)),
    buildDimension('processing_purpose', 'Processing profile', processing(input, signals, archetype, sourceConfidence))
  ];
  const supported = dimensions.filter((dimension) => dimension.score !== null);
  const supportedWeight = Math.round(supported.reduce((sum, dimension) => sum + dimension.weight, 0) * 10000) / 10000;
  const unknownWeight = Math.max(0, Math.round((1 - supportedWeight) * 10000) / 10000);
  const materialUnknownDimensions = dimensions.filter((dimension) => dimension.score === null && dimension.weight >= 0.15).map((dimension) => dimension.id);
  const scoreScope = supportedWeight >= 0.85 && materialUnknownDimensions.length === 0 ? 'overall' as const : 'supported_evidence' as const;
  const aggregation: ProductDimensionScore['aggregation'] = {
    method: 'conditional_supported_evidence_with_unknown_interval',
    formula: 'sum(weight * supported score) / supported weight',
    supportedWeightedSum: 0,
    supportedWeight,
    unknownWeight,
    supportedDimensionCount: supported.length,
    conditionalCentralScore: null,
    scoreScope,
    materialUnknownDimensions
  };
  if (supported.length === 0 || supportedWeight === 0) return { score: null, range: null, dimensions, supportedWeight, scoreScope, aggregation };

  for (const dimension of supported) {
    dimension.effectiveWeight = dimension.weight / supportedWeight;
    dimension.contribution = dimension.score! * dimension.effectiveWeight;
    dimension.range = rangeFor(dimension);
  }
  const conditionalScore = rounded(supported.reduce((sum, dimension) => sum + dimension.contribution, 0));
  const supportedWeightedSum = supported.reduce((sum, dimension) => sum + dimension.score! * dimension.weight, 0);
  const conflictSpread = input.evidenceContext?.providerConflict || input.evidenceContext?.ingredientConflict ? 6 : 0;
  const low = rounded(supported.reduce((sum, dimension) => sum + dimension.range![0] * dimension.weight, 0) - conflictSpread);
  const high = rounded(supported.reduce((sum, dimension) => sum + dimension.range![1] * dimension.weight, 0) + unknownWeight * 100 + conflictSpread);
  return {
    score: conditionalScore,
    range: [Math.min(low, conditionalScore), Math.max(high, conditionalScore)],
    dimensions,
    supportedWeight,
    scoreScope,
    aggregation: {
      ...aggregation,
      supportedWeightedSum: Math.round(supportedWeightedSum * 10) / 10,
      conditionalCentralScore: conditionalScore
    }
  };
}
