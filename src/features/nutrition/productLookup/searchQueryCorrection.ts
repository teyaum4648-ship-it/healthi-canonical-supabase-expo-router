import { MISSPELLINGS } from '../../../engines/nutrition/productScoring/ingredientAliases';
import { WHOLE_FOOD_VOCABULARY } from '../../../engines/nutrition/productScoring/foodVocabulary';
import { CHAIN_ALIASES, CHAIN_VOCABULARY } from './fastFoodChains';

/**
 * Turning what somebody typed into something the food databases will answer.
 *
 * The failure this addresses is not ranking. Results are ranked but never filtered, so a
 * typo does not discard anything locally — it makes the providers return nothing at all,
 * and a query with no rows has nothing to rank. Worse, when nothing matches, ranking
 * falls through to a shortest-name tiebreak, so the app still shows a first result: the
 * shortest row it happened to receive, presented as an answer.
 *
 * Two stages, deliberately unequal in when they run.
 *
 * `correctSearchQuery` is certain work and always runs: dropping apostrophes so a chain
 * with a possessive in its name can be matched, and applying curated maps of spellings
 * people reliably get wrong. It cannot invent.
 *
 * `guessSearchQuery` is the fuzzy pass, and it runs only once a search has already come
 * back with nothing. That ordering is the whole design. An earlier version ran the fuzzy
 * pass on every query and mangled correct words — "fries" became "fried", "greek" became
 * "green", "burrito" became "burrata" — because those words are absent from the food
 * vocabulary and absence was being read as evidence of a misspelling. It is not. A word
 * missing from a partial vocabulary is usually a word the vocabulary does not have yet.
 * After a search returns nothing, though, the query has demonstrably failed, and a
 * labelled guess is better than a dead end.
 *
 * Both report what they changed rather than doing it silently. Swapping a person's word
 * without telling them is worse than not guessing: they cannot tell whether the app
 * misunderstood them or the food simply is not there.
 */

export type CorrectedQuery = {
  /** What to send to the providers. */
  query: string;
  /** What was typed. */
  original: string;
  /** True when the two differ, so the UI can say which it searched. */
  corrected: boolean;
};

/**
 * How long a word has to be before a near neighbour counts as evidence it was misspelled.
 *
 * Short words are dense: "greek" sits one edit from "green", "fries" from "fried",
 * "chili" from "chilli" and "child". For a five-letter word, having a neighbour says
 * almost nothing, and acting on it rewrites words that were right — which is exactly
 * what an earlier version did to "greek yogurt".
 *
 * Length is the signal. A seven-letter word one edit from a food name is probably that
 * food misspelled; a nine-letter word two edits away still probably is. Below that the
 * guess is not worth making, and the query is left as typed.
 */
const ONE_EDIT_MIN_LENGTH = 7;
const TWO_EDIT_MIN_LENGTH = 9;

const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    // An apostrophe is dropped rather than spaced: "mcdonald's" has to become
    // "mcdonalds", the way people type it, not "mcdonald s".
    .replace(/['’]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

/**
 * Single words from the food and chain vocabularies.
 *
 * Kept from four letters up even though nothing shorter than seven is ever repaired,
 * because a target list is also how the code recognises a word as already correct: a
 * short word that appears here is left alone rather than measured against anything.
 */
const REPAIR_TARGETS: readonly string[] = [...new Set([
  ...WHOLE_FOOD_VOCABULARY.flatMap((term) => term.split(/[^a-z]+/i)),
  ...CHAIN_VOCABULARY.flatMap((term) => term.split(/[^a-z]+/i))
].filter((word) => word.length >= 4))];

/** Levenshtein distance, stopped as soon as it exceeds the budget. */
function editDistanceWithin(left: string, right: string, budget: number): number | null {
  if (Math.abs(left.length - right.length) > budget) return null;
  let previous = Array.from({ length: right.length + 1 }, (_unused, index) => index);
  for (let row = 1; row <= left.length; row += 1) {
    const current = [row];
    let best = row;
    for (let column = 1; column <= right.length; column += 1) {
      const cost = left[row - 1] === right[column - 1] ? 0 : 1;
      current[column] = Math.min(
        previous[column] + 1,
        current[column - 1] + 1,
        previous[column - 1] + cost
      );
      best = Math.min(best, current[column]);
    }
    if (best > budget) return null;
    previous = current;
  }
  const distance = previous[right.length];
  return distance <= budget ? distance : null;
}

/** The nearest vocabulary word within the budget its length allows, or null. */
function nearestWord(word: string): string | null {
  if (word.length < ONE_EDIT_MIN_LENGTH) return null;
  if (REPAIR_TARGETS.includes(word)) return null;
  const budget = word.length >= TWO_EDIT_MIN_LENGTH ? 2 : 1;

  let best: string | null = null;
  let bestDistance = budget + 1;
  for (const target of REPAIR_TARGETS) {
    const distance = editDistanceWithin(word, target, budget);
    if (distance === null || distance >= bestDistance) continue;
    // A tie between two equally near words is not a correction anybody should trust.
    bestDistance = distance;
    best = target;
  }
  return best;
}

/**
 * The query to search with, and whether it was changed.
 *
 * Chain aliases are applied to the whole phrase first, because several are multi-word
 * ("kentucky fried chicken", "dunkin donuts") and a word-by-word pass would never see
 * them.
 */
export function correctSearchQuery(raw: string): CorrectedQuery {
  const original = raw.trim();
  const base = normalize(original);
  if (!base) return { query: original, original, corrected: false };

  /*
   * Multi-word chain names are replaced on word boundaries. A plain substring replace
   * turned "taco bell bean burrito" into "taco belll bean burrito", because the variant
   * "taco bel" matched inside the correct spelling.
   */
  let phrase = base;
  for (const [variant, canonical] of Object.entries(CHAIN_ALIASES)) {
    if (!variant.includes(' ')) continue;
    const bounded = new RegExp(`(^|\\s)${variant.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=\\s|$)`, 'g');
    if (bounded.test(phrase)) {
      phrase = phrase.replace(bounded, (_match, lead: string) => `${lead}${canonical}`).replace(/\s+/g, ' ').trim();
    }
  }

  const words = phrase.split(' ').map((word) => {
    const alias = CHAIN_ALIASES[word];
    // A single-word alias that is itself multi-word would re-split; join it back later.
    return MISSPELLINGS[word] ?? alias ?? word;
  });

  const query = words.join(' ').replace(/\s+/g, ' ').trim();
  return { query, original, corrected: query !== base };
}

/**
 * A guess at what was meant, for a query that already returned nothing.
 *
 * Only reached after a real search failed, which is what makes guessing reasonable here
 * and unreasonable before. Returns null when it has nothing better to offer, so the
 * caller can say "no matches" rather than search twice for the same thing.
 */
export function guessSearchQuery(raw: string): CorrectedQuery | null {
  const corrected = correctSearchQuery(raw);
  const words = normalize(corrected.query).split(' ').filter(Boolean);
  if (words.length === 0) return null;

  let changed = false;
  const guessed = words.map((word) => {
    const nearest = nearestWord(word);
    if (!nearest) return word;
    changed = true;
    return nearest;
  });

  if (!changed) return null;
  const query = guessed.join(' ');
  return query === corrected.query ? null : { query, original: corrected.original, corrected: true };
}
