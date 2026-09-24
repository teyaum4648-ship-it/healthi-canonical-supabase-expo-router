import { describe, expect, it } from 'vitest';

import { daysLoggedLabel, generateTrendsSummary } from '../../../src/engines/trends';

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

  it('does not infer schedule pressure when open-window data is unavailable', () => {
    const result = generateTrendsSummary({
      today,
      scheduleHistory: dates(4).map((date) => ({ date, block_count: 6, confidence: 'medium' }))
    });
    const card = result.domain_cards.find((item) => item.domain === 'mind_life_load');

    expect(card?.status).toBe('steady');
    expect(card?.reason_codes).not.toContain('schedule_density_watch');
  });

  it('returns a serializable output with reason codes', () => {
    const result = generateTrendsSummary({ today, rhythmHistory: dates(3).map((date) => ({ date, sleep_duration_hours: 7 })) });

    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
    expect(result.overview.reason_codes.length).toBeGreaterThan(0);
    expect(result.next_focus.reason_codes.length).toBeGreaterThan(0);
  });

  it('counts the days each trend is built from, leaving unlogged days out', () => {
    const result = generateTrendsSummary({
      today,
      rhythmHistory: dates(5).map((date) => ({ date, sleep_duration_hours: 7 })),
      nutritionHistory: [...dates(2).map((date) => ({ date, meal_count: 2 })), { date: '2026-07-11', meal_count: 0 }],
      movementHistory: [{ date: '2026-07-01', workout_count: 1, total_minutes: 30 }]
    });
    const days = Object.fromEntries(result.domain_cards.map((card) => [card.domain, card.days_logged]));

    expect(days).toEqual({ recovery_rhythm: 5, nourishment: 2, movement_capacity: 0, mind_life_load: 0, readiness: 0 });
    expect(result.days_logged).toBe(5);
  });

  it('describes the evidence in days rather than a confidence grade', () => {
    expect(daysLoggedLabel(5, 7)).toBe('5 of 7 days logged');
    expect(daysLoggedLabel(0, 14)).toBe('Nothing logged in the last 14 days');
  });

  it('draws one point per day of the range, with gaps where nothing was logged', () => {
    const result = generateTrendsSummary({
      today,
      range_days: 7,
      rhythmHistory: [{ date: '2026-07-14', sleep_duration_hours: 7 }, { date: '2026-07-14', sleep_duration_hours: 1.5 }, { date: '2026-07-12', sleep_duration_hours: 8 }]
    });
    const sleep = result.domain_cards.find((card) => card.domain === 'recovery_rhythm')!;
    expect(sleep.series.map((point) => point.date)).toEqual(['2026-07-08', '2026-07-09', '2026-07-10', '2026-07-11', '2026-07-12', '2026-07-13', '2026-07-14']);
    expect(sleep.series.map((point) => point.value)).toEqual([null, null, null, null, 8, null, 7]);
    expect(sleep.series_unit).toBe('hours');
  });

  it('builds Mind + Life Load from what the Mood tab recorded', () => {
    const result = generateTrendsSummary({
      today,
      mindHistory: dates(4).map((date) => ({ date, breathing_sessions: 1, breathing_minutes: 3, morning_light_minutes: 15 }))
    });
    const mind = result.domain_cards.find((card) => card.domain === 'mind_life_load')!;
    expect(mind.status).toBe('supportive');
    expect(mind.value_label).toBe('4 breathing resets · 4 mornings outside');
    expect(mind.days_logged).toBe(4);
    expect(mind.series.filter((point) => point.value === 3)).toHaveLength(4);
  });

  it('averages the recorded daily readiness instead of calibrating forever', () => {
    const result = generateTrendsSummary({ today, readinessHistory: dates(3).map((date, index) => ({ date, score: 70 + index * 2 })) });
    const readiness = result.domain_cards.find((card) => card.domain === 'readiness')!;
    expect(readiness.status).not.toBe('calibrating');
    expect(readiness.value_label).toBe('72 average');
  });

  it('charts calories for nourishment when meals report them', () => {
    const result = generateTrendsSummary({ today, nutritionHistory: dates(3).map((date) => ({ date, meal_count: 3, calories: 2000 })) });
    const food = result.domain_cards.find((card) => card.domain === 'nourishment')!;
    expect(food.value_label).toBe('2000 kcal a day');
    expect(food.series_unit).toBe('kcal');
  });
});

