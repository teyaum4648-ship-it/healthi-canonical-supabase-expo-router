/**
 * Restaurant and fast-food chain names, with the ways people actually type them.
 *
 * Two jobs. Chain names are the vocabulary a query corrector needs — "chipolte" is only
 * fixable against a list that contains "chipotle" — and they are also the terms most
 * likely to be typed without punctuation, which is the other half of the problem: USDA's
 * Survey (FNDDS) set names its restaurant foods "McDonald's, Big Mac", and normalising
 * that apostrophe away leaves the word "mcdonald" to be matched against a query of
 * "mcdonalds".
 *
 * This is a name list, not a menu. It makes chains findable and correctable; it does not
 * carry nutrition, and nothing here claims a chain's items are in the catalogue. When the
 * provider has no row for a chain, no amount of spelling help conjures one.
 *
 * Names are used only to search public food databases for what a person ate. No
 * affiliation is implied and no brand is reproduced beyond its name.
 */

export type ChainEntry = {
  /** The spelling the food databases use, without punctuation. */
  canonical: string;
  /** What people type instead: misspellings, contractions, missing possessives. */
  variants: readonly string[];
};

export const FAST_FOOD_CHAINS: readonly ChainEntry[] = [
  { canonical: 'mcdonalds', variants: ['mcdonald', 'mcdonalds', 'mcdonals', 'macdonalds', 'mcds', 'mickey ds'] },
  { canonical: 'chipotle', variants: ['chipolte', 'chipotles', 'chiptole', 'chipotel'] },
  { canonical: 'starbucks', variants: ['starbuck', 'sbux', 'starbux'] },
  { canonical: 'chick fil a', variants: ['chickfila', 'chick fila', 'chik fil a', 'chicfila', 'chickfilet'] },
  { canonical: 'taco bell', variants: ['tacobell', 'taco bel'] },
  { canonical: 'wendys', variants: ['wendy', 'wendys', 'wendies'] },
  { canonical: 'burger king', variants: ['burgerking', 'bk'] },
  { canonical: 'subway', variants: ['subways'] },
  { canonical: 'dunkin', variants: ['dunkin donuts', 'dunkindonuts', 'dunkings', 'duncan donuts'] },
  { canonical: 'panera', variants: ['panera bread', 'panara', 'panerra'] },
  { canonical: 'kfc', variants: ['kentucky fried chicken'] },
  { canonical: 'popeyes', variants: ['popeye', 'popeyes chicken', 'popeyes'] },
  { canonical: 'dominos', variants: ['domino', 'dominoes', 'dominos pizza'] },
  { canonical: 'pizza hut', variants: ['pizzahut', 'pizza hutt'] },
  { canonical: 'papa johns', variants: ['papajohns', 'papa john'] },
  { canonical: 'five guys', variants: ['fiveguys', '5 guys'] },
  { canonical: 'shake shack', variants: ['shakeshack'] },
  { canonical: 'in n out', variants: ['in and out', 'innout', 'in-n-out'] },
  { canonical: 'jack in the box', variants: ['jackinthebox', 'jack in box'] },
  { canonical: 'sonic', variants: ['sonic drive in'] },
  { canonical: 'arbys', variants: ['arby', 'arbys'] },
  { canonical: 'panda express', variants: ['pandaexpress'] },
  // 'canes' alone is sugar cane at least as often, so it is left out.
  { canonical: 'raising canes', variants: ['raising cane', 'raisin canes'] },
  { canonical: 'whataburger', variants: ['what a burger', 'whatta burger'] },
  { canonical: 'culvers', variants: ['culver', 'culvers'] },
  { canonical: 'zaxbys', variants: ['zaxby', 'zaxbys'] },
  { canonical: 'bojangles', variants: ['bojangle'] },
  { canonical: 'del taco', variants: ['deltaco'] },
  { canonical: 'wingstop', variants: ['wing stop'] },
  { canonical: 'jimmy johns', variants: ['jimmyjohns', 'jimmy john'] },
  { canonical: 'jersey mikes', variants: ['jersey mike', 'jerseymikes'] },
  { canonical: 'firehouse subs', variants: ['firehouse'] },
  { canonical: 'qdoba', variants: ['qdoba mexican', 'kdoba'] },
  { canonical: 'moes', variants: ['moe', 'moes southwest'] },
  { canonical: 'sweetgreen', variants: ['sweet green', 'sweetgreens'] },
  { canonical: 'cava', variants: ['cava grill'] },
  { canonical: 'noodles and company', variants: ['noodles company', 'noodles co'] },
  // 'chili' is deliberately not a variant: it is a food far more often than the chain.
  { canonical: 'chilis', variants: ['chilis'] },
  { canonical: 'applebees', variants: ['applebee', 'applebees'] },
  { canonical: 'olive garden', variants: ['olivegarden'] },
  { canonical: 'cheesecake factory', variants: ['cheesecakefactory'] },
  { canonical: 'ihop', variants: ['i hop', 'international house of pancakes'] },
  { canonical: 'dennys', variants: ['denny', 'dennys'] },
  { canonical: 'waffle house', variants: ['wafflehouse'] },
  { canonical: 'cracker barrel', variants: ['crackerbarrel'] },
  { canonical: 'buffalo wild wings', variants: ['bww', 'buffalo wild wing'] },
  { canonical: 'jamba juice', variants: ['jamba', 'jambajuice'] },
  { canonical: 'smoothie king', variants: ['smoothieking'] },
  { canonical: 'dairy queen', variants: ['dq', 'dairyqueen'] },
  { canonical: 'tim hortons', variants: ['tim horton', 'timhortons', 'timmies'] }
];

/** Every chain spelling the corrector may land on, canonical forms included. */
export const CHAIN_VOCABULARY: readonly string[] = [
  ...new Set(FAST_FOOD_CHAINS.flatMap((chain) => [chain.canonical, ...chain.variants]))
];

/** Variant to canonical, for the exact-match pass. */
export const CHAIN_ALIASES: Readonly<Record<string, string>> = Object.fromEntries(
  FAST_FOOD_CHAINS.flatMap((chain) =>
    chain.variants.filter((variant) => variant !== chain.canonical).map((variant) => [variant, chain.canonical]))
);
