import type {
  DayPlanMode,
  DayScheduleBlockType,
  GenerateDayPlanInput
} from '../../engines/dayPlan';
import {
  dayScheduleBlockRowToEngineBlock,
  type DayScheduleBlockPersistenceFlexibility,
  type DayScheduleBlockPersistenceInput,
  type DayScheduleBlockPersistenceSource,
  type DayScheduleBlockRow
} from './scheduleBlockPersistence';

export const scheduleBlockTypes: DayScheduleBlockType[] = [
  'work',
  'class',
  'commute',
  'exercise',
  'meal',
  'free_time',
  'recovery',
  'social',
  'appointment',
  'sleep',
  'other'
];

export const scheduleBlockFlexibilities: DayScheduleBlockPersistenceFlexibility[] = ['fixed', 'flexible', 'movable'];

export type ScheduleBlockFormState = {
  title: string;
  block_type: DayScheduleBlockType;
  date: string;
  start_time: string;
  end_time: string;
  flexibility: DayScheduleBlockPersistenceFlexibility;
  is_protected: boolean;
  description: string;
  location: string;
};

export type ScheduleBlockFormResult =
  | {
      ok: true;
      input: DayScheduleBlockPersistenceInput;
    }
  | {
      ok: false;
      error: string;
    };

export function createEmptyScheduleBlockForm(date = new Date().toISOString().slice(0, 10)): ScheduleBlockFormState {
  return {
    title: '',
    block_type: 'work',
    date,
    start_time: '09:00',
    end_time: '17:00',
    flexibility: 'fixed',
    is_protected: true,
    description: '',
    location: ''
  };
}

export function isValidDateInput(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) return false;
  const parsed = new Date(`${value.trim()}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime());
}

export function isValidScheduleTimeInput(value: string): boolean {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return false;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
}

function isoForDateAndTime(date: string, time: string): string {
  const [hours, minutes] = time.trim().split(':').map(Number);
  return `${date.trim()}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00.000Z`;
}

function addOneDay(value: string): string {
  return new Date(new Date(value).getTime() + 24 * 60 * 60 * 1000).toISOString();
}

export function scheduleBlockFormToInput(
  form: ScheduleBlockFormState,
  source: DayScheduleBlockPersistenceSource = 'manual'
): ScheduleBlockFormResult {
  const date = form.date.trim();
  const startTime = form.start_time.trim();
  const endTime = form.end_time.trim();

  if (!isValidDateInput(date)) {
    return { ok: false, error: 'Use a date like 2026-07-12.' };
  }

  if (!isValidScheduleTimeInput(startTime) || !isValidScheduleTimeInput(endTime)) {
    return { ok: false, error: 'Use 24-hour times like 09:00 or 17:30.' };
  }

  const startAt = isoForDateAndTime(date, startTime);
  const sameDayEndAt = isoForDateAndTime(date, endTime);
  const endAt = new Date(sameDayEndAt).getTime() <= new Date(startAt).getTime() ? addOneDay(sameDayEndAt) : sameDayEndAt;

  return {
    ok: true,
    input: {
      block_date: date,
      start_at: startAt,
      end_at: endAt,
      block_type: form.block_type,
      title: form.title.trim() || defaultScheduleBlockTitle(form.block_type),
      description: form.description.trim() || null,
      location: form.location.trim() || null,
      flexibility: form.flexibility,
      is_protected: form.is_protected,
      source,
      source_confidence: 'medium',
      reason_codes: source === 'demo' ? ['manual_schedule_block', 'demo_schedule_data'] : ['manual_schedule_block']
    }
  };
}

export function createDemoScheduleBlockRow(
  input: DayScheduleBlockPersistenceInput,
  userId = 'demo-user',
  now = new Date().toISOString()
): DayScheduleBlockRow {
  return {
    id: `local-schedule-${Date.now()}`,
    user_id: userId,
    block_date: input.block_date ?? input.start_at.slice(0, 10),
    start_at: input.start_at,
    end_at: input.end_at,
    block_type: input.block_type,
    title: input.title ?? defaultScheduleBlockTitle(input.block_type),
    description: input.description ?? null,
    location: input.location ?? null,
    flexibility: input.flexibility ?? 'fixed',
    is_protected: input.is_protected ?? true,
    source: input.source ?? 'demo',
    source_confidence: input.source_confidence ?? 'medium',
    reason_codes: [...(input.reason_codes ?? ['demo_schedule_data'])],
    created_at: now,
    updated_at: now
  };
}

export function defaultScheduleBlockTitle(type: DayScheduleBlockType): string {
  return type
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function addMinutes(value: string, minutes: number): string {
  return new Date(new Date(value).getTime() + minutes * 60 * 1000).toISOString();
}

export function createFallbackRhythmInput(date: string, wakeTime?: string, targetBedtime?: string): NonNullable<GenerateDayPlanInput['rhythm']> {
  const wake = wakeTime ?? `${date.slice(0, 10)}T06:30:00.000Z`;
  const bedtime = targetBedtime ?? `${date.slice(0, 10)}T22:30:00.000Z`;
  const deepStart = addMinutes(wake, 120);
  const deepEnd = addMinutes(wake, 300);
  const exerciseStart = addMinutes(wake, 450);
  const exerciseEnd = addMinutes(wake, 600);
  const caffeineCutoff = addMinutes(bedtime, -480);
  const windDownStart = addMinutes(bedtime, -90);

  return {
    energy_windows: [
      {
        start: deepStart,
        end: deepEnd,
        label: 'Estimated high-energy window',
        intensity: 'high'
      }
    ],
    deep_work_window: {
      start: deepStart,
      end: deepEnd
    },
    exercise_window: {
      start: exerciseStart,
      end: exerciseEnd
    },
    caffeine_cutoff: caffeineCutoff,
    wind_down_start: windDownStart
  };
}

export function buildDayPlanInput(params: {
  date: string;
  scheduleBlocks: DayScheduleBlockRow[];
  wake_time?: string;
  target_bedtime?: string;
  readinessScore?: number;
  readinessMode?: DayPlanMode;
  nutritionMealCount?: number;
}): GenerateDayPlanInput {
  const date = params.date.slice(0, 10);
  const wakeTime = params.wake_time ?? `${date}T06:30:00.000Z`;
  const targetBedtime = params.target_bedtime ?? `${date}T22:30:00.000Z`;

  return {
    date,
    wake_time: wakeTime,
    target_bedtime: targetBedtime,
    schedule_blocks: params.scheduleBlocks.map(dayScheduleBlockRowToEngineBlock),
    rhythm: createFallbackRhythmInput(date, wakeTime, targetBedtime),
    readiness: {
      score: params.readinessScore ?? 72,
      mode: params.readinessMode ?? 'maintain',
      confidence: 'low',
      reason_codes: ['low_confidence_inputs']
    },
    nutrition:
      typeof params.nutritionMealCount === 'number'
        ? {
            readiness_adjustment: 0,
            confidence: 'low',
            meal_count: params.nutritionMealCount,
            food_response_label: params.nutritionMealCount > 0 ? 'steady' : 'unknown',
            reason_codes: params.nutritionMealCount > 0 ? ['food_response_logged'] : ['nutrition_calibrating']
          }
        : undefined,
    movement: {
      training_readiness: 'medium',
      preferred_training_time: null,
      reason_codes: ['movement_window_matched']
    }
  };
}
