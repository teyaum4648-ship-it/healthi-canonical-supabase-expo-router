import type { DailyReadinessDomain, DailyReadinessResult } from '../../engines/readiness/readinessTypes';
import { localDay } from '../../utils/localDay';

/** Experimental demo policy, not a validated physiological model. */
export const READINESS_NOW_POLICY = { version: 1, freshnessMinutes: 120, waterReviewHours: 4, foodReviewHours: 6 } as const;
export type IntakeAnswer = 'some' | 'none' | 'unknown';
export type ReadinessCheckin = {
  id: string;
  at: string;
  woke_at: string | null;
  food: IntakeAnswer;
  water: IntakeAnswer;
  energy: 'steady' | 'tired' | 'unknown';
  demand: 'usual' | 'demanding' | 'unknown';
};
export type ReadinessReminderPreferences = {
  enabled: boolean;
  lunchTime: string;
  delayMinutes: 30 | 45 | 60;
  snoozedUntil: string | null;
  dismissedDay: string | null;
};
export const defaultReadinessReminders: ReadinessReminderPreferences = {
  enabled: false, lunchTime: '12:30', delayMinutes: 45, snoozedUntil: null, dismissedDay: null
};
export const domainNames: Record<DailyReadinessDomain, string> = {
  recovery_rhythm: 'Recovery + Rhythm', nourishment: 'Nourishment',
  movement_capacity: 'Movement Capacity', mind_life_load: 'Mind + Life Load'
};
const validTime = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value));
export function isReadinessCheckin(value: unknown): value is ReadinessCheckin {
  if (!value || typeof value !== 'object') return false;
  const v = value as ReadinessCheckin;
  return typeof v.id === 'string' && Boolean(v.id) && validTime(v.at) &&
    (v.woke_at === null || (validTime(v.woke_at) && Date.parse(v.woke_at) <= Date.parse(v.at) && Date.parse(v.at) - Date.parse(v.woke_at) <= 24 * 3600000)) &&
    ['some', 'none', 'unknown'].includes(v.food) && ['some', 'none', 'unknown'].includes(v.water) &&
    ['steady', 'tired', 'unknown'].includes(v.energy) && ['usual', 'demanding', 'unknown'].includes(v.demand);
}
export function isReminderPreferences(value: unknown): value is ReadinessReminderPreferences {
  if (!value || typeof value !== 'object') return false;
  const v = value as ReadinessReminderPreferences;
  return typeof v.enabled === 'boolean' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(v.lunchTime) &&
    [30, 45, 60].includes(v.delayMinutes) && (v.snoozedUntil === null || validTime(v.snoozedUntil)) &&
    (v.dismissedDay === null || /^\d{4}-\d{2}-\d{2}$/.test(v.dismissedDay));
}
export function localWakeTimestamp(clock: string, yesterday: boolean, now: Date): string | null {
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(clock)) return null;
  const date = new Date(now);
  if (yesterday) date.setDate(date.getDate() - 1);
  const [hour, minute] = clock.split(':').map(Number);
  date.setHours(hour, minute, 0, 0);
  const age = now.getTime() - date.getTime();
  // Reject nonexistent wall-clock times at the spring DST transition.
  return date.getHours() === hour && date.getMinutes() === minute && age >= 0 && age <= 24 * 3600000 ? date.toISOString() : null;
}

export type ReadinessNowInput = {
  now: string; base: DailyReadinessResult; checkins: ReadinessCheckin[];
  mealTimes: string[]; waterTimes: string[]; safetyActive?: boolean;
};
export function evaluateReadinessNow(input: ReadinessNowInput) {
  const now = Date.parse(input.now);
  if (!Number.isFinite(now)) throw new Error('A valid current time is required.');
  const day = localDay(input.now);
  const checkin = input.checkins.filter(isReadinessCheckin).filter(c => localDay(c.at) === day && Date.parse(c.at) <= now)
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))[0] ?? null;
  const ageMinutes = checkin ? (now - Date.parse(checkin.at)) / 60000 : null;
  const answered = checkin && [checkin.food, checkin.water, checkin.energy, checkin.demand].some(value => value !== 'unknown');
  const fresh = Boolean(answered && ageMinutes !== null && ageMinutes <= READINESS_NOW_POLICY.freshnessMinutes);
  const awakeHours = checkin?.woke_at ? (now - Date.parse(checkin.woke_at)) / 3600000 : null;
  const unknown: string[] = [];
  const reasons: string[] = [];
  const evidence = (times: string[]) => times.filter(t => validTime(t) && localDay(t) === day && Date.parse(t) <= now);
  const meals = evidence(input.mealTimes);
  const water = evidence(input.waterTimes);
  const hasLater = (times: string[]) => times.some(t => checkin && Date.parse(t) > Date.parse(checkin.at));
  const sinceWake = (times: string[]) => times.some(t => checkin?.woke_at && Date.parse(t) >= Date.parse(checkin.woke_at));
  const foodNone = fresh && checkin?.food === 'none' && !hasLater(meals) && !sinceWake(meals);
  const waterNone = fresh && checkin?.water === 'none' && !hasLater(water) && !sinceWake(water);
  if (fresh && checkin?.food === 'none' && sinceWake(meals) && !hasLater(meals)) unknown.push('Your food answer differs from a meal logged since waking. No no-food adjustment is applied.');
  if (fresh && checkin?.water === 'none' && sinceWake(water) && !hasLater(water)) unknown.push('Your water answer differs from water logged since waking. No no-water adjustment is applied.');
  if (!fresh) unknown.push(checkin && answered ? 'Your last check-in is over two hours old. Update it before using a current estimate.' : 'A quick check-in will put today’s logs in context.');
  for (const domain of input.base.missing_data) unknown.push(`${domainNames[domain as DailyReadinessDomain] ?? 'Foundation'} evidence is incomplete.`);
  if (awakeHours === null) unknown.push('Wake time is unknown; time-awake intake rules are not applied.');
  if (!meals.length && (!fresh || checkin?.food === 'unknown')) unknown.push('No food information for today. This does not mean you have not eaten.');
  if (!water.length && (!fresh || checkin?.water === 'unknown')) unknown.push('No water information for today. This does not mean you have not had a drink.');
  if (fresh && checkin?.food === 'some' && !meals.length) unknown.push('Food confirmed, but portions and nutrition are not yet logged.');
  if (fresh && checkin?.water === 'some' && !water.length) unknown.push('Water confirmed, but amount is not yet logged.');
  if (fresh && checkin?.energy === 'unknown') unknown.push('Current energy is unknown.');
  if (fresh && checkin?.demand === 'unknown') unknown.push('Today’s demand is unknown.');
  const ledger = (input.base.contributions?.domains ?? []).map(d => ({ ...d, before: d.contribution, explanation: null as string | null }));
  function limit(domain: DailyReadinessDomain, contribution: number, reason: string, explanation: string) {
    reasons.push(reason);
    const row = ledger.find(d => d.domain === domain);
    if (!row) return;
    // Replace a domain contribution, never stack deductions for the same foundation.
    row.contribution = Math.min(row.contribution, contribution);
    row.explanation = row.explanation ? `${row.explanation} ${explanation}` : explanation;
    row.reasons = [...row.reasons, reason];
  }
  if (waterNone && awakeHours !== null && awakeHours >= READINESS_NOW_POLICY.waterReviewHours)
    limit('nourishment', -4, 'confirmed_no_water_after_wake_grace', 'You confirmed no water after several hours awake. Consider a drink and reassess how you feel.');
  if (foodNone && awakeHours !== null && awakeHours >= READINESS_NOW_POLICY.foodReviewHours)
    limit('nourishment', -4, 'confirmed_no_food_after_wake_grace', 'You confirmed no food after several hours awake. Consider your fueling needs before a demanding session.');
  if (fresh && checkin?.energy === 'tired')
    limit('movement_capacity', -5, 'current_energy_tired', 'You reported feeling tired. Keep movement flexible and reassess before adding intensity.');
  if (fresh && checkin?.demand === 'demanding')
    limit('mind_life_load', -4, 'current_day_demanding', 'You described today as demanding. Leave room for a pause or a lighter session.');
  const safe = input.safetyActive || input.base.mode === 'professional_guidance';
  const enough = input.base.date === day && input.base.label !== 'calibrating' && input.base.missing_data.length < 3 && ledger.length === 4;
  const state = safe ? 'safety_guidance' : !enough ? 'building_context' : !fresh ? 'update_needed' : 'current';
  if (!enough) unknown.push('More foundation data is needed before showing a readiness number. A check-in alone cannot fill those gaps.');
  const score = Math.min(100, Math.max(0, (input.base.contributions?.baseline ?? 70) + ledger.reduce((sum, d) => sum + d.contribution, 0)));
  const attention = ledger.filter(d => d.explanation || (!d.missing && d.contribution < 0)).map(d => ({
    domain: d.domain, text: d.explanation ?? input.base.driver_cards.find(c => c.domain === d.domain)?.detail ?? 'This foundation is limiting today’s estimate.'
  }));
  return {
    policyVersion: READINESS_NOW_POLICY.version, state, publicScore: state === 'current' ? score : null,
    calculatedScore: score, confidence: state !== 'current' || unknown.length || input.base.confidence === 'low' ? 'low' as const : 'medium' as const,
    checkin, ageMinutes, awakeHours, ledger, unknown, attention,
    supporting: ledger.filter(d => !d.missing && d.contribution > 0).map(d => ({ domain: d.domain, text: input.base.driver_cards.find(c => c.domain === d.domain)?.detail ?? 'A supportive recorded signal.' })),
    reason_codes: [...input.base.reason_codes, ...reasons, `readiness_now_${state}`],
    title: state === 'safety_guidance' ? 'Follow your safety guidance' : state === 'building_context' ? 'Building your picture' : state === 'update_needed' ? 'Let’s check in' : attention.length ? 'A little support may help' : 'Your current picture',
    summary: safe ? 'This check-in does not override your safety guidance or movement limits.' : state === 'current' ? 'A wellness estimate from your recorded foundations and latest check-in—not a measurement of your body or clearance to train.' : 'Today’s direction is a starting point, not a live reading of how you feel now.'
  };
}

/** A reminder only while Home is open. Silence outside 08:00–21:00 local time. */
export function shouldRemindAboutLunch(now: string, prefs: ReadinessReminderPreferences, mealTimes: string[], checkins: ReadinessCheckin[]) {
  if (!validTime(now) || !isReminderPreferences(prefs) || !prefs.enabled) return false;
  const date = new Date(now), day = localDay(date);
  if (date.getHours() < 8 || date.getHours() >= 21 || prefs.dismissedDay === day || (prefs.snoozedUntil && Date.parse(prefs.snoozedUntil) > date.getTime())) return false;
  const [h, m] = prefs.lunchTime.split(':').map(Number);
  const lunch = new Date(date); lunch.setHours(h, m, 0, 0);
  const due = lunch.getTime() + prefs.delayMinutes * 60000;
  if (date.getTime() < due) return false;
  // A recent food record or confirmation is enough to avoid nagging. Never infer a missed meal.
  const after = lunch.getTime() - 60 * 60000;
  return !mealTimes.some(t => validTime(t) && Date.parse(t) >= after && Date.parse(t) <= date.getTime()) &&
    !checkins.some(c => isReadinessCheckin(c) && c.food === 'some' && Date.parse(c.at) >= after && Date.parse(c.at) <= date.getTime());
}
