import { describe, expect, it } from 'vitest';

import { onboardingQuestions } from '../../../src/features/onboarding/onboardingQuestions';
import {
  normalizeTimeAnswer,
  onboardingStepQuestions,
  onboardingSteps,
  requiredQuestions
} from '../../../src/features/onboarding/onboardingSteps';
import { generateOnboardingV2Result } from '../../../src/features/onboarding/onboardingV2Model';
import type { OnboardingAnswers } from '../../../src/types/onboarding';

/** Answers every required question across the first `count` steps. */
function answerSteps(count: number): OnboardingAnswers {
  const answers: OnboardingAnswers = {};
  for (const step of onboardingSteps.slice(0, count)) {
    for (const question of requiredQuestions(step)) {
      answers[question.key] = question.type === 'scale' ? 5
        : question.type === 'multi' ? [question.options![0].value]
          : question.type === 'time' ? '22:30'
            : question.options![0].value;
    }
  }
  return answers;
}

describe('three steps instead of seventeen screens', () => {
  it('presents exactly three steps', () => {
    expect(onboardingSteps).toHaveLength(3);
    expect(onboardingSteps.map((step) => step.id)).toEqual(['focus', 'rhythm', 'fuel']);
  });

  it('keeps every question that the scoring model reads', () => {
    // Grouping changes the pacing, not the signal: dropping a scored answer would
    // quietly degrade the first plan.
    expect(onboardingStepQuestions.map((q) => q.key).sort())
      .toEqual(onboardingQuestions.map((q) => q.key).sort());
  });

  it('no longer asks the question nothing reads', () => {
    expect(onboardingQuestions.map((q) => q.key)).not.toContain('result_timeline');
  });

  it('gives every step a heading and a reason for asking', () => {
    for (const step of onboardingSteps) {
      expect(step.title.trim().length).toBeGreaterThan(0);
      expect(step.intro.trim().length).toBeGreaterThan(20);
      expect(step.questions.length).toBeGreaterThan(0);
    }
  });

  it('asks no step to carry an unreasonable number of questions', () => {
    for (const step of onboardingSteps) {
      expect(step.questions.length).toBeLessThanOrEqual(8);
    }
  });
});

describe('a usable baseline without the optional detail', () => {
  it('reaches a complete baseline on the required questions alone', () => {
    // generateOnboardingV2Result marks a baseline complete at eight answers with a
    // goal set. The first two steps must clear that on their own, so someone who
    // skips the optional detail still gets a real plan.
    const answers = answerSteps(2);
    expect(Object.keys(answers).length).toBeGreaterThanOrEqual(8);
    expect(generateOnboardingV2Result({ answers }).completed).toBe(true);
  });

  it('still completes when every optional question is skipped', () => {
    const answers = answerSteps(3);
    const result = generateOnboardingV2Result({ answers });
    expect(result.completed).toBe(true);
    // Honest about what is missing rather than claiming a full picture.
    expect(result.confidence).toBe('low');
    expect(result.missing_data.length).toBeGreaterThan(0);
  });

  it('does not complete on the first step alone', () => {
    expect(generateOnboardingV2Result({ answers: answerSteps(1) }).completed).toBe(false);
  });

  it('marks the skippable questions optional and keeps the influential ones required', () => {
    const fuel = onboardingSteps[2];
    const required = requiredQuestions(fuel).map((q) => q.key);
    // Training days and nourishment score carry the most weight in their domains.
    expect(required).toEqual(['weekly_training_days', 'diet_quality_score']);
    expect(fuel.questions.filter((q) => q.optional).length).toBe(6);
  });

  it('requires the goal, which drives every domain score', () => {
    expect(requiredQuestions(onboardingSteps[0]).map((q) => q.key)).toContain('primary_goal');
  });
});

describe('reading a time the way people write it', () => {
  it('accepts the common forms', () => {
    expect(normalizeTimeAnswer('22:30')).toBe('22:30');
    expect(normalizeTimeAnswer('10:30pm')).toBe('22:30');
    expect(normalizeTimeAnswer('10:30 PM')).toBe('22:30');
    expect(normalizeTimeAnswer('2230')).toBe('22:30');
    expect(normalizeTimeAnswer('7am')).toBe('07:00');
    expect(normalizeTimeAnswer('6:45am')).toBe('06:45');
    expect(normalizeTimeAnswer('645')).toBe('06:45');
    expect(normalizeTimeAnswer('7')).toBe('07:00');
  });

  it('handles midnight and noon without shifting them twelve hours', () => {
    expect(normalizeTimeAnswer('12am')).toBe('00:00');
    expect(normalizeTimeAnswer('12:15am')).toBe('00:15');
    expect(normalizeTimeAnswer('12pm')).toBe('12:00');
    expect(normalizeTimeAnswer('12:15pm')).toBe('12:15');
  });

  it('refuses what it cannot read rather than guessing', () => {
    for (const bad of ['', 'tonight', '25:00', '22:70', '13pm', '0am', null, undefined, 5]) {
      expect(normalizeTimeAnswer(bad as never)).toBeNull();
    }
  });
});

describe('labelled buckets instead of ten-point scales', () => {
  const scales = onboardingStepQuestions.filter((q) => q.type === 'scale');

  it('gives every scale question labelled buckets', () => {
    expect(scales.length).toBeGreaterThan(0);
    for (const question of scales) {
      expect(question.scaleLabels?.length ?? 0).toBeGreaterThanOrEqual(3);
    }
  });

  it('keeps every threshold the model actually reads reachable', () => {
    const bucket = (key: string) =>
      scales.find((q) => q.key === key)!.scaleLabels!.map((b) => b.value);

    // priorityForDomain: rested <= 4; modeForAnswers: rested <= 3.
    const rested = bucket('morning_rested_score');
    expect(rested.some((v) => v <= 3)).toBe(true);
    expect(rested.some((v) => v > 4)).toBe(true);

    // Two separate tiers, >= 7 and >= 8, must both be selectable.
    const stress = bucket('daily_stress_score');
    expect(stress.some((v) => v >= 8)).toBe(true);
    expect(stress.some((v) => v >= 7 && v < 8)).toBe(true);
    expect(stress.some((v) => v < 7)).toBe(true);

    // priorityForDomain: nourishment score <= 4.
    const diet = bucket('diet_quality_score');
    expect(diet.some((v) => v <= 4)).toBe(true);
    expect(diet.some((v) => v > 4)).toBe(true);
  });

  it('records a number, so the scoring model needs no change', () => {
    for (const question of scales) {
      for (const item of question.scaleLabels!) {
        expect(typeof item.value).toBe('number');
        expect(item.label.trim().length).toBeGreaterThan(0);
      }
    }
  });
});
