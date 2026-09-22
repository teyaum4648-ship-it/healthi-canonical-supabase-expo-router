import type { DataConfidence } from './movementTypes';

/**
 * A self-administered look at how the body is moving today.
 *
 * Every test here is a common range-of-motion or stability check described in Healthi's
 * own words, chosen because someone can do it alone in a room with no equipment and get a
 * result they can repeat next month. None of it reproduces anyone's assessment protocol,
 * scoring sheet or cueing.
 *
 * This is a screen, not an examination. It can say a hip did not travel as far as the
 * other one; it cannot say why in any medical sense, and nothing downstream is allowed to
 * speak as though it can. A restricted finding routes toward a qualified professional
 * rather than toward a fix.
 */

export type MobilityRegion =
  | 'ankle'
  | 'hip_flexor'
  | 'adductor'
  | 'hamstring'
  | 'lateral_hip'
  | 'thoracic'
  | 'shoulder';

/** What a single test came back as. 'not_tested' is absence and never counts against. */
export type MobilityFinding = 'clear' | 'limited' | 'restricted' | 'not_tested';

export type MobilityTest = {
  id: string;
  name: string;
  region: MobilityRegion;
  /** The movement pattern this informs, matching movement_pattern_permissions. */
  pattern: string;
  /** How to do it, in one or two sentences. */
  how: string;
  /** What each answer means, in the user's words rather than a grade. */
  options: Array<{ value: Exclude<MobilityFinding, 'not_tested'>; label: string }>;
};

const RANGE_OPTIONS: MobilityTest['options'] = [
  { value: 'clear', label: 'Comfortable, full range' },
  { value: 'limited', label: 'Tight, but I got there' },
  { value: 'restricted', label: 'Could not get there, or it hurt' }
];

export const MOBILITY_TESTS: readonly MobilityTest[] = [
  {
    id: 'ankle_to_wall',
    name: 'Ankle',
    region: 'ankle',
    pattern: 'squat',
    how: 'Stand facing a wall with your toes about a hand-width away. Keeping your heel down, drive your knee towards the wall.',
    options: RANGE_OPTIONS
  },
  {
    id: 'half_kneeling_hip',
    name: 'Front of hip',
    region: 'hip_flexor',
    pattern: 'lunge',
    how: 'Kneel on one knee with the other foot forward. Tuck your hips under and shift forward without letting your lower back arch.',
    options: RANGE_OPTIONS
  },
  {
    id: 'seated_straddle',
    name: 'Inner thigh',
    region: 'adductor',
    pattern: 'hinge',
    how: 'Sit with your legs open as wide as is comfortable, back tall.',
    options: RANGE_OPTIONS
  },
  {
    id: 'supine_leg_raise',
    name: 'Back of thigh',
    region: 'hamstring',
    pattern: 'hinge',
    how: 'Lie on your back and raise one straight leg as far as it goes while the other stays down.',
    options: RANGE_OPTIONS
  },
  {
    id: 'single_leg_stand',
    name: 'Standing on one leg',
    region: 'lateral_hip',
    pattern: 'single_leg',
    how: 'Stand on one leg for thirty seconds. Watch whether your hip drops on the free side or your knee falls inward.',
    options: [
      { value: 'clear', label: 'Steady for thirty seconds' },
      { value: 'limited', label: 'Wobbly, or my hip dropped' },
      { value: 'restricted', label: 'Could not hold it, or it hurt' }
    ]
  },
  {
    id: 'seated_rotation',
    name: 'Upper back rotation',
    region: 'thoracic',
    pattern: 'rotation',
    how: 'Sit tall with your arms crossed and turn your shoulders as far as they go without your hips following.',
    options: RANGE_OPTIONS
  },
  {
    id: 'overhead_reach',
    name: 'Overhead reach',
    region: 'shoulder',
    pattern: 'overhead_press',
    how: 'Stand with your back against a wall and reach both arms overhead, keeping your lower back flat to the wall.',
    options: RANGE_OPTIONS
  }
];

/** Things people can notice about how they stand, in ordinary language. */
export type PostureFlag =
  | 'pelvis_tipped_forward'
  | 'lower_back_flat'
  | 'ribs_flared'
  | 'shoulders_rounded'
  | 'head_forward'
  | 'knees_fall_inward'
  | 'arches_collapse'
  | 'one_hip_higher';

export const POSTURE_PROMPTS: Readonly<Record<PostureFlag, string>> = {
  pelvis_tipped_forward: 'My lower back curves a lot and my belt line tips forward',
  lower_back_flat: 'My lower back looks flat and my hips tuck under',
  ribs_flared: 'My lower ribs push forward when I stand relaxed',
  shoulders_rounded: 'My shoulders sit forward of my ears',
  head_forward: 'My head sits forward of my shoulders',
  knees_fall_inward: 'My knees drift towards each other when I squat',
  arches_collapse: 'My arches flatten and my ankles roll in',
  one_hip_higher: 'One hip sits higher than the other'
};

export type MovementScreen = {
  date: string;
  findings: Partial<Record<string, MobilityFinding>>;
  postureFlags: PostureFlag[];
  /** Patterns a safety rule has put out of bounds; nothing may be programmed into these. */
  blockedPatterns?: string[];
};

/** Tests that came back with something to say. */
export function testedFindings(screen: MovementScreen): Array<{ test: MobilityTest; finding: MobilityFinding }> {
  return MOBILITY_TESTS
    .map((test) => ({ test, finding: screen.findings[test.id] ?? 'not_tested' }))
    .filter((row): row is { test: MobilityTest; finding: Exclude<MobilityFinding, 'not_tested'> } =>
      row.finding !== 'not_tested');
}

/**
 * The screen as a single 0-1 term for the movement pillar, or null when too little was
 * tested to mean anything.
 *
 * Restricted counts for nothing, limited for half. A screen is a snapshot, so this is
 * deliberately coarse — it is here to notice that something is stuck, not to grade it.
 */
export function mobilityTerm(screen: MovementScreen): { value: number | null; detail: string } {
  const tested = testedFindings(screen);
  if (tested.length < 3) {
    return {
      value: null,
      detail: tested.length === 0
        ? 'No mobility screen yet'
        : `Only ${tested.length} of ${MOBILITY_TESTS.length} checks done — too few to read`
    };
  }

  const score = tested.reduce((sum, row) =>
    sum + (row.finding === 'clear' ? 1 : row.finding === 'limited' ? 0.5 : 0), 0) / tested.length;
  const stuck = tested.filter((row) => row.finding !== 'clear');

  return {
    value: score,
    detail: stuck.length === 0
      ? `All ${tested.length} checks moved freely`
      : `${stuck.length} of ${tested.length} checks came back tight: ${stuck.map((row) => row.test.name.toLowerCase()).join(', ')}`
  };
}

/** Confidence in a screen, which is really a question of how much of it was done. */
export function screenConfidence(screen: MovementScreen): DataConfidence {
  const tested = testedFindings(screen).length;
  if (tested < 3) return 'low';
  if (tested < MOBILITY_TESTS.length) return 'medium';
  return 'high';
}
