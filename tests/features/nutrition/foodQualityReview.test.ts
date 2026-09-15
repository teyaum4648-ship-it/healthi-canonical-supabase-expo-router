import { describe, expect, it } from 'vitest';

import {
  buildFoodQualityReview,
  reviewCoverageLine,
  type ReviewItemInput,
  type ReviewProductInput
} from '../../../src/features/nutrition/foodQualityReview';

function item(overrides: Partial<ReviewItemInput> & { id: string }): ReviewItemInput {
  return { name: 'Something', logged_at: '2026-09-14T12:00:00.000Z', ...overrides };
}

const products: ReviewProductInput[] = [
  { barcode: '1', name: 'Nacho chips', ingredients_text: 'corn, vegetable oil (canola oil), maltodextrin, salt, yellow 6' },
  { barcode: '2', name: 'Cola', ingredients_text: 'carbonated water, high fructose corn syrup, caramel color, natural flavor' },
  { barcode: '3', name: 'Plain yogurt', ingredients_text: 'cultured milk' },
  { barcode: '4', name: 'Granola bar', ingredients_text: 'brown rice syrup, rolled oats, canola oil, natural flavor' }
];

describe('what you actually ate, graded', () => {
  it('says so plainly when nothing logged carries a grade', () => {
    const review = buildFoodQualityReview({
      items: [item({ id: 'a' }), item({ id: 'b' })],
      products
    });
    expect(review.empty).toBe(true);
    expect(review.average).toBeNull();
    expect(review.ungradedCount).toBe(2);
    expect(reviewCoverageLine(review)).toContain('Nothing logged carries a grade yet');
  });

  it('never averages an ungraded item into the day', () => {
    // A cooked meal is unmeasured, not bad. Folding it in either direction invents data.
    const review = buildFoodQualityReview({
      items: [
        item({ id: 'a', name: 'Plain yogurt', quality_score: 90, barcode: '3' }),
        item({ id: 'b', name: 'Chili I made' })
      ],
      products
    });
    expect(review.average).toBe(90);
    expect(review.graded).toHaveLength(1);
    expect(review.ungradedCount).toBe(1);
    expect(reviewCoverageLine(review)).toBe(
      '1 of 2 logged items carry a grade; the other one was entered by hand or cooked, and is not averaged in.'
    );
  });

  it('puts the worst thing first, because that is the end worth reading', () => {
    const review = buildFoodQualityReview({
      items: [
        item({ id: 'a', name: 'Plain yogurt', quality_score: 90, barcode: '3' }),
        item({ id: 'b', name: 'Cola', quality_score: 28, barcode: '2' }),
        item({ id: 'c', name: 'Nacho chips', quality_score: 55, barcode: '1' })
      ],
      products
    });
    expect(review.graded.map((entry) => entry.name)).toEqual(['Cola', 'Nacho chips', 'Plain yogurt']);
    expect(review.worst?.name).toBe('Cola');
    expect(review.best?.name).toBe('Plain yogurt');
    expect(review.average).toBe(58);
    expect(review.averageGrade).toBe('F');
  });

  it('counts each letter and its share of what was graded', () => {
    const review = buildFoodQualityReview({
      items: [
        item({ id: 'a', quality_score: 92 }),
        item({ id: 'b', quality_score: 91 }),
        item({ id: 'c', quality_score: 40 })
      ],
      products
    });
    const byGrade = new Map(review.distribution.map((entry) => [entry.grade, entry]));
    expect(byGrade.get('A')).toMatchObject({ count: 2 });
    expect(byGrade.get('A')!.share).toBeCloseTo(2 / 3);
    expect(byGrade.get('F')).toMatchObject({ count: 1 });
    expect(byGrade.get('B')).toMatchObject({ count: 0, share: 0 });
  });

  it('names what the poor grades were made of, not what every package contains', () => {
    const review = buildFoodQualityReview({
      items: [
        item({ id: 'a', name: 'Nacho chips', quality_score: 55, barcode: '1' }),
        item({ id: 'b', name: 'Granola bar', quality_score: 62, barcode: '4' }),
        item({ id: 'c', name: 'Plain yogurt', quality_score: 90, barcode: '3' })
      ],
      products
    });
    const labels = review.burdens.map((burden) => burden.label);
    expect(labels).toContain('Refined seed oils');
    expect(labels).toContain('Added sugar');
    // Most widespread first, so the finding that shows up twice leads.
    expect(review.burdens[0].label).toBe('Refined seed oils');
    expect(review.burdens[0].products).toEqual(['Nacho chips', 'Granola bar']);
  });

  it('reads only what leads a list, so a trace additive is not a finding', () => {
    // The colour sits fifth in the nacho chips; the oil sits second. Only one is what
    // the product is made of, and reporting both would give everyone the same four
    // findings forever — the failure the old page had in a different costume.
    const review = buildFoodQualityReview({
      items: [item({ id: 'a', name: 'Nacho chips', quality_score: 55, barcode: '1' })],
      products
    });
    expect(review.burdens.map((burden) => burden.label)).not.toContain('Added colours');
  });

  it('ignores the products behind things that scored well', () => {
    // A seed oil inside something that still earned an A is not what is holding a day
    // back, and listing it would bury the finding that is.
    const review = buildFoodQualityReview({
      items: [item({ id: 'a', name: 'Nacho chips', quality_score: 88, barcode: '1' })],
      products
    });
    expect(review.burdens).toEqual([]);
  });
});
