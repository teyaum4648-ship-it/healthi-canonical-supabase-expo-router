import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { correctSearchQuery } from '../../../src/features/nutrition/productLookup/searchQueryCorrection';
import { resolveSearchFoods } from '../../../src/features/nutrition/productLookup/searchFoodResolution';
import { SEARCH_CASES } from './searchQualitySet';

/*
 * The same letters, by the same rules the app uses for punctuation — an apostrophe is
 * dropped, so "McDonald's" and "mcdonalds" are one word. That is a fact about the
 * spelling rather than a ranking heuristic, so the measure can share it without becoming
 * a restatement of the ranker. The half-credit prefix rule is deliberately NOT shared:
 * that one is a judgement call and has to be checked from outside.
 */
const normalize = (value: string) =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/['\u2019]/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

/** Plural and singular are the same word; counting them apart understates a real match. */
const singular = (word: string) =>
  word.endsWith('ies') && word.length > 4 ? `${word.slice(0, -3)}y`
    : word.endsWith('es') && word.length > 4 ? word.slice(0, -2)
      : word.endsWith('s') && !word.endsWith('ss') && word.length > 3 ? word.slice(0, -1)
        : word;

/**
 * How many of the query's words the winning row actually contains.
 *
 * This is the number that matters and the one the first version of this harness missed.
 * Ranking falls through to a shortest-name tiebreak, so when nothing matches, the app
 * still shows a first result — it is just the shortest row in the list. That reads to a
 * person as an answer, which is worse than saying nothing was found.
 */
function matchedTerms(query: string, name: string, brand: string | null): number {
  const terms = [...new Set(normalize(query).split(/\s+/).filter(Boolean))];
  const words = new Set(`${normalize(name)} ${normalize(brand ?? '')}`.split(' ').map(singular));
  return terms.filter((term) => words.has(singular(term))).length;
}

/**
 * The ratchet for search.
 *
 * A floor, like the ingredient calibration set: it may rise, and a change that lowers it
 * is a regression whatever it did for the query that prompted it.
 *
 * `npm run search:quality` prints the table, including which queries put the wrong food
 * first and what they put there instead. That list is the work queue.
 */

/**
 * Floors, the same way the ingredient calibration set works: they may rise, and a change
 * that lowers either is a regression whatever it did for the query that prompted it.
 *
 * Both started at 9 and 8 of thirteen. The four that failed were a plural query against
 * a plural row, and three cases where a misspelling or an apostrophe was the only term
 * in the query — and two of the nine that "passed" had matched nothing at all, winning
 * on a shortest-name tiebreak.
 */
const TOP_FLOOR = 13;
/** Cases where the winning row actually contains something the person typed. */
const GROUNDED_FLOOR = 13;

function measure() {
  return SEARCH_CASES.map((testCase) => {
    // The real pipeline corrects the query before anything is searched or ranked, so the
    // harness measures the pair rather than the ranker on its own.
    const { query, corrected } = correctSearchQuery(testCase.query);
    const ranked = resolveSearchFoods([...testCase.rows], query);
    const position = ranked.findIndex((row) => row.name === testCase.expectTop);
    const winner = ranked[0];
    const matched = winner ? matchedTerms(query, winner.name, winner.brand ?? null) : 0;
    return {
      testCase,
      searched: query,
      corrected,
      top: winner?.name ?? '\u2014',
      hit: winner?.name === testCase.expectTop,
      /** A first result that matched nothing is a coin flip wearing a result's clothes. */
      grounded: matched > 0,
      matched,
      position
    };
  });
}

describe('search quality, against the query set', () => {
  it('puts the right food first often enough', () => {
    const rows = measure();
    expect(rows.filter((row) => row.hit).length).toBeGreaterThanOrEqual(TOP_FLOOR);
  });

  it('does not present a first result that matched nothing the person typed', () => {
    const rows = measure();
    expect(rows.filter((row) => row.grounded).length).toBeGreaterThanOrEqual(GROUNDED_FLOOR);
  });

  it('never loses the expected food out of the results entirely', () => {
    // Ranking may be wrong; dropping a row that the provider returned is a different
    // and worse bug, so it gets its own assertion.
    const lost = measure().filter((row) => row.position < 0).map((row) => row.testCase.id);
    expect(lost).toEqual([]);
  });

  it('writes the search quality report', () => {
    const rows = measure();
    const hits = rows.filter((row) => row.hit).length;
    const lines = [
      'Search quality',
      '',
      `queries            ${rows.length}`,
      `right food first   ${hits} of ${rows.length}   floor ${TOP_FLOOR}`,
      `winner matched     ${rows.filter((row) => row.grounded).length} of ${rows.length}   floor ${GROUNDED_FLOOR}`,
      '',
      'Measures the correction applied to a query and the order rows come back in.',
      'It cannot measure whether the providers return anything: that needs the network,',
      'and the commonest real failure is USDA being switched off.',
      '',
      'Query                          Expected                             Got',
      ''
    ];
    for (const row of rows) {
      const mark = row.hit ? (row.grounded ? '  ok  ' : '  luck') : '  ->  ';
      lines.push(
        `${mark}${row.testCase.query.padEnd(28)} ${row.testCase.expectTop.padEnd(36)} ${row.hit ? '' : row.top}`
      );
      if (row.corrected) lines.push(`        searched "${row.searched}"`);
      if (!row.hit || !row.grounded) lines.push(`        matched ${row.matched} terms \u00b7 ${row.testCase.why}`);
    }

    fs.mkdirSync(path.join(process.cwd(), 'reports'), { recursive: true });
    fs.writeFileSync(path.join(process.cwd(), 'reports', 'search-quality.txt'), lines.join('\n') + '\n');
    expect(rows.length).toBeGreaterThan(0);
  });
});
