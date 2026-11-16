import { describe, expect, it } from 'vitest';

import type { CircadianBriefing } from '../../../src/engines/circadian';
import type { DayPlanResult } from '../../../src/engines/dayPlan';
import { buildDayThreadInput, localMinute, wallClockMinute, type DayThreadSources } from '../../../src/features/dashboard/dayThreadInput';

const TODAY = '2026-11-16';
const wall = (time: string, day = TODAY) => `${day}T${time}:00.000Z`;
/** A real instant at a local wall-clock time, whatever zone the tests run in. */
const local = (hours: number, minutes: number, day = 16) => new Date(2026, 10, day, hours, minutes).toISOString();

const briefing: DayThreadSources['briefing'] = {
  wake_time: wall('06:40'),
  target_bedtime: wall('23:15'),
  energy_curve: [
    { time: wall('06:40'), estimated_energy: 30, label: 'wake_grogginess' },
    { time: wall('07:00'), estimated_energy: 45, label: 'rising' }
  ],
  energy_zones: [{ start_at: wall('09:00'), end_at: wall('12:00'), level: 'high' }],
  rhythm_plan: {
    deep_work_windows: [],
    best_exercise_windows: [],
    best_walk_windows: [],
    nap_windows: [],
    breathing_windows: [],
    morning_light_windows: [],
    evening_dim_light_start: null,
    caffeine_cutoff: null,
    caffeine_cutoff_large_dose: null,
    wind_down_start: wall('22:15'),
    target_bedtime: wall('23:15'),
    reason_codes: []
  }
} satisfies Pick<CircadianBriefing, 'wake_time' | 'target_bedtime' | 'energy_curve' | 'energy_zones' | 'rhythm_plan'>;

const plan: Pick<DayPlanResult, 'recommendations' | 'protected_blocks'> = {
  recommendations: [
    { id: 'r1', type: 'deep_work', title: 'Focus window', detail: 'Use your strongest energy window for focused work.', start: wall('09:15'), end: wall('11:45'), priority: 'high', confidence: 'medium', reason_codes: [] },
    { id: 'r2', type: 'schedule_adjustment', title: 'Schedule opening', detail: 'Add one anchor block.', priority: 'low', confidence: 'low', reason_codes: [] }
  ],
  protected_blocks: [
    { id: 'b1', type: 'work', label: 'Team meeting', start: wall('13:00'), end: wall('14:00'), flexibility: 'fixed', source: 'user_entered', confidence: 'high', reason_codes: [] },
    { id: 'b2', type: 'sleep', label: 'Sleep', start: wall('23:15'), end: wall('06:40', '2026-11-17'), flexibility: 'fixed', source: 'user_entered', confidence: 'high', reason_codes: [] }
  ]
};

function sources(overrides: Partial<DayThreadSources> = {}): DayThreadSources {
  return {
    today: TODAY,
    nowMinute: 581,
    briefing,
    lastNight: { minutes: 412 },
    meals: [
      { id: 'm1', logged_at: local(7, 50), name: 'Breakfast', meal_type: 'breakfast', protein_g: 31.4 },
      { id: 'm2', logged_at: local(19, 0, 15), name: 'Yesterday’s dinner', meal_type: 'dinner', protein_g: 40 }
    ],
    water: [
      { id: 'w1', logged_at: local(8, 0), amount_ml: 250 },
      { id: 'w2', logged_at: local(8, 30), amount_ml: 250 }
    ],
    workouts: [],
    plan,
    glassMl: 250,
    ...overrides
  };
}

describe('time conventions', () => {
  it('reads engine times as the wall clock on the UTC axis', () => {
    expect(wallClockMinute(wall('06:40'), TODAY)).toBe(400);
    expect(wallClockMinute(wall('00:30', '2026-11-17'), TODAY)).toBe(1470);
    expect(wallClockMinute(null, TODAY)).toBeNull();
    expect(wallClockMinute('not a date', TODAY)).toBeNull();
  });

  it('reads logged instants on the device clock', () => {
    expect(localMinute(local(7, 50), TODAY)).toBe(470);
    expect(localMinute(local(23, 0, 15), TODAY)).toBe(-60);
  });
});

describe('building the strand input', () => {
  it('passes the curve and windows through unchanged, in minutes', () => {
    const result = buildDayThreadInput(sources());
    expect(result.wakeMinute).toBe(400);
    expect(result.bedMinute).toBe(1395);
    expect(result.curve).toEqual([{ minute: 400, energy: 30 }, { minute: 420, energy: 45 }]);
    expect(result.zones).toEqual([{ start: 540, end: 720, level: 'high' }]);
  });

  it('lists only what was logged or measured today', () => {
    const labels = buildDayThreadInput(sources()).logged.map((item) => item.label);
    expect(labels).toEqual(['Woke · 6h 52m asleep', 'Breakfast · 31 g protein', 'Water · 2 glasses']);
  });

  it('does not invent a wake row when last night is not logged', () => {
    expect(buildDayThreadInput(sources({ lastNight: null })).logged.some((item) => item.id === 'wake')).toBe(false);
  });

  it('adds nothing above now from an empty day, even with a curve', () => {
    expect(buildDayThreadInput(sources({ lastNight: null, meals: [], water: [] })).logged).toEqual([]);
  });

  it('counts glasses only when every entry is a glass', () => {
    const mixed = buildDayThreadInput(sources({ water: [{ id: 'a', logged_at: local(8, 0), amount_ml: 250 }, { id: 'b', logged_at: local(9, 0), amount_ml: 500 }] }));
    expect(mixed.logged.find((item) => item.id === 'water')).toMatchObject({ label: 'Water · 750 mL', minute: 540 });
  });

  it('names a meal by its type when its name is blank, and adds protein only when known', () => {
    const result = buildDayThreadInput(sources({ meals: [{ id: 'x', logged_at: local(12, 30), name: '  ', meal_type: 'lunch', protein_g: null }] }));
    expect(result.logged.find((item) => item.id === 'meal-x')?.label).toBe('Lunch');
  });

  it('lists today’s workouts with their length', () => {
    const result = buildDayThreadInput(sources({ workouts: [{ id: 'k', logged_at: local(8, 45), title: 'Strength', duration_minutes: 60 }] }));
    expect(result.logged.find((item) => item.id === 'workout-k')?.label).toBe('Strength · 60 min');
  });

  it('takes the plan from the day plan, with its real times and the engine’s own words', () => {
    const planned = buildDayThreadInput(sources()).planned;
    expect(planned.find((item) => item.id === 'rec-r1')).toEqual({
      id: 'rec-r1', start: 555, end: 705, title: 'Focus window', detail: '09:15–11:45 · Use your strongest energy window for focused work.'
    });
    expect(planned.some((item) => item.id === 'rec-r2')).toBe(false);
    expect(planned.find((item) => item.id === 'block-b1')).toMatchObject({ title: 'Team meeting', detail: '13:00–14:00', listOnly: true });
    expect(planned.some((item) => item.id === 'block-b2')).toBe(false);
  });

  it('ends the day with wind-down and bed from the rhythm plan', () => {
    const planned = buildDayThreadInput(sources()).planned;
    expect(planned.find((item) => item.id === 'wind-down')).toMatchObject({ start: 1335, title: 'Wind-down' });
    expect(planned.find((item) => item.id === 'bed')).toMatchObject({ start: 1395, title: 'Bed' });
  });

  it('uses the plan’s own wind-down when it has one, so it is not listed twice', () => {
    const withWindDown = {
      ...plan,
      recommendations: [...plan.recommendations, { id: 'r3', type: 'wind_down' as const, title: 'Wind-down', detail: 'Protect wind-down so tomorrow starts cleaner.', start: wall('22:15'), end: wall('23:15'), priority: 'medium' as const, confidence: 'medium' as const, reason_codes: [] }]
    };
    const planned = buildDayThreadInput(sources({ plan: withWindDown })).planned;
    expect(planned.filter((item) => item.title === 'Wind-down')).toHaveLength(1);
  });
});
