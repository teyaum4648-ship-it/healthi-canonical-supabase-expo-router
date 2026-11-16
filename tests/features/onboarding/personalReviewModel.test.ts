import { describe, expect, it } from 'vitest';

import { generateBiweeklyFocusProfile } from '../../../src/features/onboarding/generateBiweeklyFocusProfile';
import { answerText, buildPersonalReview, FOUNDATION_ORDER } from '../../../src/features/onboarding/personalReviewModel';
import type { OnboardingAnswers } from '../../../src/types/onboarding';

const answers: OnboardingAnswers = {
  primary_goal: 'energy_focus',
  blocking_factors: ['low_energy', 'poor_sleep'],
  bedtime: '11:30pm',
  wake_time: '6:45am',
  morning_rested_score: 2,
  overnight_waking: 'occasionally',
  meal_cadence: 'three_larger_meals',
  diet_quality_score: 6,
  water_intake: 'less_than_1l',
  post_meal_energy: 'slight_drop',
  weekly_training_days: '1_to_2',
  training_types: ['strength_lifting', 'cardio'],
  recovery_between_sessions: 'slow_recovery',
  non_fitness_activity: 'mostly_sedentary',
  daily_stress_score: 7,
  daily_schedule: 'standard_9_to_5'
};

const profile = generateBiweeklyFocusProfile({ userId: 'local-preview', answers });
const review = buildPersonalReview(profile, answers);

describe('the Personal Review', () => {
  it('reads answers back in the questionnaire’s own words, with times on a 12-hour clock', () => {
    expect(answerText('primary_goal', 'energy_focus')).toBe('Improve daily energy');
    expect(answerText('morning_rested_score', 2)).toBe('Rarely rested');
    expect(answerText('blocking_factors', ['low_energy', 'poor_sleep'])).toBe('Daily energy, Sleep rhythm');
    expect(answerText('bedtime', '11:30pm')).toBe('11:30 PM');
    expect(answerText('bedtime', '22:30')).toBe('10:30 PM');
    expect(answerText('wake_time', '6:45am')).toBe('6:45 AM');
    expect(answerText('water_intake', undefined)).toBeNull();
    expect(answerText('water_intake', 'not_an_option')).toBeNull();
  });

  it('explains the focus only with answers the person actually gave', () => {
    expect(review.why.goal).toBe('Improve daily energy');
    expect(review.why.flagged).toBe('Daily energy, Sleep rhythm');
    expect(review.why.rows.length).toBeGreaterThan(0);
    expect(review.why.rows.length).toBeLessThanOrEqual(5);
    for (const row of review.why.rows) expect(row.value).not.toMatch(/undefined|null|NaN/);
  });

  it('leaves out what was not answered rather than filling it in', () => {
    const sparse = buildPersonalReview(profile, { primary_goal: 'energy_focus' });
    expect(sparse.why.rows).toEqual([]);
    expect(sparse.why.flagged).toBeNull();
    expect(buildPersonalReview(profile, { ...answers, blocking_factors: ['no_clear_issue'] }).why.flagged).toBeNull();
  });

  it('names the focus and carries the engine’s own summary, priority and confidence', () => {
    expect(review.focus.summary).toBe(profile.dynamic_score_sheet.summary);
    expect(review.focus.priority).toMatch(/^(Low|Moderate|High) priority$/);
    expect(review.focus.confidence).toMatch(/confidence$/);
  });

  it('shows the four foundations in order, in plain words, keeping each number as context', () => {
    expect(review.foundations.map((item) => item.name)).toEqual(['Recovery & Rhythm', 'Nourishment', 'Stress & Life Load', 'Movement']);
    review.foundations.forEach((item, index) => {
      const domain = profile.dynamic_score_sheet.domain_scores[FOUNDATION_ORDER[index]!];
      expect(item.score).toBe(Math.round(domain.score));
      expect(item.priority).toBe(domain.priority);
      expect(['Most attention now', 'Some attention', 'Steady for now']).toContain(item.attention);
    });
    expect(review.foundations.filter((item) => item.isFocus).length).toBe(profile.primary_focus === 'balanced' ? 0 : 1);
  });

  it('previews the first 14 days from the engine’s own plan biases and reassessment date', () => {
    const [calibrate, focus, checkIn] = review.firstFourteenDays;
    expect(calibrate!.when).toBe('Days 1–7');
    expect(focus!.lines).toHaveLength(4);
    expect(checkIn!.when).toMatch(/^Day 14/);
  });

  it('never uses diagnosis or treatment language', () => {
    const text = JSON.stringify(review).toLowerCase();
    for (const word of ['diagnos', 'treatment', 'cure', 'prescri', 'adrenal', 'cortisol', 'hormone', 'guaranteed']) {
      expect(text).not.toContain(word);
    }
  });
});
