#!/usr/bin/env node
/**
 * Builds the restaurant foods that ship inside the app, from USDA FoodData Central.
 *
 * Open Food Facts, the only catalogue the phone app can reach without a server, is a
 * packaged-goods database and has almost no restaurant meals. USDA SR Legacy does: its
 * "Fast Foods" and "Restaurant Foods" groups hold several hundred chain and sit-down
 * dishes, each with lab or label nutrients per 100 g and the weight of a real serving.
 * As a work of the US government the data is public domain, so it can be checked in.
 *
 * The bulk CSV download needs no API key:
 *
 *   curl -fsSLo sr.zip https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_csv_2018-04.zip
 *   unzip -q sr.zip -d sr
 *   node scripts/build-restaurant-foods.mjs sr
 *
 * The "Build restaurant foods" GitHub workflow does exactly this and commits the result.
 * Output is src/features/nutrition/productLookup/generatedRestaurantFoods.ts.
 *
 * SR Legacy was last released in April 2018, so these are the menus as USDA measured them
 * then. The app says so next to every row; nothing here claims to be a chain's current
 * menu.
 */

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const OUTPUT = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..', 'src', 'features', 'nutrition', 'productLookup', 'generatedRestaurantFoods.ts'
);

export const CATEGORY_PATTERN = /^(fast foods|restaurant foods)$/i;

/** FDC nutrient ids, in the column order the generated rows use. */
export const NUTRIENT_COLUMNS = [
  ['kcal', 1008],
  ['protein_g', 1003],
  ['carbs_g', 1005],
  ['fat_g', 1004],
  ['fiber_g', 1079],
  ['sugar_g', 2000],
  ['saturated_fat_g', 1258],
  ['sodium_mg', 1093]
];

/** One CSV line into fields: quoted fields may hold commas and doubled quotes. */
export function parseCsvLine(line) {
  const fields = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (quoted) {
      if (char === '"' && line[i + 1] === '"') { field += '"'; i += 1; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') { fields.push(field); field = ''; }
    else field += char;
  }
  fields.push(field);
  return fields;
}

/** Rows of a CSV as objects keyed by its header. Quoted newlines do not occur in FDC files. */
export async function* readCsv(file) {
  const lines = readline.createInterface({ input: fs.createReadStream(file), crlfDelay: Infinity });
  let header = null;
  for await (const raw of lines) {
    const line = raw.replace(/^﻿/, '');
    if (!line.trim()) continue;
    const fields = parseCsvLine(line);
    if (!header) { header = fields; continue; }
    yield Object.fromEntries(header.map((name, index) => [name, fields[index] ?? '']));
  }
}

function findFile(dir, name) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const found = findFile(full, name);
      if (found) return found;
    } else if (entry.name === name) return full;
  }
  return null;
}

const number = (value) => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) / 100 : null;
};

/** "1 sandwich", "1 serving 6 pieces": the words a person would pick a portion by. */
export function portionLabel(portion, unitName) {
  const described = portion.portion_description?.trim();
  if (described) return described;
  const unit = unitName && unitName !== 'undetermined' ? unitName : '';
  return [number(portion.amount) ?? '', unit, portion.modifier?.trim() ?? ''].filter((part) => part !== '' && part !== null).join(' ').trim();
}

/**
 * Assemble generated rows from parsed tables. Pure, so it is tested without a download.
 * Row shape: [fdcId, description, category, ...NUTRIENT_COLUMNS values, portions].
 */
export function buildRows({ foods, categories, nutrients, portions, units }) {
  const wanted = new Map(categories.filter((c) => CATEGORY_PATTERN.test(c.description.trim())).map((c) => [c.id, c.description.trim()]));
  const selected = foods.filter((food) => wanted.has(food.food_category_id) && food.description.trim());
  const ids = new Set(selected.map((food) => food.fdc_id));
  const nutrientIndex = new Map(NUTRIENT_COLUMNS.map(([, id], index) => [String(id), index]));
  const values = new Map();
  for (const row of nutrients) {
    if (!ids.has(row.fdc_id)) continue;
    const index = nutrientIndex.get(row.nutrient_id);
    if (index === undefined) continue;
    const list = values.get(row.fdc_id) ?? Array(NUTRIENT_COLUMNS.length).fill(null);
    list[index] = number(row.amount);
    values.set(row.fdc_id, list);
  }
  const unitNames = new Map(units.map((unit) => [unit.id, unit.name]));
  const servings = new Map();
  for (const portion of [...portions].sort((a, b) => Number(a.seq_num) - Number(b.seq_num))) {
    if (!ids.has(portion.fdc_id)) continue;
    const grams = number(portion.gram_weight);
    const label = portionLabel(portion, unitNames.get(portion.measure_unit_id));
    if (!grams || !label) continue;
    const list = servings.get(portion.fdc_id) ?? [];
    if (!list.some(([existing]) => existing === label)) list.push([label, grams]);
    servings.set(portion.fdc_id, list);
  }
  return selected
    .map((food) => [Number(food.fdc_id), food.description.trim(), wanted.get(food.food_category_id), ...(values.get(food.fdc_id) ?? Array(NUTRIENT_COLUMNS.length).fill(null)), servings.get(food.fdc_id) ?? []])
    // A row without energy cannot be logged meaningfully; leave it to the online sources.
    .filter((row) => row[3] !== null)
    .sort((a, b) => a[1].localeCompare(b[1]));
}

export function render(rows, provenance) {
  const body = rows.map((row) => `  ${JSON.stringify(row)}`).join(',\n');
  return `/**
 * Restaurant and fast-food dishes generated from USDA FoodData Central SR Legacy by
 * scripts/build-restaurant-foods.mjs. Do not edit by hand; run the "Build restaurant
 * foods" GitHub workflow instead.
 *
 * USDA data is a work of the US government and public domain. SR Legacy's last release
 * was April 2018, so rows describe dishes as measured then, not a chain's current menu.
 * Nutrients are per 100 g; null means USDA did not report it, never zero.
 *
 * ${provenance}
 */
import type { RestaurantFoodRow } from './restaurantFoodTypes';

export const RESTAURANT_FOODS: readonly RestaurantFoodRow[] = [
${body}
];
`;
}

async function collect(file, keep = () => true) {
  const rows = [];
  for await (const row of readCsv(file)) if (keep(row)) rows.push(row);
  return rows;
}

async function main() {
  const dir = process.argv[2];
  if (!dir || !fs.existsSync(dir)) {
    console.error('Usage: node scripts/build-restaurant-foods.mjs <unzipped SR Legacy CSV folder>');
    process.exit(1);
  }
  const file = (name) => {
    const found = findFile(dir, name);
    if (!found) { console.error(`${name} not found under ${dir}`); process.exit(1); }
    return found;
  };
  const categories = await collect(file('food_category.csv'));
  const foods = await collect(file('food.csv'));
  const wantedIds = new Set(categories.filter((c) => CATEGORY_PATTERN.test(c.description.trim())).map((c) => c.id));
  if (!wantedIds.size) { console.error('No "Fast Foods" or "Restaurant Foods" category in food_category.csv.'); process.exit(1); }
  const fdcIds = new Set(foods.filter((f) => wantedIds.has(f.food_category_id)).map((f) => f.fdc_id));
  const nutrientIds = new Set(NUTRIENT_COLUMNS.map(([, id]) => String(id)));
  const nutrients = await collect(file('food_nutrient.csv'), (row) => fdcIds.has(row.fdc_id) && nutrientIds.has(row.nutrient_id));
  const portions = await collect(file('food_portion.csv'), (row) => fdcIds.has(row.fdc_id));
  const unitsFile = findFile(dir, 'measure_unit.csv');
  const units = unitsFile ? await collect(unitsFile) : [];

  const rows = buildRows({ foods, categories, nutrients, portions, units });
  if (rows.length < 50) { console.error(`Only ${rows.length} rows built; refusing to overwrite the checked-in list.`); process.exit(1); }
  const withServing = rows.filter((row) => row[row.length - 1].length).length;
  const provenance = `Generated ${new Date().toISOString().slice(0, 10)}: ${rows.length} dishes, ${withServing} with a serving weight.`;
  fs.writeFileSync(OUTPUT, render(rows, provenance));
  console.log(`${provenance} Wrote ${path.relative(process.cwd(), OUTPUT)}.`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  await main();
}
