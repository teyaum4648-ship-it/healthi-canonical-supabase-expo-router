import { describe, expect, it } from 'vitest';

import { loadBand, sessionLoad, summarizeLoad, type LoadSession } from '../../../src/engines/load';

const today = '2026-09-26';
const session = (session_date: string, duration_minutes: number | null, perceived_effort: number | null): LoadSession => ({ session_date, duration_minutes, perceived_effort });

describe('sessionLoad', () => {
  it('is minutes times effort', () => {
    expect(sessionLoad(session(today, 45, 6))).toBe(270);
  });

  it('refuses to guess when effort or minutes are missing or off the scale', () => {
    expect(sessionLoad(session(today, 45, null))).toBeNull();
    expect(sessionLoad(session(today, null, 6))).toBeNull();
    expect(sessionLoad(session(today, 45, 11))).toBeNull();
    expect(sessionLoad(session(today, 0, 5))).toBeNull();
  });
});

describe('loadBand', () => {
  it('bands effort-minutes from rest to very heavy', () => {
    expect(loadBand(0)).toBe('rest');
    expect(loadBand(150)).toBe('light');
    expect(loadBand(420)).toBe('moderate');
    expect(loadBand(720)).toBe('heavy');
    expect(loadBand(960)).toBe('very_heavy');
  });
});

describe('summarizeLoad', () => {
  it('calls a day with nothing logged a rest day, in neutral', () => {
    const summary = summarizeLoad([], today);
    expect(summary.today).toEqual({ load: 0, sessions: 0, unrated: 0 });
    expect(summary.label).toBe('Rest day');
    expect(summary.zone).toBe('neutral');
    expect(summary.series).toHaveLength(7);
  });

  it('adds up today and the week, and counts active days', () => {
    const summary = summarizeLoad([
      session('2026-09-21', 35, 5),
      session('2026-09-23', 45, 7),
      session(today, 40, 6),
      session(today, 20, 4),
      session('2026-09-10', 90, 9)
    ], today);
    expect(summary.today.load).toBe(320);
    expect(summary.band).toBe('moderate');
    expect(summary.zone).toBe('optimal');
    expect(summary.weekTotal).toBe(175 + 315 + 320);
    expect(summary.activeDays).toBe(3);
    expect(summary.confidence).toBe('high');
  });

  it('marks heavy days in the warning zone and very heavy ones in the critical zone', () => {
    expect(summarizeLoad([session(today, 90, 8)], today).zone).toBe('warning');
    expect(summarizeLoad([session(today, 120, 9)], today).zone).toBe('critical');
  });

  it('leaves an unrated session out, says so, and lowers confidence', () => {
    const summary = summarizeLoad([session(today, 40, 6), session(today, 30, null)], today);
    expect(summary.today).toEqual({ load: 240, sessions: 2, unrated: 1 });
    expect(summary.confidence).toBe('low');
    expect(summary.reason_codes).toContain('load_session_without_effort');
    expect(summary.insight).toContain('One session has no effort rating');
  });

  it('never encourages training through pain or uses clinical language', () => {
    for (const minutes of [0, 30, 60, 90, 150]) {
      const { insight } = summarizeLoad(minutes ? [session(today, minutes, 7)] : [], today);
      expect(insight).not.toMatch(/pain|push through|diagnos|clinical|guarantee/i);
    }
  });
});
