/**
 * Breathing, as a set of named techniques rather than one circle with a dial on it.
 *
 * The old model was `{ inhaleMs, holdMs, exhaleMs }`, which cannot express most of what
 * people actually practise. Box breathing needs a hold *after* the exhale. A
 * physiological sigh is two inhales. Alternate nostril needs to say which nostril, and
 * when. So a technique is now a sequence of phases, and the pacer walks the sequence.
 *
 * Each one carries when to reach for it and why it does anything, because "here is a
 * circle" is not a feature — the choice between techniques is the feature, and a person
 * cannot make that choice without knowing that a long exhale settles and a fast round
 * stimulates. Several of these are opposites; shipping them without saying so would be
 * worse than shipping one.
 *
 * Claims are kept to what the mechanism supports. Slow breathing with a long exhale has a
 * clear physiological story. "Balancing the brain's hemispheres" does not, so alternate
 * nostril is described by what it verifiably does — occupies your hands and your attention
 * while you breathe slowly — rather than by the folklore attached to it.
 */

export type BreathPhaseKind = 'inhale' | 'hold' | 'exhale' | 'hold_empty';

export type BreathPhase = {
  kind: BreathPhaseKind;
  ms: number;
  /**
   * Shown while this phase runs. Needed for anything the hands do, and for a technique
   * whose phases are not self-evident from the circle growing or shrinking.
   */
  cue?: string;
  /**
   * Where the circle should be at the end of this phase, 0 to 1. Defaults to 1 for an
   * inhale and 0 for an exhale, which is right for everything except a technique with
   * two inhales in a row — the first one only gets part of the way there.
   */
  to?: number;
};

/** A cycle repeats until stopped. Rounds have their own structure and their own screen. */
export type BreathStructure = 'cycle' | 'rounds';

export type BreathTechnique = {
  id: string;
  name: string;
  /** One line under the name in a list. */
  summary: string;
  /** When to reach for this one instead of another. */
  when: string;
  /** Why it does anything. Mechanism, hedged where the evidence is thin. */
  why: string;
  structure: BreathStructure;
  phases: BreathPhase[];
  /** What a useful session looks like. */
  suggestedMinutes: number;
  icon: string;
  /** Shown before the technique can be started, when there is a real reason to be careful. */
  caution?: string;
  /**
   * True when the caution has to be acknowledged before a first run rather than merely
   * displayed. Reserved for the techniques that can actually hurt someone.
   */
  requiresAcknowledgement?: boolean;
  /** Rounds only. */
  rounds?: {
    count: number;
    /** Fast, full breaths at the top of each round. */
    breaths: number;
    breathMs: number;
    /** The recovery hold after the retention, which is a fixed length. */
    recoveryHoldMs: number;
  };
};

export const BREATH_TECHNIQUES: BreathTechnique[] = [
  {
    id: 'settle',
    name: 'Settle',
    summary: 'In for four, out for eight',
    when: 'A racing morning, or any moment you need to come down off something. The first thing to try.',
    why: 'Breathing out is the half of the cycle that slows the heart, so making the exhale twice the inhale is the longest lever you have without equipment. It works within a few breaths, which is why it is first on this list.',
    structure: 'cycle',
    phases: [
      { kind: 'inhale', ms: 4000 },
      { kind: 'exhale', ms: 8000 }
    ],
    suggestedMinutes: 2,
    icon: 'trending-down-outline'
  },
  {
    id: 'sigh',
    name: 'Physiological sigh',
    summary: 'Two breaths in, one long breath out',
    when: 'Mid-spike, when you have seconds rather than minutes. One to three breaths, not a session.',
    why: 'A second, shorter inhale on top of a full one reinflates air sacs that have collapsed, which lets the long exhale clear more carbon dioxide in one go. It is the fastest of these, and it is the thing your body already does on its own when you sob or sigh.',
    structure: 'cycle',
    phases: [
      { kind: 'inhale', ms: 1800, to: 0.68, cue: 'In through the nose' },
      { kind: 'inhale', ms: 1100, cue: 'Top it up' },
      { kind: 'exhale', ms: 6000, cue: 'Long, slow out through the mouth' }
    ],
    suggestedMinutes: 1,
    icon: 'arrow-up-outline'
  },
  {
    id: 'wind_down',
    name: 'Wind down',
    summary: 'In, a pause at the top, then a slower way out',
    when: 'The last half hour before bed. This is the pace the sleep tab has always used, so it is the familiar one if you have been following that.',
    why: 'A shorter hold than 4-7-8 and a shorter exhale, which makes it gentler to sustain for ten minutes rather than four. The pause at the top is what separates it from Settle — it slows the rate further without asking for a longer out-breath.',
    structure: 'cycle',
    phases: [
      { kind: 'inhale', ms: 4000 },
      { kind: 'hold', ms: 3500, cue: 'Pause at the top' },
      { kind: 'exhale', ms: 5000 }
    ],
    suggestedMinutes: 10,
    icon: 'cloudy-night-outline'
  },
  {
    id: 'box',
    name: 'Box breathing',
    summary: 'Four equal sides: in, hold, out, hold',
    when: 'Before something you are nervous about. When you need to be steady rather than sleepy — a long exhale can leave you a little too soft for a hard conversation.',
    why: 'Equal phases slow your rate to about four breaths a minute, and the two holds give attention somewhere to go. Much of what it does is that second part: a pattern with four counted sides is hard to do while also spiralling. It is taught to people who work under pressure for exactly that reason.',
    structure: 'cycle',
    phases: [
      { kind: 'inhale', ms: 4000 },
      { kind: 'hold', ms: 4000, cue: 'Hold, full' },
      { kind: 'exhale', ms: 4000 },
      { kind: 'hold_empty', ms: 4000, cue: 'Hold, empty' }
    ],
    suggestedMinutes: 4,
    icon: 'square-outline'
  },
  {
    id: 'steady',
    name: 'Steady',
    summary: 'Equal in, hold, and out',
    when: 'Holding a line rather than coming down off something. Mid-task, when you want to stay where you are.',
    why: 'Three equal phases, so nothing about it pushes you in either direction. It is the closest thing here to a neutral pace, which is the point: not every moment calls for an intervention.',
    structure: 'cycle',
    phases: [
      { kind: 'inhale', ms: 4000 },
      { kind: 'hold', ms: 4000, cue: 'Hold' },
      { kind: 'exhale', ms: 4000 }
    ],
    suggestedMinutes: 4,
    icon: 'remove-outline'
  },
  {
    id: 'coherent',
    name: 'Coherent breathing',
    summary: 'Five and a half seconds each way',
    when: 'A daily practice rather than a rescue. Five to ten minutes, ideally at the same time each day.',
    why: 'Around five to six breaths a minute, the rhythm of your breathing and the rhythm of your heart rate line up, and the swing between them is at its widest. That swing is heart rate variability, and this is the pace that maximises it in most people. It is unremarkable to do and the least dramatic thing here, which is rather the point.',
    structure: 'cycle',
    phases: [
      { kind: 'inhale', ms: 5500 },
      { kind: 'exhale', ms: 5500 }
    ],
    suggestedMinutes: 10,
    icon: 'infinite-outline'
  },
  {
    id: 'four_seven_eight',
    name: '4-7-8',
    summary: 'In four, hold seven, out eight',
    when: 'Lying in bed, trying to get to sleep. Too strong for the middle of a working day.',
    why: 'A long hold followed by an even longer exhale, which pushes the rate down to about three breaths a minute. The hold is what makes it more demanding than Settle, and the reason it belongs at the end of the day rather than the start.',
    structure: 'cycle',
    phases: [
      { kind: 'inhale', ms: 4000 },
      { kind: 'hold', ms: 7000, cue: 'Hold' },
      { kind: 'exhale', ms: 8000 }
    ],
    suggestedMinutes: 4,
    icon: 'moon-outline',
    caution: 'The seven-second hold makes some people lightheaded at first. Do this sitting or lying down, and shorten the hold rather than pushing through it.'
  },
  {
    id: 'zone',
    name: 'Zone pace',
    summary: 'Slow and unforced, five each way',
    when: 'Underneath a movement rather than on its own. This is what the tension releases on this tab are paced to.',
    why: 'Slow enough to lengthen a stretch on every exhale, even enough that you are not thinking about the breath while also thinking about the hip. Near the same tempo as coherent breathing, for the same reason — it is where slow breathing stops being work.',
    structure: 'cycle',
    phases: [
      { kind: 'inhale', ms: 5000 },
      { kind: 'exhale', ms: 5000 }
    ],
    suggestedMinutes: 3,
    icon: 'body-outline'
  },
  {
    id: 'alternate_nostril',
    name: 'Alternate nostril',
    summary: 'One side in, the other side out',
    when: 'Scattered, with a few minutes and somewhere private. Before focused work rather than before sleep.',
    why: 'Honestly: most of what this does is the two things you can verify. You are breathing slowly, and you are running a hand pattern that takes enough attention to crowd out whatever you were chewing on. Claims about balancing the two halves of the brain are not well supported and this app is not going to make them.',
    structure: 'cycle',
    phases: [
      { kind: 'inhale', ms: 4000, cue: 'Right thumb closes the right nostril · in through the left' },
      { kind: 'exhale', ms: 6000, cue: 'Switch: ring finger closes the left · out through the right' },
      { kind: 'inhale', ms: 4000, cue: 'Stay there · in through the right' },
      { kind: 'exhale', ms: 6000, cue: 'Switch back · out through the left' }
    ],
    suggestedMinutes: 5,
    icon: 'swap-horizontal-outline',
    caution: 'Skip it if your nose is blocked — forcing air through one side of a congested nose is unpleasant and does nothing useful.'
  },
  {
    id: 'cyclic_hyperventilation',
    name: 'Cyclic breathing rounds',
    summary: 'Thirty fast breaths, then hold — the Wim Hof pattern',
    when: 'Mornings, for alertness. This is the one technique here that winds you UP rather than down, so it is the wrong tool for a panic and a good one for a flat start.',
    why: 'Thirty fast full breaths blow off carbon dioxide well below its normal level. Because it is carbon dioxide and not oxygen that drives the urge to breathe, the hold afterwards feels easy for far longer than usual. It also raises adrenaline. The tingling and lightheadedness are that chemistry, not a sign it is working better.',
    structure: 'rounds',
    /* The paced portion of a round. The retention that follows has no fixed length. */
    phases: [
      { kind: 'inhale', ms: 1600, cue: 'In, full' },
      { kind: 'exhale', ms: 1600, cue: 'Out, let it fall' }
    ],
    suggestedMinutes: 11,
    icon: 'flame-outline',
    requiresAcknowledgement: true,
    caution:
      'Never in or near water. This can make you faint with no warning, and people have drowned doing it in a pool or a bath. Sit or lie down, on land, away from anything you could fall against or into. Not while driving. Not if you are pregnant, or if you have epilepsy, a heart condition, or high blood pressure. Fainting is a real outcome, not a remote one — if you feel like you are going, stop and breathe normally.',
    rounds: { count: 3, breaths: 30, breathMs: 3200, recoveryHoldMs: 15000 }
  }
];

export function techniqueById(id: string): BreathTechnique {
  return BREATH_TECHNIQUES.find((technique) => technique.id === id) ?? BREATH_TECHNIQUES[0];
}

/** The cycling techniques, which are the ones the circle can pace. */
export const CYCLE_TECHNIQUES = BREATH_TECHNIQUES.filter((t) => t.structure === 'cycle');

/** Where a phase should leave the circle, 0 to 1. */
export function phaseTarget(phase: BreathPhase, previous: number): number {
  if (phase.to !== undefined) return phase.to;
  if (phase.kind === 'inhale') return 1;
  if (phase.kind === 'exhale') return 0;
  return previous;
}

/** One full pass through the phases, in milliseconds. */
export function cycleMs(technique: BreathTechnique): number {
  return technique.phases.reduce((sum, phase) => sum + phase.ms, 0);
}

/** How many whole cycles fit in a number of minutes, which is how a session is sized. */
export function cyclesInMinutes(technique: BreathTechnique, minutes: number): number {
  return Math.max(1, Math.floor((minutes * 60_000) / cycleMs(technique)));
}

/** "4 in · 4 hold · 4 out · 4 hold" — the pattern as a line of text. */
export function patternLine(technique: BreathTechnique): string {
  const label: Record<BreathPhaseKind, string> = {
    inhale: 'in',
    hold: 'hold',
    exhale: 'out',
    hold_empty: 'hold'
  };
  return technique.phases
    .map((phase) => `${Math.round(phase.ms / 1000)} ${label[phase.kind]}`)
    .join(' · ');
}

/** Breaths per minute, for comparing techniques against each other. */
export function breathsPerMinute(technique: BreathTechnique): number {
  const inhales = technique.phases.filter((phase) => phase.kind === 'inhale').length || 1;
  return Math.round((60_000 / cycleMs(technique)) * inhales * 10) / 10;
}
