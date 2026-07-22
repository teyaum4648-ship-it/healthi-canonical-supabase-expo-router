import type { DataConfidence } from '../../../engines/nutrition';

export type IngredientEvidenceStatus = 'complete' | 'partial' | 'reconstructed' | 'absent';

export type StructuredIngredientEvidence = {
  id: string | null;
  text: string | null;
  percent: number | null;
  ingredients: StructuredIngredientEvidence[];
};

export type IngredientEvidence = {
  resolved_text: string | null;
  raw_text: string | null;
  source_field: string | null;
  language: string | null;
  localized_texts?: Array<{ source_field: string; language: string | null; text: string }>;
  structured_ingredients: StructuredIngredientEvidence[];
  status: IngredientEvidenceStatus;
  confidence: DataConfidence;
  reconstructed: boolean;
  conflicts: string[];
};

type IngredientRecord = Record<string, unknown>;

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function number(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function record(value: unknown): IngredientRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as IngredientRecord : {};
}

function normalizeLanguage(value: unknown): string | null {
  const language = text(value)?.toLowerCase().replace('_', '-');
  return language?.match(/^[a-z]{2,3}(?:-[a-z]{2})?$/)?.[0] ?? null;
}

function parseStructured(value: unknown): StructuredIngredientEvidence[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const source = record(item);
    return {
      id: text(source.id),
      text: text(source.text) ?? text(source.text_en),
      percent: number(source.percent_estimate) ?? number(source.percent),
      ingredients: parseStructured(source.ingredients)
    };
  });
}

function reconstructOne(item: StructuredIngredientEvidence): string | null {
  if (!item.text) return null;
  const nested = item.ingredients.map(reconstructOne).filter((value): value is string => Boolean(value));
  return nested.length > 0 ? `${item.text} (${nested.join(', ')})` : item.text;
}

function normalizedConflictValue(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').replace(/[.;]+$/g, '').trim();
}

function normalizedQualityTag(value: string): string {
  return value.toLowerCase().replace(/^[a-z]{2,3}:/, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function isIngredientIncompleteTag(value: string, selectedLanguage: string | null): boolean {
  const tag = normalizedQualityTag(value);
  const match = tag.match(/^(ingredients?|ingredient list)(?: ([a-z]{2,3}))? (missing|incomplete|unknown|not provided|not available|to be completed)$/);
  if (!match) return false;
  const taggedLanguage = match[2] ?? null;
  return !taggedLanguage || !selectedLanguage || taggedLanguage === selectedLanguage.split('-')[0];
}

function ingredientStatus(product: IngredientRecord, selectedLanguage: string | null): IngredientEvidenceStatus {
  const qualityTags = Array.isArray(product.data_quality_tags)
    ? product.data_quality_tags.filter((item): item is string => typeof item === 'string')
    : [];
  return qualityTags.some((tag) => isIngredientIncompleteTag(tag, selectedLanguage)) ? 'partial' : 'complete';
}

function materialSameLanguageConflict(
  candidates: Array<{ field: string; value: string; language: string | null }>
): boolean {
  const byLanguage = new Map<string, Set<string>>();
  for (const candidate of candidates) {
    if (!candidate.language) continue;
    const values = byLanguage.get(candidate.language) ?? new Set<string>();
    values.add(normalizedConflictValue(candidate.value));
    byLanguage.set(candidate.language, values);
  }
  return [...byLanguage.values()].some((values) => values.size > 1);
}

export function resolveIngredientEvidence(
  product: IngredientRecord,
  requestedLocale = 'en'
): IngredientEvidence {
  const requestedLanguage = normalizeLanguage(requestedLocale) ?? 'en';
  const declaredLanguage = normalizeLanguage(product.lang);
  const structured = parseStructured(product.ingredients);
  const orderedFields = [
    `ingredients_text_${requestedLanguage.replace('-', '_')}`,
    'ingredients_text_en',
    ...(declaredLanguage ? [`ingredients_text_${declaredLanguage.replace('-', '_')}`] : []),
    'ingredients_text'
  ];
  const localizedFields = Object.keys(product)
    .filter((key) => /^ingredients_text_[a-z]{2,3}(?:_[a-z]{2})?$/i.test(key))
    .sort();
  const candidates: Array<{ field: string; value: string; language: string | null }> = [];
  for (const field of [...new Set([...orderedFields, ...localizedFields])]) {
    const value = text(product[field]);
    if (!value) continue;
    const suffix = field.match(/^ingredients_text_(.+)$/i)?.[1]?.replace('_', '-') ?? null;
    candidates.push({ field, value, language: normalizeLanguage(suffix) ?? declaredLanguage });
  }

  const localizedTexts = candidates.map((candidate) => ({
    source_field: candidate.field,
    language: candidate.language,
    text: candidate.value
  }));
  const conflicts = materialSameLanguageConflict(candidates)
    ? ['Provider ingredient text fields for the same language materially disagree.']
    : [];
  const selected = candidates[0];
  if (selected) {
    const status = ingredientStatus(product, selected.language);
    return {
      resolved_text: selected.value,
      raw_text: selected.value,
      source_field: selected.field,
      language: selected.language,
      localized_texts: localizedTexts,
      structured_ingredients: structured,
      status,
      confidence: status === 'partial' || conflicts.length > 0 ? 'medium' : 'high',
      reconstructed: false,
      conflicts: conflicts.slice(0, 1)
    };
  }

  const reconstructedParts = structured.map(reconstructOne).filter((value): value is string => Boolean(value));
  if (reconstructedParts.length > 0) {
    const missingNames = structured.some((item) => !item.text);
    return {
      resolved_text: reconstructedParts.join(', '),
      raw_text: null,
      source_field: 'ingredients',
      language: declaredLanguage,
      localized_texts: [],
      structured_ingredients: structured,
      status: 'reconstructed',
      confidence: missingNames ? 'low' : 'medium',
      reconstructed: true,
      conflicts: []
    };
  }

  return {
    resolved_text: null,
    raw_text: null,
    source_field: null,
    language: declaredLanguage,
    localized_texts: [],
    structured_ingredients: structured,
    status: 'absent',
    confidence: 'low',
    reconstructed: false,
    conflicts: []
  };
}
