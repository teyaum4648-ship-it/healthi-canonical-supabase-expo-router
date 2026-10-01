import { describe, expect, it } from 'vitest';

import { brandText, leadingBrand } from '../../../src/features/nutrition/productLookup/brandSearch';

describe('brand text', () => {
  it('reads punctuation and ampersands the way people type them', () => {
    expect(brandText("Ben & Jerry's")).toBe('ben and jerrys');
    expect(brandText('Siggi’s')).toBe('siggis');
    expect(brandText('Häagen-Dazs')).toBe('haagen dazs');
  });
});

describe('the brand a search starts with', () => {
  it('reads the leading words as the brand and keeps the rest', () => {
    expect(leadingBrand('chobani vanilla greek yogurt', ['Chobani'])).toEqual({ brand: 'Chobani', rest: 'vanilla greek yogurt' });
  });

  it('matches past an apostrophe, typed or not', () => {
    expect(leadingBrand('daves killer bread good seed', ["Dave's Killer Bread"])).toEqual({ brand: "Dave's Killer Bread", rest: 'good seed' });
    expect(leadingBrand("dave's killer bread good seed", ["Dave's Killer Bread"])?.rest).toBe('good seed');
  });

  it('prefers the longest brand', () => {
    expect(leadingBrand('premier protein chocolate shake', ['Premier', 'Premier Protein'])?.brand).toBe('Premier Protein');
  });

  it('needs whole words, the start of the query, and something left to look for', () => {
    expect(leadingBrand('kinder bueno', ['Kind'])).toBeNull();
    expect(leadingBrand('greek yogurt chobani', ['Chobani'])).toBeNull();
    expect(leadingBrand('chobani', ['Chobani'])).toBeNull();
    expect(leadingBrand('chobani yogurt', [])).toBeNull();
  });
});
