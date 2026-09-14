import { describe, expect, it } from 'vitest';

import {
  allergenMatchText,
  assessAllergens,
  flaggedMatches,
  matchAllergenProfile,
  type AllergenGroup
} from '../../../src/features/nutrition/allergens';
import {
  parseAllergenProfile,
  toggleAllergenGroup
} from '../../../src/features/nutrition/allergenProfileStore';
import { normalizeOpenFoodFactsProduct } from '../../../src/features/nutrition/productLookup/normalizeProduct';

const groups = (text: string) => assessAllergens({ ingredients_text: text }).declarations.map((d) => d.group);

describe('reading declarations off a label statement', () => {
  it('captures the statement the ingredient parser throws away', () => {
    const assessment = assessAllergens({
      ingredients_text: 'Oats, sugar, sunflower oil. Contains: milk, soy.'
    });
    expect(assessment.statement).toBe('declared');
    expect(assessment.declarations.map((d) => d.group)).toEqual(['milk', 'soy']);
    expect(assessment.declarations[0]).toMatchObject({ basis: 'contains', source: 'label_statement' });
  });

  it('keeps a cross-contact advisory separate from an outright declaration', () => {
    const assessment = assessAllergens({
      ingredients_text: 'Oats, sugar. Contains: milk. May contain peanuts.'
    });
    const byGroup = Object.fromEntries(assessment.declarations.map((d) => [d.group, d.basis]));
    expect(byGroup).toEqual({ milk: 'contains', peanuts: 'may_contain' });
  });

  it('reads the other phrasings producers actually print', () => {
    expect(groups('Rice. Traces of sesame.')).toEqual(['sesame']);
    expect(assessAllergens({ ingredients_text: 'Rice. Traces of sesame.' }).declarations[0].basis).toBe('may_contain');
    expect(groups('Cocoa. Manufactured on equipment that shares tree nuts.')).toEqual(['tree_nuts']);
  });

  it('recognises a component name, not just the group word', () => {
    expect(groups('Ingredients: flour, whey, casein. Contains: whey, casein.')).toEqual(['milk']);
    expect(groups('Sauce. Contains: anchovies.')).toEqual(['fish']);
    expect(groups('Bread. Contains: semolina.')).toEqual(['wheat']);
  });

  it('does not turn a peanut into a tree nut', () => {
    // A peanut is a legume. Someone avoiding tree nuts must not see a false declaration,
    // and someone avoiding peanuts must still see theirs.
    expect(groups('Bar. Contains: peanuts.')).toEqual(['peanuts']);
    expect(groups('Bar. Contains: peanuts, almonds.').sort()).toEqual(['peanuts', 'tree_nuts']);
  });
});

describe('absence of a declaration is not a declaration of absence', () => {
  it('reports a record with no statement as absent rather than clean', () => {
    const assessment = assessAllergens({ ingredients_text: 'Oats, sugar, sunflower oil.' });
    expect(assessment.statement).toBe('absent');
    expect(assessment.declarations).toEqual([]);
  });

  it('still returns a row for every flagged group, so silence cannot read as safety', () => {
    const assessment = assessAllergens({ ingredients_text: 'Oats, sugar.' });
    const matches = matchAllergenProfile(assessment, ['peanuts', 'milk']);
    expect(matches).toHaveLength(2);
    expect(matches.every((match) => match.status === 'not_declared')).toBe(true);
    // Nothing to interrupt anyone for, but the rows exist to be shown.
    expect(flaggedMatches(matches)).toEqual([]);
  });

  it('never phrases a missing statement as free-from', () => {
    const absent = assessAllergens({ ingredients_text: 'Oats.' });
    const text = allergenMatchText(matchAllergenProfile(absent, ['peanuts'])[0], absent.statement);
    expect(text).toBe('This record carries no allergen statement — check the packet');
    expect(text).not.toMatch(/free|safe|no peanuts|without/i);

    const declared = assessAllergens({ ingredients_text: 'Oats. Contains: milk.' });
    const other = allergenMatchText(matchAllergenProfile(declared, ['peanuts'])[0], declared.statement);
    expect(other).toBe("Peanuts is not named in this record's allergen statement");
    expect(other).not.toMatch(/free|safe/i);
  });

  it('has no boolean that could be read as a safety verdict', () => {
    const assessment = assessAllergens({ ingredients_text: 'Oats. Contains: milk.' });
    for (const value of Object.values(assessment)) expect(typeof value).not.toBe('boolean');
    const match = matchAllergenProfile(assessment, ['milk'])[0];
    for (const value of Object.values(match)) expect(typeof value).not.toBe('boolean');
  });
});

describe('provider tags', () => {
  it('prefers curated tags and keeps traces as advisories', () => {
    const assessment = assessAllergens({
      allergen_tags: ['en:milk', 'en:gluten'],
      trace_tags: ['en:nuts']
    });
    expect(assessment.statement).toBe('declared');
    expect(assessment.declarations).toEqual([
      { group: 'gluten', basis: 'contains', source: 'provider_tag', evidence: 'en:gluten' },
      { group: 'milk', basis: 'contains', source: 'provider_tag', evidence: 'en:milk' },
      { group: 'tree_nuts', basis: 'may_contain', source: 'provider_tag', evidence: 'en:nuts' }
    ]);
  });

  it('counts an unrecognized tag as a statement without inventing a group', () => {
    const assessment = assessAllergens({ allergen_tags: ['en:something-unmapped'] });
    // The record does carry allergen information, so it is not "absent" — but nothing is guessed.
    expect(assessment.statement).toBe('declared');
    expect(assessment.declarations).toEqual([]);
  });

  it('merges tags with the printed statement instead of dropping either', () => {
    const assessment = assessAllergens({
      allergen_tags: ['en:milk'],
      ingredients_text: 'Chocolate. Contains: soy.'
    });
    expect(assessment.declarations.map((d) => d.group).sort()).toEqual(['milk', 'soy']);
  });

  it('carries the tags through product normalization', () => {
    const snapshot = normalizeOpenFoodFactsProduct('30000000001', {
      product_name: 'Milk chocolate',
      ingredients_text: 'Sugar, cocoa butter, milk powder.',
      categories_tags: ['en:chocolates'],
      allergens_tags: ['en:milk'],
      traces_tags: ['en:nuts'],
      nutriments: { 'energy-kcal_100g': 535, proteins_100g: 8 }
    })!;
    // Normalization strips the language prefix; the group mapping accepts either form.
    expect(snapshot.allergen_tags).toEqual(['milk']);
    expect(snapshot.trace_tags).toEqual(['nuts']);
    expect(assessAllergens(snapshot).declarations.map((d) => d.group)).toEqual(['milk', 'tree_nuts']);
  });
});

describe('matching a profile', () => {
  it('raises a declaration and an advisory, in that order of seriousness', () => {
    const assessment = assessAllergens({ ingredients_text: 'Bar. Contains: milk. May contain peanuts.' });
    const matches = matchAllergenProfile(assessment, ['peanuts', 'milk', 'sesame']);
    expect(matches.map((m) => m.status)).toEqual(['may_contain', 'contains', 'not_declared']);
    expect(flaggedMatches(matches).map((m) => m.group)).toEqual(['peanuts', 'milk']);
    expect(allergenMatchText(matches[1], assessment.statement)).toBe('Declares milk');
    expect(allergenMatchText(matches[0], assessment.statement))
      .toBe('May contain peanuts — cross-contact advisory');
  });

  it('reports the stronger basis when a group is both declared and advised', () => {
    const assessment = assessAllergens({ allergen_tags: ['en:milk'], trace_tags: ['en:milk'] });
    expect(matchAllergenProfile(assessment, ['milk'])[0].status).toBe('contains');
  });

  it('returns nothing when no groups are flagged', () => {
    expect(matchAllergenProfile(assessAllergens({ allergen_tags: ['en:milk'] }), [])).toEqual([]);
  });
});

describe('the stored profile', () => {
  it('drops anything unrecognized rather than failing the whole profile', () => {
    expect(parseAllergenProfile(['milk', 'not-a-group', 42, null, 'peanuts'])).toEqual(['milk', 'peanuts']);
    expect(parseAllergenProfile('milk')).toEqual([]);
    expect(parseAllergenProfile(null)).toEqual([]);
  });

  it('keeps a canonical order so the list does not shuffle as it is edited', () => {
    const picked = ['sesame', 'milk', 'peanuts'] as AllergenGroup[];
    expect(parseAllergenProfile(picked)).toEqual(['milk', 'peanuts', 'sesame']);
  });

  it('toggles without duplicating', () => {
    let profile = toggleAllergenGroup([], 'milk');
    expect(profile).toEqual(['milk']);
    profile = toggleAllergenGroup(profile, 'peanuts');
    expect(profile).toEqual(['milk', 'peanuts']);
    profile = toggleAllergenGroup(profile, 'milk');
    expect(profile).toEqual(['peanuts']);
  });
});
