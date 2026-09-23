import { describe, expect, it } from 'vitest';

import {
  correctSearchQuery,
  guessSearchQuery
} from '../../../src/features/nutrition/productLookup/searchQueryCorrection';

/**
 * Correcting a query, and knowing when not to.
 *
 * The interesting half of this is the restraint. A first version ran a bounded
 * edit-distance pass over every query against the food vocabulary, and it quietly
 * rewrote correct words — "fries" to "fried", "greek" to "green", "burrito" to
 * "burrata" — because those words are not in that vocabulary and absence was being read
 * as evidence of a misspelling. It is not: a word a partial vocabulary does not have is
 * usually a word the vocabulary is missing.
 *
 * So the guessing moved behind a real failure. Everything asserted here about what is
 * left alone matters more than what is changed.
 */

const searched = (query: string) => correctSearchQuery(query).query;

describe('the corrections that always apply', () => {
  it('drops the apostrophe a chain name is stored with', () => {
    // USDA writes "McDonald's, Big Mac". Spacing the apostrophe leaves "mcdonald",
    // which never matches what anybody types.
    expect(searched("McDonald's")).toBe('mcdonalds');
    expect(searched('mcdonalds')).toBe('mcdonalds');
    expect(searched("Wendy's chili")).toBe('wendys chili');
  });

  it('fixes the spellings people reliably get wrong', () => {
    expect(searched('brocolli')).toBe('broccoli');
    expect(searched('avacado')).toBe('avocado');
    expect(searched('tumeric')).toBe('turmeric');
  });

  it('fixes chain names, including the multi-word ones', () => {
    expect(searched('chipolte')).toBe('chipotle');
    expect(searched('chickfila')).toBe('chick fil a');
    expect(searched('kentucky fried chicken')).toBe('kfc');
    expect(searched('dunkin donuts')).toBe('dunkin');
  });

  it('replaces a multi-word alias on word boundaries only', () => {
    // A plain substring replace turned this into "taco belll bean burrito", because the
    // variant "taco bel" matched inside the correct spelling.
    expect(searched('taco bell bean burrito')).toBe('taco bell bean burrito');
    expect(searched('taco bel')).toBe('taco bell');
  });

  it('reports whether it changed anything', () => {
    expect(correctSearchQuery('brocolli').corrected).toBe(true);
    expect(correctSearchQuery('broccoli').corrected).toBe(false);
    expect(correctSearchQuery('greek yogurt').corrected).toBe(false);
  });
});

describe('the words it must leave alone', () => {
  it('does not rewrite correct words that the vocabulary happens to lack', () => {
    // Every one of these was mangled by the first version.
    for (const query of [
      'french fries', 'greek yogurt', 'bean burrito', 'chili', 'taco bell',
      'pad thai', 'ramen broth', 'protein shake', 'iced latte'
    ]) {
      expect(searched(query)).toBe(query);
    }
  });

  it('keeps a food word that collides with a chain name', () => {
    // "chili" is a food far more often than it is the restaurant, so it is not an alias.
    expect(searched('chili')).toBe('chili');
    expect(searched('canes')).toBe('canes');
  });

  it('leaves a query it cannot improve exactly as typed', () => {
    expect(correctSearchQuery('xylitol gum').corrected).toBe(false);
    expect(correctSearchQuery('').query).toBe('');
  });
});

describe('guessing, once a search has already failed', () => {
  it('offers a nearer word for a misspelling the maps do not know', () => {
    const guess = guessSearchQuery('bananna');
    expect(guess?.query).toBe('banana');
    expect(guess?.original).toBe('bananna');
  });

  it('offers nothing when the query is already spelled fine', () => {
    // Returning a guess equal to the query would search twice for the same thing.
    expect(guessSearchQuery('broccoli')).toBeNull();
    expect(guessSearchQuery('greek yogurt')).toBeNull();
  });

  it('offers nothing when it has no idea', () => {
    expect(guessSearchQuery('zzzqqx')).toBeNull();
    expect(guessSearchQuery('')).toBeNull();
  });

  it('keeps the certain corrections it inherits', () => {
    // A guess is built on top of the always-applied pass, not instead of it.
    expect(guessSearchQuery('brocolli')).toBeNull();
    expect(correctSearchQuery('brocolli').query).toBe('broccoli');
  });
});
