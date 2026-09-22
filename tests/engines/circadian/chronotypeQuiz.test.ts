import { describe, expect, it } from 'vitest';

import {
  CHRONOTYPE_QUESTIONS,
  MIDDLE_CLOCK_MID_SLEEP_MINUTES,
  scoreChronotype,
  suggestDayArchitecture
} from '../../../src/engines/circadian/chronotypeQuiz';
import { estimateCircadianPhase } from '../../../src/engines/circadian/circadianPhase';
import type { SleepSession } from '../../../src/engines/circadian';

/**
 * The quiz, and what it is allowed to claim.
 *
 * Measuring a body clock takes two weeks of logged nights, and someone who installed the
 * app this morning has none — so the schedule it offers on day one is either a guess
 * wearing a plan's clothes or nothing at all. Asking is the third option, and the whole
 * design rests on the answer being a starting position that real nights overrule.
 *
 * So the two things worth testing are that it reads a clock correctly from answers, and
 * that it gets out of the way: a week of logged nights has to be able to move the estimate
 * off whatever the quiz said, or the app has locked someone into a questionnaire.
 */

const answers = (over: Record<string, string> = {}) => ({
  free_day_wake: 'middle',
  free_day_sleep: 'middle',
  morning_alertness: 'medium',
  sharpest: 'afternoon',
  training_preference: 'late_afternoon',
  evening_sleepiness: 'middle',
  ...over
});

const earlyAnswers = answers({
  free_day_wake: 'very_early', free_day_sleep: 'very_early', morning_alertness: 'immediate',
  sharpest: 'early_morning', training_preference: 'early_morning', evening_sleepiness: 'very_early'
});

const lateAnswers = answers({
  free_day_wake: 'very_late', free_day_sleep: 'very_late', morning_alertness: 'long',
  sharpest: 'evening', training_preference: 'evening', evening_sleepiness: 'very_late'
});

function night(date: string, startHour: number, durationHours = 8): SleepSession {
  const start = new Date(`${date}T00:00:00.000Z`);
  start.setUTCHours(startHour);
  const end = new Date(start.getTime() + durationHours * 3600_000);
  return {
    date,
    sleep_start_at: start.toISOString(),
    sleep_end_at: end.toISOString(),
    duration_minutes: durationHours * 60,
    source: 'manual',
    source_confidence: 'high',
    reason_codes: [],
    created_at: `${date}T12:00:00.000Z`
  };
}

describe('reading a clock from answers', () => {
  it('puts an early answerer earlier and a late one later', () => {
    const early = scoreChronotype(earlyAnswers);
    const late = scoreChronotype(lateAnswers);

    expect(early.chronotype).toBe('early_clock');
    expect(late.chronotype).toBe('late_clock');
    expect(early.offsetMinutes).toBeLessThan(0);
    expect(late.offsetMinutes).toBeGreaterThan(0);
  });

  it('leaves a middling answerer in the middle', () => {
    const middle = scoreChronotype(answers());
    expect(middle.chronotype).toBe('middle_clock');
    expect(Math.abs(middle.preferredMidSleepMinutes - MIDDLE_CLOCK_MID_SLEEP_MINUTES)).toBeLessThanOrEqual(25);
  });

  it('weighs the free-day questions hardest', () => {
    // What someone does with no alarm says more than what they believe about mornings.
    const freeDaysEarly = scoreChronotype(answers({ free_day_wake: 'very_early', free_day_sleep: 'very_early' }));
    const opinionsEarly = scoreChronotype(answers({ sharpest: 'early_morning', training_preference: 'early_morning' }));
    expect(freeDaysEarly.offsetMinutes).toBeLessThan(opinionsEarly.offsetMinutes);
  });

  it('drops unanswered questions instead of assuming a middle answer', () => {
    const partial = scoreChronotype({ free_day_wake: 'very_late' });
    expect(partial.answeredCount).toBe(1);
    expect(partial.confidence).toBe('low');
    expect(partial.reason_codes).toContain('chronotype_partially_answered');
    // One late answer should still read late rather than being diluted toward the middle.
    expect(partial.offsetMinutes).toBeGreaterThan(60);
  });

  it('never claims more than a questionnaire can support', () => {
    // Even a complete quiz is medium at best: what people believe about their mornings
    // and what their clock does are different things.
    expect(scoreChronotype(earlyAnswers).confidence).toBe('medium');
    expect(scoreChronotype({}).confidence).toBe('low');
    expect(scoreChronotype({}).reason_codes).toContain('chronotype_not_answered');
    expect(scoreChronotype(earlyAnswers).reason_codes).toContain('chronotype_self_reported');
  });

  it('keeps mid-sleep on the clock face', () => {
    for (const result of [scoreChronotype(earlyAnswers), scoreChronotype(lateAnswers), scoreChronotype(answers())]) {
      expect(result.preferredMidSleepMinutes).toBeGreaterThanOrEqual(0);
      expect(result.preferredMidSleepMinutes).toBeLessThan(1440);
    }
  });
});

describe('the day it suggests', () => {
  it('builds the day around the clock it found, not around a fixed hour', () => {
    const early = suggestDayArchitecture({ preferredMidSleepMinutes: scoreChronotype(earlyAnswers).preferredMidSleepMinutes });
    const late = suggestDayArchitecture({ preferredMidSleepMinutes: scoreChronotype(lateAnswers).preferredMidSleepMinutes });

    const wakeOf = (slots: typeof early) => slots.find((slot) => slot.id === 'wake')!.startMinutes;
    expect(wakeOf(early)).toBeLessThan(wakeOf(late));
  });

  it('gives every slot a reason a person can disagree with', () => {
    // The point of offering rather than imposing is that someone can reject the reasoning,
    // not just the time.
    for (const slot of suggestDayArchitecture({ preferredMidSleepMinutes: 210 })) {
      expect(slot.why.length).toBeGreaterThan(20);
      expect(slot.startMinutes).toBeGreaterThanOrEqual(0);
      expect(slot.startMinutes).toBeLessThan(1440);
      expect(slot.endMinutes).toBeLessThan(1440);
    }
  });

  it('puts training after the dip and the last coffee well before sleep', () => {
    const slots = suggestDayArchitecture({ preferredMidSleepMinutes: 210, sleepNeedMinutes: 480 });
    const at = (id: string) => slots.find((slot) => slot.id === id)!;
    const wake = at('wake').startMinutes;
    const since = (minutes: number) => ((minutes - wake) % 1440 + 1440) % 1440;

    expect(since(at('training').startMinutes)).toBeGreaterThan(since(at('afternoon_dip').startMinutes));
    expect(since(at('deep_work').startMinutes)).toBeLessThan(since(at('afternoon_dip').startMinutes));
    expect(since(at('caffeine_cutoff').startMinutes)).toBeLessThan(since(at('sleep').startMinutes));
  });
});

describe('the quiz as a starting position', () => {
  it('yields a clock before a single night has been logged', () => {
    const quiz = scoreChronotype(lateAnswers);
    const estimate = estimateCircadianPhase({ sessions: [], priorMidSleepMinutes: quiz.preferredMidSleepMinutes });

    expect(estimate).not.toBeNull();
    expect(estimate!.source).toBe('self_reported');
    expect(estimate!.nightsUsed).toBe(0);
    expect(estimate!.confidence).toBe('low');
    expect(estimate!.phaseMinutes).toBe(quiz.preferredMidSleepMinutes);
  });

  it('gets out of the way once real nights arrive', () => {
    // Someone who answered "late" but actually sleeps 10pm to 6am. Within a week the
    // estimate has to be near what they do, or the app has locked them into a quiz.
    const quiz = scoreChronotype(lateAnswers);
    const sessions = ['01', '02', '03', '04', '05', '06', '07']
      .map((day) => night(`2026-09-${day}`, 22));

    const estimate = estimateCircadianPhase({ sessions, priorMidSleepMinutes: quiz.preferredMidSleepMinutes })!;
    expect(estimate.source).toBe('measured');
    expect(estimate.nightsUsed).toBe(7);

    const behavioural = estimate.behaviouralMinutes!;
    const gap = Math.abs(((estimate.phaseMinutes - behavioural + 720) % 1440) - 720);
    expect(gap).toBeLessThan(60);
  });

  it('still reads nights when no quiz was taken', () => {
    const sessions = ['01', '02', '03'].map((day) => night(`2026-09-${day}`, 23));
    const estimate = estimateCircadianPhase({ sessions })!;
    expect(estimate.source).toBe('measured');
    expect(estimate.nightsUsed).toBe(3);
  });
});

describe('what the quiz may not borrow', () => {
  it('uses none of the branded chronotype vocabulary', () => {
    const copy = [
      ...CHRONOTYPE_QUESTIONS.flatMap((question) => [
        question.prompt, question.note ?? '', ...question.options.map((option) => option.label)
      ]),
      ...['early_clock', 'late_clock', 'middle_clock'].map((id) => {
        const result = scoreChronotype(id === 'early_clock' ? earlyAnswers : id === 'late_clock' ? lateAnswers : answers());
        return `${result.label} ${result.summary}`;
      })
    ].join(' ').toLowerCase();

    // Animal-named schemes are somebody's brand, and published morningness
    // questionnaires are somebody's instrument.
    for (const term of ['bear', 'lion', 'wolf', 'dolphin', 'morningness', 'eveningness questionnaire', 'meq']) {
      expect(copy).not.toContain(term);
    }
    for (const term of ['diagnos', 'disorder', 'insomnia', 'treat', 'prescri']) {
      expect(copy).not.toContain(term);
    }
  });
});
