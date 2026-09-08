export type IngredientEvidenceCompleteness = 'complete' | 'partial' | 'reconstructed' | 'absent' | 'unknown';

export type ParsedIngredients = {
  rawText: string;
  topLevelIngredients: string[];
  nestedIngredients: string[];
  flatTokens: string[];
  declaredOrder: string[];
  completeness: IngredientEvidenceCompleteness;
  reconstructionSignals: string[];
};

const RECONSTRUCTION_PATTERNS: Array<[string, RegExp]> = [
  ['isolated_component', /\b(isolate|isolated|concentrate|concentrated)\b/i],
  ['modified_component', /\b(modified|hydroly[sz]ed|fractionated)\b/i],
  ['reconstituted_component', /\b(reconstituted|reconstructed|from concentrate)\b/i],
  ['refined_component', /\b(refined|maltodextrin|dextrin)\b/i],
  ['texture_system', /\b(gum|cellulose|carrageenan|emulsifier|stabili[sz]er|thickener)\b/i],
  ['extruded_structure', /\b(extruded|extrusion)\b/i]
];

function normalizeToken(value: string): string {
  return value
    .replace(/^\s*(?:ingredients?|made with)\s*:\s*/i, '')
    .replace(/\b\d+(?:\.\d+)?\s*%\s*/g, '')
    .replace(/^[\s,;:.-]+|[\s,;:.-]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function pushToken(target: string[], value: string): void {
  const normalized = normalizeToken(value);
  if (normalized && /[a-z]/i.test(normalized)) target.push(normalized);
}

function stripAllergenSuffix(rawText: string): string {
  return rawText
    .replace(/(?:\.|;)\s*(?:contains|may contain|allergen(?:s)?)[\s:]+[\s\S]*$/i, '')
    .trim();
}

/**
 * Parses label text without product, category, or runtime dependencies.
 * A top-level colon starts a recoverable compound-ingredient sublist until the
 * next semicolon. Parentheses and brackets are always nested ingredient scope.
 */
export function parseIngredients(
  rawText: string | null | undefined,
  completeness: IngredientEvidenceCompleteness = 'unknown'
): ParsedIngredients {
  const raw = rawText?.trim() ?? '';
  if (!raw) return {
    rawText: raw,
    topLevelIngredients: [],
    nestedIngredients: [],
    flatTokens: [],
    declaredOrder: [],
    completeness: completeness === 'unknown' ? 'absent' : completeness,
    reconstructionSignals: []
  };

  const text = stripAllergenSuffix(raw).replace(/^\s*ingredients?\s*:\s*/i, '');
  const topLevelIngredients: string[] = [];
  const nestedIngredients: string[] = [];
  const declaredOrder: string[] = [];
  let current = '';
  let nestedCurrent = '';
  let depth = 0;
  let compoundSublist = false;

  const flushTop = () => {
    const before = topLevelIngredients.length;
    pushToken(topLevelIngredients, current);
    if (topLevelIngredients.length > before) declaredOrder.push(topLevelIngredients.at(-1)!);
    current = '';
  };
  const flushNested = () => {
    const before = nestedIngredients.length;
    pushToken(nestedIngredients, nestedCurrent);
    if (nestedIngredients.length > before) declaredOrder.push(nestedIngredients.at(-1)!);
    nestedCurrent = '';
  };

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]!;
    if (character === '(' || character === '[') {
      if (depth === 0) {
        flushTop();
        depth = 1;
        continue;
      }
      depth += 1;
      nestedCurrent += character;
      continue;
    }
    if (character === ')' || character === ']') {
      if (depth > 1) nestedCurrent += character;
      depth = Math.max(0, depth - 1);
      if (depth === 0) flushNested();
      continue;
    }
    if (depth > 0) {
      if (character === ',' || character === ';') flushNested();
      else nestedCurrent += character;
      continue;
    }
    if (character === ':' && normalizeToken(current) && !/^\s*(?:contains|may contain|allergens?)\s*$/i.test(current)) {
      flushTop();
      compoundSublist = true;
      continue;
    }
    if (character === ';') {
      if (compoundSublist) flushNested();
      else flushTop();
      compoundSublist = false;
      continue;
    }
    if (character === ',') {
      if (compoundSublist) flushNested();
      else flushTop();
      continue;
    }
    if (compoundSublist) nestedCurrent += character;
    else current += character;
  }
  if (depth > 0 || compoundSublist) flushNested();
  else flushTop();

  const flatTokens = [...topLevelIngredients, ...nestedIngredients];
  const reconstructionSignals = RECONSTRUCTION_PATTERNS.flatMap(([id, pattern]) => (
    pattern.test(flatTokens.join(', ')) ? [id] : []
  ));
  return {
    rawText: raw,
    topLevelIngredients: [...new Set(topLevelIngredients)],
    nestedIngredients: [...new Set(nestedIngredients)],
    flatTokens: [...new Set(flatTokens)],
    declaredOrder,
    completeness,
    reconstructionSignals
  };
}

export function ingredientTextForMatching(parsed: ParsedIngredients): string {
  return parsed.flatTokens.join(', ');
}
