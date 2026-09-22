/**
 * A checklist of foods a wellness app is expected to recognise by name.
 *
 * This exists because the calibration corpus cannot find a gap in the role table: every
 * product in it was chosen by someone who had already looked at its label, so it scores
 * 0% unrecognised no matter how narrow the table is. Measuring coverage against curated
 * products measures the curation.
 *
 * So the audit runs the other way. Rather than asking what share of some corpus we miss,
 * it asks which of these foods the table cannot place — and the list is organised by
 * category and by cuisine precisely so the gaps are structural rather than anecdotal. A
 * table that knows broccoli and kale but not bok choy or amaranth leaf is not 90% done,
 * it is Anglo-centric, and only a category-by-category sweep shows that.
 *
 * Entries are the form that appears on a label, lowercase. This is a floor, not a
 * ceiling: USDA's generic food descriptions carry roughly ten thousand of these, and
 * `npm run vocab:build` is what replaces this checklist with that.
 */

export type FoodCategory = {
  id: string;
  label: string;
  /** What this category is here to catch, in one line. */
  note: string;
  foods: string[];
};

export const FOOD_TAXONOMY: FoodCategory[] = [
  {
    id: 'leafy_greens',
    label: 'Leafy greens',
    note: 'The table knows the supermarket four and little else.',
    foods: [
      'spinach', 'kale', 'lettuce', 'romaine lettuce', 'arugula', 'rocket', 'watercress',
      'swiss chard', 'chard', 'collard greens', 'mustard greens', 'turnip greens',
      'beet greens', 'endive', 'escarole', 'radicchio', 'bok choy', 'pak choi',
      'napa cabbage', 'savoy cabbage', 'amaranth leaf', 'moringa', 'sorrel', 'purslane',
      'dandelion greens', 'mizuna', 'tatsoi', 'malabar spinach', 'callaloo'
    ]
  },
  {
    id: 'cruciferous',
    label: 'Cruciferous',
    note: 'Beyond broccoli and cauliflower the family thins out fast.',
    foods: [
      'broccoli', 'cauliflower', 'cabbage', 'red cabbage', 'brussels sprouts',
      'broccolini', 'broccoli rabe', 'rapini', 'kohlrabi', 'romanesco', 'daikon',
      'horseradish', 'wasabi', 'turnip', 'rutabaga', 'swede'
    ]
  },
  {
    id: 'root_tuber',
    label: 'Roots and tubers',
    note: 'Staple carbohydrates for most of the world, largely absent here.',
    foods: [
      'potato', 'sweet potato', 'yam', 'cassava', 'yuca', 'manioc', 'taro', 'malanga',
      'carrot', 'parsnip', 'beet', 'beetroot', 'celeriac', 'celery root', 'jicama',
      'lotus root', 'burdock root', 'salsify', 'sunchoke', 'jerusalem artichoke',
      'radish', 'plantain', 'breadfruit'
    ]
  },
  {
    id: 'allium',
    label: 'Alliums',
    note: 'Onion and garlic are in; the rest of the family is not.',
    foods: [
      'onion', 'red onion', 'yellow onion', 'white onion', 'garlic', 'leek', 'shallot',
      'scallion', 'green onion', 'spring onion', 'chive', 'ramp', 'elephant garlic'
    ]
  },
  {
    id: 'nightshade',
    label: 'Nightshades',
    note: 'The family that produced the F-grade jar of vegetables.',
    foods: [
      'tomato', 'cherry tomato', 'tomatillo', 'eggplant', 'aubergine', 'brinjal',
      'bell pepper', 'red pepper', 'green pepper', 'poblano', 'jalapeno', 'serrano',
      'habanero', 'chili pepper', 'chile', 'cayenne pepper', 'paprika', 'pimento',
      'potato', 'goji berry'
    ]
  },
  {
    id: 'gourd_squash',
    label: 'Gourds and squashes',
    note: 'Squash and zucchini are in; the global gourds are not.',
    foods: [
      'zucchini', 'courgette', 'yellow squash', 'butternut squash', 'acorn squash',
      'spaghetti squash', 'delicata squash', 'kabocha', 'pumpkin', 'cucumber',
      'bottle gourd', 'calabash', 'bitter melon', 'bitter gourd', 'ridge gourd',
      'luffa', 'chayote', 'winter melon', 'ash gourd', 'okra'
    ]
  },
  {
    id: 'stem_flower_sea',
    label: 'Stems, flowers and sea vegetables',
    note: 'Sea vegetables are a whole food category with no representation.',
    foods: [
      'asparagus', 'celery', 'fennel', 'artichoke', 'heart of palm', 'bamboo shoot',
      'rhubarb', 'nori', 'kombu', 'wakame', 'dulse', 'kelp', 'seaweed', 'sea moss',
      'agar', 'irish moss', 'spirulina', 'chlorella'
    ]
  },
  {
    id: 'mushroom',
    label: 'Mushrooms',
    note: 'One generic word covers a category with real variety.',
    foods: [
      'mushroom', 'button mushroom', 'cremini', 'portobello', 'shiitake', 'maitake',
      'oyster mushroom', 'enoki', 'porcini', 'chanterelle', 'lion’s mane',
      'reishi', 'king trumpet', 'wood ear'
    ]
  },
  {
    id: 'fruit_common',
    label: 'Common fruit',
    note: 'Well covered already; here to catch regressions.',
    foods: [
      'apple', 'banana', 'orange', 'lemon', 'lime', 'pear', 'peach', 'nectarine',
      'plum', 'apricot', 'cherry', 'grape', 'strawberry', 'blueberry', 'raspberry',
      'blackberry', 'cranberry', 'watermelon', 'cantaloupe', 'honeydew'
    ]
  },
  {
    id: 'fruit_tropical',
    label: 'Tropical and less common fruit',
    note: 'Where the produce aisle stops being British.',
    foods: [
      'mango', 'pineapple', 'papaya', 'guava', 'passion fruit', 'lychee', 'longan',
      'rambutan', 'dragon fruit', 'pitaya', 'jackfruit', 'durian', 'starfruit',
      'persimmon', 'pomegranate', 'fig', 'date', 'tamarind', 'acai', 'acerola',
      'soursop', 'guanabana', 'sapote', 'kiwi', 'kiwifruit', 'coconut', 'avocado',
      'olive', 'elderberry', 'currant', 'gooseberry', 'quince', 'mulberry'
    ]
  },
  {
    id: 'grain',
    label: 'Grains and pseudocereals',
    note: 'Beyond oats, rice and quinoa the shelf is bare.',
    foods: [
      'oat', 'oats', 'rice', 'brown rice', 'basmati rice', 'jasmine rice', 'wild rice',
      'wheat', 'whole wheat', 'durum wheat', 'semolina', 'spelt', 'einkorn', 'emmer',
      'farro', 'kamut', 'barley', 'rye', 'triticale', 'corn', 'cornmeal', 'masa',
      'hominy', 'polenta', 'quinoa', 'amaranth', 'buckwheat', 'millet', 'teff',
      'sorghum', 'fonio', 'freekeh', 'bulgur', 'couscous', 'job’s tears'
    ]
  },
  {
    id: 'legume',
    label: 'Legumes and pulses',
    note: 'The cheapest protein on earth, half of it unrecognised.',
    foods: [
      'black bean', 'pinto bean', 'kidney bean', 'navy bean', 'cannellini bean',
      'great northern bean', 'lima bean', 'butter bean', 'fava bean', 'broad bean',
      'mung bean', 'adzuki bean', 'black-eyed pea', 'cowpea', 'pigeon pea', 'toor dal',
      'chana dal', 'urad dal', 'masoor dal', 'moong dal', 'lentil', 'red lentil',
      'green lentil', 'brown lentil', 'beluga lentil', 'chickpea', 'garbanzo bean',
      'split pea', 'green pea', 'snow pea', 'snap pea', 'edamame', 'soybean', 'lupini',
      'peanut', 'tofu', 'tempeh', 'natto', 'miso'
    ]
  },
  {
    id: 'nut_seed',
    label: 'Nuts and seeds',
    note: 'Reasonably covered; the regional ones are missing.',
    foods: [
      'almond', 'walnut', 'pecan', 'cashew', 'pistachio', 'hazelnut', 'filbert',
      'macadamia', 'brazil nut', 'pine nut', 'chestnut', 'peanut', 'tiger nut',
      'sunflower seed', 'pumpkin seed', 'pepita', 'chia seed', 'flaxseed', 'linseed',
      'hemp seed', 'sesame seed', 'poppy seed', 'nigella seed', 'watermelon seed',
      'tahini', 'almond butter', 'peanut butter', 'cashew butter', 'sunflower butter'
    ]
  },
  {
    id: 'herb',
    label: 'Herbs',
    note: 'Fresh herbs are food, not flavouring, and mostly unrecognised.',
    foods: [
      'basil', 'thai basil', 'parsley', 'cilantro', 'coriander leaf', 'mint',
      'spearmint', 'peppermint', 'oregano', 'thyme', 'rosemary', 'sage', 'dill',
      'tarragon', 'marjoram', 'bay leaf', 'chervil', 'lemongrass', 'curry leaf',
      'kaffir lime leaf', 'shiso', 'epazote', 'lovage'
    ]
  },
  {
    id: 'spice',
    label: 'Spices',
    note: 'The single largest gap: almost none of these resolve.',
    foods: [
      'cumin', 'coriander', 'turmeric', 'ginger', 'cinnamon', 'cassia', 'cardamom',
      'clove', 'nutmeg', 'mace', 'allspice', 'star anise', 'anise', 'fennel seed',
      'caraway', 'mustard seed', 'fenugreek', 'asafoetida', 'hing', 'black pepper',
      'white pepper', 'sichuan pepper', 'sumac', 'za’atar', 'saffron', 'vanilla',
      'vanilla bean', 'juniper berry', 'annatto seed', 'galangal', 'ajwain',
      'amchur', 'garam masala', 'curry powder', 'chili powder', 'smoked paprika',
      'harissa', 'ras el hanout', 'berbere', 'dukkah', 'furikake'
    ]
  },
  {
    id: 'animal_protein',
    label: 'Meat, poultry and eggs',
    note: 'Common cuts are in; organ meats and game are not.',
    foods: [
      'chicken', 'chicken breast', 'chicken thigh', 'turkey', 'duck', 'goose', 'quail',
      'beef', 'ground beef', 'steak', 'brisket', 'pork', 'ham', 'bacon', 'lamb',
      'mutton', 'goat', 'veal', 'bison', 'venison', 'elk', 'rabbit', 'liver',
      'chicken liver', 'beef liver', 'heart', 'kidney', 'tripe', 'bone broth',
      'egg', 'egg white', 'egg yolk', 'duck egg', 'quail egg'
    ]
  },
  {
    id: 'seafood',
    label: 'Fish and shellfish',
    note: 'A handful of fish names stand in for an entire aisle.',
    foods: [
      'salmon', 'tuna', 'cod', 'haddock', 'halibut', 'tilapia', 'trout', 'mackerel',
      'sardine', 'anchovy', 'herring', 'bass', 'snapper', 'grouper', 'catfish',
      'pollock', 'sole', 'flounder', 'swordfish', 'mahi mahi', 'barramundi',
      'shrimp', 'prawn', 'crab', 'lobster', 'crawfish', 'scallop', 'oyster', 'clam',
      'mussel', 'squid', 'calamari', 'octopus', 'roe', 'caviar'
    ]
  },
  {
    id: 'dairy_ferment',
    label: 'Dairy and ferments',
    note: 'Ferments are a distinct food class with almost no coverage.',
    foods: [
      'milk', 'whole milk', 'skim milk', 'cream', 'heavy cream', 'sour cream',
      'creme fraiche', 'butter', 'ghee', 'yogurt', 'greek yogurt', 'skyr', 'kefir',
      'labneh', 'quark', 'cottage cheese', 'ricotta', 'mozzarella', 'cheddar',
      'parmesan', 'feta', 'halloumi', 'paneer', 'goat cheese', 'blue cheese',
      'sauerkraut', 'kimchi', 'kombucha', 'kvass', 'sourdough starter'
    ]
  },
  {
    id: 'plant_milk',
    label: 'Plant milks and alternatives',
    note: 'An entire modern category, unaddressed.',
    foods: [
      'almond milk', 'oat milk', 'soy milk', 'coconut milk', 'cashew milk',
      'rice milk', 'hemp milk', 'pea milk', 'macadamia milk', 'coconut cream',
      'coconut water'
    ]
  },
  {
    id: 'staple_global',
    label: 'Global staples',
    note: 'Foods eaten daily by billions, invisible to the table.',
    foods: [
      'injera', 'tortilla', 'corn tortilla', 'roti', 'chapati', 'naan', 'pita',
      'rice noodle', 'soba', 'udon', 'ramen noodle', 'vermicelli', 'couscous',
      'polenta', 'grits', 'congee', 'poi', 'fufu', 'ugali', 'arepa', 'mochi',
      'seitan', 'wheat gluten'
    ]
  },
  {
    id: 'whole_sweetener_fat',
    label: 'Whole-food sweeteners and fats',
    note: 'Distinct from added sugar and from refined oil; both roles already exist.',
    foods: [
      'honey', 'raw honey', 'maple syrup', 'date syrup', 'molasses', 'blackstrap molasses',
      'olive oil', 'extra virgin olive oil', 'avocado oil', 'coconut oil', 'sesame oil',
      'walnut oil', 'flaxseed oil', 'duck fat', 'tallow', 'lard', 'schmaltz'
    ]
  }
];

/** Every food in the checklist, deduplicated. */
export function allTaxonomyFoods(): string[] {
  return [...new Set(FOOD_TAXONOMY.flatMap((category) => category.foods))];
}
