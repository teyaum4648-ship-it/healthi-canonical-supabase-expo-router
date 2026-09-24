import type { DataConfidence } from '../../types/common';
import { trendDomainTitles } from './trendsCopy';
import type {
  GenerateTrendsSummaryInput,
  TrendMovementEntry,
  TrendNutritionEntry,
  TrendReadinessEntry,
  TrendRhythmEntry,
  TrendScheduleEntry,
  TrendsDirection,
  TrendsDomain,
  TrendsDomainCard,
  TrendsInsight,
  TrendsStatus,
  TrendsSummary
} from './trendsTypes';

const DAY_MS = 24 * 60 * 60 * 1000;

function dateKey(value: string): string {
  return value.slice(0, 10);
}

function inRange<T extends { date: string }>(entries: T[] | undefined, today: string, rangeDays: number): T[] {
  const end = new Date(`${dateKey(today)}T12:00:00.000Z`).getTime();
  const start = end - (rangeDays - 1) * DAY_MS;
  return (entries ?? [])
    .filter((entry) => {
      const value = new Date(`${dateKey(entry.date)}T12:00:00.000Z`).getTime();
      return !Number.isNaN(value) && value >= start && value <= end;
    })
    .sort((left, right) => left.date.localeCompare(right.date));
}

function daysWith<T extends { date: string }>(entries: T[], hasData: (entry: T) => boolean): number {
  return new Set(entries.filter(hasData).map((entry) => dateKey(entry.date))).size;
}

function confidenceFor(count: number): DataConfidence {
  if (count < 3) return 'low';
  if (count < 7) return 'medium';
  return 'high';
}

function average(values: Array<number | null | undefined>): number | null {
  const known = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  if (!known.length) return null;
  return known.reduce((sum, value) => sum + value, 0) / known.length;
}

function direction(values: Array<number | null | undefined>): TrendsDirection {
  const known = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  if (known.length < 3) return 'unknown';
  const split = Math.ceil(known.length / 2);
  const earlier = average(known.slice(0, split));
  const later = average(known.slice(split));
  if (earlier === null || later === null) return 'unknown';
  const delta = later - earlier;
  const threshold = Math.max(0.15, Math.abs(earlier) * 0.05);
  if (Math.abs(delta) < threshold) return 'steady';
  return delta > 0 ? 'up' : 'down';
}

function formatHours(value: number | null): string {
  if (value === null) return 'Calibrating';
  const hours = Math.floor(value);
  const minutes = Math.round((value - hours) * 60);
  return `${hours}h ${String(minutes).padStart(2, '0')}m`;
}

function calibratingCard(domain: TrendsDomain, reasonCode: string, daysLogged: number): TrendsDomainCard {
  return {
    domain,
    title: trendDomainTitles[domain],
    value_label: 'Calibrating',
    detail: 'Log a few more days to reveal a clearer pattern.',
    status: 'calibrating',
    direction: 'unknown',
    confidence: 'low',
    days_logged: daysLogged,
    reason_codes: [reasonCode, 'trends_calibrating']
  };
}

function recoveryCard(entries: TrendRhythmEntry[]): TrendsDomainCard {
  const daysLogged = daysWith(entries, (entry) => typeof entry.sleep_duration_hours === 'number' || typeof entry.sleep_debt_hours === 'number');
  if (entries.length < 3) return calibratingCard('recovery_rhythm', 'rhythm_history_sparse', daysLogged);
  const averageSleep = average(entries.map((entry) => entry.sleep_duration_hours));
  const averageDebt = average(entries.map((entry) => entry.sleep_debt_hours));
  const debtDirection = direction(entries.map((entry) => entry.sleep_debt_hours));
  const sleepDirection = direction(entries.map((entry) => entry.sleep_duration_hours));
  const status: TrendsStatus = debtDirection === 'up' || (averageDebt !== null && averageDebt >= 1.5)
    ? 'watch'
    : averageSleep !== null && averageSleep >= 7
      ? 'supportive'
      : 'steady';
  return {
    domain: 'recovery_rhythm',
    title: trendDomainTitles.recovery_rhythm,
    value_label: averageSleep === null ? 'Sleep logged' : `${formatHours(averageSleep)} average sleep`,
    detail: status === 'watch'
      ? 'Your recent sleep debt is trending higher. A steadier wind-down may be useful.'
      : sleepDirection === 'up'
        ? 'Your logged sleep duration is moving in a supportive direction.'
        : 'Based on your recent sleep window and available rhythm data.',
    status,
    direction: debtDirection === 'up' ? 'down' : sleepDirection,
    confidence: confidenceFor(entries.length),
    days_logged: daysLogged,
    reason_codes: [
      'rhythm_history_available',
      ...(debtDirection === 'up' ? ['sleep_debt_rising'] : []),
      ...(sleepDirection === 'up' ? ['sleep_duration_improving'] : [])
    ]
  };
}

function nourishmentCard(entries: TrendNutritionEntry[]): TrendsDomainCard {
  const daysLogged = daysWith(entries, (entry) => (entry.meal_count ?? 0) > 0);
  if (entries.length < 3) return calibratingCard('nourishment', 'nutrition_history_sparse', daysLogged);
  const loggedDays = entries.filter((entry) => (entry.meal_count ?? 0) > 0).length;
  const avgProtein = average(entries.map((entry) => entry.protein_grams));
  const avgFiber = average(entries.map((entry) => entry.fiber_grams));
  const sugarDirection = direction(entries.map((entry) => entry.added_sugar_grams));
  const watchQuality = entries.some((entry) => entry.food_quality_label === 'watch' || entry.food_response_label === 'watch');
  const status: TrendsStatus = watchQuality || sugarDirection === 'up'
    ? 'watch'
    : loggedDays >= 3 && ((avgProtein ?? 0) > 0 || (avgFiber ?? 0) > 0)
      ? 'supportive'
      : 'steady';
  return {
    domain: 'nourishment',
    title: trendDomainTitles.nourishment,
    value_label: `${loggedDays} logged days`,
    detail: status === 'watch'
      ? 'A few logged meals show a pattern worth watching. Keep logging to add context.'
      : `Your logged meals are building a clearer fueling pattern${avgProtein ? `, with ${Math.round(avgProtein)}g protein on average` : ''}.`,
    status,
    direction: sugarDirection === 'up' ? 'down' : 'steady',
    confidence: confidenceFor(entries.length),
    days_logged: daysLogged,
    reason_codes: ['nutrition_history_available', ...(watchQuality ? ['nutrition_pattern_watch'] : [])]
  };
}

function movementCard(entries: TrendMovementEntry[]): TrendsDomainCard {
  const daysLogged = daysWith(entries, (entry) => (entry.workout_count ?? 0) > 0);
  if (entries.length < 3) return calibratingCard('movement_capacity', 'movement_history_sparse', daysLogged);
  const workouts = entries.reduce((sum, entry) => sum + (entry.workout_count ?? 0), 0);
  const minutes = entries.reduce((sum, entry) => sum + (entry.total_minutes ?? 0), 0);
  const lowReadiness = entries.some((entry) => entry.readiness_label === 'low' || entry.readiness_label === 'conserve');
  const highLoad = entries.some((entry) => entry.training_load_label === 'high');
  const status: TrendsStatus = lowReadiness && highLoad ? 'watch' : workouts > 0 ? 'supportive' : 'steady';
  return {
    domain: 'movement_capacity',
    title: trendDomainTitles.movement_capacity,
    value_label: workouts > 0 ? `${workouts} sessions · ${minutes} min` : 'No sessions logged',
    detail: status === 'watch'
      ? 'Higher effort shows up alongside lower readiness labels. Keep the next session adaptable.'
      : workouts > 0
        ? 'Your movement logs show a consistent capacity signal.'
        : 'No movement sessions were logged in this window.',
    status,
    direction: workouts > 0 ? 'steady' : 'unknown',
    confidence: confidenceFor(entries.length),
    days_logged: daysLogged,
    reason_codes: ['movement_history_available', ...(status === 'watch' ? ['movement_load_watch'] : [])]
  };
}

function scheduleCard(entries: TrendScheduleEntry[]): TrendsDomainCard {
  const daysLogged = daysWith(entries, (entry) => (entry.block_count ?? 0) > 0);
  if (entries.length < 3) return calibratingCard('mind_life_load', 'schedule_history_sparse', daysLogged);
  const averageBlocks = average(entries.map((entry) => entry.block_count)) ?? 0;
  const averageOpen = average(entries.map((entry) => entry.open_window_count));
  const protectedCount = entries.reduce((sum, entry) => sum + (entry.protected_block_count ?? 0), 0);
  const crowded = averageOpen !== null && averageBlocks >= 5 && averageOpen < 1;
  const status: TrendsStatus = crowded ? 'watch' : averageOpen !== null && averageOpen >= 1 ? 'supportive' : 'steady';
  return {
    domain: 'mind_life_load',
    title: trendDomainTitles.mind_life_load,
    value_label: `${Math.round(averageBlocks)} blocks per day`,
    detail: status === 'watch'
      ? 'Your schedule looks full with few open windows. Protecting one flexible block may help.'
      : protectedCount > 0
        ? 'Your schedule includes protected time and useful room to organize the day.'
        : 'Based on the schedule blocks you have logged.',
    status,
    direction: 'steady',
    confidence: confidenceFor(entries.length),
    days_logged: daysLogged,
    reason_codes: ['schedule_history_available', ...(crowded ? ['schedule_density_watch'] : [])]
  };
}

function readinessCard(entries: TrendReadinessEntry[]): TrendsDomainCard {
  const daysLogged = daysWith(entries, (entry) => typeof entry.score === 'number');
  if (entries.length < 3) return calibratingCard('readiness', 'readiness_history_sparse', daysLogged);
  const scores = entries.map((entry) => entry.score);
  const score = average(scores);
  const scoreDirection = direction(scores);
  const status: TrendsStatus = score !== null && score >= 70 ? 'supportive' : score !== null && score < 45 ? 'watch' : 'steady';
  return {
    domain: 'readiness',
    title: trendDomainTitles.readiness,
    value_label: score === null ? 'Readiness logged' : `${Math.round(score)} average`,
    detail: scoreDirection === 'up'
      ? 'Your overall readiness signal is moving upward across logged days.'
      : 'Readiness reflects the available signals without overriding each domain.',
    status,
    direction: scoreDirection,
    confidence: confidenceFor(entries.length),
    days_logged: daysLogged,
    reason_codes: ['readiness_history_available']
  };
}

function overview(cards: TrendsDomainCard[]): TrendsSummary['overview'] {
  const watchCards = cards.filter((card) => card.status === 'watch');
  const supportiveCards = cards.filter((card) => card.status === 'supportive');
  const activeCards = cards.filter((card) => card.status !== 'calibrating');
  if (!activeCards.length) {
    return { headline: 'Your trends are still calibrating.', detail: 'Log a few more days to reveal clearer patterns.', trend_direction: 'calibrating', reason_codes: ['trends_calibrating'] };
  }
  if (watchCards.length) {
    return { headline: 'A few patterns need a lighter touch.', detail: 'These are early signals based on your logged data.', trend_direction: 'needs_attention', reason_codes: ['trends_watch_pattern'] };
  }
  if (supportiveCards.length >= 2) {
    return { headline: 'Your logged patterns look supportive.', detail: 'Keep the habits that are showing up steadily.', trend_direction: 'improving', reason_codes: ['trends_supportive_pattern'] };
  }
  return { headline: 'Your recent pattern looks steady.', detail: 'More logged days will make the picture more specific.', trend_direction: 'steady', reason_codes: ['trends_steady_pattern'] };
}

function nextFocus(cards: TrendsDomainCard[]): TrendsSummary['next_focus'] {
  const candidates = cards.filter((card) => card.domain !== 'readiness');
  const watch = candidates.find((card) => card.status === 'watch');
  if (watch) return { domain: watch.domain as Exclude<TrendsDomain, 'readiness'>, title: `Support ${watch.title.toLowerCase()}`, detail: watch.detail, reason_codes: [...watch.reason_codes, 'next_focus_watch'] };
  const calibrating = candidates.find((card) => card.status === 'calibrating');
  if (calibrating) return { domain: calibrating.domain as Exclude<TrendsDomain, 'readiness'>, title: `Build your ${calibrating.title.toLowerCase()} signal`, detail: calibrating.detail, reason_codes: [...calibrating.reason_codes, 'next_focus_calibrating'] };
  return { domain: 'balanced', title: 'Keep the pattern steady', detail: 'Your available signals are moving together. Continue logging the parts of your day that matter most.', reason_codes: ['next_focus_balanced'] };
}

function insights(cards: TrendsDomainCard[]): TrendsInsight[] {
  const chosen = [...cards.filter((card) => card.status === 'watch'), ...cards.filter((card) => card.status === 'supportive')].slice(0, 4);
  if (!chosen.length) return [{ id: 'calibrating', title: 'A clearer pattern is forming', detail: 'Your next few logs will help Healthi organize more useful trends.', domain: 'balanced', priority: 'low', confidence: 'low', reason_codes: ['trends_calibrating'] }];
  return chosen.map((card) => ({ id: `${card.domain}-${card.status}`, title: card.title, detail: card.detail, domain: card.domain, priority: card.status === 'watch' ? 'high' : 'low', confidence: card.confidence, reason_codes: [...card.reason_codes] }));
}

export function generateTrendsSummary(input: GenerateTrendsSummaryInput): TrendsSummary {
  const rangeDays = input.range_days ?? 7;
  const rhythm = inRange(input.rhythmHistory, input.today, rangeDays);
  const nutrition = inRange(input.nutritionHistory, input.today, rangeDays);
  const movement = inRange(input.movementHistory, input.today, rangeDays);
  const schedule = inRange(input.scheduleHistory, input.today, rangeDays);
  const readiness = inRange(input.readinessHistory, input.today, rangeDays);
  const domainCards = [recoveryCard(rhythm), nourishmentCard(nutrition), movementCard(movement), scheduleCard(schedule), readinessCard(readiness)];
  const missing = domainCards.filter((card) => card.status === 'calibrating').map((card) => card.domain);
  const knownDays = [rhythm.length, nutrition.length, movement.length, schedule.length, readiness.length].filter((count) => count >= 3);
  const sourceLabel = input.source_label ?? (knownDays.length ? 'logged' : 'calibrating');
  return {
    generated_at: `${dateKey(input.today)}T12:00:00.000Z`,
    range_days: rangeDays,
    confidence: confidenceFor(Math.max(0, ...knownDays)),
    source_label: sourceLabel,
    overview: overview(domainCards),
    domain_cards: domainCards,
    days_logged: new Set([...rhythm, ...nutrition, ...movement, ...schedule, ...readiness].map((entry) => dateKey(entry.date))).size,
    insights: insights(domainCards),
    next_focus: nextFocus(domainCards),
    missing_data: missing
  };
}
