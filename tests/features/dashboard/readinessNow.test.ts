import { describe, expect, it } from 'vitest';
import { generateDailyReadiness } from '../../../src/engines/readiness';
import { defaultReadinessReminders, evaluateReadinessNow, isReadinessCheckin, localWakeTimestamp, shouldRemindAboutLunch, type ReadinessCheckin } from '../../../src/features/dashboard/readinessNow';
import { localDay } from '../../../src/utils/localDay';

const at = (hour: number, minute = 0, day = 11) => new Date(2026, 8, day, hour, minute).toISOString();
const base = () => generateDailyReadiness({
  date: localDay(at(9)), rhythm: { sleep_duration_hours: 7.5, confidence: 'high' },
  nutrition: { meal_count: 1, readiness_adjustment: 2, food_quality_label: 'steady', confidence: 'high' },
  movement: { readiness_label: 'steady', confidence: 'high' },
  schedule: { block_count: 1, open_window_count: 2, confidence: 'high' }
});
const check = (hour = 19, overrides: Partial<ReadinessCheckin> = {}): ReadinessCheckin => ({ id: 'check', at: at(hour), woke_at: at(7), food: 'none', water: 'none', energy: 'steady', demand: 'usual', ...overrides });
function run(hour = 19, checkins: ReadinessCheckin[] = [check(hour)], extra: Partial<Parameters<typeof evaluateReadinessNow>[0]> = {}) {
  return evaluateReadinessNow({ now: at(hour), base: base(), checkins, mealTimes: [], waterTimes: [], ...extra });
}

describe('readiness now demo invariants', () => {
  it('exposes the original daily contribution ledger without changing its score', () => {
    const result = base();
    expect(result.contributions?.domains).toHaveLength(4);
    expect(result.score).toBe(Math.min(100, Math.max(0, result.contributions!.baseline + result.contributions!.domains.reduce((n, d) => n + d.contribution, 0))));
  });
  it('never deducts for absent logs, at 9 AM or 7 PM, and still shows the foundations\' number', () => {
    for (const hour of [9, 19]) {
      const result = run(hour, []);
      expect(result.calculatedScore).toBe(base().score);
      expect(result.publicScore).toBe(base().score);
      expect(result.confidence).toBe('low');
      expect(result.unknown.join(' ')).toContain('does not mean');
    }
  });
  it('allows a recently awakened person time for their routine', () => {
    expect(run(9, [check(9)]).publicScore).toBe(base().score);
  });
  it('uses time awake rather than a blanket evening penalty', () => {
    expect(run(19, [check(19, { woke_at: at(18) })]).publicScore).toBe(base().score);
    expect(run().publicScore).toBeLessThan(base().score);
  });
  it('drops an old morning check-in in the evening instead of inventing intake, and keeps the number', () => {
    const result = run(19, [check(9)]);
    expect(result.state).toBe('update_needed');
    expect(result.publicScore).toBe(base().score);
    expect(result.confidence).toBe('low');
    expect(result.calculatedScore).toBe(base().score);
  });
  it('does not make an all-skipped check-in current', () => {
    const result = run(19, [check(19, { food: 'unknown', water: 'unknown', energy: 'unknown', demand: 'unknown' })]);
    expect(result.state).toBe('update_needed');
    expect(result.confidence).toBe('low');
    expect(result.publicScore).toBe(base().score);
    expect(result.calculatedScore).toBe(base().score);
  });
  it('does not run time-awake rules without a confirmed wake time', () => {
    const result = run(19, [check(19, { woke_at: null })]);
    expect(result.calculatedScore).toBe(base().score);
    expect(result.unknown.join()).toContain('Wake time is unknown');
  });
  it('replaces nourishment once rather than double-counting water plus food', () => {
    const both = run();
    const waterOnly = run(19, [check(19, { food: 'some' })]);
    expect(both.publicScore).toBe(waterOnly.publicScore);
    expect(both.ledger.find(d => d.domain === 'nourishment')?.contribution).toBe(-4);
    expect(both.reason_codes).toContain('confirmed_no_food_after_wake_grace');
    expect(both.reason_codes).toContain('confirmed_no_water_after_wake_grace');
  });
  it('never compounds a pre-existing stronger nourishment limitation', () => {
    const initial = base();
    initial.contributions!.domains.find(d => d.domain === 'nourishment')!.contribution = -8;
    const result = run(19, [check()], { base: initial });
    expect(result.ledger.find(d => d.domain === 'nourishment')?.contribution).toBe(-8);
  });
  it('does not repeatedly deduct on every clock tick', () => {
    const first = run();
    const later = run(19, [check()], { now: at(19, 59) });
    expect(first.calculatedScore).toBe(later.calculatedScore);
  });
  it('expires negative and positive confirmations equally, back to the foundations at low confidence', () => {
    const result = run(22, [check(19)]);
    expect(result.state).toBe('update_needed');
    expect(result.publicScore).toBe(base().score);
    expect(result.confidence).toBe('low');
    expect(result.reason_codes).not.toContain('confirmed_no_food_after_wake_grace');
  });
  it('new meal and water logs supersede an earlier not-yet answer', () => {
    const result = run(20, [check(19)], { mealTimes: [at(19, 15)], waterTimes: [at(19, 30)] });
    expect(result.calculatedScore).toBe(base().score);
    expect(result.reason_codes).not.toContain('confirmed_no_water_after_wake_grace');
  });
  it('conflicting earlier logs do not become a no-intake deduction', () => {
    const result = run(19, [check()], { mealTimes: [at(12)], waterTimes: [at(13)] });
    expect(result.calculatedScore).toBe(base().score);
    expect(result.unknown.join(' ')).toContain('differs');
  });
  it('future logs cannot erase a confirmed signal', () => {
    expect(run(19, [check()], { mealTimes: [at(20)], waterTimes: [at(20)] }).calculatedScore).toBe(run().calculatedScore);
  });
  it('check-ins do not boost a score just for confirming intake or steady energy', () => {
    const result = run(19, [check(19, { food: 'some', water: 'some' })]);
    expect(result.publicScore).toBe(base().score);
    expect(result.confidence).toBe('low'); // Amounts remain unknown.
  });
  it('preserves safety/professional guidance regardless of strong signals', () => {
    expect(run(19, [check()], { safetyActive: true }).state).toBe('safety_guidance');
    expect(run(19, [check()], { base: { ...base(), mode: 'professional_guidance' } }).publicScore).toBeNull();
  });
  it('a check-in cannot substitute for absent foundations or a legacy ledger', () => {
    expect(run(19, [check()], { base: generateDailyReadiness({ date: localDay(at(19)) }) }).state).toBe('building_context');
    expect(run(19, [check()], { base: { ...base(), contributions: undefined } }).publicScore).toBeNull();
  });
  it('gives every changed contribution a visible explanation and reason', () => {
    const result = run(19, [check(19, { energy: 'tired', demand: 'demanding' })]);
    for (const row of result.ledger.filter(d => d.before !== d.contribution)) {
      expect(row.explanation).toBeTruthy();
      expect(row.reasons.length).toBeGreaterThan(0);
      expect(result.attention.some(a => a.domain === row.domain)).toBe(true);
    }
  });
  it('keeps the input immutable and produces the same result for the same inputs', () => {
    const initial = base(), copy = JSON.stringify(initial);
    expect(run(19, [check()], { base: initial })).toEqual(run(19, [check()], { base: initial }));
    expect(JSON.stringify(initial)).toBe(copy);
  });
  it('uses only the latest valid check-in, never future or previous-day answers', () => {
    expect(run(19, [check(20)]).checkin).toBeNull();
    expect(run(19, [check(19, { at: at(19, 0, 10), woke_at: at(7, 0, 10) })]).checkin).toBeNull();
    expect(run(19, [check(18), check(19, { energy: 'tired' })]).checkin?.energy).toBe('tired');
  });
  it('invalid and future wake times are rejected', () => {
    expect(isReadinessCheckin(check(19, { woke_at: at(20) }))).toBe(false);
    expect(isReadinessCheckin(check(19, { woke_at: 'invalid' }))).toBe(false);
    expect(localWakeTimestamp('25:30', false, new Date(at(19)))).toBeNull();
    expect(localWakeTimestamp('20:00', false, new Date(at(19)))).toBeNull();
    expect(localWakeTimestamp('07:00', false, new Date(at(19)))).toBe(at(7));
    expect(localWakeTimestamp('23:00', true, new Date(at(1)))).toBe(at(23, 0, 10));
  });
  it('midnight resets current context, not the stored history', () => {
    const history = [check(23)];
    const result = run(0, history, { now: at(0, 5, 12), base: { ...base(), date: localDay(at(0, 5, 12)) } });
    expect(result.checkin).toBeNull();
    expect(result.state).toBe('update_needed');
    expect(result.confidence).toBe('low');
    expect(history).toHaveLength(1);
  });
});

describe('optional in-app lunch reminders', () => {
  const prefs = { ...defaultReadinessReminders, enabled: true };
  it('defaults off and does not request OS permission', () => expect(shouldRemindAboutLunch(at(14), defaultReadinessReminders, [], [])).toBe(false));
  it('uses the chosen delay', () => {
    expect(shouldRemindAboutLunch(at(13, 14), prefs, [], [])).toBe(false);
    expect(shouldRemindAboutLunch(at(13, 15), prefs, [], [])).toBe(true);
  });
  it('supports snooze and a per-day dismissal', () => {
    expect(shouldRemindAboutLunch(at(14), { ...prefs, snoozedUntil: at(14, 30) }, [], [])).toBe(false);
    expect(shouldRemindAboutLunch(at(14), { ...prefs, dismissedDay: localDay(at(14)) }, [], [])).toBe(false);
    expect(shouldRemindAboutLunch(at(14, 0, 12), { ...prefs, dismissedDay: localDay(at(14)) }, [], [])).toBe(true);
  });
  it('respects quiet hours', () => {
    expect(shouldRemindAboutLunch(at(22), prefs, [], [])).toBe(false);
    expect(shouldRemindAboutLunch(at(7), { ...prefs, lunchTime: '06:00' }, [], [])).toBe(false);
  });
  it('does not nag after a meal or confirmation, but a future log does not count', () => {
    expect(shouldRemindAboutLunch(at(14), prefs, [at(12)], [])).toBe(false);
    expect(shouldRemindAboutLunch(at(14), prefs, [], [check(13, { food: 'some' })])).toBe(false);
    expect(shouldRemindAboutLunch(at(14), prefs, [at(18)], [])).toBe(true);
  });
});
