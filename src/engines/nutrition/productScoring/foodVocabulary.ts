import { GENERATED_FOOD_VOCABULARY } from './generatedFoodVocabulary';

/**
 * Names of foods, consulted only after the hand-written rules have all missed.
 *
 * The rules in ingredientRoles.ts encode judgment — that palm kernel oil is an
 * industrial fat, that paprika extract is a colour, that cocoa butter is a culinary fat
 * rather than a butter. That judgment has to keep deciding, so this list never competes
 * with it: ingredientReading() reads every rule first and reaches here only for a name
 * nothing placed. A term here can therefore move an ingredient from unknown to food and
 * can do nothing else, which is what makes the list safe to grow.
 *
 * It is long on purpose. An unrecognised ingredient scores 0.55 against a whole food's
 * 1.0, so a gap does not read as "we are not sure" — it quietly withholds the credit a
 * real food earns, and a jar of eggplant and tomatoes lands at F. Before this file
 * existed the table could not place 58% of a 519-item checklist of ordinary foods,
 * including tomato and potato themselves.
 *
 * Synonyms and regional names are entries in their own right rather than aliases, since
 * a label says aubergine or brinjal without meaning anything different by it. Genuine
 * misspellings are handled separately, in ingredientAliases.ts.
 *
 * This list is a floor. USDA FoodData Central publishes roughly ten thousand generic
 * food descriptions as public-domain data, and `npm run vocab:build` regenerates this
 * file from them; see scripts/build-food-vocabulary.mjs.
 */

/**
 * The curated core: foods chosen category by category so the gaps are structural rather
 * than anecdotal. It is the floor, and it stays checked in even once generation runs, so
 * a failed or partial regeneration can never shrink what the table knows.
 */
export const CURATED_FOOD_VOCABULARY: readonly string[] = [
  // Leafy greens
  'arugula', 'rocket', 'watercress', 'swiss chard', 'chard', 'collard greens', 'collards',
  'mustard greens', 'turnip greens', 'beet greens', 'endive', 'escarole', 'radicchio',
  'frisee', 'bok choy', 'pak choi', 'napa cabbage', 'savoy cabbage', 'amaranth leaf',
  'moringa', 'sorrel', 'purslane', 'dandelion greens', 'mizuna', 'tatsoi',
  'malabar spinach', 'callaloo', 'microgreens', 'sprouts', 'alfalfa sprouts',
  'broccoli sprouts', 'watercress leaf', 'baby spinach', 'mixed greens', 'spring mix',

  // Cruciferous
  'brussels sprouts', 'brussel sprouts', 'broccolini', 'broccoli rabe', 'rapini',
  'kohlrabi', 'romanesco', 'daikon', 'horseradish', 'wasabi', 'turnip', 'rutabaga',
  'swede', 'red cabbage', 'green cabbage',

  // Roots and tubers
  'potato', 'sweet potato', 'russet potato', 'red potato', 'yukon gold potato',
  'purple potato', 'fingerling potato', 'yam', 'manioc', 'taro', 'malanga', 'eddoe',
  'parsnip', 'beetroot', 'celeriac', 'celery root', 'jicama', 'lotus root',
  'burdock root', 'salsify', 'sunchoke', 'jerusalem artichoke', 'radish',
  'plantain', 'breadfruit', 'turmeric root', 'galangal', 'horseradish root',

  // Alliums
  'leek', 'shallot', 'scallion', 'green onion', 'spring onion', 'chive', 'ramp',
  'elephant garlic', 'garlic clove', 'red onion', 'yellow onion', 'white onion',
  'sweet onion', 'vidalia onion', 'pearl onion',

  // Nightshades
  'tomato', 'cherry tomato', 'grape tomato', 'roma tomato', 'plum tomato',
  'sun dried tomato', 'tomatillo', 'eggplant', 'aubergine', 'brinjal', 'poblano',
  'jalapeno', 'serrano', 'habanero', 'scotch bonnet', 'chile', 'chilli', 'chili',
  'ancho', 'chipotle', 'guajillo', 'pasilla', 'bird’s eye chili', 'paprika',
  'pimento', 'pimiento', 'goji berry', 'wolfberry', 'banana pepper', 'shishito',
  'padron pepper', 'cubanelle',

  // Gourds and squashes
  'courgette', 'kabocha', 'pumpkin', 'bottle gourd', 'calabash', 'lauki',
  'bitter melon', 'bitter gourd', 'karela', 'ridge gourd', 'luffa', 'chayote',
  'winter melon', 'ash gourd', 'okra', 'lady finger', 'delicata squash',
  'acorn squash', 'butternut squash', 'spaghetti squash', 'hubbard squash',
  'patty pan squash', 'crookneck squash',

  // Stems, flowers, sea vegetables
  'fennel', 'fennel bulb', 'artichoke', 'artichoke heart', 'heart of palm',
  'bamboo shoot', 'rhubarb', 'cardoon', 'nori', 'kombu', 'wakame', 'dulse', 'kelp',
  'seaweed', 'sea moss', 'irish moss', 'agar', 'spirulina', 'chlorella', 'arame',
  'hijiki', 'sea lettuce',

  // Mushrooms
  'cremini', 'crimini', 'portobello', 'portabella', 'shiitake', 'maitake',
  'oyster mushroom', 'enoki', 'porcini', 'chanterelle', 'lion’s mane',
  'lions mane', 'reishi', 'cordyceps', 'chaga', 'king trumpet', 'king oyster',
  'wood ear', 'morel', 'truffle', 'button mushroom', 'white mushroom',

  // Fruit
  'papaya', 'guava', 'lychee', 'litchi', 'longan', 'rambutan', 'dragon fruit',
  'pitaya', 'jackfruit', 'durian', 'starfruit', 'carambola', 'persimmon',
  'pomegranate', 'tamarind', 'acai', 'acerola', 'soursop', 'guanabana', 'cherimoya',
  'sapote', 'mamey', 'kiwi', 'kiwifruit', 'coconut', 'avocado', 'olive', 'elderberry',
  'currant', 'blackcurrant', 'redcurrant', 'gooseberry', 'quince', 'mulberry',
  'boysenberry', 'lingonberry', 'cloudberry', 'sea buckthorn', 'nectarine',
  'clementine', 'mandarin', 'tangerine', 'satsuma', 'grapefruit', 'pomelo', 'yuzu',
  'calamansi', 'kumquat', 'plantain banana', 'watermelon', 'cantaloupe', 'honeydew',
  'muskmelon', 'passion fruit', 'maracuya', 'jujube', 'loquat', 'feijoa',

  // Grains and pseudocereals
  'wheat', 'durum wheat', 'spelt', 'einkorn', 'emmer', 'kamut', 'khorasan wheat',
  'rye', 'triticale', 'cornmeal', 'polenta', 'grits', 'teff', 'sorghum', 'fonio',
  'freekeh', 'bulgur', 'couscous', 'job’s tears', 'basmati rice', 'jasmine rice',
  'black rice', 'red rice', 'forbidden rice', 'rice bran', 'wheat bran', 'oat bran',
  'wheat germ', 'rolled barley', 'pearl barley', 'hulled barley', 'buckwheat groats',
  'kasha', 'semolina', 'durum semolina',

  // Legumes and pulses
  'black bean', 'pinto bean', 'kidney bean', 'navy bean', 'cannellini bean',
  'great northern bean', 'lima bean', 'butter bean', 'fava bean', 'broad bean',
  'mung bean', 'adzuki bean', 'aduki bean', 'black-eyed pea', 'black eyed pea',
  'cowpea', 'pigeon pea', 'toor dal', 'chana dal', 'urad dal', 'masoor dal',
  'moong dal', 'dal', 'daal', 'red lentil', 'green lentil', 'brown lentil',
  'beluga lentil', 'french lentil', 'puy lentil', 'split pea', 'snow pea',
  'snap pea', 'sugar snap pea', 'lupini', 'lupin bean', 'natto', 'miso',
  'yellow pea', 'green split pea', 'borlotti bean', 'cranberry bean', 'flageolet',

  // Nuts and seeds
  'filbert', 'brazil nut', 'pine nut', 'pignoli', 'chestnut', 'tiger nut',
  'sunflower seed', 'pumpkin seed', 'pepita', 'chia seed', 'flaxseed', 'flax seed',
  'linseed', 'hemp seed', 'hemp heart', 'sesame seed', 'poppy seed', 'nigella seed',
  'black seed', 'watermelon seed', 'melon seed', 'sacha inchi', 'cashew butter',
  'sunflower butter', 'sunbutter', 'hazelnut butter', 'pistachio butter',

  // Herbs
  'cilantro', 'coriander leaf', 'mint', 'spearmint', 'peppermint', 'sage', 'dill',
  'tarragon', 'marjoram', 'bay leaf', 'chervil', 'lemongrass', 'curry leaf',
  'kaffir lime leaf', 'makrut lime leaf', 'shiso', 'perilla', 'epazote', 'lovage',
  'savory', 'thai basil', 'holy basil', 'tulsi', 'fenugreek leaf', 'methi',

  // Spices
  'cumin', 'coriander', 'cassia', 'cardamom', 'clove', 'nutmeg', 'mace', 'allspice',
  'star anise', 'anise', 'aniseed', 'caraway', 'fenugreek', 'asafoetida', 'hing',
  'sumac', 'za’atar', 'zaatar', 'saffron', 'vanilla', 'vanilla bean',
  'juniper berry', 'annatto seed', 'ajwain', 'amchur', 'mango powder',
  'garam masala', 'curry powder', 'chili powder', 'chile powder', 'smoked paprika',
  'harissa', 'ras el hanout', 'berbere', 'dukkah', 'furikake', 'shichimi',
  'togarashi', 'fennel seed', 'mustard seed', 'black pepper', 'white pepper',
  'green peppercorn', 'pink peppercorn', 'sichuan pepper', 'szechuan pepper',
  'long pepper', 'grains of paradise', 'mahlab', 'nigella', 'kalonji',

  // Meat, poultry, eggs
  'duck', 'goose', 'quail', 'pheasant', 'steak', 'brisket', 'sirloin', 'ribeye',
  'tenderloin', 'chuck', 'flank steak', 'skirt steak', 'short rib', 'oxtail',
  'ham', 'prosciutto', 'bacon', 'pancetta', 'mutton', 'goat', 'veal', 'venison',
  'elk', 'rabbit', 'boar', 'liver', 'heart', 'kidney', 'tripe', 'sweetbread',
  'marrow', 'bone broth', 'chicken broth', 'beef broth', 'stock', 'gelatin from bone',
  'duck egg', 'quail egg', 'chicken breast', 'chicken thigh', 'ground beef',
  'ground turkey', 'ground chicken', 'ground pork', 'ground lamb',

  // Fish and shellfish
  'haddock', 'halibut', 'tilapia', 'trout', 'mackerel', 'herring', 'bass',
  'sea bass', 'striped bass', 'snapper', 'grouper', 'catfish', 'pollock', 'sole',
  'flounder', 'swordfish', 'mahi mahi', 'mahi-mahi', 'barramundi', 'branzino',
  'arctic char', 'whitefish', 'monkfish', 'skate', 'prawn', 'crab', 'lobster',
  'crawfish', 'crayfish', 'langoustine', 'scallop', 'oyster', 'clam', 'mussel',
  'squid', 'calamari', 'octopus', 'cuttlefish', 'roe', 'caviar', 'bonito',
  'yellowtail', 'hamachi', 'eel', 'unagi',

  // Dairy and ferments
  'creme fraiche', 'skyr', 'labneh', 'quark', 'ricotta', 'mozzarella', 'cheddar',
  'parmesan', 'parmigiano', 'pecorino', 'feta', 'halloumi', 'paneer', 'queso fresco',
  'cotija', 'manchego', 'gruyere', 'gouda', 'brie', 'camembert', 'provolone',
  'monterey jack', 'swiss cheese', 'blue cheese', 'gorgonzola', 'roquefort',
  'mascarpone', 'burrata', 'goat cheese', 'chevre', 'sauerkraut', 'kimchi',
  'kombucha', 'kvass', 'sourdough starter', 'buttermilk', 'clotted cream',
  'evaporated milk', 'a2 milk', 'raw milk', 'goat milk', 'sheep milk',

  // Plant milks
  'almond milk', 'oat milk', 'soy milk', 'coconut milk', 'cashew milk', 'rice milk',
  'hemp milk', 'pea milk', 'macadamia milk', 'walnut milk', 'coconut cream',
  'coconut water', 'oat base', 'almond base',

  // Global staples and prepared wholes
  'injera', 'tortilla', 'corn tortilla', 'flour tortilla', 'roti', 'chapati', 'naan',
  'pita', 'lavash', 'rice noodle', 'soba', 'udon', 'ramen noodle', 'vermicelli',
  'rice paper', 'congee', 'poi', 'fufu', 'ugali', 'arepa', 'masa harina', 'mochi',
  'seitan', 'wheat gluten', 'falafel', 'hummus', 'tahini paste', 'harina de maiz',

  // Fats whose whole-food source matters
  'walnut oil', 'flaxseed oil', 'macadamia oil', 'pumpkin seed oil', 'schmaltz',
  'duck fat', 'cod liver oil', 'fish oil', 'krill oil', 'algae oil'
];

/** Everything the table can place as food: the curated core plus whatever USDA added. */
export const WHOLE_FOOD_VOCABULARY: readonly string[] = [
  ...new Set([...CURATED_FOOD_VOCABULARY, ...GENERATED_FOOD_VOCABULARY])
];

const escapeForRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * The curated terms as one alternation, longest first so "sweet potato" wins over "potato"
 * and "coconut water" over "coconut". Built once, because this runs per ingredient.
 *
 * Curated terms may match anywhere in a name. They were chosen one at a time, and a label
 * names foods inside longer phrases — "organic diced tomatoes in their own juice".
 */
const CURATED_PATTERN = new RegExp(
  `\\b(?:${[...CURATED_FOOD_VOCABULARY]
    .sort((left, right) => right.length - left.length)
    .map(escapeForRegex)
    .join('|')})\\b`
);

/**
 * Generated terms may only match an ingredient that is that food.
 *
 * They come from splitting USDA descriptions, which yields specific foods and also, however
 * carefully it is filtered, the odd word that is a food only in context. Matching those
 * anywhere in a name is how "mixed" once made "mixed tocopherols" a whole food and
 * "vegetable" did the same for "hydrolyzed vegetable protein". A generated term is evidence
 * about an ingredient that is the food it names — "abalone", "dried abalone" — and none
 * about one that merely contains the word.
 */
const GENERATED_TERMS = new Set(GENERATED_FOOD_VOCABULARY);

/** How a label dresses a single food without changing which food it is. */
const LEADING_PREPARATION = /^(?:(?:organic|dried|dehydrated|freeze-dried|fresh|raw|frozen|whole|roasted|toasted|ground|chopped|diced|sliced|cooked|wild|sprouted)\s+)+/;

/** The name reduced to the food it names, for the whole-name match. */
export function coreIngredientName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[*.,;:]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(LEADING_PREPARATION, '');
}

function isGeneratedFood(name: string): boolean {
  const core = coreIngredientName(name);
  if (!core) return false;
  if (GENERATED_TERMS.has(core)) return true;
  // USDA lists some foods singular and some plural; a label may use either.
  return core.endsWith('s') ? GENERATED_TERMS.has(core.slice(0, -1)) : GENERATED_TERMS.has(`${core}s`);
}

/** Whether this name is a food the vocabulary knows. */
export function isVocabularyFood(name: string): boolean {
  return CURATED_PATTERN.test(name) || isGeneratedFood(name);
}
