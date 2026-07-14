import { describe, expect, it } from 'vitest';

import { generateTrendsSummary } from '../../../src/engines/trends';

const today = '2026-07-14';

function dates(count: number): string[] {
  return Array.from({ length: count }, (_, index) => `2026-07-${String(14 - index).padStart(2, '0')}`);
}

describe('generateTrendsSummary', () => {
  it('returns a calm calibrating summary when no history is available', () => {
    const result = generateTrendsSummary({ today });

    expect(result.overview.trend_direction).toBe('calibrating');
    expect(result.confidence).toBe('low');
    expect(result.domain_cards).toHaveLength(5);
    expect(result.missing_data).toContain('recovery_rhythm');
  });

  it('keeps fewer than three logged days at low confidence', () => {
    const result = generateTrendsSummary({
      today,
      nutritionHistory: dates(2).map((date) => ({ date, meal_count: 2, confidence: 'medium' }))
    });

    expect(result.domain_cards.find((card) => card.domain === 'nourishment')?.status).toBe('calibrating');
    expect(result.domain_cards.find((card) => card.domain === 'nourishment')?.confidence).toBe('low');
  });

  it('shows a steady readiness pattern for stable logged scores', () => {
    const result = generateTrendsSummary({
      today,
      readinessHistory: dates(7).map((date) => ({ date, score: 72, confidence: 'medium' }))
    });
    const card = result.domain_cards.find((item) => item.domain === 'readiness');

    expect(card?.status).toBe('supportive');
    expect(card?.direction).toBe('steady');
  });

  it('marks recovery for watch when sleep debt rises', () => {
    const result = generateTrendsSummary({
      today,
      rhythmHistory: dates(7).map((date, index) => ({
        date,
        sleep_duration_hours: 7.2,
        sleep_debt_hours: 2.5 - index * 0.3,
        confidence: 'medium'
      }))
    });
    const card = result.domain_cards.find((item) => item.domain === 'recovery_rhythm');

    expect(card?.status).toBe('watch');
    expect(card?.reason_codes).toContain('sleep_debt_rising');
  });

  it('treats sparse nutrition as calibrating instead of watch', () => {
    const result = generateTrendsSummary({
      today,
      nutritionHistory: [{ date: today, meal_count: 1, food_quality_label: 'watch' }]
    });

    expect(result.domain_cards.find((item) => item.domain === 'nourishment')?.status).toBe('calibrating');
  });

  it('shows consistent movement as supportive', () => {
    const result = generateTrendsSummary({
      today,
      movementHistory: dates(4).map((date) => ({ date, workout_count: 1, total_minutes: 42, confidence: 'medium' }))
    });

    expect(result.domain_cards.find((item) => item.domain === 'movement_capacity')?.status).toBe('supportive');
  });

  it('flags dense schedules with no recorded open windows', () => {
    const result = generateTrendsSummary({
      today,
      scheduleHistory: dates(4).map((date) => ({ date, block_count: 6, open_window_count: 0, confidence: 'medium' }))
    });
    const card = result.domain_cards.find((item) => item.domain === 'mind_life_load');

    expect(card?.status).toBe('watch');
    expect(result.next_focus.domain).toBe('mind_life_load');
  });

  it('returns a serializable output with reason codes', () => {
    const result = generateTrendsSummary({ today, rhythmHistory: dates(3).map((date) => ({ date, sleep_duration_hours: 7 })) });

    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
    expect(result.overview.reason_codes.length).toBeGreaterThan(0);
    expect(result.next_focus.reason_codes.length).toBeGreaterThan(0);
  });
});
