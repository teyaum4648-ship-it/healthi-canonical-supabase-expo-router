export const goalIds = [
  'build_muscle',
  'lose_fat',
  'strength',
  'body_recomposition',
  'general_health',
  'energy',
  'athletic_performance',
  'mobility',
  'stress_reduction'
] as const;

export type GoalId = typeof goalIds[number];

export const goalLabels: Record<GoalId, string> = {
  build_muscle: 'Build Muscle',
  lose_fat: 'Lose Fat',
  strength: 'Strength',
  body_recomposition: 'Body Recomposition',
  general_health: 'General Health',
  energy: 'Energy',
  athletic_performance: 'Athletic Performance',
  mobility: 'Mobility',
  stress_reduction: 'Stress Reduction'
};
