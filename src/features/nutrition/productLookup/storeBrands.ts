/**
 * Store names people type, and the house brands those stores' shelves are labelled with.
 *
 * Nobody's label says "Costco". A search for "costco almond butter" returned nothing from
 * Open Food Facts while "kirkland almond butter" returned the Kirkland Signature jars,
 * because the catalogue records the brand on the package. So a store name is read as
 * its house brand, and the brand is searched as a brand filter rather than as words,
 * which keeps "Trader Joe's" from being missed over an apostrophe.
 *
 * Tags are Open Food Facts brand tags, checked against the live catalogue: each one
 * returns several hundred to several thousand US products. Names only; no affiliation
 * is implied.
 */

export type StoreBrand = {
  /** The brand as the package spells it, for display and for text search. */
  brand: string;
  /** Open Food Facts brands tag. */
  tag: string;
  /** Store names that mean this brand, as typed (lower case, no apostrophes). */
  stores: readonly string[];
  /** The store to name when one was typed, for the notice. */
  storeLabel?: string;
  /** The brand name as typed. */
  names: readonly string[];
};

export const STORE_BRANDS: readonly StoreBrand[] = [
  { brand: 'Kirkland Signature', tag: 'kirkland-signature', storeLabel: 'Costco', stores: ['costco', 'costcos'], names: ['kirkland signature', 'kirkland', 'kirklands'] },
  { brand: 'Trader Joe’s', tag: 'trader-joe-s', stores: [], names: ['trader joes', 'trader joe', 'traders joes', 'traderjoes', 'tjs'] },
  { brand: 'Kroger', tag: 'kroger', stores: [], names: ['kroger', 'krogers'] },
  { brand: 'Simple Truth', tag: 'simple-truth', stores: [], names: ['simple truth', 'simple truth organic'] },
  { brand: 'Private Selection', tag: 'private-selection', stores: [], names: ['private selection'] },
  { brand: 'Great Value', tag: 'great-value', storeLabel: 'Walmart', stores: ['walmart', 'walmarts'], names: ['great value'] },
  { brand: 'Good & Gather', tag: 'good-gather', storeLabel: 'Target', stores: ['target', 'targets'], names: ['good gather', 'good and gather'] },
  { brand: 'Market Pantry', tag: 'market-pantry', stores: [], names: ['market pantry'] },
  { brand: 'Whole Foods Market', tag: 'whole-foods-market', stores: ['whole foods', 'whole foods market'], storeLabel: 'Whole Foods', names: ['365 by whole foods', '365 everyday value', '365'] },
  { brand: 'Signature Select', tag: 'signature-select', storeLabel: 'Safeway and Albertsons', stores: ['safeway', 'albertsons', 'vons', 'jewel osco', 'shaws', 'acme'], names: ['signature select'] },
  { brand: 'O Organics', tag: 'o-organics', stores: [], names: ['o organics'] },
  { brand: 'Member’s Mark', tag: 'members-mark', storeLabel: 'Sam’s Club', stores: ['sams club', 'sams'], names: ['members mark', 'member mark'] },
  { brand: 'H-E-B', tag: 'h-e-b', stores: [], names: ['h e b', 'heb'] },
  { brand: 'Publix', tag: 'publix', stores: [], names: ['publix'] },
  { brand: 'Wegmans', tag: 'wegmans', stores: [], names: ['wegmans', 'wegman'] },
  { brand: 'Aldi', tag: 'aldi', stores: [], names: ['aldi', 'aldis'] },
  { brand: 'Simply Nature', tag: 'simply-nature', stores: [], names: ['simply nature'] },
  // Never plain "sprouts": that is brussels sprouts and bean sprouts.
  { brand: 'Sprouts', tag: 'sprouts-farmers-market', stores: [], names: ['sprouts farmers market', 'sprouts market', 'sprouts brand'] },
  { brand: 'Meijer', tag: 'meijer', stores: [], names: ['meijer', 'meijers'] }
];

export type StoreBrandMatch = {
  store: StoreBrand;
  /** The query without the store or brand words: what to look for inside the brand. */
  rest: string;
  /** Set when a store name was typed rather than the brand, so the app can say so. */
  typedStore: string | null;
};

const normalize = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/['’]/g, '').replace(/&/g, ' and ').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

/** Every typed form, longest first, so "whole foods market" wins over "whole foods". */
const FORMS = STORE_BRANDS.flatMap(store => [
  ...store.stores.map(form => ({ form, store, isStore: true })),
  ...store.names.map(form => ({ form, store, isStore: false }))
]).sort((a, b) => b.form.length - a.form.length);

/** The store or house brand named in a query, if any, and what else was asked for. */
export function findStoreBrand(query: string): StoreBrandMatch | null {
  const phrase = ` ${normalize(query)} `;
  for (const { form, store, isStore } of FORMS) {
    const at = phrase.indexOf(` ${form} `);
    if (at < 0) continue;
    const rest = `${phrase.slice(0, at)} ${phrase.slice(at + form.length + 2)}`.replace(/\s+/g, ' ').trim();
    return { store, rest, typedStore: isStore ? store.storeLabel ?? null : null };
  }
  return null;
}

/** Text to send where brand filters are not available: the brand's words, then the rest. */
export function storeBrandText(match: StoreBrandMatch): string {
  return `${match.store.brand} ${match.rest}`.trim();
}

/** "Showing Kirkland Signature, Costco’s own brand." Only when a store name was typed. */
export function storeBrandNotice(match: StoreBrandMatch): string | undefined {
  return match.typedStore ? `Showing ${match.store.brand}, ${match.typedStore}’s own brand. Other brands they carry are under their own names.` : undefined;
}

/** Open Food Facts country tags for the regions the app is used in. */
const COUNTRY_TAGS: Readonly<Record<string, string>> = {
  US: 'united-states', CA: 'canada', GB: 'united-kingdom', IE: 'ireland', AU: 'australia', NZ: 'new-zealand',
  FR: 'france', DE: 'germany', ES: 'spain', IT: 'italy', MX: 'mexico'
};

/**
 * The device's country, as an Open Food Facts tag, or null. A search for "greek yogurt"
 * with no country returned UK supermarket brands first; limited to the United States it
 * returned Chobani, Fage and Kirkland. Reading the region from the device's locale keeps
 * that right for people elsewhere too.
 */
export function deviceCountryTag(locale?: string): string | null {
  try {
    const resolved = locale ?? Intl.DateTimeFormat().resolvedOptions().locale;
    const region = /[-_]([A-Za-z]{2})(?:[-_]|$)/.exec(resolved)?.[1]?.toUpperCase();
    return region ? COUNTRY_TAGS[region] ?? null : null;
  } catch {
    return null;
  }
}
