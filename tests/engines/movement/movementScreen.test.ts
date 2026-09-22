import { describe, expect, it } from 'vitest';

import {
  MOBILITY_TESTS,
  POSTURE_PROMPTS,
  mobilityTerm,
  screenConfidence,
  type MovementScreen
} from '../../../src/engines/movement/movementScreenModel';
import { findMovementLinks, screenReferrals } from '../../../src/engines/movement/movementRootCause';

/**
 * The screen, and the reasoning it feeds.
 *
 * The example that shaped this: someone with a tight hip flexor and a tight inner thigh
 * who cannot stand on one leg steadily. The obvious answer is to stretch the tight things,
 * and it does not hold — those muscles are stabilising sideways because the side of the
 * hip is not, and they tighten again by the afternoon. The screen exists to notice that
 * arrangement and point at the lateral hip instead.
 *
 * Two lines are held absolutely here: nothing speaks as though it has diagnosed anything,
 * and nothing gets programmed into a pattern a safety rule has put out of bounds.
 */

const DATE = '2026-08-19';

function screen(overrides: Partial<MovementScreen> = {}): MovementScreen {
  return { date: DATE, findings: {}, postureFlags: [], ...overrides };
}

describe('the mobility term', () => {
  it('withholds itself when too little was tested to mean anything', () => {
    expect(mobilityTerm(screen()).value).toBeNull();
    expect(mobilityTerm(screen({ findings: { ankle_to_wall: 'clear', seated_straddle: 'limited' } })).value).toBeNull();
  });

  it('reads a completed screen and names what came back tight', () => {
    const result = mobilityTerm(screen({
      findings: {
        ankle_to_wall: 'clear', half_kneeling_hip: 'limited', seated_straddle: 'limited',
        supine_leg_raise: 'clear', single_leg_stand: 'clear'
      }
    }));
    expect(result.value).toBeCloseTo(0.8, 6); // three clear + two at half, over five
    expect(result.detail).toContain('front of hip');
    expect(result.detail).toContain('inner thigh');
  });

  it('gains confidence as more of the screen is done', () => {
    const partial = screen({ findings: { ankle_to_wall: 'clear', half_kneeling_hip: 'clear', seated_straddle: 'clear' } });
    const whole = screen({ findings: Object.fromEntries(MOBILITY_TESTS.map((test) => [test.id, 'clear' as const])) });
    expect(screenConfidence(screen())).toBe('low');
    expect(screenConfidence(partial)).toBe('medium');
    expect(screenConfidence(whole)).toBe('high');
  });
});

describe('finding what the tightness is downstream of', () => {
  it('points at the side of the hip, not at the tight muscles', () => {
    const links = findMovementLinks(screen({
      findings: { half_kneeling_hip: 'limited', seated_straddle: 'limited', single_leg_stand: 'limited' },
      postureFlags: []
    }));

    const lateral = links.find((link) => link.id === 'lateral_hip_under_contributing');
    expect(lateral).toBeDefined();
    expect(lateral!.strengthen).toContain('Bulgarian split squat');
    // And it says why stretching alone tends not to hold.
    expect(lateral!.reason_codes).toContain('stretch_alone_unlikely_to_hold');
    expect(lateral!.lengthen.length).toBeGreaterThan(0);
  });

  it('reaches the same link through a posture answer instead of a balance test', () => {
    const links = findMovementLinks(screen({
      findings: { half_kneeling_hip: 'limited', seated_straddle: 'restricted' },
      postureFlags: ['knees_fall_inward']
    }));
    expect(links.map((link) => link.id)).toContain('lateral_hip_under_contributing');
  });

  it('says nothing when the screen gives it nothing', () => {
    expect(findMovementLinks(screen())).toEqual([]);
    expect(findMovementLinks(screen({ findings: { ankle_to_wall: 'clear', seated_straddle: 'clear' } }))).toEqual([]);
  });

  it('withholds programming for a pattern that is out of bounds', () => {
    const links = findMovementLinks(screen({
      findings: { half_kneeling_hip: 'limited', seated_straddle: 'limited', single_leg_stand: 'limited' },
      blockedPatterns: ['single_leg']
    }));

    const lateral = links.find((link) => link.id === 'lateral_hip_under_contributing')!;
    expect(lateral.strengthen).toEqual([]);
    expect(lateral.patterns).not.toContain('single_leg');
    expect(lateral.reason_codes).toContain('programming_withheld_pattern_blocked');
    // The explanation survives; only the programming is withheld.
    expect(lateral.reasoning.length).toBeGreaterThan(0);
  });

  it('sends a painful or restricted result to a person, not to a programme', () => {
    const referrals = screenReferrals(screen({
      findings: { single_leg_stand: 'restricted', ankle_to_wall: 'clear' }
    }));
    expect(referrals).toHaveLength(1);
    expect(referrals[0].toLowerCase()).toContain('qualified professional');
  });
});

describe('the language the screen uses', () => {
  it('never claims to have diagnosed anything', () => {
    const copy = [
      ...MOBILITY_TESTS.map((test) => `${test.name} ${test.how} ${test.options.map((o) => o.label).join(' ')}`),
      ...Object.values(POSTURE_PROMPTS),
      ...findMovementLinks(screen({
        findings: { half_kneeling_hip: 'limited', seated_straddle: 'limited', single_leg_stand: 'limited', supine_leg_raise: 'limited', overhead_reach: 'limited', seated_rotation: 'limited', ankle_to_wall: 'limited' },
        postureFlags: ['pelvis_tipped_forward', 'ribs_flared', 'shoulders_rounded', 'head_forward', 'knees_fall_inward', 'arches_collapse', 'lower_back_flat']
      })).flatMap((link) => [link.headline, link.reasoning]),
      ...screenReferrals(screen({ findings: { single_leg_stand: 'restricted' } }))
    ].join(' ').toLowerCase();

    for (const word of [
      'diagnos', 'treatment', 'cure', 'prescri', 'clinical assessment', 'medical',
      'guaranteed', 'dysfunction', 'impingement', 'patholog'
    ]) {
      expect(copy).not.toContain(word);
    }
  });

  it('never tells anyone to train through pain', () => {
    const copy = MOBILITY_TESTS.map((test) => test.how).join(' ').toLowerCase();
    expect(copy).not.toContain('push through');
    expect(copy).not.toContain('ignore the pain');
    // Every range test offers a way to say it hurt.
    const rangeTests = MOBILITY_TESTS.filter((test) => test.options.some((o) => o.value === 'restricted'));
    expect(rangeTests).toHaveLength(MOBILITY_TESTS.length);
  });

  it('avoids the vocabulary the product rules put out of bounds', () => {
    const copy = [
      ...MOBILITY_TESTS.map((test) => test.how),
      ...Object.values(POSTURE_PROMPTS)
    ].join(' ').toLowerCase();
    for (const term of ['chek', 'c.h.e.k', 'hlc', '4 doctors', 'primal pattern', 'work-in']) {
      expect(copy).not.toContain(term);
    }
  });
});
