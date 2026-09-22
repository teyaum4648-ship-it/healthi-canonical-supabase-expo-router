import { createScopedLogStore, isRecord } from './scopedLogStore';

/**
 * Time outdoors, weighted by when it happened.
 *
 * Total minutes outside is the wrong number. Light sets the body clock, and the same
 * twenty minutes does very different work at 7am than at 7pm — morning light pulls the
 * clock earlier, evening light pushes it later. A feature that summed minutes would tell
 * someone who walks after dinner that they are doing well at the exact thing keeping
 * them up.
 *
 * So each bout carries the window it happened in, and the day's figure is weighted.
 *
 * **Evening light is reported, never penalised.** It would be easy to subtract for it and
 * technically defensible on mechanism, but the resulting advice — "your score dropped
 * because you went for a walk" — is bad advice. Going outside is good. The clock effect
 * is a separate fact, so it gets a separate line, and only when there is enough of it to
 * be worth mentioning.
 *
 * This is a log, not a light meter. It cannot know whether "outside" was overcast dusk or
 * open noon, and the copy says so rather than implying a measurement.
 */

export type LightWindow = 'early' | 'morning' | 'midday' | 'evening' | 'night';

export const LIGHT_WINDOWS: Array<{
  id: LightWindow;
  label: string;
  /** Local clock hours, [from, to). */
  fromHour: number;
  toHour: number;
  /** How much this window counts toward anchoring the clock. */
  weight: number;
  note: string;
}> = [
  { id: 'early', label: 'Early', fromHour: 5, toHour: 9, weight: 1, note: 'The strongest anchor there is. Light in the first hours after waking is what sets the clock.' },
  { id: 'morning', label: 'Morning', fromHour: 9, toHour: 12, weight: 0.8, note: 'Still doing most of the work.' },
  { id: 'midday', label: 'Midday', fromHour: 12, toHour: 16, weight: 0.5, note: 'Brightest light of the day, but the clock is less movable by now.' },
  { id: 'evening', label: 'Evening', fromHour: 16, toHour: 20, weight: 0.15, note: 'Good for you, close to neutral for your clock — and past dusk it starts pushing bedtime later.' },
  { id: 'night', label: 'Night', fromHour: 20, toHour: 5, weight: 0, note: 'Counts as time outside. Does nothing to anchor the clock.' }
];

export function lightWindow(id: LightWindow) {
  return LIGHT_WINDOWS.find((entry) => entry.id === id) ?? LIGHT_WINDOWS[2];
}

/** Night wraps midnight, so it is the fallback rather than a range check. */
export function windowForHour(hour: number): LightWindow {
  const found = LIGHT_WINDOWS.find(
    (entry) => entry.id !== 'night' && hour >= entry.fromHour && hour < entry.toHour
  );
  return found?.id ?? 'night';
}

export type DaylightBout = {
  id: string;
  date: string;
  minutes: number;
  window: LightWindow;
  /** True when the person tapped "I got outside" without saying how long. */
  estimated: boolean;
  loggedAt: string;
};

/**
 * What one tap is worth when no duration is given.
 *
 * The alternative was to demand a number every time, which turns a two-second log into a
 * form and means it stops happening. A marked estimate that is roughly right beats an
 * exact figure nobody enters — but it is marked, because presenting an assumption as a
 * measurement is the thing this app is trying not to do.
 */
export const ASSUMED_MINUTES = 15;

export const MINUTE_CHOICES = [5, 10, 15, 30, 45, 60, 90] as const;

/**
 * `none` means nothing logged. `late` means time outside that cannot anchor anything —
 * after dark, there is no light to respond to. Collapsing the two into one band made the
 * screen say "nothing yet" to someone who had just logged a walk.
 */
export type DaylightAnchor = 'none' | 'late' | 'thin' | 'decent' | 'strong';

export type DaylightDay = {
  bouts: DaylightBout[];
  totalMinutes: number;
  /** Minutes after weighting by window — the figure the anchor band is read from. */
  anchorMinutes: number;
  morningMinutes: number;
  eveningMinutes: number;
  anchor: DaylightAnchor;
  anyEstimated: boolean;
};

export function summariseDaylightDay(bouts: DaylightBout[], date: string): DaylightDay {
  const today = bouts
    .filter((bout) => bout.date === date)
    .sort((left, right) => left.loggedAt.localeCompare(right.loggedAt));

  const totalMinutes = today.reduce((sum, bout) => sum + bout.minutes, 0);
  const anchorMinutes = Math.round(
    today.reduce((sum, bout) => sum + bout.minutes * lightWindow(bout.window).weight, 0)
  );
  const inWindows = (ids: LightWindow[]) =>
    today.filter((bout) => ids.includes(bout.window)).reduce((sum, bout) => sum + bout.minutes, 0);

  return {
    bouts: today,
    totalMinutes,
    anchorMinutes,
    morningMinutes: inWindows(['early', 'morning']),
    eveningMinutes: inWindows(['evening', 'night']),
    /* Healthi's own bands, not a clinical threshold. Ten weighted minutes is the point
       where the log is saying something; thirty is a solid morning. */
    anchor: today.length === 0
      ? 'none'
      : anchorMinutes === 0
        ? 'late'
        : anchorMinutes < 10 ? 'thin' : anchorMinutes < 30 ? 'decent' : 'strong',
    anyEstimated: today.some((bout) => bout.estimated)
  };
}

export function daylightLine(day: DaylightDay): string {
  if (day.bouts.length === 0) return 'No time outside logged today.';
  const about = day.anyEstimated ? 'about ' : '';
  const span = `${about}${day.totalMinutes} ${day.totalMinutes === 1 ? 'minute' : 'minutes'} outside`;
  if (day.morningMinutes > 0) return `${span}, ${day.morningMinutes} of it before noon.`;
  return `${span}, none of it before noon.`;
}

export function anchorHeadline(day: DaylightDay): string {
  switch (day.anchor) {
    case 'strong': return 'Your clock got a clear signal today';
    case 'decent': return 'Enough light to count';
    case 'thin': return 'A little light, early enough to matter';
    case 'late': return 'Logged — but after the light had gone';
    case 'none': return 'Nothing yet to anchor the day';
  }
}

export function anchorDetail(day: DaylightDay): string {
  switch (day.anchor) {
    case 'strong':
      return 'Morning light is the single strongest lever on sleep timing, and you pulled it.';
    case 'decent':
      return 'More of it earlier would do more. Light before noon anchors the clock; light after does much less.';
    case 'thin':
      return 'Even a few minutes early is worth more than an hour at dusk. Getting out before noon is the cheapest change here.';
    case 'late':
      return 'Time outside after dark still counts as time outside — it just cannot move your clock, because there was no light for it to respond to. This lever only works in the morning.';
    case 'none':
      return 'Ten minutes outside in the morning does more for sleep tonight than anything you can do at bedtime.';
  }
}

/**
 * Only surfaced when there is enough evening time for the clock effect to be real, and
 * only when the morning was thin — otherwise it is a fact with no action attached.
 */
export function eveningNote(day: DaylightDay): string | null {
  if (day.eveningMinutes < 30) return null;
  if (day.morningMinutes >= 15) return null;
  return `Most of today's light came late. Evening light nudges your clock later, so if getting to sleep is the problem, moving some of that ${day.eveningMinutes} minutes to the morning is the lever — not cutting it.`;
}

function isBout(value: unknown): value is DaylightBout {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.date === 'string'
    && typeof value.minutes === 'number'
    && typeof value.window === 'string'
    && typeof value.estimated === 'boolean'
    && typeof value.loggedAt === 'string';
}

export const localDaylightStore = createScopedLogStore<DaylightBout>({
  key: 'healthi:practice:daylight:v1',
  isRow: isBout
});
