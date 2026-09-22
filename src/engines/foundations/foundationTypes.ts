import type { DataConfidence } from '../../types/common';

export type { DataConfidence };

export type FoundationDomain =
  | 'recovery_rhythm'
  | 'nourishment'
  | 'movement_capacity'
  | 'mind_life_load';

/**
 * One term inside a pillar score.
 *
 * `value` is normalised to 0-1 so terms measured in grams, minutes and sessions can be
 * weighed against each other, and `null` means nothing reported it — which is not zero.
 * The distinction is the whole reason this type exists rather than a bare number: a
 * pillar that cannot tell "you did none of this" from "we could not see this" will
 * eventually tell someone they failed at something it never measured.
 */
export type FoundationContributor = {
  id: string;
  label: string;
  /** Share of the pillar this term carries, before renormalising over what is known. */
  weight: number;
  /** 0-1 where 1 is fully supportive, or null when nothing reported it. */
  value: number | null;
  /** What this term is saying, in the words the user should read. */
  detail: string;
};

export type FoundationScore = {
  domain: FoundationDomain;
  date: string;
  /** 0-100, or null when nothing at all was known and a number would be invented. */
  score: number | null;
  confidence: DataConfidence;
  /** Share of the pillar's weight that had data behind it. */
  coverage: number;
  contributors: FoundationContributor[];
  /**
   * What is holding the pillar back, heaviest drag first.
   *
   * Ordered by weight times shortfall rather than by shortfall alone, because a term
   * carrying a fifth of the pillar at 0.5 is doing more damage than one carrying a
   * twentieth at 0.1 — and the point of naming a limiter is to say where the work is,
   * not to list every imperfection.
   */
  limiters: FoundationContributor[];
  reason_codes: string[];
  summary: string;
};
