import { describe, expect, it } from 'vitest';

import { generateDayPlan } from '../../../src/engines/dayPlan';
import {
  buildDayPlanInput,
  createDemoScheduleBlockRow,
  createEmptyScheduleBlockForm,
  createScheduleBlockFormForWindow,
  isValidScheduleTimeInput,
  scheduleBlockFormToInput
} from '../../../src/features/dayPlan/scheduleBlockForms';

describe('schedule block form helpers', () => {
  it('prefills a one-hour block from a selected calendar time', () => {
    expect(createScheduleBlockFormForWindow('2026-08-09T14:00:00.000Z', 'exercise')).toMatchObject({
      date: '2026-08-09',
      block_type: 'exercise',
      start_time: '14:00',
      end_time: '15:00'
    });
  });

  it('creates a valid schedule block payload from the UI form shape', () => {
    const form = {
      ...createEmptyScheduleBlockForm('2026-07-12'),
      title: 'Class',
      block_type: 'class' as const,
      start_time: '10:00',
      end_time: '11:30',
      flexibility: 'fixed' as const,
      is_protected: true,
      description: 'Lecture',
      location: 'Campus'
    };
    const result = scheduleBlockFormToInput(form, 'manual');

    expect(result).toEqual({
      ok: true,
      input: {
        block_date: '2026-07-12',
        start_at: '2026-07-12T10:00:00.000Z',
        end_at: '2026-07-12T11:30:00.000Z',
        block_type: 'class',
        title: 'Class',
        description: 'Lecture',
        location: 'Campus',
        flexibility: 'fixed',
        is_protected: true,
        source: 'manual',
        source_confidence: 'medium',
        reason_codes: ['manual_schedule_block']
      }
    });
  });

  it('supports overnight blocks from simple 24-hour inputs', () => {
    const result = scheduleBlockFormToInput(
      {
        ...createEmptyScheduleBlockForm('2026-07-12'),
        block_type: 'sleep',
        title: 'Sleep',
        start_time: '22:30',
        end_time: '06:30'
      },
      'demo'
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.input.end_at).toBe('2026-07-13T06:30:00.000Z');
      expect(result.input.reason_codes).toEqual(['manual_schedule_block', 'demo_schedule_data']);
    }
  });

  it('rejects invalid time inputs safely', () => {
    expect(isValidScheduleTimeInput('09:00')).toBe(true);
    expect(isValidScheduleTimeInput('17:30')).toBe(true);
    expect(isValidScheduleTimeInput('25:00')).toBe(false);
    expect(isValidScheduleTimeInput('9pm')).toBe(false);

    const result = scheduleBlockFormToInput({
      ...createEmptyScheduleBlockForm('2026-07-12'),
      start_time: '9pm'
    });

    expect(result).toEqual({
      ok: false,
      error: 'Use 24-hour times like 09:00 or 17:30.'
    });
  });

  it('passes schedule blocks into generateDayPlan through the input builder', () => {
    const formResult = scheduleBlockFormToInput({
      ...createEmptyScheduleBlockForm('2026-07-12'),
      title: 'Work',
      start_time: '09:00',
      end_time: '12:00'
    }, 'demo');

    expect(formResult.ok).toBe(true);
    if (!formResult.ok) return;

    const row = createDemoScheduleBlockRow(formResult.input, 'demo-user', '2026-07-12T08:00:00.000Z');
    const input = buildDayPlanInput({
      date: '2026-07-12',
      scheduleBlocks: [row]
    });
    const result = generateDayPlan(input);

    expect(input.schedule_blocks).toHaveLength(1);
    expect(input.schedule_blocks[0]?.label).toBe('Work');
    expect(result.protected_blocks.map((block) => block.label)).toContain('Work');
    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
  });

  it('passes unified readiness mode, confidence, and reasons into Day Plan', () => {
    const input = buildDayPlanInput({
      date: '2026-07-12',
      scheduleBlocks: [],
      readinessScore: 61,
      readinessMode: 'correct',
      readinessConfidence: 'medium',
      readinessReasonCodes: ['readiness_conserve', 'primary_focus_recovery_rhythm']
    });

    expect(input.readiness).toEqual({
      score: 61,
      mode: 'correct',
      confidence: 'medium',
      reason_codes: ['readiness_conserve', 'primary_focus_recovery_rhythm']
    });
  });
});
