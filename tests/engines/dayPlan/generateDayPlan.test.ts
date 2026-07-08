import { describe, expect, it } from 'vitest';

import { generateDayPlan, type DayPlanRecommendation, type DayScheduleBlock, type GenerateDayPlanInput } from '../../../src/engines/dayPlan';

const date = '2026-07-08';
const wake = '2026-07-08T06:30:00.000Z';
const bedtime = '2026-07-08T22:30:00.000Z';

function block(overrides: Partial<DayScheduleBlock> = {}): DayScheduleBlock {
  return {
    id: overrides.id ?? 'work-1',
    type: overrides.type ?? 'work',
    label: overrides.label ?? 'Work',
    start: overrides.start ?? '2026-07-08T09:00:00.000Z',
    end: overrides.end ?? '2026-07-08T11:00:00.000Z',
    flexibility: overrides.flexibility ?? 'fixed',
    source: overrides.source ?? 'user_entered',
    confidence: overrides.confidence ?? 'high',
    reason_codes: overrides.reason_codes ?? ['schedule_blocks_available']
  };
}

function baseInput(overrides: Partial<GenerateDayPlanInput> = {}): GenerateDayPlanInput {
  return {
    date,
    wake_time: wake,
    target_bedtime: bedtime,
    schedule_blocks: [
      block({
        id: 'work-morning',
        start: '2026-07-08T09:00:00.000Z',
        end: '2026-07-08T10:30:00.000Z'
      }),
      block({
        id: 'class-midday',
        type: 'class',
        label: 'Class',
        start: '2026-07-08T12:00:00.000Z',
        end: '2026-07-08T13:30:00.000Z'
      })
    ],
    rhythm: {
      energy_windows: [
        {
          start: '2026-07-08T08:00:00.000Z',
          end: '2026-07-08T11:30:00.000Z',
          label: 'Morning lift',
          intensity: 'high'
        }
      ],
      deep_work_window: {
        start: '2026-07-08T08:00:00.000Z',
        end: '2026-07-08T11:30:00.000Z'
      },
      exercise_window: {
        start: '2026-07-08T14:00:00.000Z',
        end: '2026-07-08T16:00:00.000Z'
      },
      caffeine_cutoff: '2026-07-08T14:30:00.000Z',
      wind_down_start: '2026-07-08T21:00:00.000Z'
    },
    readiness: {
      score: 82,
      mode: 'build',
      confidence: 'high',
      reason_codes: ['readiness_high']
    },
    nutrition: {
      readiness_adjustment: 2,
      confidence: 'medium',
      meal_count: 2,
      food_response_label: 'steady',
      reason_codes: ['food_response_logged']
    },
    movement: {
      training_readiness: 'high',
      preferred_training_time: null,
      reason_codes: ['movement_window_matched']
    },
    ...overrides
  };
}

function overlapsBusy(recommendation: DayPlanRecommendation, blocks: DayScheduleBlock[]): boolean {
  if (!recommendation.start || !recommendation.end) return false;
  const recStart = new Date(recommendation.start).getTime();
  const recEnd = new Date(recommendation.end).getTime();

  return blocks.some((item) => {
    if (item.type === 'free_time' && item.flexibility !== 'fixed') return false;
    const blockStart = new Date(item.start).getTime();
    const blockEnd = new Date(item.end).getTime();
    return recStart < blockEnd && recEnd > blockStart;
  });
}

describe('generateDayPlan', () => {
  it('returns a calibrating plan when schedule is empty', () => {
    const result = generateDayPlan(baseInput({ schedule_blocks: [] }));

    expect(result.summary).toBe('Your day plan is still calibrating.');
    expect(result.confidence).toBe('low');
    expect(result.missing_data).toContain('schedule');
    expect(result.reason_codes).toContain('missing_schedule_data');
    expect(result.recommendations.some((item) => item.type === 'schedule_adjustment')).toBe(true);
  });

  it('finds available open windows around a busy schedule', () => {
    const result = generateDayPlan(baseInput());

    expect(result.open_windows.length).toBeGreaterThan(0);
    expect(result.open_windows.map((window) => window.start)).toContain('2026-07-08T06:30:00.000Z');
    expect(result.reason_codes).toContain('open_window_detected');
  });

  it('handles overlapping blocks safely', () => {
    const result = generateDayPlan(
      baseInput({
        schedule_blocks: [
          block({ id: 'work-a', start: '2026-07-08T09:00:00.000Z', end: '2026-07-08T11:00:00.000Z' }),
          block({ id: 'work-b', start: '2026-07-08T10:30:00.000Z', end: '2026-07-08T12:00:00.000Z' })
        ]
      })
    );

    expect(result.reason_codes).toContain('overlapping_blocks_handled');
    expect(result.open_windows.every((window) => window.duration_minutes > 0)).toBe(true);
  });

  it('uses a rhythm high-energy window for deep work when available', () => {
    const result = generateDayPlan(baseInput());
    const deepWork = result.recommendations.find((item) => item.type === 'deep_work');

    expect(deepWork?.start).toBe('2026-07-08T08:00:00.000Z');
    expect(deepWork?.end).toBe('2026-07-08T09:00:00.000Z');
    expect(deepWork?.reason_codes).toContain('deep_work_window_matched');
  });

  it('uses movement and rhythm windows when readiness is high', () => {
    const result = generateDayPlan(baseInput());
    const movement = result.recommendations.find((item) => item.type === 'movement');

    expect(movement?.start).toBe('2026-07-08T14:00:00.000Z');
    expect(movement?.reason_codes).toContain('movement_window_matched');
    expect(movement?.reason_codes).toContain('readiness_high');
  });

  it('avoids intense movement in restore mode', () => {
    const result = generateDayPlan(
      baseInput({
        readiness: { score: 28, mode: 'restore', confidence: 'medium', reason_codes: ['restore_mode_selected'] },
        movement: { training_readiness: 'high', preferred_training_time: null, reason_codes: [] }
      })
    );

    expect(result.mode).toBe('restore');
    expect(result.recommendations.some((item) => item.type === 'movement')).toBe(false);
    expect(result.recommendations.some((item) => item.type === 'recovery')).toBe(true);
  });

  it('turns low readiness into recovery or lighter movement', () => {
    const result = generateDayPlan(
      baseInput({
        readiness: { score: 38, mode: 'correct', confidence: 'medium', reason_codes: ['readiness_low'] },
        movement: { training_readiness: 'low', preferred_training_time: null, reason_codes: [] }
      })
    );

    expect(result.reason_codes).toContain('readiness_low');
    expect(result.recommendations.some((item) => item.type === 'walk' || item.type === 'recovery')).toBe(true);
  });

  it('adds a fueling action and lowers confidence when nutrition is missing', () => {
    const result = generateDayPlan(baseInput({ nutrition: undefined }));
    const meal = result.recommendations.find((item) => item.type === 'meal_timing');

    expect(result.confidence).toBe('low');
    expect(result.missing_data).toContain('nutrition');
    expect(meal?.detail).toBe('Log a meal to improve today’s fueling signal.');
    expect(meal?.reason_codes).toContain('nutrition_calibrating');
  });

  it('uses present nutrition data for a careful meal timing recommendation', () => {
    const result = generateDayPlan(baseInput());
    const meal = result.recommendations.find((item) => item.type === 'meal_timing');

    expect(meal?.detail).toBe('Food response is logged, so keep the next meal simple and steady.');
    expect(meal?.reason_codes).toContain('food_response_logged');
  });

  it('adds wind-down when wind-down data exists', () => {
    const result = generateDayPlan(baseInput());
    const windDown = result.recommendations.find((item) => item.type === 'wind_down');

    expect(windDown?.start).toBe('2026-07-08T21:00:00.000Z');
    expect(windDown?.reason_codes).toContain('wind_down_protected');
  });

  it('does not place recommendations inside protected busy blocks', () => {
    const input = baseInput();
    const result = generateDayPlan(input);

    expect(result.recommendations.every((item) => !overlapsBusy(item, input.schedule_blocks))).toBe(true);
  });

  it('lowers confidence when rhythm is missing without crashing', () => {
    const result = generateDayPlan(baseInput({ rhythm: undefined }));

    expect(result.confidence).toBe('low');
    expect(result.missing_data).toContain('rhythm');
    expect(result.reason_codes).toContain('missing_rhythm_data');
  });

  it('lowers confidence when movement is missing without crashing', () => {
    const result = generateDayPlan(baseInput({ movement: undefined }));

    expect(result.confidence).toBe('low');
    expect(result.missing_data).toContain('movement');
    expect(result.reason_codes).toContain('missing_movement_data');
  });

  it('keeps output serializable', () => {
    const result = generateDayPlan(baseInput());

    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
  });

  it('includes reason codes', () => {
    const result = generateDayPlan(baseInput());

    expect(result.reason_codes).toEqual(expect.arrayContaining(['schedule_blocks_available', 'rhythm_window_available']));
    expect(result.recommendations.every((item) => item.reason_codes.length > 0)).toBe(true);
  });

  it('avoids forbidden language in user-facing copy', () => {
    const result = generateDayPlan(
      baseInput({
        readiness: { score: 34, mode: 'restore', confidence: 'low', reason_codes: [] },
        nutrition: undefined,
        movement: { training_readiness: 'low', preferred_training_time: null, reason_codes: [] }
      })
    );
    const output = JSON.stringify({
      summary: result.summary,
      primary_focus: result.primary_focus,
      recommendations: result.recommendations.map((item) => ({
        title: item.title,
        detail: item.detail
      }))
    }).toLowerCase();
    const blockedTerms = [
      'diag' + 'nosis',
      'diag' + 'nose',
      'treat' + 'ment',
      'c' + 'ure',
      'pre' + 'scribe',
      'pre' + 'scription',
      'ad' + 'renal',
      'h' + 'pa',
      'cor' + 'tisol',
      'hor' + 'mone',
      'clin' + 'ical',
      'medical ' + 'decision',
      'dys' + 'regulated',
      'dys' + 'function',
      'de' + 'tox',
      'tox' + 'in',
      'tox' + 'ic',
      'clean' + 'se',
      'cheat ' + 'meal',
      'guilt-' + 'free',
      'bad ' + 'food',
      'metabolic ' + 'type',
      'metabolic ' + 'typing',
      'che' + 'k',
      'h' + 'lc',
      '4 doc' + 'tors',
      'primal ' + 'pattern',
      'work-' + 'in'
    ];

    for (const term of blockedTerms) {
      expect(output).not.toContain(term);
    }
  });

  it('returns deterministic output for the same input', () => {
    const input = baseInput();

    expect(generateDayPlan(input)).toEqual(generateDayPlan(input));
  });
});
