export * from './movementTypes';
export * from './calculateMovementSummary';
export * from './generateMovementReadinessSignal';
export * from './generateAdaptiveMovementPlan';
export {
  calculateMovementScore,
  explainMovementLimiter
} from './calculateMovementScore';
export type {
  MovementCrossDomainContext,
  ProgressionTally
} from './calculateMovementScore';
