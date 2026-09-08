export type ProductForm =
  | 'ready_to_eat'
  | 'beverage'
  | 'powder_mix'
  | 'pantry_staple'
  | 'salt'
  | 'condiment_or_sauce'
  | 'frozen_dessert';

export type ProductCategory = {
  id: string;
  label: string;
  keywords: string[];
  broadKeywords?: string[];
  form: ProductForm;
  expectedSodium?: boolean;
  dessertContext?: boolean;
  proteinContext?: boolean;
  compatibilityMode?: 'commodity';
};

export const PRODUCT_CATEGORIES: ProductCategory[] = [
  { id: 'salt', label: 'Salt and mineral pantry staples', form: 'salt', expectedSodium: true, compatibilityMode: 'commodity', keywords: ['iodized salt', 'table salt', 'sea salt', 'mineral salt', 'himalayan salt', 'pink salt', 'salt'], broadKeywords: ['salt'] },
  { id: 'low_sodium_salt', label: 'Low-sodium salt substitute', form: 'salt', expectedSodium: true, compatibilityMode: 'commodity', keywords: ['potassium chloride', 'salt substitute', 'low sodium salt'] },
  { id: 'electrolyte', label: 'Electrolyte and hydration mix', form: 'powder_mix', expectedSodium: true, keywords: ['electrolyte', 'hydration mix', 'hydration powder'] },
  { id: 'plant_milk', label: 'Plant milk', form: 'beverage', keywords: ['almond milk', 'oat milk', 'cashew milk', 'coconut milk beverage', 'plant milk'] },
  { id: 'marinara', label: 'Pasta sauce and marinara', form: 'condiment_or_sauce', expectedSodium: true, keywords: ['marinara', 'pasta sauce', 'tomato sauce'] },
  { id: 'ice_cream', label: 'Ice cream', form: 'frozen_dessert', dessertContext: true, keywords: ['ice cream', 'gelato'] },
  { id: 'frozen_dairy_dessert', label: 'Frozen dairy dessert', form: 'frozen_dessert', dessertContext: true, keywords: ['frozen dairy dessert', 'frozen dessert', 'ice cream cone'], broadKeywords: ['frozen dessert'] },
  { id: 'prebiotic_soda', label: 'Prebiotic soda', form: 'beverage', keywords: ['prebiotic soda', 'prebiotic sparkling', 'sparkling tonic'] },
  { id: 'still_water', label: 'Still water', form: 'beverage', keywords: ['still water', 'spring water', 'drinking water', 'purified water', 'bottled water', 'waters', 'water'], broadKeywords: ['waters', 'water'] },
  { id: 'sparkling_water', label: 'Sparkling water', form: 'beverage', keywords: ['unsweetened sparkling water', 'sparkling mineral water', 'sparkling water', 'carbonated water', 'seltzer water', 'seltzer'] },
  { id: 'energy_drink', label: 'Energy drinks', form: 'beverage', keywords: ['zero sugar energy drink', 'sugar free energy drink', 'energy drink', 'energy beverage', 'power drink'] },
  { id: 'electrolyte_beverage', label: 'Electrolyte and sports beverages', form: 'beverage', expectedSodium: true, keywords: ['zero sugar electrolyte drink', 'electrolyte beverage', 'electrolyte drink', 'sports drink', 'hydration drink', 'thirst quencher'] },
  {
    id: 'soda',
    label: 'Soda and soft drinks',
    form: 'beverage',
    keywords: [
      'carbonated soft drink', 'zero sugar cola', 'sugar free cola',
      'diet cola', 'zero sugar soda', 'sugar free soda', 'diet soda', 'root beer', 'soft drink', 'cola', 'soda'
    ],
    broadKeywords: ['soda', 'soft drink']
  },
  { id: 'pasta', label: 'Pasta and legume pasta', form: 'pantry_staple', proteinContext: true, keywords: ['chickpea pasta', 'legume pasta', 'protein pasta', 'pasta'] },
  { id: 'pancake_mix', label: 'Pancake and waffle mixes', form: 'pantry_staple', keywords: ['pancake mix', 'waffle mix', 'flapjack mix', 'pancake and waffle mix'] },
  { id: 'bread', label: 'Bread', form: 'ready_to_eat', keywords: ['multigrain sliced bread', 'whole grain bread', 'sliced bread', 'bread'] },
  { id: 'soup', label: 'Soup', form: 'ready_to_eat', expectedSodium: true, keywords: ['lentil soup', 'vegetable soup', 'canned soup', 'soup'] },
  { id: 'broth', label: 'Broth and stock', form: 'ready_to_eat', expectedSodium: true, proteinContext: true, keywords: ['bone broth', 'chicken broth', 'vegetable broth', 'beef broth', 'stock'] },
  { id: 'tofu', label: 'Tofu and simple soy foods', form: 'ready_to_eat', proteinContext: true, keywords: ['extra firm tofu', 'firm tofu', 'silken tofu', 'tofu'] },
  { id: 'canned_fish', label: 'Canned fish', form: 'ready_to_eat', expectedSodium: true, proteinContext: true, keywords: ['albacore tuna', 'canned tuna', 'tuna in water', 'canned salmon', 'sardines', 'tuna'] },
  { id: 'plant_based_meat', label: 'Plant-based meat alternatives', form: 'ready_to_eat', proteinContext: true, keywords: ['plant based burger', 'veggie burger', 'meatless burger', 'plant based meat'] },
  { id: 'prepared_meat', label: 'Prepared meat and poultry', form: 'ready_to_eat', expectedSodium: true, proteinContext: true, keywords: ['turkey breast', 'prepared meat', 'deli meat', 'lunch meat', 'sliced turkey', 'sliced chicken'] },
  { id: 'cereal_bar', label: 'Cereal and granola bars', form: 'ready_to_eat', keywords: ['cereal bar', 'granola bar', 'oat bar'] },
  { id: 'cereal', label: 'Cereal and protein cereal', form: 'ready_to_eat', proteinContext: true, keywords: ['protein cereal', 'breakfast cereal', 'extruded cereal', 'cereal', 'granola', 'muesli'], broadKeywords: ['cereal'] },
  { id: 'yogurt', label: 'Yogurt and cultured dairy', form: 'ready_to_eat', proteinContext: true, keywords: ['zero sugar yogurt', 'yogurt', 'yoghurt', 'kefir', 'skyr'] },
  { id: 'cottage_cheese', label: 'Cottage cheese and cultured dairy', form: 'ready_to_eat', expectedSodium: true, proteinContext: true, keywords: ['cottage cheese'] },
  { id: 'crackers', label: 'Crackers', form: 'ready_to_eat', expectedSodium: true, keywords: ['crackers', 'cracker'] },
  { id: 'protein_chip', label: 'Protein chip and protein snack', form: 'ready_to_eat', proteinContext: true, keywords: ['protein chips', 'protein chip', 'protein puffs', 'protein snack'] },
  { id: 'ready_to_drink_protein', label: 'Ready-to-drink protein', form: 'beverage', proteinContext: true, keywords: ['protein shake', 'protein drink', 'ready to drink protein'] },
  { id: 'chocolate', label: 'Chocolate and confection', form: 'ready_to_eat', dessertContext: true, keywords: ['chocolate', 'cacao', 'cocoa', 'confection'] },
  { id: 'meat_snack', label: 'Meat snack', form: 'ready_to_eat', expectedSodium: true, proteinContext: true, keywords: ['jerky', 'meat stick', 'meat snack', 'biltong'] },
  { id: 'protein_bar', label: 'Protein bar', form: 'ready_to_eat', proteinContext: true, keywords: ['protein bar', 'snack bar', 'energy bar'] },
  { id: 'protein_powder', label: 'Protein powder', form: 'powder_mix', proteinContext: true, keywords: ['protein powder', 'protein isolate', 'whey protein', 'plant protein'] },
  { id: 'juice', label: 'Juice and fruit drinks', form: 'beverage', keywords: ['juice', 'lemonade', 'fruit drink'] },
  { id: 'chips', label: 'Chips and salty snacks', form: 'ready_to_eat', expectedSodium: true, keywords: ['tortilla chips', 'potato chips', 'chips', 'crisps', 'puffs'], broadKeywords: ['chips', 'puffs'] },
  { id: 'cookies', label: 'Cookies and sweet baked goods', form: 'ready_to_eat', dessertContext: true, keywords: ['sandwich cookie', 'cookies', 'cookie', 'wafers', 'brownie'] },
  { id: 'condiments', label: 'Condiments and sauces', form: 'condiment_or_sauce', expectedSodium: true, keywords: ['ketchup', 'mayonnaise', 'mayo', 'dressing', 'sauce', 'condiment', 'mustard'], broadKeywords: ['sauce', 'condiment'] }
];

export function detectProductCategory(
  explicit?: string | null,
  name?: string | null,
  categoryTags: string[] = []
): ProductCategory | null {
  const explicitId = explicit?.trim().toLowerCase();
  if (explicitId) {
    const exact = PRODUCT_CATEGORIES.find((category) => category.id === explicitId);
    if (exact) return exact;
  }

  const searchable = [explicit, name, ...categoryTags].filter(Boolean).join(' | ').toLowerCase();
  let best: { category: ProductCategory; length: number } | null = null;
  for (const category of PRODUCT_CATEGORIES) {
    for (const keyword of category.keywords) {
      if (searchable.includes(keyword) && (!best || keyword.length > best.length)) best = { category, length: keyword.length };
    }
  }
  return best?.category ?? null;
}

export function categoryInterpretationConfidence(
  category: ProductCategory | null,
  explicit?: string | null,
  name?: string | null,
  categoryTags: string[] = []
): 'low' | 'medium' | 'high' {
  if (!category) return 'low';
  const terms = [explicit, ...categoryTags].filter(Boolean).join(' ').toLowerCase();
  if (terms.includes(category.id.replaceAll('_', ' ')) || category.keywords.some((keyword) => terms.includes(keyword))) return 'high';
  return category.keywords.some((keyword) => (name ?? '').toLowerCase().includes(keyword)) ? 'medium' : 'low';
}
