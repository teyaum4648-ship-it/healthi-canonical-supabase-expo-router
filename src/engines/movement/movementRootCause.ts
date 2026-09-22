import {
  MOBILITY_TESTS,
  type MobilityFinding,
  type MovementScreen,
  type PostureFlag,
  screenConfidence,
  testedFindings
} from './movementScreenModel';
import type { DataConfidence } from './movementTypes';

/**
 * What a pattern of tight places tends to be downstream of.
 *
 * Stretching whatever feels tight is the obvious response and usually the wrong one. A
 * hip flexor that is short and an inner thigh that is short, in someone who cannot stand
 * on one leg without their hip dropping, is a recognisable arrangement: those muscles are
 * taking on stabilising work the side of the hip is not doing, and they stay tight
 * because they are busy. Stretch them and they tighten again by the afternoon; give the
 * lateral hip something to do and they often let go on their own.
 *
 * That reasoning is what this file encodes — as links worth trying, never as findings.
 * Every rule is phrased as a suggestion, none of it is a diagnosis, and a restricted
 * result routes to a qualified professional instead of to a programme. The rules are
 * written in Healthi's own terms and reference exercises by their common names.
 */

export type MovementLink = {
  id: string;
  /** What this is, in a sentence a person would say. */
  headline: string;
  /** Why the tight places are tight, framed as a possibility. */
  reasoning: string;
  /** Common exercise names to add where they fit an existing routine. */
  strengthen: string[];
  /** What to lengthen, alongside rather than instead of the above. */
  lengthen: string[];
  /** Movement patterns this touches, checked against what is out of bounds. */
  patterns: string[];
  confidence: DataConfidence;
  reason_codes: string[];
};

type Rule = {
  id: string;
  headline: string;
  reasoning: string;
  strengthen: string[];
  lengthen: string[];
  patterns: string[];
  reasonCodes: string[];
  matches: (context: {
    finding: (testId: string) => MobilityFinding;
    tight: (testId: string) => boolean;
    flag: (flag: PostureFlag) => boolean;
  }) => boolean;
};

const RULES: Rule[] = [
  {
    id: 'lateral_hip_under_contributing',
    headline: 'The side of your hip may not be doing its share',
    reasoning:
      'Your hip flexors and inner thighs are both tight, and standing on one leg is unsteady. Those muscles can end up stabilising the hip sideways, which is not their job — and muscles doing a job that is not theirs stay tight. Stretching usually gives this one back within hours; giving the side of the hip something to do tends to last longer.',
    strengthen: ['Bulgarian split squat', 'Side-lying hip abduction', 'Lateral band walk', 'Single-leg Romanian deadlift'],
    lengthen: ['Half-kneeling hip flexor stretch', 'Adductor rock-back'],
    patterns: ['single_leg', 'squat', 'lunge'],
    reasonCodes: ['lateral_hip_suggested', 'stretch_alone_unlikely_to_hold'],
    matches: ({ tight, flag }) =>
      tight('half_kneeling_hip') &&
      tight('seated_straddle') &&
      (tight('single_leg_stand') || flag('knees_fall_inward') || flag('one_hip_higher'))
  },
  {
    id: 'hips_anchored_forward',
    headline: 'Your hips look anchored towards the front',
    reasoning:
      'Tight hip flexors together with a pelvis that tips forward often go with a back doing work the hips and midsection could share. Lengthening the front of the hip helps, but it usually holds better once the back of the hip has something to do.',
    strengthen: ['Glute bridge', 'Hip thrust', 'Dead bug', 'Reverse lunge'],
    lengthen: ['Half-kneeling hip flexor stretch', 'Couch stretch'],
    patterns: ['hinge', 'lunge'],
    reasonCodes: ['hip_flexor_length_suggested'],
    matches: ({ tight, flag }) =>
      tight('half_kneeling_hip') && (flag('pelvis_tipped_forward') || flag('ribs_flared'))
  },
  {
    id: 'ankle_limiting_the_squat',
    headline: 'Your ankles may be deciding how you squat',
    reasoning:
      'When the ankle does not travel far, the body finds the depth elsewhere — usually the lower back or the knees drifting inward. Ankle range is often the cheapest thing to change here.',
    strengthen: ['Heel-elevated goblet squat', 'Tibialis raise'],
    lengthen: ['Knee-to-wall ankle mobilisation', 'Calf stretch against a wall'],
    patterns: ['squat'],
    reasonCodes: ['ankle_range_limits_squat'],
    matches: ({ tight, flag }) => tight('ankle_to_wall') && (flag('knees_fall_inward') || flag('arches_collapse'))
  },
  {
    id: 'upper_back_paying_for_the_shoulder',
    headline: 'Your overhead reach may be coming from your lower back',
    reasoning:
      'When the upper back does not rotate or extend easily, the arms still get overhead — by arching the lower back and letting the ribs flare. Freeing the upper back usually gives the shoulder somewhere to go.',
    strengthen: ['Wall slide', 'Prone Y raise', 'Half-kneeling landmine press'],
    lengthen: ['Open book rotation', 'Thoracic extension over a foam roller'],
    patterns: ['overhead_press', 'rotation'],
    reasonCodes: ['thoracic_limits_overhead'],
    matches: ({ tight, flag }) =>
      (tight('overhead_reach') || tight('seated_rotation')) && (flag('ribs_flared') || flag('shoulders_rounded'))
  },
  {
    id: 'posterior_chain_short',
    headline: 'The back of your legs is short on range',
    reasoning:
      'A tight hamstring alongside a flat lower back often means the hips are not hinging much, so the hamstrings take the stretch every time you bend. Learning the hinge usually does more than stretching does.',
    strengthen: ['Romanian deadlift', 'Hip hinge with a dowel', 'Glute bridge'],
    lengthen: ['Supine hamstring stretch with a strap', '90/90 hip switch'],
    patterns: ['hinge'],
    reasonCodes: ['hinge_pattern_suggested'],
    matches: ({ tight, flag }) => tight('supine_leg_raise') && flag('lower_back_flat')
  },
  {
    id: 'head_and_shoulders_forward',
    headline: 'Your shoulders and head sit forward of where they rest easiest',
    reasoning:
      'Rounded shoulders and a forward head usually come with an upper back that has stopped extending. This is about what gets practised all day more than about any one muscle.',
    strengthen: ['Face pull', 'Prone T raise', 'Chin tuck'],
    lengthen: ['Doorway pec stretch', 'Open book rotation'],
    patterns: ['row', 'rotation'],
    reasonCodes: ['upper_back_posture_suggested'],
    matches: ({ flag }) => flag('shoulders_rounded') && flag('head_forward')
  }
];

/** The strongest link the screen supports, plus any others worth mentioning. */
export function findMovementLinks(screen: MovementScreen): MovementLink[] {
  const finding = (testId: string): MobilityFinding => screen.findings[testId] ?? 'not_tested';
  const tight = (testId: string) => ['limited', 'restricted'].includes(finding(testId));
  const flag = (value: PostureFlag) => screen.postureFlags.includes(value);
  const confidence = screenConfidence(screen);
  const blocked = new Set(screen.blockedPatterns ?? []);

  return RULES
    .filter((rule) => rule.matches({ finding, tight, flag }))
    .map((rule) => ({
      id: rule.id,
      headline: rule.headline,
      reasoning: rule.reasoning,
      // Nothing is ever suggested into a pattern a safety rule has put out of bounds.
      strengthen: rule.patterns.some((pattern) => blocked.has(pattern)) ? [] : [...rule.strengthen],
      lengthen: [...rule.lengthen],
      patterns: rule.patterns.filter((pattern) => !blocked.has(pattern)),
      confidence,
      reason_codes: rule.patterns.some((pattern) => blocked.has(pattern))
        ? [...rule.reasonCodes, 'programming_withheld_pattern_blocked']
        : [...rule.reasonCodes]
    }));
}

/**
 * Anything the screen turned up that belongs with a person rather than with a programme.
 *
 * A restricted result means someone could not get there or it hurt. Healthi does not work
 * out why that is, and it never programmes around pain.
 */
export function screenReferrals(screen: MovementScreen): string[] {
  return testedFindings(screen)
    .filter((row) => row.finding === 'restricted')
    .map((row) =>
      `${row.test.name} came back restricted or painful. Healthi will leave that one alone — it is worth having a qualified professional look at it.`);
}

/** Every test id, for callers building the screen UI. */
export const MOBILITY_TEST_IDS: readonly string[] = MOBILITY_TESTS.map((test) => test.id);
