export const movementPatterns = [
  'horizontal_push',
  'vertical_push',
  'horizontal_pull',
  'vertical_pull',
  'squat',
  'hinge',
  'lunge',
  'carry',
  'rotation',
  'anti_rotation',
  'core_stability',
  'locomotion'
] as const;

export type MovementPattern = typeof movementPatterns[number];

export const patternPermissions = [
  'allowed',
  'allowed_with_modification',
  'technique_only',
  'corrective_only',
  'blocked'
] as const;

export type PatternPermission = typeof patternPermissions[number];
