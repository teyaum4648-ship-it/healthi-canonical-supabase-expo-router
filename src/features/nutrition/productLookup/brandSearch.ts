/*
 * Reading the brand at the start of a search: "breyers butter pecan ice cream" is the brand
 * Breyers and the words "butter pecan ice cream". The catalogue engine is then asked again
 * inside that brand, which puts the brand's own products first even when the brand is only
 * on the label's brand line and not in the product's name.
 */

/** A brand or query as plain words: "Ben & Jerry's" and "ben and jerrys" read the same. */
export const brandText = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/['’]/g, '').replace(/&/g, ' and ').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

export type LeadingBrand = {
  /** The brand as the catalogue spells it. */
  brand: string;
  /** What else was asked for: the words to look for inside the brand. */
  rest: string;
};

/**
 * The brand a query starts with, chosen from catalogue brand names, and the words after
 * it. The longest brand wins, so "premier protein shake" reads as Premier Protein and not
 * Premier. Whole words only, and some words must be left over: a query that is only a
 * brand is already answered by the ordinary search.
 */
export function leadingBrand(query: string, brands: readonly string[]): LeadingBrand | null {
  const words = brandText(query).split(' ').filter(Boolean);
  let best: { brand: string; length: number } | null = null;
  for (const brand of brands) {
    const brandWords = brandText(brand).split(' ').filter(Boolean);
    if (!brandWords.length || brandWords.length >= words.length) continue;
    if (!brandWords.every((word, index) => words[index] === word)) continue;
    if (!best || brandWords.length > best.length) best = { brand, length: brandWords.length };
  }
  return best ? { brand: best.brand, rest: words.slice(best.length).join(' ') } : null;
}
