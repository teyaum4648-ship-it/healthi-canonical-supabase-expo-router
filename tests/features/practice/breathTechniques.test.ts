import { describe, expect, it } from 'vitest';

import {
  BREATH_TECHNIQUES,
  breathsPerMinute,
  CYCLE_TECHNIQUES,
  cycleMs,
  patternLine,
  phaseTarget,
  techniqueById
} from '../../../src/features/practice/breathTechniques';

/**
 * The ids that other things point at. Sessions already stored on devices carry these, and
 * zoneModel names them directly — dropping one makes techniqueById fall back to Settle
 * silently, which paced every tension release at the wrong tempo until a test caught it.
 */
const LOAD_BEARING_IDS = ['settle', 'wind_down', 'steady', 'zone'];

describe('the technique library', () => {
  it('keeps every id that stored data or other modules depend on', () => {
    for (const id of LOAD_BEARING_IDS) {
      expect(BREATH_TECHNIQUES.some((t) => t.id === id), id).toBe(true);
    }
  });

  it('has unique ids', () => {
    const ids = BREATH_TECHNIQUES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('falls back rather than returning undefined', () => {
    expect(techniqueById('does-not-exist').id).toBe('settle');
  });

  it('gives every technique at least one inhale and one exhale', () => {
    for (const technique of BREATH_TECHNIQUES) {
      expect(technique.phases.some((p) => p.kind === 'inhale'), technique.id).toBe(true);
      expect(technique.phases.some((p) => p.kind === 'exhale'), technique.id).toBe(true);
      expect(cycleMs(technique), technique.id).toBeGreaterThan(0);
    }
  });

  it('separates cycling techniques from rounds', () => {
    expect(CYCLE_TECHNIQUES.every((t) => t.structure === 'cycle')).toBe(true);
    const rounds = BREATH_TECHNIQUES.filter((t) => t.structure === 'rounds');
    expect(rounds.length).toBeGreaterThan(0);
    // A rounds technique is useless without its plan.
    for (const technique of rounds) {
      expect(technique.rounds, technique.id).toBeDefined();
      expect(technique.rounds!.breaths).toBeGreaterThan(0);
      expect(technique.rounds!.count).toBeGreaterThan(0);
    }
  });
});

describe('phases the old inhale/hold/exhale model could not express', () => {
  it('box breathing holds after the exhale, not just after the inhale', () => {
    const kinds = techniqueById('box').phases.map((p) => p.kind);
    expect(kinds).toEqual(['inhale', 'hold', 'exhale', 'hold_empty']);
  });

  it('the physiological sigh is two inhales, the first only part of the way up', () => {
    const phases = techniqueById('sigh').phases;
    expect(phases.filter((p) => p.kind === 'inhale')).toHaveLength(2);
    expect(phases[0].to).toBeLessThan(1);
    expect(phases[0].to).toBeGreaterThan(0);
  });

  it('alternate nostril cues every phase, because the hands have to know', () => {
    for (const phase of techniqueById('alternate_nostril').phases) {
      expect(phase.cue).toBeTruthy();
      expect(phase.cue).toMatch(/left|right/i);
    }
  });
});

describe('phaseTarget', () => {
  it('sends an inhale to full and an exhale to empty by default', () => {
    expect(phaseTarget({ kind: 'inhale', ms: 1000 }, 0)).toBe(1);
    expect(phaseTarget({ kind: 'exhale', ms: 1000 }, 1)).toBe(0);
  });

  it('holds wherever it already is, full or empty', () => {
    expect(phaseTarget({ kind: 'hold', ms: 1000 }, 1)).toBe(1);
    expect(phaseTarget({ kind: 'hold_empty', ms: 1000 }, 0)).toBe(0);
  });

  it('honours an explicit target, which is what makes a double inhale possible', () => {
    expect(phaseTarget({ kind: 'inhale', ms: 1000, to: 0.68 }, 0)).toBe(0.68);
  });
});

describe('derived figures', () => {
  it('reads a pattern back as a line', () => {
    expect(patternLine(techniqueById('box'))).toBe('4 in · 4 hold · 4 out · 4 hold');
    expect(patternLine(techniqueById('settle'))).toBe('4 in · 8 out');
  });

  it('counts breaths per minute, including techniques with two inhales', () => {
    // Settle is a 12s cycle with one inhale -> 5/min.
    expect(breathsPerMinute(techniqueById('settle'))).toBe(5);
    // Box is a 16s cycle with one inhale -> 3.8/min.
    expect(breathsPerMinute(techniqueById('box'))).toBe(3.8);
    /*
     * Alternate nostril has two inhales in a 20s cycle, so it is 6/min rather than the
     * 3/min a naive one-breath-per-cycle count would report.
     */
    expect(breathsPerMinute(techniqueById('alternate_nostril'))).toBe(6);
  });

  it('puts the stimulating technique far above the calming ones', () => {
    const rounds = techniqueById('cyclic_hyperventilation');
    expect(breathsPerMinute(rounds)).toBeGreaterThan(breathsPerMinute(techniqueById('settle')) * 3);
  });
});

describe('safety', () => {
  it('gates the only technique that can make someone faint', () => {
    const rounds = techniqueById('cyclic_hyperventilation');
    expect(rounds.requiresAcknowledgement).toBe(true);
    expect(rounds.caution).toBeTruthy();
  });

  it('names water in that caution, because that is the one that kills people', () => {
    expect(techniqueById('cyclic_hyperventilation').caution).toMatch(/water/i);
  });

  it('only marks acknowledgement-required on techniques that carry a caution', () => {
    for (const technique of BREATH_TECHNIQUES) {
      if (technique.requiresAcknowledgement) {
        expect(technique.caution, technique.id).toBeTruthy();
      }
    }
  });

  it('does not overclaim on alternate nostril', () => {
    // The hemisphere-balancing story is not supported; the copy says so on purpose.
    const why = techniqueById('alternate_nostril').why;
    expect(why).toMatch(/not well supported|not going to make them/i);
  });
});
