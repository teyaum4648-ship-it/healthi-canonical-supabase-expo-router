import { CURATED_FOOD_VOCABULARY } from './foodVocabulary';

/**
 * Label spelling is not a solved problem. The jar that started this work listed
 * "tumeric", which the role table has known as turmeric since the beginning — the word
 * was there, the label just could not spell it, and 59% of that product came back
 * unrecognised partly for that reason.
 *
 * Two layers, deliberately unequal in what they are allowed to do:
 *
 *   MISSPELLINGS is curated, so a correction here may resolve to any role. Reading
 *   "hydrogenatd oil" as a hydrogenated fat is the point, not a hazard.
 *
 *   The fuzzy pass is a guess, so it may only move a name the table could not place
 *   toward food. A heuristic is never allowed to invent a penalty, which means the
 *   worst a bad guess can do is credit something it should not have — the same
 *   direction the 0.55 unknown default already errs in.
 */

/** Label misspellings seen in the wild, mapped to the spelling the table knows. */
export const MISSPELLINGS: Readonly<Record<string, string>> = {
  tumeric: 'turmeric',
  termeric: 'turmeric',
  brocolli: 'broccoli',
  broccolli: 'broccoli',
  brocoli: 'broccoli',
  avacado: 'avocado',
  avocodo: 'avocado',
  tomatoe: 'tomato',
  potatoe: 'potato',
  chickpeas: 'chickpea',
  garbanzos: 'garbanzo bean',
  lentals: 'lentil',
  quinoia: 'quinoa',
  qinoa: 'quinoa',
  cinamon: 'cinnamon',
  cinnamom: 'cinnamon',
  corriander: 'coriander',
  cilantro_leaf: 'cilantro',
  parsely: 'parsley',
  oregeno: 'oregano',
  basmatti: 'basmati rice',
  jalapino: 'jalapeno',
  jalepeno: 'jalapeno',
  cauliflour: 'cauliflower',
  califlower: 'cauliflower',
  zuchini: 'zucchini',
  zucchinni: 'zucchini',
  asparagas: 'asparagus',
  mozarella: 'mozzarella',
  mozzarela: 'mozzarella',
  parmasan: 'parmesan',
  yoghurt: 'yogurt',
  yoghourt: 'yogurt',
  hydrogenatd: 'hydrogenated',
  hydogenated: 'hydrogenated',
  maltodextrine: 'maltodextrin',
  lecthin: 'lecithin',
  lecitin: 'lecithin',
  ascorbid: 'ascorbic',
  perservative: 'preservative',
  sacharin: 'saccharin',
  aspertame: 'aspartame'
};

/** Applies the curated corrections word by word. Unknown words are left alone. */
export function correctSpelling(name: string): string {
  return name.replace(/[a-z]+/g, (word) => MISSPELLINGS[word] ?? word);
}

/**
 * Curated words long enough that a one-character slip is unlikely to be ambiguous.
 *
 * Curated only. A repair is a guess, and whatever it lands on is credited as food, so it
 * may only land on names somebody chose. Generated terms are filtered but not vetted one
 * by one, and a guess pulled towards one of them would be a guess resting on a guess.
 */
const FUZZY_TARGETS: readonly string[] = [...new Set(
  CURATED_FOOD_VOCABULARY.flatMap((term) => term.split(/[^a-z]+/i)).filter((word) => word.length >= 5)
)];

/** True when one insertion, deletion or substitution turns left into right. */
function withinOneEdit(left: string, right: string): boolean {
  if (left === right) return true;
  const gap = left.length - right.length;
  if (gap > 1 || gap < -1) return false;
  const [shorter, longer] = left.length <= right.length ? [left, right] : [right, left];
  let shortIndex = 0;
  let longIndex = 0;
  let edited = false;
  while (shortIndex < shorter.length && longIndex < longer.length) {
    if (shorter[shortIndex] === longer[longIndex]) {
      shortIndex += 1;
      longIndex += 1;
      continue;
    }
    if (edited) return false;
    edited = true;
    if (shorter.length === longer.length) shortIndex += 1;
    longIndex += 1;
  }
  return true;
}

/**
 * Repairs words the vocabulary nearly knows. Only words of five characters or more are
 * considered, and only against food names — so this can move a name toward food and
 * nowhere else.
 */
export function repairTowardFood(name: string): string {
  return name.replace(/[a-z]+/g, (word) => {
    if (word.length < 5 || FUZZY_TARGETS.includes(word)) return word;
    const match = FUZZY_TARGETS.find((target) => Math.abs(target.length - word.length) <= 1 && withinOneEdit(word, target));
    return match ?? word;
  });
}
