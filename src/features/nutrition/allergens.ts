/**
 * Declared allergens.
 *
 * The one rule this module exists to enforce: **absence of a declaration is not a
 * declaration of absence.** A record with no allergen statement tells you nothing about
 * whether the food contains an allergen — the producer may simply not have published it,
 * or Open Food Facts may not have transcribed it. So there is deliberately no "free from",
 * no "safe", and no boolean anywhere in this API. The strongest negative statement
 * available is `not_declared`, which callers must render as missing information rather
 * than as reassurance.
 *
 * That matters more here than anywhere else in Healthi: a person avoiding peanuts who
 * reads "peanut-free" off a record that merely lacked a statement could be harmed by it.
 */

/** The US "big nine" plus the additional groups declared under EU labelling rules. */
export const ALLERGEN_GROUPS = [
  'milk',
  'egg',
  'fish',
  'crustaceans',
  'molluscs',
  'tree_nuts',
  'peanuts',
  'wheat',
  'gluten',
  'soy',
  'sesame',
  'mustard',
  'celery',
  'lupin',
  'sulphites'
] as const;

export type AllergenGroup = typeof ALLERGEN_GROUPS[number];

export const ALLERGEN_GROUP_LABELS: Record<AllergenGroup, string> = {
  milk: 'Milk',
  egg: 'Egg',
  fish: 'Fish',
  crustaceans: 'Crustacean shellfish',
  molluscs: 'Molluscs',
  tree_nuts: 'Tree nuts',
  peanuts: 'Peanuts',
  wheat: 'Wheat',
  gluten: 'Gluten',
  soy: 'Soy',
  sesame: 'Sesame',
  mustard: 'Mustard',
  celery: 'Celery',
  lupin: 'Lupin',
  sulphites: 'Sulphites'
};

/**
 * How a group came to be declared.
 *
 * `contains` is a positive statement by the producer. `may_contain` is a cross-contact
 * advisory — weaker as a statement about the recipe, but often the more important one for
 * someone with a severe allergy, so it is never folded into `contains` or dropped.
 */
export type AllergenBasis = 'contains' | 'may_contain';

export type AllergenDeclaration = {
  group: AllergenGroup;
  basis: AllergenBasis;
  /** Where this came from, so a person can check it against the packet. */
  source: 'provider_tag' | 'label_statement';
  /** The label words or tag that produced it, shown verbatim. */
  evidence: string;
};

export type AllergenAssessment = {
  declarations: AllergenDeclaration[];
  /**
   * `declared` means this record carried allergen information. `absent` means it carried
   * none — which says nothing about the food, only about the record.
   */
  statement: 'declared' | 'absent';
};

/** One group, judged against what a person asked to avoid. */
export type AllergenMatch = {
  group: AllergenGroup;
  /** `not_declared` is missing information, never a clean bill of health. */
  status: 'contains' | 'may_contain' | 'not_declared';
  declaration: AllergenDeclaration | null;
};

/** Open Food Facts tags, and the free-text words producers actually print. */
const GROUP_SYNONYMS: Array<[AllergenGroup, RegExp]> = [
  ['milk', /\b(milk|dairy|lactose|whey|casein|caseinate|butter|cream|cheese|yogh?urt)\b/i],
  ['egg', /\b(eggs?|albumen|ovalbumin)\b/i],
  ['crustaceans', /\b(crustaceans?|shellfish|shrimps?|prawns?|crabs?|lobsters?|crayfish)\b/i],
  ['molluscs', /\b(molluscs?|mollusks?|squid|octopus|clams?|mussels?|oysters?|scallops?|snails?)\b/i],
  ['fish', /\b(fish|anchovy|anchovies|cod|salmon|tuna|haddock|sardines?|mackerel)\b/i],
  ['peanuts', /\b(peanuts?|groundnuts?|arachis)\b/i],
  ['tree_nuts', /\b(tree[- ]?nuts?|nuts?|almonds?|hazelnuts?|walnuts?|cashews?|pecans?|pistachios?|macadamias?|brazil nuts?)\b/i],
  ['wheat', /\b(wheat|spelt|semolina|durum|farro|kamut)\b/i],
  ['gluten', /\b(gluten|barley|rye|malt|triticale)\b/i],
  ['soy', /\b(soya?|soybeans?|soja|tofu|edamame)\b/i],
  ['sesame', /\b(sesame|tahini|benne)\b/i],
  ['mustard', /\b(mustard)\b/i],
  ['celery', /\b(celery|celeriac)\b/i],
  ['lupin', /\b(lupin|lupine)\b/i],
  ['sulphites', /\b(sulph?ites?|sulfur dioxide|sulphur dioxide|e22[0-8])\b/i]
];

/**
 * Splits the ingredient text's allergen suffix off the recipe.
 *
 * The parser in productScoring already strips this to keep ingredient tokens clean; this
 * keeps the part it discards. "Contains" and "may contain" are captured separately
 * because they mean different things.
 */
const STATEMENT_PATTERN = /(?:^|[.;\n])\s*(contains|may contain|manufactured (?:in|on)[^.;\n]*?(?:with|shares?)|allergens?|traces? of)\b[\s:]*([^.;\n]*)/gi;

function advisory(keyword: string): AllergenBasis {
  return /may contain|traces? of|manufactured/i.test(keyword) ? 'may_contain' : 'contains';
}

function groupsIn(text: string): AllergenGroup[] {
  const found: AllergenGroup[] = [];
  for (const [group, pattern] of GROUP_SYNONYMS) {
    if (pattern.test(text)) found.push(group);
  }
  // "Peanuts" also matches the generic tree-nut word list; a peanut is a legume, so an
  // explicit peanut mention must not silently become a tree-nut declaration too.
  if (found.includes('peanuts') && found.includes('tree_nuts') && !/\b(tree[- ]?nuts?|almonds?|hazelnuts?|walnuts?|cashews?|pecans?|pistachios?|macadamias?|brazil nuts?|\bnuts\b)/i.test(text.replace(/\b(peanuts?|groundnuts?)\b/gi, ''))) {
    return found.filter((group) => group !== 'tree_nuts');
  }
  return found;
}

/** `en:milk` / `en:gluten` → the canonical group. Unrecognized tags are ignored, not guessed. */
function groupFromTag(tag: string): AllergenGroup | null {
  const bare = tag.replace(/^[a-z]{2,3}:/i, '').replace(/[-_]+/g, ' ').trim();
  if (!bare) return null;
  for (const [group, pattern] of GROUP_SYNONYMS) {
    if (pattern.test(bare)) return group;
  }
  return null;
}

function addDeclaration(into: Map<string, AllergenDeclaration>, declaration: AllergenDeclaration): void {
  const key = `${declaration.group}:${declaration.basis}`;
  // A positive "contains" outranks an advisory for the same group; otherwise first wins.
  const existing = into.get(key);
  if (!existing) into.set(key, declaration);
}

/**
 * Reads every allergen signal a product record carries.
 *
 * Provider tags are preferred where present — they are curated and language-independent —
 * with the printed statement used as well, since the two disagree often enough that
 * dropping either would lose real declarations.
 */
export function assessAllergens(input: {
  allergen_tags?: string[] | null;
  trace_tags?: string[] | null;
  ingredients_text?: string | null;
}): AllergenAssessment {
  const declarations = new Map<string, AllergenDeclaration>();
  let sawAnyStatement = false;

  for (const tag of input.allergen_tags ?? []) {
    const group = groupFromTag(tag);
    sawAnyStatement = true;
    if (group) addDeclaration(declarations, { group, basis: 'contains', source: 'provider_tag', evidence: tag });
  }

  for (const tag of input.trace_tags ?? []) {
    const group = groupFromTag(tag);
    sawAnyStatement = true;
    if (group) addDeclaration(declarations, { group, basis: 'may_contain', source: 'provider_tag', evidence: tag });
  }

  const text = input.ingredients_text?.trim() ?? '';
  if (text) {
    for (const match of text.matchAll(STATEMENT_PATTERN)) {
      const keyword = match[1] ?? '';
      const body = (match[2] ?? '').trim();
      if (!body) continue;
      sawAnyStatement = true;
      const basis = advisory(keyword);
      for (const group of groupsIn(body)) {
        addDeclaration(declarations, {
          group,
          basis,
          source: 'label_statement',
          evidence: `${keyword.trim()}: ${body}`.slice(0, 160)
        });
      }
    }
  }

  const list = [...declarations.values()].sort((a, b) =>
    a.basis === b.basis ? a.group.localeCompare(b.group) : a.basis === 'contains' ? -1 : 1
  );

  return { declarations: list, statement: sawAnyStatement ? 'declared' : 'absent' };
}

/**
 * Judges an assessment against the groups a person asked to avoid.
 *
 * Returns a row for every group they flagged, including the ones this record says nothing
 * about — because "we have no information" is the answer a person needs to see, and
 * omitting those rows would let silence read as safety.
 */
export function matchAllergenProfile(
  assessment: AllergenAssessment,
  avoiding: AllergenGroup[]
): AllergenMatch[] {
  return avoiding.map((group) => {
    const contains = assessment.declarations.find((item) => item.group === group && item.basis === 'contains');
    const may = assessment.declarations.find((item) => item.group === group && item.basis === 'may_contain');
    const declaration = contains ?? may ?? null;
    return {
      group,
      status: contains ? 'contains' : may ? 'may_contain' : 'not_declared',
      declaration
    };
  });
}

/** The rows worth interrupting someone for: an actual declaration against their profile. */
export function flaggedMatches(matches: AllergenMatch[]): AllergenMatch[] {
  return matches.filter((match) => match.status !== 'not_declared');
}

/**
 * One line of honest copy for a group.
 *
 * Note what the `not_declared` case does and does not say. It reports the state of the
 * record, never the state of the food.
 */
export function allergenMatchText(match: AllergenMatch, statement: AllergenAssessment['statement']): string {
  const name = ALLERGEN_GROUP_LABELS[match.group];
  if (match.status === 'contains') return `Declares ${name.toLowerCase()}`;
  if (match.status === 'may_contain') return `May contain ${name.toLowerCase()} — cross-contact advisory`;
  return statement === 'declared'
    ? `${name} is not named in this record's allergen statement`
    : `This record carries no allergen statement — check the packet`;
}
