import type { ProductLetterGrade, ProductNutrients } from './engine';
import type { ProductScoreDimension } from './dimensions';
import { splitIngredientList } from './engine';
import {
  FOOD_ROLES,
  roleIngredients,
  type IngredientRole,
  type RoledIngredient
} from './ingredientRoles';

/**
 * Why the score is the score.
 *
 * The scanner used to state a conclusion and keep its premise to itself. "Built on an
 * industrially refined seed oil" only lands if you already believe seed oils are a
 * problem, and "Nutrition profile: What the label delivers" does not even manage that.
 * Every reason was an enthymeme — a syllogism with the interesting half missing — so
 * the screen could be read as an opinion with a number attached.
 *
 * What is missing is never the conclusion. It is the mechanism: tapioca and cassava
 * are marked down because the fibre that would slow them is milled out and they land
 * about as fast as glucose; a seed oil is marked down because of how it is extracted,
 * not because of its saturated-fat line. Those are claims a person can agree or
 * disagree with, which is the point — an unstated premise cannot be argued with.
 *
 * Two rules hold this honest.
 *
 * **Every number said out loud comes from the label.** A share is a position weight, a
 * gram is a gram off the panel. Nothing is rounded into a better story.
 *
 * **The ordering comes from the kernel's own ledger.** A finding is anchored to the
 * rule that actually moved the score, so the list cannot drift away from the number it
 * is explaining: the reason that weighed most is the reason that leads. Where a finding
 * is a reading of the panel rather than a rule — "nothing here slows the sugar down" is
 * true of a cola whether or not a rule fired for it — it carries a declared weight, so
 * the most important thing about a drink does not sort to the bottom for want of a
 * ledger entry.
 */

export type ProductFindingTone = 'strength' | 'cost';

export type ProductFinding = {
  id: string;
  tone: ProductFindingTone;
  /** The specifics: which ingredients, and where they sit in the list. */
  headline: string;
  /** The premise the score was leaving unstated. */
  mechanism: string;
  /**
   * How much this weighed on the score, used to order the list.
   *
   * It is the kernel's own ledger delta, which is internal to one dimension and is not
   * a count of points off the final score — a dimension is weighted and then clamped,
   * so no honest arithmetic turns "-36 on nutrition fit" into "-11 overall". It orders
   * the findings and is never rendered as a number, because a number a person could
   * add up would be a number they were entitled to add up.
   */
  weight: number;
};

export type CompositionSlice = {
  role: IngredientRole;
  label: string;
  /** Share of the product by position weight, which is what an ingredient order implies. */
  share: number;
  names: string[];
};

export type ProductExplanation = {
  /** What this band means, in the words the philosophy uses. */
  verdict: string;
  composition: CompositionSlice[];
  /** Biggest mover first, whichever way it moved. */
  findings: ProductFinding[];
  /** Ingredients the role table cannot place. Named on screen rather than hidden. */
  unrecognised: string[];
};

/**
 * What each band means, which is the one piece of copy that is a product decision
 * rather than a reading of the label.
 */
const BAND_MEANING: Record<ProductLetterGrade, string> = {
  A: 'An intact food with nothing done to it that needs defending.',
  B: 'The better version of something you were going to eat anyway.',
  C: 'Harm reduction. It earns its place against a worse option, not on its own.',
  D: 'Better off skipping — not poison, just not worth the slot when a B exists in the same aisle.',
  F: 'There is no version of this that is doing you a favour.'
};

const ROLE_LABEL: Record<IngredientRole, string> = {
  whole_food: 'Whole foods',
  culinary_fat: 'Culinary fat',
  seed_oil: 'Refined seed oil',
  industrial_fat: 'Hydrogenated fat',
  added_sugar: 'Added sugar',
  refined_starch: 'Refined starch',
  isolate: 'Isolated fractions',
  flavor_system: 'Flavouring',
  color: 'Colour',
  preservative: 'Preservative',
  texturizer: 'Texturiser',
  high_intensity_sweetener: 'Sweetener',
  sugar_alcohol: 'Sugar alcohol',
  fortificant: 'Added vitamins',
  neutral: 'Water, salt and leavening',
  unknown: 'Not yet recognised'
};

/** Roles that are there to build the product rather than to feed anyone. */
const COST_ROLES: ReadonlySet<IngredientRole> = new Set([
  'seed_oil', 'industrial_fat', 'added_sugar', 'refined_starch', 'isolate',
  'flavor_system', 'color', 'high_intensity_sweetener'
]);

function ordinal(position: number): string {
  const n = position + 1;
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
}

/** "a", "a and b", "a, b and c" — an English list, not a join. */
function listOf(parts: string[]): string {
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

function sentenceCase(text: string): string {
  const trimmed = text.trim();
  return trimmed ? trimmed[0].toUpperCase() + trimmed.slice(1) : trimmed;
}

function pct(share: number): string {
  return `${Math.round(share * 100)}%`;
}

/** Grams as a person writes them: 3.6, not 3.60, and 10 rather than 10.0. */
function grams(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 10) / 10);
}

function finite(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** Where a set of ingredients sits, as "2nd and 3rd" or "1st". */
function positionsOf(items: RoledIngredient[]): string {
  return listOf(items.map((item) => ordinal(item.position)));
}

function namesOf(items: RoledIngredient[]): string {
  return listOf(items.map((item) => item.name));
}

export function explainProductScore(params: {
  ingredientsText: string | null | undefined;
  /** The same per-100 basis the kernel scored, so a stated gram matches the score. */
  nutrients: ProductNutrients | null | undefined;
  /** '100 g' for a food, '100 ml' for a drink. Only used in the copy. */
  basisLabel?: string;
  dimensions: ProductScoreDimension[];
  grade: ProductLetterGrade | null;
}): ProductExplanation {
  const basis = params.basisLabel ?? '100 g';
  const names = params.ingredientsText ? splitIngredientList(params.ingredientsText) : [];
  const ingredients = roleIngredients(names);
  const nutrients = params.nutrients ?? null;

  /**
   * Points come from the kernel, never from this file. Where a rule did not fire the
   * finding shows no number at all, which is honest about the difference between a
   * reason the score used and a reading it did not.
   */
  const points = new Map<string, number>();
  for (const dimension of params.dimensions) {
    for (const contribution of [...dimension.positiveContributions, ...dimension.negativeContributions]) {
      points.set(contribution.ruleId, (points.get(contribution.ruleId) ?? 0) + contribution.delta);
    }
  }
  const weightFor = (...ruleIds: string[]): number | null => {
    const found = ruleIds.filter((id) => points.has(id));
    if (found.length === 0) return null;
    return Math.abs(Math.round(found.reduce((sum, id) => sum + (points.get(id) ?? 0), 0)));
  };

  const byRole = (role: IngredientRole) => ingredients.filter((item) => item.role === role);
  const shareOf = (role: IngredientRole) => byRole(role).reduce((sum, item) => sum + item.weight, 0);

  const calories = finite(nutrients?.calories);
  const usable = calories !== null && calories > 0;
  const fiber = finite(nutrients?.fiber_g);
  const protein = finite(nutrients?.protein_g);
  const sugar = finite(nutrients?.added_sugar_g) ?? finite(nutrients?.sugar_g);
  const sodium = finite(nutrients?.sodium_mg);

  const findings: ProductFinding[] = [];

  // ---- What it is mostly made of, when that is food -------------------------------
  const foods = ingredients.filter((item) => FOOD_ROLES.has(item.role));
  const foodShare = foods.reduce((sum, item) => sum + item.weight, 0);

  /**
   * Which foods actually lead, which means walking the list rather than filtering it.
   * Filtering reported a rosemary extract in sixth place as leading a cracker, on the
   * grounds that it was the second food-shaped thing in the package. Water and salt are
   * stepped over rather than breaking the run: a hummus does not stop being chickpeas
   * because water is declared first.
   */
  const leadingFoods: RoledIngredient[] = [];
  for (const item of ingredients) {
    if (item.role === 'neutral') continue;
    if (!FOOD_ROLES.has(item.role)) break;
    leadingFoods.push(item);
  }
  if (leadingFoods.length > 0) {
    const shown = leadingFoods.slice(0, 2);
    findings.push({
      id: 'lead_is_food',
      tone: 'strength',
      headline: ingredients.length === 1
        ? `${sentenceCase(ingredients[0].name)}, and nothing else`
        : `${sentenceCase(namesOf(shown))} ${shown.length > 1 ? 'lead' : 'leads'} the list`,
      mechanism: ingredients.length === 1
        ? 'One ingredient, and it is the food itself. There is nothing here to weigh against it.'
        : `An ingredient list runs in order of mass, so the front of it is most of what you are eating. ${pct(foodShare)} of this, by position, is food that was grown rather than formulated.`,
      weight: weightFor('v6_food_share', 'v6_structure_intact') ?? 60
    });
  }

  // ---- Refined starch, and the case the owner named --------------------------------
  const starches = byRole('refined_starch');
  if (starches.length > 0) {
    const share = shareOf('refined_starch');
    const fibreClause = fiber !== null ? `, against ${grams(fiber)} g of fibre per ${basis} to slow it down` : '';
    findings.push(
      starches.length >= 2
        ? {
          id: 'starch_stack',
          tone: 'cost',
          headline: `${sentenceCase(namesOf(starches.slice(0, 3)))}, ${positionsOf(starches.slice(0, 3))}`,
          mechanism: `${starches.length === 2 ? 'Both' : 'These'} are starches with the fibre milled out, so they digest close to as fast as glucose does. Stacked, they are ${pct(share)} of the list${fibreClause}.`,
          weight: weightFor('v6_structure_rebuilt', 'v6_reconstruction') ?? 45
        }
        : {
          id: 'starch_single',
          tone: 'cost',
          headline: starches[0].position === 0
            ? `${sentenceCase(starches[0].name)} is the first ingredient`
            : `${sentenceCase(starches[0].name)}, ${ordinal(starches[0].position)}`,
          mechanism: `A starch with the fibre milled out digests close to as fast as glucose does${fibreClause}.`,
          weight: weightFor('v6_structure_rebuilt', 'v6_reconstruction') ?? 45
        }
    );
  }

  // ---- Fat, by where it came from --------------------------------------------------
  const industrial = byRole('industrial_fat');
  const seedOils = byRole('seed_oil');
  const culinary = byRole('culinary_fat');
  if (industrial.length > 0) {
    findings.push({
      id: 'industrial_fat',
      tone: 'cost',
      headline: `${sentenceCase(namesOf(industrial.slice(0, 2)))}, ${positionsOf(industrial.slice(0, 2))}`,
      mechanism: 'Hydrogenated or interesterified — a fat rebuilt in a plant to behave like one that is not in the product.',
      weight: weightFor('v6_industrial_fat', 'v6_industrial_processing') ?? 50
    });
  } else if (seedOils.length > 0) {
    const share = shareOf('seed_oil');
    findings.push({
      id: 'seed_oil',
      tone: 'cost',
      headline: seedOils[0].position === 0
        ? `${sentenceCase(seedOils[0].name)} is the first ingredient`
        : `${sentenceCase(namesOf(seedOils.slice(0, 2)))}, ${positionsOf(seedOils.slice(0, 2))}`,
      mechanism: `Crushed, solvent-extracted, bleached and deodorised — what is left after a seed is processed for its fat, rather than a fat anyone cooks with. Here it is ${pct(share)} of the list. The saturated-fat line on the panel cannot tell this apart from butter, which is why the source decides instead.`,
      weight: weightFor('v6_seed_oil') ?? 40
    });
  } else if (culinary.length > 0) {
    findings.push({
      id: 'culinary_fat',
      tone: 'strength',
      headline: `${sentenceCase(namesOf(culinary.slice(0, 2)))}, ${positionsOf(culinary.slice(0, 2))}`,
      mechanism: 'Pressed or rendered, and used as it is. Where a fat came from is the question here, not how much of it is saturated.',
      weight: weightFor('v6_culinary_fat') ?? 10
    });
  }

  // ---- Sugar, and the trick of spelling it several ways -----------------------------
  const sugars = byRole('added_sugar');
  if (sugars.length >= 2) {
    findings.push({
      id: 'split_sugar',
      tone: 'cost',
      headline: `Sugar under ${sugars.length} names: ${namesOf(sugars.slice(0, 3))}`,
      mechanism: 'Listing a sweetener several ways keeps each one further down the list than their total would sit, which is the one thing ingredient order was supposed to tell you.',
      weight: weightFor('v6_added_sugar') ?? 50
    });
  } else if (sugars.length === 1) {
    findings.push({
      id: 'added_sugar',
      tone: 'cost',
      headline: sugars[0].position === 0
        ? `${sentenceCase(sugars[0].name)} is the first ingredient`
        : `${sentenceCase(sugars[0].name)}, ${ordinal(sugars[0].position)}`,
      mechanism: sugars[0].position === 0
        ? 'The list runs in order of mass, so there is more of this here than anything else in the package.'
        : 'Sugar the product did not grow with, added to a place high enough in the list to matter.',
      weight: weightFor('v6_added_sugar') ?? 50
    });
  }

  /**
   * Sugar with no brake. This is the reading that separates a fruit from a soda: both
   * are mostly sugar, and only one arrives with anything to slow it.
   */
  if (usable && sugar !== null && sugar > 0) {
    const sugarShare = (sugar * 4) / calories;
    const fiberLow = fiber === null || fiber < 1;
    const proteinLow = protein === null || protein < 2;
    if (sugarShare >= 0.6 && fiberLow && proteinLow) {
      findings.push({
        id: 'nothing_slows_it',
        tone: 'cost',
        headline: `${grams(sugar)} g of sugar per ${basis}, with nothing to slow it`,
        mechanism: 'No fibre, fat or protein here to blunt the rise, so all of it lands at once. The same sugar inside a piece of fruit does not behave this way.',
        weight: 55
      });
    }
  }

  // ---- The absence trap ------------------------------------------------------------
  if (ingredients.length > 0 && ingredients.length <= 6 && foods.length === 0) {
    findings.push({
      id: 'short_not_clean',
      tone: 'cost',
      headline: `${ingredients.length} ingredients, and none of them a food`,
      mechanism: 'A short ingredient list gets read as a clean one. Nothing here was grown, so there is no credit for the preservatives and colours it also does not contain.',
      weight: weightFor('v6_formulation_share') ?? 55
    });
  }

  // ---- Fractions standing in for food ----------------------------------------------
  const isolates = byRole('isolate');
  if (isolates.length > 0) {
    findings.push({
      id: 'isolate',
      tone: 'cost',
      headline: `${sentenceCase(namesOf(isolates.slice(0, 2)))}, ${positionsOf(isolates.slice(0, 2))}`,
      mechanism: 'A fraction of a food doing the job of the food: the protein or the fibre without what it arrived wrapped in.',
      weight: weightFor('v6_reconstruction') ?? 20
    });
  }

  const colors = byRole('color');
  if (colors.length > 0) {
    findings.push({
      id: 'color',
      tone: 'cost',
      headline: `${sentenceCase(namesOf(colors.slice(0, 3)))}, ${positionsOf(colors.slice(0, 3))}`,
      mechanism: 'Colour does nothing for the person eating it. It is in the package because the food it is imitating is not.',
      weight: weightFor('v6_reconstruction') ?? 20
    });
  }

  const flavors = byRole('flavor_system');
  if (flavors.length > 0 && colors.length === 0) {
    findings.push({
      id: 'flavor',
      tone: 'cost',
      headline: `${sentenceCase(namesOf(flavors.slice(0, 2)))}, ${positionsOf(flavors.slice(0, 2))}`,
      mechanism: 'Flavour added back after processing removed the one the ingredients had.',
      weight: weightFor('v6_reconstruction') ?? 20
    });
  }

  // ---- What the panel says, where it earns a mention --------------------------------
  if (usable && protein !== null && (protein * 4) / calories > 0.12) {
    findings.push({
      id: 'protein',
      tone: 'strength',
      headline: `${grams(protein)} g of protein per ${basis}`,
      mechanism: `${pct((protein * 4) / calories)} of the calories, which is enough to change how the rest of it lands.`,
      weight: weightFor('v6_protein') ?? 15
    });
  }
  if (usable && fiber !== null && (fiber / calories) * 100 >= 1.2) {
    findings.push({
      id: 'fiber',
      tone: 'strength',
      headline: `${grams(fiber)} g of fibre per ${basis}`,
      mechanism: 'Fibre in proportion to the calories, which is what decides how fast the carbohydrate behind it arrives.',
      weight: weightFor('v6_fiber') ?? 12
    });
  }
  if (usable && sodium !== null && sodium / calories > 2.2) {
    findings.push({
      id: 'sodium',
      tone: 'cost',
      headline: `${grams(sodium)} mg of sodium per ${basis}`,
      mechanism: `About ${Math.round((sodium / calories) * 100)} mg for every 100 calories — salt-heavy for what this is, rather than for its serving size.`,
      weight: weightFor('v6_sodium') ?? 18
    });
  }

  /**
   * Biggest mover first, whichever way it moved. Sorting costs above strengths would
   * be a second opinion layered on the score; sorting by what actually moved it is
   * just the answer to the question the screen is asking.
   */
  findings.sort((left, right) => right.weight - left.weight);

  const slices = new Map<IngredientRole, CompositionSlice>();
  for (const item of ingredients) {
    const slice = slices.get(item.role)
      ?? { role: item.role, label: ROLE_LABEL[item.role], share: 0, names: [] };
    slice.share += item.weight;
    slice.names.push(item.name);
    slices.set(item.role, slice);
  }

  return {
    verdict: params.grade ? BAND_MEANING[params.grade] : 'Not enough of the label came back to place this.',
    composition: [...slices.values()].sort((left, right) => right.share - left.share),
    findings,
    unrecognised: byRole('unknown').map((item) => item.name)
  };
}

/** Whether a role is one the product pays for, used to colour the composition bar. */
export function isCostRole(role: IngredientRole): boolean {
  return COST_ROLES.has(role);
}
