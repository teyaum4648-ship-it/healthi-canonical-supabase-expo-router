import type { SafetyAllowedAction, SafetyStatus } from './safetyTypes';

/**
 * User-facing copy for the Safety Engine. Language is intentionally calm,
 * practical, and non-clinical — general wellness guidance only, never
 * diagnostic or alarmist.
 */

export const SAFETY_SUMMARY: Record<SafetyStatus, string> = {
  clear: 'Available signals look steady. daywoven can offer the usual daily guidance.',
  caution:
    'A few signals suggest an easier day. daywoven will keep today gentle and practical rather than pushing.',
  limit_guidance:
    'daywoven is holding back stronger guidance today and keeping the focus on easy, supportive steps.',
  professional_guidance:
    'Some of what you shared is worth checking with a qualified professional before any stronger guidance. daywoven will keep today gentle in the meantime.'
};

/** Baseline safe actions Healthi can always suggest, tailored by how limited the day is. */
export function baselineAllowedActions(level: 'full' | 'gentle' | 'rest'): SafetyAllowedAction[] {
  const hydration: SafetyAllowedAction = {
    id: 'safe_hydration',
    title: 'Hydrate steadily',
    detail: 'Keep water within reach and sip through the day.',
    domain: 'nourishment'
  };
  const familiarMeal: SafetyAllowedAction = {
    id: 'safe_familiar_meal',
    title: 'Keep meals familiar',
    detail: 'Choose a familiar, comfortable meal that usually sits well.',
    domain: 'nourishment'
  };
  const windDown: SafetyAllowedAction = {
    id: 'safe_wind_down',
    title: 'Protect a calm wind-down',
    detail: 'Give yourself an unhurried wind-down before bed.',
    domain: 'recovery_rhythm'
  };
  const breathing: SafetyAllowedAction = {
    id: 'safe_breathing',
    title: 'Take a few slow breaths',
    detail: 'A short, slow breathing reset can help the body settle.',
    domain: 'mind_life_load'
  };
  const gentleWalk: SafetyAllowedAction = {
    id: 'safe_gentle_walk',
    title: 'Take a gentle walk',
    detail: 'An easy, comfortable walk if it feels good — no push.',
    domain: 'movement'
  };
  const restMovement: SafetyAllowedAction = {
    id: 'safe_rest_movement',
    title: 'Favor rest and easy movement',
    detail: 'Light stretching or simply resting is a good use of today.',
    domain: 'movement'
  };

  if (level === 'rest') {
    return [hydration, familiarMeal, windDown, breathing];
  }
  if (level === 'gentle') {
    return [gentleWalk, hydration, familiarMeal, windDown];
  }
  return [gentleWalk, hydration, familiarMeal, breathing];
}
