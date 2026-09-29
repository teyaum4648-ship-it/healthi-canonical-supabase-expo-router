#!/usr/bin/env node
/**
 * Builds the chain-restaurant menu list from MenuStat.
 *
 * MenuStat is the NYC Department of Health's annual collection of the nutrition that the
 * largest US restaurant chains publish for their menus. Its annual files are on Harvard
 * Dataverse (doi:10.7910/DVN/K4NYTR) under CC0, so the data is public domain. The newest
 * year is 2018.
 *
 *   curl -fsSL -o menustat.csv "https://dataverse.harvard.edu/api/access/datafile/6191167?format=original"
 *   node scripts/build-menustat-foods.mjs menustat.csv
 *
 * The "Build restaurant foods" GitHub workflow does exactly this and commits the result.
 * Output is src/features/nutrition/productLookup/generatedMenuStatFoods.ts.
 *
 * Kept: items with a single reported calorie figure. Customisable builds that MenuStat
 * reports only as a range ("340-1175") are left out, because a range is not a portion
 * anybody ate.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseCsvLine } from './build-restaurant-foods.mjs';

const OUTPUT = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..', 'src', 'features', 'nutrition', 'productLookup', 'generatedMenuStatFoods.ts'
);

/** Per-serving nutrient columns, in the order the generated rows use. */
export const NUTRIENT_COLUMNS = ['Calories', 'Protein', 'Carbohydrates', 'Total_Fat', 'Saturated_Fat', 'Dietary_Fiber', 'Sugar', 'Sodium'];

/**
 * Records from CSV text, allowing a quoted field to span lines. Descriptions are free
 * text copied from menus; a line break inside one must not split the record.
 */
export function* csvRecords(text) {
  let pending = '';
  for (const line of text.split(/\r?\n/)) {
    pending = pending ? `${pending}\n${line}` : line;
    if (((pending.match(/"/g) ?? []).length % 2) === 1) continue;
    if (pending.trim()) yield parseCsvLine(pending);
    pending = '';
  }
}

const number = (value) => {
  const text = String(value ?? '').trim();
  if (!/^\d+(\.\d+)?$/.test(text)) return null;
  return Math.round(Number(text) * 10) / 10;
};

/** A reported serving as a quantity in g or mL, converting ounces; null when unusable. */
export function servingMetric(size, unit) {
  const quantity = number(size);
  if (!quantity) return null;
  const u = String(unit ?? '').trim().toLowerCase().replace(/\./g, '');
  if (u === 'g' || u === 'grams' || u === 'gram') return [quantity, 'g'];
  if (u === 'ml' || u === 'milliliters') return [quantity, 'mL'];
  if (u === 'oz') return [Math.round(quantity * 28.3495), 'g'];
  if (u === 'fl oz' || u === 'floz') return [Math.round(quantity * 29.5735), 'mL'];
  return null;
}

/**
 * Rows from parsed records. Pure, so it is tested without a download.
 * Row: [menuItemId, restaurantIndex, name, servingLabel, servingQuantity, servingUnit, ...nutrients].
 */
export function buildRows(records) {
  const [header, ...body] = records;
  const at = Object.fromEntries(header.map((name, index) => [name.trim(), index]));
  for (const needed of ['Menu_Item_ID', 'Restaurant', 'Item_Name', ...NUTRIENT_COLUMNS]) {
    if (!(needed in at)) throw new Error(`MenuStat column missing: ${needed}`);
  }
  const field = (row, name) => (name in at ? String(row[at[name]] ?? '').trim() : '');
  const restaurants = [];
  const restaurantIndex = new Map();
  const seen = new Set();
  const rows = [];
  const units = new Map();
  for (const row of body) {
    const calories = number(field(row, 'Calories'));
    const restaurant = field(row, 'Restaurant');
    const name = field(row, 'Item_Name');
    if (calories === null || !restaurant || !name) continue;
    const key = `${restaurant}|${name}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    if (!restaurantIndex.has(restaurant)) { restaurantIndex.set(restaurant, restaurants.length); restaurants.push(restaurant); }
    const unit = field(row, 'Serving_Size_Unit');
    units.set(unit, (units.get(unit) ?? 0) + 1);
    const metric = servingMetric(field(row, 'Serving_Size'), unit);
    const household = field(row, 'Serving_Size_household') || field(row, 'Serving_Size_text');
    const label = household || (metric ? `${metric[0]} ${metric[1]}` : null);
    rows.push([
      Number(field(row, 'Menu_Item_ID')) || rows.length,
      restaurantIndex.get(restaurant),
      name,
      label || null,
      metric ? metric[0] : null,
      metric ? metric[1] : null,
      calories,
      ...NUTRIENT_COLUMNS.slice(1).map(column => number(field(row, column)))
    ]);
  }
  return { restaurants, rows, units };
}

export function render({ restaurants, rows }, provenance) {
  return `/**
 * Chain-restaurant menu items generated from MenuStat by scripts/build-menustat-foods.mjs.
 * Do not edit by hand; run the "Build restaurant foods" GitHub workflow instead.
 *
 * MenuStat (NYC Department of Health and Mental Hygiene) collects the nutrition that the
 * largest US chains publish. Harvard Dataverse doi:10.7910/DVN/K4NYTR, CC0. The newest
 * year is 2018, so rows describe menus as published then. Nutrients are per serving;
 * null means not reported, never zero.
 *
 * ${provenance}
 */
import type { MenuStatRow } from './restaurantFoodTypes';

export const MENUSTAT_RESTAURANTS: readonly string[] = ${JSON.stringify(restaurants)};

export const MENUSTAT_FOODS: readonly MenuStatRow[] = [
${rows.map(row => `  ${JSON.stringify(row)}`).join(',\n')}
];
`;
}

function main() {
  const file = process.argv[2];
  if (!file || !fs.existsSync(file)) {
    console.error('Usage: node scripts/build-menustat-foods.mjs <MenuStat annual CSV>');
    process.exit(1);
  }
  const built = buildRows([...csvRecords(fs.readFileSync(file, 'utf8').replace(/^﻿/, ''))]);
  if (built.rows.length < 1000) { console.error(`Only ${built.rows.length} items built; refusing to overwrite the checked-in list.`); process.exit(1); }
  const withServing = built.rows.filter(row => row[4] !== null).length;
  const provenance = `Generated ${new Date().toISOString().slice(0, 10)}: ${built.rows.length} items from ${built.restaurants.length} chains, ${withServing} with a serving weight or volume.`;
  fs.writeFileSync(OUTPUT, render(built, provenance));
  console.log(provenance);
  console.log('Serving units:', JSON.stringify([...built.units.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)));
  console.log('Chains:', built.restaurants.join(', '));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main();
}
