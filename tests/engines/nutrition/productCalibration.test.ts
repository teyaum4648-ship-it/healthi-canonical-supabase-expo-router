import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { productLetterGrade, scoreProductLabel } from '../../../src/engines/nutrition/productScoring';
import { CALIBRATION_ORDERINGS, CALIBRATION_SET } from './calibrationSet';

/**
 * The ratchet.
 *
 * Tuning a scorer one product at a time is whack-a-mole: nothing says what a fix must
 * not break, so rescuing cheese crackers quietly drags corn tortillas down and the only
 * way to find out is to scan something by hand. These numbers are floors. They may rise
 * as the model improves and a change that lowers any of them is a regression, whatever
 * it did for the product that prompted it.
 *
 * The floors are deliberately the current state rather than the goal — 31 of 50 in the
 * right band is not good, it is just honest, and the gap to 50 is the work remaining.
 * `npm run calibrate` prints the full table.
 */

const BAND_FLOOR = 34;
const RANK_FLOOR = 0.93;

/** The kernel under calibration, set here so the suite measures it whatever the default. */
function scoreAll() {
  const previous = process.env.EXPO_PUBLIC_PRODUCT_QUALITY_EXPERIMENT;
  process.env.EXPO_PUBLIC_PRODUCT_QUALITY_EXPERIMENT = 'v6_composition';
  try {
    return CALIBRATION_SET.map((item) => {
      const result = scoreProductLabel(item.input);
      return { item, score: result.displayScore };
    });
  } finally {
    process.env.EXPO_PUBLIC_PRODUCT_QUALITY_EXPERIMENT = previous;
  }
}

function spearman(rows: Array<{ id: string; want: number; got: number }>): number {
  const rankBy = (key: 'want' | 'got') => new Map(
    [...rows].sort((left, right) => right[key] - left[key]).map((row, index) => [row.id, index])
  );
  const wantRank = rankBy('want');
  const gotRank = rankBy('got');
  const n = rows.length;
  const squaredGap = rows.reduce((sum, row) => sum + (wantRank.get(row.id)! - gotRank.get(row.id)!) ** 2, 0);
  return 1 - (6 * squaredGap) / (n * (n * n - 1));
}

describe('product scoring, against the calibration set', () => {
  it('has a score for every product, including the plainest whole foods', () => {
    // A scanner that cannot grade a blueberry is not a scanner. The kernel this
    // replaced abstained on four of these, because a one-word ingredient list left
    // three dimensions with nothing to say and the eligibility gate then refused.
    const unscored = scoreAll().filter((row) => row.score === null).map((row) => row.item.name);
    expect(unscored).toEqual([]);
  });

  it('puts products in the right order, which matters more than any single score', () => {
    const rows = scoreAll().map(({ item, score }) => ({ id: item.id, want: item.target, got: score ?? 0 }));
    expect(spearman(rows)).toBeGreaterThanOrEqual(RANK_FLOOR);
  });

  it('holds the orderings the scale would be wrong without', () => {
    const scored = new Map(scoreAll().map(({ item, score }) => [item.id, score ?? 0]));
    const broken: string[] = [];
    for (const ordering of CALIBRATION_ORDERINGS) {
      const values = ordering.order.map((id) => ({ id, score: scored.get(id)! }));
      const holds = values.every((row, index) => index === 0 || values[index - 1].score > row.score);
      if (!holds) {
        broken.push(`${ordering.why}: ${values.map((row) => `${row.id} ${row.score}`).join(' > ')}`);
      }
    }
    expect(broken).toEqual([]);
  });

  it('lands at least the current number of products in the right letter band', () => {
    const rows = scoreAll();
    const correct = rows.filter(({ item, score }) => score !== null && productLetterGrade(score) === item.grade);
    expect(correct.length).toBeGreaterThanOrEqual(BAND_FLOOR);
  });

  it('writes the calibration report', () => {
    const rows = scoreAll();
    const lines = rows.map(({ item, score }) => {
      const grade = score === null ? '—' : productLetterGrade(score);
      const delta = score === null ? '   —' : String(score - item.target).padStart(4);
      return `${item.name.slice(0, 40).padEnd(40)} want ${String(item.target).padStart(3)}/${item.grade}` +
        `   got ${String(score ?? '—').padStart(3)}/${grade}   ${delta}${grade === item.grade ? '' : '   <-- wrong band'}`;
    });
    const correct = rows.filter(({ item, score }) => score !== null && productLetterGrade(score) === item.grade).length;
    const rank = spearman(rows.map(({ item, score }) => ({ id: item.id, want: item.target, got: score ?? 0 })));
    lines.push('', `right band ${correct}/${rows.length} · rank correlation ${rank.toFixed(3)}`);
    fs.mkdirSync(path.join(process.cwd(), 'reports'), { recursive: true });
    fs.writeFileSync(path.join(process.cwd(), 'reports', 'product-calibration.txt'), lines.join('\n') + '\n');
    expect(lines.length).toBeGreaterThan(50);
  });
});
