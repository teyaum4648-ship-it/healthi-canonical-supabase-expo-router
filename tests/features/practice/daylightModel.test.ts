import { describe, expect, it } from 'vitest';

import {
  anchorDetail,
  anchorHeadline,
  ASSUMED_MINUTES,
  daylightLine,
  eveningNote,
  LIGHT_WINDOWS,
  lightWindow,
  summariseDaylightDay,
  windowForHour,
  type DaylightBout,
  type LightWindow
} from '../../../src/features/practice/daylightModel';

function bout(minutes: number, window: LightWindow, opts: Partial<DaylightBout> = {}): DaylightBout {
  return {
    id: `b-${window}-${minutes}-${opts.loggedAt ?? ''}`,
    date: '2026-09-16',
    minutes,
    window,
    estimated: false,
    loggedAt: '2026-09-16T08:00:00.000Z',
    ...opts
  };
}

describe('windowForHour', () => {
  it('maps the clock to a window', () => {
    expect(windowForHour(6)).toBe('early');
    expect(windowForHour(10)).toBe('morning');
    expect(windowForHour(13)).toBe('midday');
    expect(windowForHour(18)).toBe('evening');
  });

  it('wraps midnight into night rather than falling through', () => {
    expect(windowForHour(21)).toBe('night');
    expect(windowForHour(0)).toBe('night');
    expect(windowForHour(3)).toBe('night');
    expect(windowForHour(4)).toBe('night');
    expect(windowForHour(5)).toBe('early');
  });

  it('covers all 24 hours with no gaps', () => {
    for (let hour = 0; hour < 24; hour++) {
      expect(LIGHT_WINDOWS.some((w) => w.id === windowForHour(hour))).toBe(true);
    }
  });
});

describe('weighting', () => {
  it('weights earlier light more heavily, monotonically through the day', () => {
    const order: LightWindow[] = ['early', 'morning', 'midday', 'evening', 'night'];
    const weights = order.map((id) => lightWindow(id).weight);
    for (let i = 1; i < weights.length; i++) {
      expect(weights[i]).toBeLessThanOrEqual(weights[i - 1]);
    }
    expect(lightWindow('early').weight).toBe(1);
    expect(lightWindow('night').weight).toBe(0);
  });

  it('values the same minutes more in the morning than the evening', () => {
    const morning = summariseDaylightDay([bout(30, 'early')], '2026-09-16');
    const evening = summariseDaylightDay([bout(30, 'evening')], '2026-09-16');

    expect(morning.totalMinutes).toBe(evening.totalMinutes);
    expect(morning.anchorMinutes).toBeGreaterThan(evening.anchorMinutes);
  });

  it('never penalises evening light — the anchor figure cannot go down', () => {
    /*
     * Evening light does push the clock later, but "your score dropped because you went
     * for a walk" is bad advice. The clock effect is a separate note, not a subtraction.
     */
    const morningOnly = summariseDaylightDay([bout(20, 'early')], '2026-09-16');
    const plusEvening = summariseDaylightDay([bout(20, 'early'), bout(60, 'evening')], '2026-09-16');

    expect(plusEvening.anchorMinutes).toBeGreaterThanOrEqual(morningOnly.anchorMinutes);
    for (const w of LIGHT_WINDOWS) expect(w.weight).toBeGreaterThanOrEqual(0);
  });
});

describe('summariseDaylightDay', () => {
  it('keeps only today', () => {
    const day = summariseDaylightDay(
      [bout(20, 'early'), { ...bout(90, 'midday'), date: '2026-09-15' }],
      '2026-09-16'
    );
    expect(day.bouts).toHaveLength(1);
    expect(day.totalMinutes).toBe(20);
  });

  it('splits morning from evening minutes', () => {
    const day = summariseDaylightDay(
      [bout(10, 'early'), bout(15, 'morning'), bout(40, 'evening'), bout(5, 'night')],
      '2026-09-16'
    );
    expect(day.morningMinutes).toBe(25);
    expect(day.eveningMinutes).toBe(45);
  });

  it('distinguishes nothing logged from logged-too-late', () => {
    /*
     * Both have an anchor figure of zero, and for a while both said "nothing yet to
     * anchor the day" — which read as a failed log to anyone who had just tapped.
     */
    const empty = summariseDaylightDay([], '2026-09-16');
    const afterDark = summariseDaylightDay([bout(15, 'night')], '2026-09-16');

    expect(empty.anchorMinutes).toBe(0);
    expect(afterDark.anchorMinutes).toBe(0);

    expect(empty.anchor).toBe('none');
    expect(afterDark.anchor).toBe('late');

    expect(anchorHeadline(empty)).not.toBe(anchorHeadline(afterDark));
    expect(anchorHeadline(afterDark)).toMatch(/Logged/);
    expect(anchorDetail(afterDark)).toMatch(/still counts/);
  });

  it('bands the anchor by weighted minutes', () => {
    expect(summariseDaylightDay([], '2026-09-16').anchor).toBe('none');
    expect(summariseDaylightDay([bout(5, 'early')], '2026-09-16').anchor).toBe('thin');
    expect(summariseDaylightDay([bout(20, 'early')], '2026-09-16').anchor).toBe('decent');
    expect(summariseDaylightDay([bout(40, 'early')], '2026-09-16').anchor).toBe('strong');
  });

  it('carries the estimated flag so copy can hedge', () => {
    const exact = summariseDaylightDay([bout(20, 'early')], '2026-09-16');
    const tapped = summariseDaylightDay([bout(ASSUMED_MINUTES, 'early', { estimated: true })], '2026-09-16');

    expect(exact.anyEstimated).toBe(false);
    expect(tapped.anyEstimated).toBe(true);
    expect(daylightLine(tapped)).toMatch(/about/);
    expect(daylightLine(exact)).not.toMatch(/about/);
  });

  it('has something to say on an empty day', () => {
    const day = summariseDaylightDay([], '2026-09-16');
    expect(daylightLine(day)).toMatch(/No time outside/);
    expect(anchorHeadline(day)).toBeTruthy();
    expect(anchorDetail(day)).toBeTruthy();
  });
});

describe('eveningNote', () => {
  it('stays quiet when the morning was already handled', () => {
    const day = summariseDaylightDay([bout(30, 'early'), bout(60, 'evening')], '2026-09-16');
    expect(eveningNote(day)).toBeNull();
  });

  it('stays quiet when there is too little evening light to matter', () => {
    const day = summariseDaylightDay([bout(10, 'evening')], '2026-09-16');
    expect(eveningNote(day)).toBeNull();
  });

  it('speaks up when the light came late and the morning was thin', () => {
    const day = summariseDaylightDay([bout(60, 'evening')], '2026-09-16');
    const note = eveningNote(day);
    expect(note).toMatch(/later/);
    // Framed as moving light earlier, never as cutting the walk.
    expect(note).toMatch(/not cutting it/);
  });
});
