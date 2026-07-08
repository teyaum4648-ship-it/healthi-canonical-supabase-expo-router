import type { DayPlanMode } from './dayPlanTypes';

export function summaryForMode(mode: DayPlanMode, hasSchedule: boolean): string {
  if (!hasSchedule) return 'Your day plan is still calibrating.';
  if (mode === 'build') return 'Use your strongest energy window for focused work and movement.';
  if (mode === 'maintain') return 'Keep the day steady with focused work, movement, and wind-down protected.';
  if (mode === 'correct') return 'Keep the plan controlled and protect a reset window.';
  return 'Keep the day lighter while readiness is rebuilding.';
}

export function primaryFocusForMode(mode: DayPlanMode): string {
  if (mode === 'build') return 'Focused output';
  if (mode === 'maintain') return 'Steady execution';
  if (mode === 'correct') return 'Controlled rhythm';
  return 'Recovery-led day';
}

export const dayPlanCopy = {
  deepWorkTitle: 'Focus window',
  deepWorkDetail: 'Use your strongest energy window for focused work.',
  movementTitle: 'Movement window',
  movementDetail: 'This window has rhythm support for movement.',
  lighterMovementTitle: 'Light movement',
  lighterMovementDetail: 'Keep movement lighter today while readiness is rebuilding.',
  recoveryTitle: 'Recovery window',
  recoveryDetail: 'Use this opening for a quiet reset or lighter recovery.',
  nutritionTitle: 'Fueling signal',
  nutritionMissingDetail: 'Log a meal to improve today’s fueling signal.',
  nutritionPresentDetail: 'Food response is logged, so keep the next meal simple and steady.',
  caffeineTitle: 'Caffeine cutoff',
  caffeineDetail: 'Use this cutoff to protect tonight’s wind-down.',
  windDownTitle: 'Wind-down',
  windDownDetail: 'Protect wind-down so tomorrow starts cleaner.',
  scheduleAdjustmentTitle: 'Schedule opening',
  scheduleAdjustmentDetail: 'Add one anchor block so Healthi can fit your day plan with more confidence.'
} as const;

