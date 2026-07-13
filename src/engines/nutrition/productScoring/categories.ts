export type ProductCategory = {
  id: string;
  label: string;
  keywords: string[];
  typicalScore: number;
};

export const CATEGORY_SCORE_SLOPE = 0.8;

export const PRODUCT_CATEGORIES: ProductCategory[] = [
  { id: 'soda', label: 'Soda and soft drinks', typicalScore: 22, keywords: ['soda', 'cola', 'soft drink', 'root beer', 'energy drink'] },
  { id: 'chips', label: 'Chips and salty snacks', typicalScore: 38, keywords: ['tortilla chips', 'potato chips', 'chips', 'crisps', 'puffs'] },
  { id: 'crackers', label: 'Crackers', typicalScore: 42, keywords: ['crackers', 'cracker'] },
  { id: 'bars', label: 'Snack and protein bars', typicalScore: 44, keywords: ['granola bar', 'protein bar', 'snack bar', 'energy bar'] },
  { id: 'cookies', label: 'Cookies and sweet baked goods', typicalScore: 30, keywords: ['sandwich cookie', 'cookies', 'cookie', 'wafers', 'brownie'] },
  { id: 'candy', label: 'Candy', typicalScore: 24, keywords: ['candy', 'gummies', 'gummy', 'chews'] },
  { id: 'cereal', label: 'Cereal and granola', typicalScore: 44, keywords: ['cereal', 'granola', 'muesli', 'oatmeal'] },
  { id: 'bread', label: 'Bread and tortillas', typicalScore: 52, keywords: ['tortillas', 'bread', 'bagel', 'buns', 'pita'] },
  { id: 'yogurt', label: 'Yogurt and cultured dairy', typicalScore: 68, keywords: ['yogurt', 'yoghurt', 'kefir', 'skyr'] },
  { id: 'chocolate', label: 'Chocolate', typicalScore: 48, keywords: ['chocolate', 'cacao', 'cocoa'] },
  { id: 'rice', label: 'Rice products', typicalScore: 62, keywords: ['rice cakes', 'rice crackers', 'rice'] },
  { id: 'protein_powder', label: 'Protein powder', typicalScore: 52, keywords: ['protein powder', 'protein isolate powder', 'whey protein', 'plant protein'] },
  { id: 'condiments', label: 'Condiments and sauces', typicalScore: 46, keywords: ['ketchup', 'mayonnaise', 'mayo', 'dressing', 'sauce', 'condiment', 'mustard'] },
  { id: 'juice', label: 'Juice and fruit drinks', typicalScore: 48, keywords: ['juice', 'lemonade', 'fruit drink'] },
  { id: 'frozen', label: 'Frozen meals', typicalScore: 42, keywords: ['frozen pizza', 'frozen meal', 'frozen entree'] },
  { id: 'nut_butter', label: 'Nut butters', typicalScore: 64, keywords: ['peanut butter', 'almond butter', 'nut butter', 'tahini'] },
  { id: 'jerky', label: 'Jerky and meat snacks', typicalScore: 52, keywords: ['jerky', 'meat stick', 'meat snack', 'biltong'] },
  { id: 'oil', label: 'Cooking oils and fats', typicalScore: 72, keywords: ['olive oil', 'cooking oil', 'ghee', 'butter'] }
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
      if (searchable.includes(keyword) && (!best || keyword.length > best.length)) {
        best = { category, length: keyword.length };
      }
    }
  }
  return best?.category ?? null;
}
