import { createScopedLogStore, isRecord } from './scopedLogStore';

/**
 * Where tension is sitting, and one thing to do about it.
 *
 * The idea this borrows is that held tension is not evenly distributed — it collects in
 * particular places, those places are fairly consistent per person, and the useful
 * response is specific rather than "relax". That framing comes from the four-doctors
 * tradition the rest of this tab is built on.
 *
 * Three decisions worth stating, because each one is a departure from the source:
 *
 * **Regions, not numbered zones.** A numbered scheme means nothing to someone opening an
 * app — "Zone 4" is a lookup, "front of the hips" is a place you can feel. It also keeps
 * this our own material rather than a reimplementation of someone else's, which matters:
 * the framework's ideas are free to use, its wording, cueing and numbering are not.
 *
 * **One region at a time.** Offering five practices for five places produces a to-do list
 * nobody finishes. Pick where it actually sits, get one thing, two minutes.
 *
 * **Mechanism, never diagnosis.** Each region says what tightness there tends to travel
 * with and why, anatomically. None of it says what is wrong with you, because tight hips
 * have a dozen causes and this app can distinguish none of them.
 */

export type TensionRegion = 'jaw' | 'chest' | 'upper_back' | 'low_back' | 'hips';

export type RegionRelease = {
  id: TensionRegion;
  label: string;
  /** How to tell this is the one, in the words someone would notice it in. */
  recognise: string;
  /** Why tightness here and a short breath tend to arrive together. Anatomy, not a cause. */
  mechanism: string;
  /** Our own cueing, one step per line. */
  steps: string[];
  minutes: number;
  /** Paces the movement — see BREATH_RHYTHMS. */
  rhythmId: string;
  /** Shown when there is a real reason to be careful, and left off when there is not. */
  caution?: string;
};

export const REGION_RELEASES: RegionRelease[] = [
  {
    id: 'jaw',
    label: 'Jaw, throat and neck',
    recognise: 'Teeth touching when you notice them. A tight throat, or a headache that starts at the temples.',
    mechanism:
      'Clenching is one of the first places held tension turns up, and the easiest to miss — you can do it for hours without noticing. The jaw and the breath move together: a clamped jaw tends to come with breathing that has moved up into the chest.',
    steps: [
      'Sit or stand, wherever you already are.',
      'Let your teeth come apart. Not open — just not touching.',
      'Rest the tip of your tongue behind your top teeth and let the rest of it go heavy.',
      'Breathe in and out through your nose at the pace of the circle.',
      'Each time you breathe out, let the jaw get a little heavier. You are not stretching anything — you are stopping holding it.'
    ],
    minutes: 2,
    rhythmId: 'settle'
  },
  {
    id: 'chest',
    label: 'Chest and front of shoulders',
    recognise: 'Shoulders that sit forward. A feeling of not being able to get a full breath in.',
    mechanism:
      'Desk hours and shallow breathing pull on the same muscles. The ones that help you breathe hard also draw the shoulders forward, which is why a tight chest and a short breath usually show up together.',
    steps: [
      'Stand at a doorframe or a wall corner.',
      'Put one forearm flat against it, elbow at about shoulder height.',
      'Step through with the same-side foot until you feel a stretch across the front of your chest. Mild. Not sharp.',
      'Hold there and breathe at the pace of the circle — the stretch does its work on the out-breath, not by pushing.',
      'Five breaths, then the other side.'
    ],
    minutes: 2,
    rhythmId: 'zone'
  },
  {
    id: 'upper_back',
    label: 'Between the shoulder blades',
    recognise: 'An ache between the shoulder blades by the afternoon. Turning to look behind you feels stiff.',
    mechanism:
      'Your mid-back has to extend for a full breath to happen. When it stops moving, breathing relocates up into the neck and shoulders — which then do work they are not built for.',
    steps: [
      'On hands and knees, or sitting forward on a chair with hands on your knees.',
      'Breathing in, let your chest open and your back gently hollow.',
      'Breathing out, round the back and let your head drop.',
      'Follow the circle rather than your own tempo — slower than feels natural is the point.',
      'Ten breaths. Move only as far as is comfortable; the range will grow on its own.'
    ],
    minutes: 3,
    rhythmId: 'zone'
  },
  {
    id: 'low_back',
    label: 'Low back',
    recognise: 'Stiff on standing up after sitting. A dull band across the lower back at the end of the day.',
    mechanism:
      'Your diaphragm attaches to the lower spine. When breathing gets shallow, the low back ends up doing more holding than it should — so breathing lower is part of the release, not just the timing for it.',
    steps: [
      'Lie on your back, knees bent, feet flat.',
      'Bring both knees gently toward your chest and hold behind the thighs, not over the shins.',
      'Breathe in and feel your lower back press lightly into the floor.',
      'Breathe out and let the knees drift a little closer. No pulling.',
      'Eight breaths, then put your feet down slowly.'
    ],
    minutes: 3,
    rhythmId: 'settle',
    caution: 'Skip this if you have a back injury, or if anything here is sharp rather than mild. Sharp is a reason to ask a professional, not to push further.'
  },
  {
    id: 'hips',
    label: 'Front of the hips',
    recognise: 'Tight at the top of the thigh when you stand. A back that feels better walking than sitting.',
    mechanism:
      'Sitting keeps the front of the hip short, and those muscles tie into the lower spine. It is why a tight hip so often reads as a sore back — the place it hurts is not always the place that is short.',
    steps: [
      'Kneel on one knee, other foot flat in front, like a low lunge. Use a cushion under the knee.',
      'Before you lean anywhere, tuck your tailbone under so your lower back flattens slightly. This is the whole exercise.',
      'Keeping that tuck, shift your weight forward an inch or two until you feel the front of the back-leg hip lengthen.',
      'Breathe at the pace of the circle. Let the out-breath take you a little further in.',
      'Six breaths, then swap sides.'
    ],
    minutes: 3,
    rhythmId: 'zone',
    caution: 'If your knee objects, put more padding under it or do this standing with your back foot on a step behind you.'
  }
];

export function regionRelease(id: TensionRegion): RegionRelease {
  return REGION_RELEASES.find((entry) => entry.id === id) ?? REGION_RELEASES[0];
}

export type ZoneSession = {
  id: string;
  date: string;
  region: TensionRegion;
  /** What was actually done, not what was prescribed. */
  seconds: number;
  finishedAt: string;
};

export type ZoneDay = {
  sessions: ZoneSession[];
  regions: TensionRegion[];
  totalSeconds: number;
};

export function summariseZoneDay(sessions: ZoneSession[], date: string): ZoneDay {
  const today = sessions
    .filter((session) => session.date === date)
    .sort((left, right) => left.finishedAt.localeCompare(right.finishedAt));
  return {
    sessions: today,
    regions: [...new Set(today.map((session) => session.region))],
    totalSeconds: today.reduce((sum, session) => sum + session.seconds, 0)
  };
}

export function zoneDayLine(day: ZoneDay): string {
  if (day.sessions.length === 0) return 'Nothing released yet today.';
  const names = day.regions.map((region) => regionRelease(region).label.toLowerCase());
  const minutes = Math.max(1, Math.round(day.totalSeconds / 60));
  const list = names.length === 1
    ? names[0]
    : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} on ${list}.`;
}

function isZoneSession(value: unknown): value is ZoneSession {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.date === 'string'
    && typeof value.region === 'string'
    && typeof value.seconds === 'number'
    && typeof value.finishedAt === 'string';
}

export const localZoneStore = createScopedLogStore<ZoneSession>({
  key: 'healthi:practice:zone:v1',
  isRow: isZoneSession
});
