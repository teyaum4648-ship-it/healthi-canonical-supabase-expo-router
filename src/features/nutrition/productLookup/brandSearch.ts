/*
 * Finding a product by its brand when the brand is not in the product's name.
 *
 * A Chobani cup is named "Greek Yogurt, Vanilla" with "Chobani" only in its brand field.
 * Searched as "chobani vanilla greek yogurt", it competes on the words with every vanilla
 * Greek yogurt in the catalogue, and the catalogue ranks by popularity, not by how well
 * the words fit. So the cup could be one barcode away and still missing from the list.
 * Searching the rest of the words inside the brand finds it.
 */

const normalize = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/['’]/g, '').replace(/&/g, ' and ').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

/**
 * Open Food Facts' brand tag for a brand as printed: "Dave's Killer Bread" becomes
 * "dave-s-killer-bread", "Good & Gather" becomes "good-gather".
 */
export function brandTag(name: string): string {
  return name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '');
}

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
  const words = normalize(query).split(' ').filter(Boolean);
  let best: { brand: string; length: number } | null = null;
  for (const brand of brands) {
    const brandWords = normalize(brand).split(' ').filter(Boolean);
    if (!brandWords.length || brandWords.length >= words.length) continue;
    if (!brandWords.every((word, index) => words[index] === word)) continue;
    if (!best || brandWords.length > best.length) best = { brand, length: brandWords.length };
  }
  return best ? { brand: best.brand, rest: words.slice(best.length).join(' ') } : null;
}
