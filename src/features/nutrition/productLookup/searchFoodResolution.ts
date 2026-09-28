import type { HealthiProductSnapshot } from './productLookupTypes';
import { canonicalBarcodeIdentity } from './barcodeUtils';
import { foodLoggingCompleteness } from '../foodLoggingNutrition';

/*
 * An apostrophe is dropped rather than turned into a space. USDA names its restaurant
 * foods "McDonald's, Big Mac", and spacing that punctuation left the word "mcdonald" to
 * be matched against a query of "mcdonalds" — so the brand term missed on every chain
 * with a possessive in its name, which is most of them.
 */
const normalized = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/['\u2019]/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

/** Shared leading characters before two words diverge. */
function sharedPrefix(left: string, right: string): number {
  const limit = Math.min(left.length, right.length);
  let index = 0;
  while (index < limit && left[index] === right[index]) index += 1;
  return index;
}

/**
 * How much of a query term a row contains: a whole word counts fully, a word that shares
 * a long enough stem counts half.
 *
 * Whole-word matching alone reads "oat" and "oats" as unrelated, and a query of "wendys"
 * as unrelated to "wendy". Partial credit ranks the near miss above the noise without
 * letting it outrank a real match.
 */
const STEM_MIN = 4;
/** "oats" and "oat" are one word; treating them as a near miss lets "oat bran" win. */
const singular = (word: string) =>
  word.endsWith('ies') && word.length > 4 ? `${word.slice(0, -3)}y`
    : word.endsWith('es') && word.length > 4 ? word.slice(0, -2)
      : word.endsWith('s') && !word.endsWith('ss') && word.length > 3 ? word.slice(0, -1)
        : word;

function termCredit(term: string, words: Set<string>): number {
  if (words.has(term)) return 1;
  const stem = singular(term);
  for (const word of words) {
    if (singular(word) === stem) return 1;
  }
  for (const word of words) {
    if (word.length < STEM_MIN && term.length < STEM_MIN) continue;
    if (sharedPrefix(term, word) >= Math.min(STEM_MIN, Math.min(term.length, word.length))) return 0.5;
  }
  return 0;
}

/** Words a person types around a food that no food name carries. */
const FILLER = new Set(['a', 'an', 'the', 'and', 'with', 'from', 'at', 'of', 'in']);

/**
 * Whether every word of a query appears in a food's name or brand, fully or as a near
 * miss. A local list has to filter itself — unlike a catalogue, it has not already been
 * asked the question — and this uses the same word rules as the ranking below.
 */
export function matchesEveryTerm(haystack: string, query: string): boolean {
  const words = new Set(normalized(haystack).split(' '));
  const terms = [...new Set(normalized(query).split(/\s+/).filter(Boolean))];
  const meaningful = terms.filter(term => !FILLER.has(term) || words.has(term));
  return meaningful.length > 0 && meaningful.every(term => termCredit(term, words) > 0);
}

/** Completeness breaks ties among relevant foods, never across identities.
 * A secondary-provider record wins a duplicate only as a whole nutrition record.
 */
export function resolveSearchFoods(rows: HealthiProductSnapshot[], query: string): HealthiProductSnapshot[] {
  const identity = (p: HealthiProductSnapshot) => p.barcode ? canonicalBarcodeIdentity(p.barcode) : `${p.provider}:${p.provider_product_id}`;
  const groups = new Map<string, HealthiProductSnapshot[]>();
  for (const p of rows) { const key = identity(p); groups.set(key, [...(groups.get(key) ?? []), p]); }
  const candidates = [...groups.values()].map(group => {
    const sorted = [...group].sort((a,b) => foodLoggingCompleteness(b) - foodLoggingCompleteness(a));
    const best = sorted[0];
    // Identification image only; never borrow nutrients, serving or brand from
    // another result. Exact barcode equality is required for this photo reuse.
    return best.image_url ? best : { ...best, image_url: sorted.find(p => p.image_url)?.image_url ?? null };
  });
  const phrase = normalized(query), terms = [...new Set(phrase.split(/\s+/).filter(Boolean))];
  return candidates.map((p,i) => {
    const name = normalized(p.name), haystack = `${name} ${normalized(p.brand ?? '')}`;
    const words = new Set(haystack.split(' '));
    const covered = terms.reduce((sum, t) => sum + termCredit(t, words), 0);
    /*
     * USDA names lead with the food, so a term matching the first word means the row is
     * about that food: "Oats, whole grain" against a query of "oat" should beat "Bread,
     * oat bran", which is a row about bread that happens to mention oats.
     */
    const head = name.split(' ')[0] ?? '';
    const leads = terms.some(t => termCredit(t, new Set([head])) === 1) ? 1 : 0;
    return { p, i, covered, leads, completeness: foodLoggingCompleteness(p), exact: name === phrase ? 2 : name.includes(phrase) ? 1 : 0, length: name.length };
  }).sort((a,b) => b.covered - a.covered || b.leads - a.leads || b.completeness - a.completeness || b.exact - a.exact || a.length - b.length || a.i - b.i).map(r => r.p);
}
