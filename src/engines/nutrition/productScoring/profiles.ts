import { PRODUCT_CATEGORIES, type ProductCategory, type ProductForm } from './categories';

export const RULE_FAMILIES = [
  'sugar_density',
  'sodium_density',
  'calorie_density',
  'fat_density',
  'protein_density',
  'fiber_density',
  'flavor_systems',
  'sweeteners',
  'oils',
  'emulsifiers_gums',
  'colors',
  'refined_syrups',
  'ingredient_simplicity',
  'claim_alignment'
] as const;

export type RuleFamily = typeof RULE_FAMILIES[number];
export type RulePolicyStatus = 'apply' | 'suppress' | 'context_only' | 'unavailable';
export type NutrientBasisPreference = 'per_serving' | 'per_100g' | 'prepared_serving' | 'pantry_context';

export type CategoryProfile = {
  categoryId: string;
  productForm: ProductForm;
  nutrientBasis: NutrientBasisPreference;
  rulePolicy: Record<RuleFamily, RulePolicyStatus>;
  ruleOverrides?: Record<string, RulePolicyStatus>;
};

function allUnavailable(): Record<RuleFamily, RulePolicyStatus> {
  return Object.fromEntries(RULE_FAMILIES.map((family) => [family, 'unavailable'])) as Record<RuleFamily, RulePolicyStatus>;
}

function policy(overrides: Partial<Record<RuleFamily, RulePolicyStatus>>): Record<RuleFamily, RulePolicyStatus> {
  return { ...allUnavailable(), ...overrides };
}

function profile(
  category: ProductCategory,
  nutrientBasis: NutrientBasisPreference,
  overrides: Partial<Record<RuleFamily, RulePolicyStatus>>,
  ruleOverrides?: Record<string, RulePolicyStatus>
): CategoryProfile {
  return { categoryId: category.id, productForm: category.form, nutrientBasis, rulePolicy: policy(overrides), ruleOverrides };
}

const BY_ID = Object.fromEntries(PRODUCT_CATEGORIES.map((category) => [category.id, category])) as Record<string, ProductCategory>;
const category = (id: string): ProductCategory => BY_ID[id]!;

const dessertPolicy: Partial<Record<RuleFamily, RulePolicyStatus>> = {
  sugar_density: 'context_only', calorie_density: 'context_only', fat_density: 'context_only',
  flavor_systems: 'apply', sweeteners: 'context_only', oils: 'apply', emulsifiers_gums: 'apply', colors: 'apply',
  refined_syrups: 'context_only', ingredient_simplicity: 'apply', claim_alignment: 'apply'
};

const formulatedSnackPolicy: Partial<Record<RuleFamily, RulePolicyStatus>> = {
  sodium_density: 'context_only', flavor_systems: 'apply', sweeteners: 'context_only', oils: 'apply',
  emulsifiers_gums: 'apply', colors: 'apply', refined_syrups: 'apply', ingredient_simplicity: 'apply', claim_alignment: 'apply',
  protein_density: 'suppress', fiber_density: 'suppress', calorie_density: 'suppress', fat_density: 'suppress'
};

export const CATEGORY_PROFILES: Record<string, CategoryProfile> = {
  salt: profile(category('salt'), 'pantry_context', {
    sodium_density: 'context_only', calorie_density: 'suppress', fat_density: 'suppress', protein_density: 'suppress', fiber_density: 'suppress',
    sugar_density: 'suppress', flavor_systems: 'suppress', sweeteners: 'suppress', oils: 'unavailable', emulsifiers_gums: 'apply',
    colors: 'apply', refined_syrups: 'context_only', ingredient_simplicity: 'apply', claim_alignment: 'apply'
  }, { added_sugar: 'suppress' }),
  low_sodium_salt: profile(category('low_sodium_salt'), 'pantry_context', {
    sodium_density: 'context_only', calorie_density: 'suppress', fat_density: 'suppress', protein_density: 'suppress', fiber_density: 'suppress',
    sugar_density: 'suppress', flavor_systems: 'suppress', sweeteners: 'suppress', oils: 'unavailable', emulsifiers_gums: 'apply',
    colors: 'apply', refined_syrups: 'context_only', ingredient_simplicity: 'apply', claim_alignment: 'context_only'
  }),
  electrolyte: profile(category('electrolyte'), 'prepared_serving', {
    sodium_density: 'context_only', sugar_density: 'context_only', calorie_density: 'suppress', fat_density: 'suppress',
    protein_density: 'suppress', fiber_density: 'suppress', flavor_systems: 'context_only', sweeteners: 'context_only',
    oils: 'unavailable', emulsifiers_gums: 'apply', colors: 'apply', refined_syrups: 'apply', ingredient_simplicity: 'apply', claim_alignment: 'apply'
  }),
  plant_milk: profile(category('plant_milk'), 'per_serving', {
    sugar_density: 'apply', sodium_density: 'context_only', calorie_density: 'context_only', fat_density: 'context_only',
    protein_density: 'suppress', fiber_density: 'context_only', flavor_systems: 'context_only', sweeteners: 'context_only', oils: 'apply',
    emulsifiers_gums: 'apply', colors: 'apply', refined_syrups: 'apply', ingredient_simplicity: 'apply', claim_alignment: 'apply'
  }),
  marinara: profile(category('marinara'), 'per_serving', {
    sugar_density: 'context_only', sodium_density: 'context_only', calorie_density: 'suppress', fat_density: 'context_only',
    protein_density: 'suppress', fiber_density: 'context_only', flavor_systems: 'context_only', sweeteners: 'context_only', oils: 'apply',
    emulsifiers_gums: 'apply', colors: 'apply', refined_syrups: 'apply', ingredient_simplicity: 'apply', claim_alignment: 'apply'
  }, { ingredient_complexity: 'suppress' }),
  ice_cream: profile(category('ice_cream'), 'per_serving', dessertPolicy),
  frozen_dairy_dessert: profile(category('frozen_dairy_dessert'), 'per_serving', dessertPolicy),
  prebiotic_soda: profile(category('prebiotic_soda'), 'per_serving', {
    sugar_density: 'apply', sodium_density: 'suppress', calorie_density: 'context_only', fat_density: 'suppress', protein_density: 'suppress',
    fiber_density: 'suppress', flavor_systems: 'context_only', sweeteners: 'context_only', oils: 'apply', emulsifiers_gums: 'apply',
    colors: 'apply', refined_syrups: 'apply', ingredient_simplicity: 'apply', claim_alignment: 'apply'
  }, { prebiotic_fiber: 'suppress' }),
  still_water: profile(category('still_water'), 'per_serving', {
    sugar_density: 'suppress', sodium_density: 'context_only', calorie_density: 'suppress', fat_density: 'suppress',
    protein_density: 'suppress', fiber_density: 'suppress', flavor_systems: 'suppress', sweeteners: 'suppress',
    oils: 'unavailable', emulsifiers_gums: 'suppress', colors: 'suppress', refined_syrups: 'suppress',
    ingredient_simplicity: 'apply', claim_alignment: 'apply'
  }),
  sparkling_water: profile(category('sparkling_water'), 'per_serving', {
    sugar_density: 'apply', sodium_density: 'context_only', calorie_density: 'suppress', fat_density: 'suppress', protein_density: 'suppress',
    fiber_density: 'suppress', flavor_systems: 'context_only', sweeteners: 'context_only', oils: 'unavailable', emulsifiers_gums: 'apply',
    colors: 'apply', refined_syrups: 'apply', ingredient_simplicity: 'apply', claim_alignment: 'apply'
  }),
  energy_drink: profile(category('energy_drink'), 'per_serving', {
    sugar_density: 'apply', sodium_density: 'context_only', calorie_density: 'context_only', fat_density: 'suppress', protein_density: 'suppress',
    fiber_density: 'suppress', flavor_systems: 'apply', sweeteners: 'context_only', oils: 'unavailable', emulsifiers_gums: 'apply',
    colors: 'apply', refined_syrups: 'apply', ingredient_simplicity: 'apply', claim_alignment: 'apply'
  }),
  electrolyte_beverage: profile(category('electrolyte_beverage'), 'per_serving', {
    sugar_density: 'apply', sodium_density: 'context_only', calorie_density: 'suppress', fat_density: 'suppress', protein_density: 'suppress',
    fiber_density: 'suppress', flavor_systems: 'apply', sweeteners: 'context_only', oils: 'unavailable', emulsifiers_gums: 'apply',
    colors: 'apply', refined_syrups: 'apply', ingredient_simplicity: 'apply', claim_alignment: 'apply'
  }),
  soda: profile(category('soda'), 'per_serving', {
    sugar_density: 'apply', sodium_density: 'suppress', calorie_density: 'context_only', fat_density: 'suppress', protein_density: 'suppress',
    fiber_density: 'suppress', flavor_systems: 'context_only', sweeteners: 'context_only', oils: 'apply', emulsifiers_gums: 'apply',
    colors: 'apply', refined_syrups: 'apply', ingredient_simplicity: 'apply', claim_alignment: 'apply'
  }, { prebiotic_fiber: 'suppress' }),
  pasta: profile(category('pasta'), 'per_serving', {
    sugar_density: 'context_only', sodium_density: 'context_only', calorie_density: 'context_only', fat_density: 'context_only',
    protein_density: 'context_only', fiber_density: 'context_only', flavor_systems: 'apply', sweeteners: 'context_only',
    oils: 'apply', emulsifiers_gums: 'apply', colors: 'apply', refined_syrups: 'apply', ingredient_simplicity: 'apply', claim_alignment: 'apply'
  }),
  pancake_mix: profile(category('pancake_mix'), 'prepared_serving', {
    sugar_density: 'apply', sodium_density: 'context_only', calorie_density: 'context_only', fat_density: 'context_only',
    protein_density: 'context_only', fiber_density: 'context_only', flavor_systems: 'apply', sweeteners: 'context_only',
    oils: 'apply', emulsifiers_gums: 'apply', colors: 'apply', refined_syrups: 'apply',
    ingredient_simplicity: 'apply', claim_alignment: 'apply'
  }),
  bread: profile(category('bread'), 'per_serving', {
    sugar_density: 'apply', sodium_density: 'context_only', calorie_density: 'context_only', fat_density: 'context_only',
    protein_density: 'context_only', fiber_density: 'context_only', flavor_systems: 'apply', sweeteners: 'context_only',
    oils: 'apply', emulsifiers_gums: 'apply', colors: 'apply', refined_syrups: 'apply', ingredient_simplicity: 'apply', claim_alignment: 'apply'
  }),
  soup: profile(category('soup'), 'per_serving', {
    sugar_density: 'context_only', sodium_density: 'context_only', calorie_density: 'context_only', fat_density: 'context_only',
    protein_density: 'context_only', fiber_density: 'context_only', flavor_systems: 'context_only', sweeteners: 'context_only',
    oils: 'apply', emulsifiers_gums: 'apply', colors: 'apply', refined_syrups: 'apply', ingredient_simplicity: 'apply', claim_alignment: 'apply'
  }),
  broth: profile(category('broth'), 'per_serving', {
    sugar_density: 'context_only', sodium_density: 'context_only', calorie_density: 'context_only', fat_density: 'context_only',
    protein_density: 'context_only', fiber_density: 'unavailable', flavor_systems: 'context_only', sweeteners: 'context_only',
    oils: 'apply', emulsifiers_gums: 'apply', colors: 'apply', refined_syrups: 'apply',
    ingredient_simplicity: 'apply', claim_alignment: 'apply'
  }),
  tofu: profile(category('tofu'), 'per_serving', {
    sugar_density: 'context_only', sodium_density: 'context_only', calorie_density: 'context_only', fat_density: 'context_only',
    protein_density: 'context_only', fiber_density: 'context_only', flavor_systems: 'apply', sweeteners: 'context_only',
    oils: 'apply', emulsifiers_gums: 'apply', colors: 'apply', refined_syrups: 'apply',
    ingredient_simplicity: 'apply', claim_alignment: 'apply'
  }),
  canned_fish: profile(category('canned_fish'), 'per_serving', {
    sugar_density: 'suppress', sodium_density: 'context_only', calorie_density: 'context_only', fat_density: 'context_only',
    protein_density: 'context_only', fiber_density: 'unavailable', flavor_systems: 'apply', sweeteners: 'suppress',
    oils: 'context_only', emulsifiers_gums: 'apply', colors: 'apply', refined_syrups: 'suppress',
    ingredient_simplicity: 'apply', claim_alignment: 'apply'
  }),
  plant_based_meat: profile(category('plant_based_meat'), 'per_serving', {
    sugar_density: 'context_only', sodium_density: 'context_only', calorie_density: 'context_only', fat_density: 'context_only',
    protein_density: 'context_only', fiber_density: 'context_only', flavor_systems: 'apply', sweeteners: 'context_only',
    oils: 'apply', emulsifiers_gums: 'apply', colors: 'apply', refined_syrups: 'apply',
    ingredient_simplicity: 'apply', claim_alignment: 'apply'
  }),
  prepared_meat: profile(category('prepared_meat'), 'per_serving', {
    sugar_density: 'context_only', sodium_density: 'context_only', calorie_density: 'context_only', fat_density: 'context_only',
    protein_density: 'context_only', fiber_density: 'unavailable', flavor_systems: 'apply', sweeteners: 'context_only',
    oils: 'apply', emulsifiers_gums: 'apply', colors: 'apply', refined_syrups: 'apply', ingredient_simplicity: 'apply', claim_alignment: 'apply'
  }),
  cereal_bar: profile(category('cereal_bar'), 'per_serving', {
    sugar_density: 'apply', sodium_density: 'context_only', calorie_density: 'context_only', fat_density: 'context_only',
    protein_density: 'context_only', fiber_density: 'context_only', flavor_systems: 'apply', sweeteners: 'context_only',
    oils: 'apply', emulsifiers_gums: 'apply', colors: 'apply', refined_syrups: 'apply', ingredient_simplicity: 'apply', claim_alignment: 'apply'
  }),
  cereal: profile(category('cereal'), 'per_serving', {
    sugar_density: 'apply', sodium_density: 'context_only', calorie_density: 'context_only', fat_density: 'context_only',
    protein_density: 'context_only', fiber_density: 'context_only', flavor_systems: 'apply', sweeteners: 'context_only',
    oils: 'apply', emulsifiers_gums: 'apply', colors: 'apply', refined_syrups: 'apply', ingredient_simplicity: 'apply', claim_alignment: 'apply'
  }, { prebiotic_fiber: 'suppress' }),
  yogurt: profile(category('yogurt'), 'per_serving', {
    sugar_density: 'apply', sodium_density: 'context_only', calorie_density: 'context_only', fat_density: 'context_only', protein_density: 'context_only',
    fiber_density: 'context_only', flavor_systems: 'apply', sweeteners: 'context_only', oils: 'apply', emulsifiers_gums: 'apply',
    colors: 'apply', refined_syrups: 'apply', ingredient_simplicity: 'apply', claim_alignment: 'apply'
  }),
  cottage_cheese: profile(category('cottage_cheese'), 'per_serving', {
    sodium_density: 'context_only', calorie_density: 'context_only', fat_density: 'context_only', protein_density: 'context_only',
    sugar_density: 'context_only', fiber_density: 'unavailable', flavor_systems: 'apply', sweeteners: 'context_only', oils: 'apply',
    emulsifiers_gums: 'apply', colors: 'apply', refined_syrups: 'apply', ingredient_simplicity: 'apply', claim_alignment: 'apply'
  }),
  crackers: profile(category('crackers'), 'per_serving', formulatedSnackPolicy),
  protein_chip: profile(category('protein_chip'), 'per_serving', formulatedSnackPolicy, { fermented_food: 'suppress', prebiotic_fiber: 'suppress' }),
  ready_to_drink_protein: profile(category('ready_to_drink_protein'), 'per_serving', {
    sugar_density: 'apply', sodium_density: 'context_only', calorie_density: 'context_only', fat_density: 'context_only',
    protein_density: 'context_only', fiber_density: 'context_only', flavor_systems: 'apply', sweeteners: 'context_only', oils: 'apply',
    emulsifiers_gums: 'apply', colors: 'apply', refined_syrups: 'apply', ingredient_simplicity: 'apply', claim_alignment: 'apply'
  }, { prebiotic_fiber: 'suppress' }),
  chocolate: profile(category('chocolate'), 'per_serving', dessertPolicy),
  meat_snack: profile(category('meat_snack'), 'per_serving', formulatedSnackPolicy),
  protein_bar: profile(category('protein_bar'), 'per_serving', {
    ...formulatedSnackPolicy, protein_density: 'context_only', fiber_density: 'context_only', sugar_density: 'apply'
  }, { prebiotic_fiber: 'suppress' }),
  protein_powder: profile(category('protein_powder'), 'prepared_serving', {
    sugar_density: 'apply', sodium_density: 'context_only', calorie_density: 'context_only', fat_density: 'context_only',
    protein_density: 'context_only', fiber_density: 'context_only', flavor_systems: 'apply', sweeteners: 'context_only', oils: 'apply',
    emulsifiers_gums: 'apply', colors: 'apply', refined_syrups: 'apply', ingredient_simplicity: 'apply', claim_alignment: 'apply'
  }, { prebiotic_fiber: 'suppress' }),
  juice: profile(category('juice'), 'per_serving', {
    sugar_density: 'context_only', sodium_density: 'suppress', calorie_density: 'context_only', fat_density: 'suppress', protein_density: 'suppress',
    fiber_density: 'context_only', flavor_systems: 'context_only', sweeteners: 'context_only', oils: 'unavailable', emulsifiers_gums: 'apply',
    colors: 'apply', refined_syrups: 'apply', ingredient_simplicity: 'apply', claim_alignment: 'apply'
  }),
  chips: profile(category('chips'), 'per_serving', formulatedSnackPolicy, { traditional_oil: 'suppress' }),
  cookies: profile(category('cookies'), 'per_serving', dessertPolicy),
  condiments: profile(category('condiments'), 'per_serving', {
    sugar_density: 'context_only', sodium_density: 'context_only', calorie_density: 'context_only', fat_density: 'context_only',
    protein_density: 'suppress', fiber_density: 'suppress', flavor_systems: 'apply', sweeteners: 'context_only', oils: 'apply',
    emulsifiers_gums: 'apply', colors: 'apply', refined_syrups: 'apply', ingredient_simplicity: 'apply', claim_alignment: 'apply'
  })
};

export function getCategoryProfile(categoryId: string | null): CategoryProfile | null {
  return categoryId ? CATEGORY_PROFILES[categoryId] ?? null : null;
}
