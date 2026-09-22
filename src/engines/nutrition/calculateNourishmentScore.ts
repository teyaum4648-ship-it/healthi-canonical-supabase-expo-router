import { composeFoundationScore } from '../foundations/composeFoundationScore';
import type { FoundationContributor, FoundationScore } from '../foundations/foundationTypes';
import { MICRONUTRIENTS, dailyValueFraction, micronutrientCoverage } from './micronutrients';
import type { FoodQualitySummary, FoodResponseSummary, NutrientSummary, NutritionTargets } from './types';

/**
 * How well today's food is supporting the person eating it.
 *
 * Six terms: energy, protein, fibre, the micronutrient panel, the quality of what was
 * eaten, and how it was reported to feel. Weighted, renormalised over whatever actually
 * had data, and handed back with the terms that dragged hardest named — so the number can
 * answer "why" rather than only "what".
 *
 * Deliberately not a verdict on a person. A low score here means the day's food is giving
 * the body less to work with than it could, which is a thing to act on this afternoon; it
 * is not a grade, and none of the copy treats it as one.
 */

/** Energy is judged against the working target, both directions. */
const ENERGY_FULL_BAND = 0.15;
const ENERGY_ZERO_BAND = 0.45;

/**
 * Below this share of the panel, the micronutrient term is withheld entirely.
 *
 * A mean taken over two of twenty-seven nutrients says almost nothing about a day, and
 * scoring it anyway would let one fortified cereal carry a whole pillar. Withheld means
 * dropped from the weighting, not counted as zero.
 */
const MICRONUTRIENT_TERM_FLOOR = 0.25;

function ratioTerm(amount: number | null, target: number | null | undefined): number | null {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) return null;
  if (typeof target !== 'number' || !Number.isFinite(target) || target <= 0) return null;
  return Math.min(1, amount / target);
}

/** Full credit around the target, falling away on both sides. Too much is not better. */
function energyTerm(amount: number | null, target: number | null | undefined): number | null {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) return null;
  if (typeof target !== 'number' || !Number.isFinite(target) || target <= 0) return null;
  const distance = Math.abs(amount / target - 1);
  if (distance <= ENERGY_FULL_BAND) return 1;
  if (distance >= ENERGY_ZERO_BAND) return 0;
  return 1 - (distance - ENERGY_FULL_BAND) / (ENERGY_ZERO_BAND - ENERGY_FULL_BAND);
}

/** Mean share of a day's reference across the nutrients that were actually reported. */
function micronutrientTerm(summary: NutrientSummary): { value: number | null; detail: string } {
  const coverage = micronutrientCoverage(summary.micronutrients);
  if (coverage.fraction < MICRONUTRIENT_TERM_FLOOR) {
    return {
      value: null,
      detail: coverage.reported === 0
        ? 'No food you logged reported its micronutrients'
        : `Only ${coverage.reported} of ${coverage.tracked} nutrients reported — too thin to read`
    };
  }

  const shares = MICRONUTRIENTS
    .map((definition) => dailyValueFraction(definition.id, summary.micronutrients[definition.id]))
    .filter((share): share is number => share !== null)
    .map((share) => Math.min(1, share));
  const mean = shares.reduce((sum, share) => sum + share, 0) / shares.length;

  return {
    value: mean,
    detail: `${coverage.reported} of ${coverage.tracked} nutrients reported, averaging ${Math.round(mean * 100)}% of a day's reference`
  };
}

function responseTerm(response: FoodResponseSummary): { value: number | null; detail: string } {
  if (response.label === 'steady') return { value: 1, detail: 'Food sat well today' };
  if (response.label === 'mixed') return { value: 0.5, detail: 'Mixed response to what you ate' };
  if (response.label === 'watch') return { value: 0.25, detail: 'Your notes suggest food is not sitting well' };
  return { value: null, detail: 'No response logged yet' };
}

function amountDetail(amount: number | null, target: number | null | undefined, unit: string): string {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) return 'Not reported by anything you logged';
  if (typeof target !== 'number' || !Number.isFinite(target) || target <= 0) return `${Math.round(amount)}${unit} logged, no working target set`;
  return `${Math.round(amount)}${unit} of ${Math.round(target)}${unit}`;
}

function summarise(score: number | null, limiters: FoundationContributor[]): string {
  if (score === null) return 'Nothing logged yet today, so there is nothing to read.';
  const lead = limiters[0];
  if (!lead) {
    if (score >= 75) return 'Today gave your body a lot to work with.';
    return 'Today is steady on what you have logged so far.';
  }
  return `${lead.label} is the thing holding today back — ${lead.detail.toLowerCase()}.`;
}

export function calculateNourishmentScore(params: {
  date: string;
  nutrientSummary: NutrientSummary;
  foodQuality: FoodQualitySummary;
  foodResponse: FoodResponseSummary;
  targets?: NutritionTargets | null;
}): FoundationScore {
  const { nutrientSummary: summary, foodQuality, foodResponse } = params;
  const targets = params.targets ?? summary.targets ?? null;

  const micros = micronutrientTerm(summary);
  const response = responseTerm(foodResponse);

  const contributors: FoundationContributor[] = [
    {
      id: 'energy',
      label: 'Energy',
      weight: 0.15,
      value: summary.meal_count === 0 ? null : energyTerm(summary.calories, targets?.calories_target),
      detail: amountDetail(summary.calories, targets?.calories_target, ' kcal')
    },
    {
      id: 'protein',
      label: 'Protein',
      weight: 0.2,
      value: ratioTerm(summary.protein_g, targets?.protein_g_target),
      detail: amountDetail(summary.protein_g, targets?.protein_g_target, ' g')
    },
    {
      id: 'fiber',
      label: 'Fibre',
      weight: 0.15,
      value: ratioTerm(summary.fiber_g, targets?.fiber_g_target),
      detail: amountDetail(summary.fiber_g, targets?.fiber_g_target, ' g')
    },
    {
      id: 'micronutrients',
      label: 'Vitamins and minerals',
      weight: 0.2,
      value: micros.value,
      detail: micros.detail
    },
    {
      id: 'food_quality',
      label: 'Food quality',
      weight: 0.2,
      value: typeof foodQuality.score === 'number' ? foodQuality.score / 100 : null,
      detail: typeof foodQuality.score === 'number'
        ? `Averaging ${Math.round(foodQuality.score)} across what you logged`
        : 'Nothing logged yet carries a quality grade'
    },
    {
      id: 'food_response',
      label: 'How it sat',
      weight: 0.1,
      value: response.value,
      detail: response.detail
    }
  ];

  return composeFoundationScore({
    domain: 'nourishment',
    date: params.date,
    contributors,
    inputConfidences: [summary.confidence, foodQuality.confidence, foodResponse.confidence],
    reasonCodes: [...summary.reason_codes, ...foodQuality.reason_codes, ...foodResponse.reason_codes],
    summarise
  });
}
