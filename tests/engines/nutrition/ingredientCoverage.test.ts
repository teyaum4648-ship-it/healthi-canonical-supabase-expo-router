import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { splitIngredientList } from '../../../src/engines/nutrition/productScoring';
import { ingredientReading, roleIngredients } from '../../../src/engines/nutrition/productScoring/ingredientRoles';
import { CALIBRATION_SET } from './calibrationSet';
import { FOOD_TAXONOMY, allTaxonomyFoods } from './foodTaxonomy';

/**
 * The coverage meter.
 *
 * The role table is a hand-written list, so the only honest question about it is not
 * "did we add eggplant" but "what fraction of real food does it still not recognise".
 * An unrecognised ingredient is scored 0.55 — neither credited nor punished — which
 * sounds neutral and is not: a whole food is worth 1.0, so every miss quietly costs a
 * real food the credit it earns. A jar of eggplant and tomatoes graded F because 59% of
 * its list was unrecognised, not because anything in it was bad.
 *
 * These are ceilings, the mirror of the floors in productCalibration.test.ts. They are
 * the current state rather than the goal, and a change that raises either one is a
 * regression whatever it did for the product that prompted it.
 *
 * `npm run lexicon:coverage` prints the full report, including the unmatched names
 * ranked by how much score they are costing. That ranking is the work queue.
 */

/**
 * Mean share of a product, by position weight, that the role table cannot place.
 *
 * Zero, and it means less than it looks: the corpus is curated, so it was already zero
 * before any of this work. Its value is as a tripwire — the day a real product joins
 * the calibration set carrying an ingredient nothing places, this fails and the
 * vocabulary grows to meet it, which is the behaviour we want from a corpus that is
 * meant to be replaced with scanned labels.
 */
const UNKNOWN_WEIGHT_CEILING = 0;
/** Share of all ingredient names across the corpus that the role table cannot place. */
const UNKNOWN_TOKEN_CEILING = 0;
/**
 * Share of the food checklist the role table cannot place at all.
 *
 * This is the number that matters, and it is a specification rather than a measurement.
 * The checklist says which foods a wellness app is expected to know by name; a miss is
 * therefore never acceptable, and the ceiling is zero so that adding a food to the
 * checklist and forgetting to teach the table fails the build. It stood at 58.2% of 519
 * foods before the vocabulary existed — including tomato and potato, which two plural
 * patterns had been quietly dropping since the beginning.
 */
const TAXONOMY_MISS_CEILING = 0;

type CoverageRow = {
  id: string;
  name: string;
  unknownWeight: number;
  unknownNames: string[];
  tokenCount: number;
};

/**
 * The corpus is every ingredient list the repository already holds as a real label.
 * It is small and it is curated, so it understates the problem rather than overstating
 * it: these products were chosen to calibrate the scale, which means someone already
 * looked at them. Treat the numbers as a lower bound on what is missing.
 */
function corpus(): Array<{ id: string; name: string; text: string }> {
  return CALIBRATION_SET
    .filter((item) => Boolean(item.input.ingredientsText))
    .map((item) => ({ id: item.id, name: item.name, text: item.input.ingredientsText! }));
}

function measure(): CoverageRow[] {
  return corpus().map(({ id, name, text }) => {
    const ingredients = roleIngredients(splitIngredientList(text));
    const unknown = ingredients.filter((item) => item.role === 'unknown');
    return {
      id,
      name,
      unknownWeight: unknown.reduce((sum, item) => sum + item.weight, 0),
      unknownNames: unknown.map((item) => item.name),
      tokenCount: ingredients.length
    };
  });
}

/**
 * Unmatched names ranked by cost, not by count. A name that appears once at the head of
 * a short list is doing more damage than one that appears six times in last place,
 * because position weight is what the score reads.
 */
function unmatchedByCost(rows: CoverageRow[]): Array<{ name: string; occurrences: number; cost: number }> {
  const tally = new Map<string, { occurrences: number; cost: number }>();
  for (const { text } of corpus()) {
    for (const item of roleIngredients(splitIngredientList(text))) {
      if (item.role !== 'unknown') continue;
      const entry = tally.get(item.name) ?? { occurrences: 0, cost: 0 };
      entry.occurrences += 1;
      entry.cost += item.weight;
      tally.set(item.name, entry);
    }
  }
  return [...tally.entries()]
    .map(([name, entry]) => ({ name, ...entry }))
    .sort((left, right) => right.cost - left.cost);
}

function meanUnknownWeight(rows: CoverageRow[]): number {
  if (rows.length === 0) return 0;
  return rows.reduce((sum, row) => sum + row.unknownWeight, 0) / rows.length;
}

function unknownTokenShare(rows: CoverageRow[]): number {
  const total = rows.reduce((sum, row) => sum + row.tokenCount, 0);
  if (total === 0) return 0;
  return rows.reduce((sum, row) => sum + row.unknownNames.length, 0) / total;
}

/** Foods in the checklist the table cannot place, by category. */
function taxonomyAudit(): Array<{ id: string; label: string; note: string; total: number; missed: string[] }> {
  return FOOD_TAXONOMY.map((category) => ({
    id: category.id,
    label: category.label,
    note: category.note,
    total: category.foods.length,
    missed: category.foods.filter((food) => ingredientReading(food).role === 'unknown')
  }));
}

function taxonomyMissRate(): number {
  const foods = allTaxonomyFoods();
  if (foods.length === 0) return 0;
  return foods.filter((food) => ingredientReading(food).role === 'unknown').length / foods.length;
}

describe('ingredient recognition coverage', () => {
  it('recognises enough of each product that unknown mass cannot decide a grade', () => {
    expect(meanUnknownWeight(measure())).toBeLessThanOrEqual(UNKNOWN_WEIGHT_CEILING);
  });

  it('recognises enough ingredient names across the corpus', () => {
    expect(unknownTokenShare(measure())).toBeLessThanOrEqual(UNKNOWN_TOKEN_CEILING);
  });

  it('places the foods a wellness app is expected to know by name', () => {
    expect(taxonomyMissRate()).toBeLessThanOrEqual(TAXONOMY_MISS_CEILING);
  });

  it('writes the coverage report', () => {
    const rows = measure();
    const pct = (value: number) => `${(value * 100).toFixed(1)}%`;
    const worst = [...rows].sort((left, right) => right.unknownWeight - left.unknownWeight);
    const unmatched = unmatchedByCost(rows);

    const lines = [
      'Ingredient recognition coverage',
      '',
      `products in corpus          ${rows.length}`,
      `ingredient names            ${rows.reduce((sum, row) => sum + row.tokenCount, 0)}`,
      `mean unknown share (weight) ${pct(meanUnknownWeight(rows))}   ceiling ${pct(UNKNOWN_WEIGHT_CEILING)}`,
      `unknown share (token count) ${pct(unknownTokenShare(rows))}   ceiling ${pct(UNKNOWN_TOKEN_CEILING)}`,
      `products with any unknown   ${rows.filter((row) => row.unknownNames.length > 0).length} of ${rows.length}`,
      `distinct unmatched names    ${unmatched.length}`,
      '',
      'Worst products, by the share of the list the table cannot place',
      ''
    ];
    for (const row of worst.slice(0, 15)) {
      if (row.unknownWeight === 0) break;
      lines.push(`  ${pct(row.unknownWeight).padStart(6)}  ${row.name}`);
      lines.push(`          ${row.unknownNames.join(', ')}`);
    }
    lines.push('', 'Unmatched names, ranked by the score they cost', '');
    for (const entry of unmatched.slice(0, 200)) {
      lines.push(`  ${entry.cost.toFixed(3)}  x${entry.occurrences}  ${entry.name}`);
    }

    const audit = taxonomyAudit();
    lines.push(
      '',
      '='.repeat(72),
      'Food checklist audit — what the table cannot place at all',
      '',
      `checklist size              ${allTaxonomyFoods().length}`,
      `unplaceable                 ${pct(taxonomyMissRate())}   ceiling ${pct(TAXONOMY_MISS_CEILING)}`,
      ''
    );
    for (const category of [...audit].sort((left, right) => (right.missed.length / right.total) - (left.missed.length / left.total))) {
      const rate = category.missed.length / category.total;
      lines.push(`  ${pct(rate).padStart(6)} missed  ${category.label} (${category.missed.length}/${category.total})`);
      lines.push(`          ${category.note}`);
      if (category.missed.length > 0) lines.push(`          ${category.missed.join(', ')}`);
      lines.push('');
    }

    fs.mkdirSync(path.join(process.cwd(), 'reports'), { recursive: true });
    fs.writeFileSync(path.join(process.cwd(), 'reports', 'lexicon-coverage.txt'), lines.join('\n') + '\n');
    expect(rows.length).toBeGreaterThan(0);
  });
});
