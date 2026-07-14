import type {
  DailyReadinessLabel,
  DailyReadinessPrimaryFocus
} from './readinessTypes';

export function readinessSummary(label: DailyReadinessLabel): string {
  if (label === 'primed') return 'Your available signals support a stronger day.';
  if (label === 'steady') return 'Your system supports a steady, useful pace today.';
  if (label === 'conserve') return 'Protect your capacity and keep the day controlled.';
  if (label === 'restore') return 'Recovery rhythm leads today, with lighter demands where possible.';
  return 'Your system is still calibrating. Healthi will sharpen this as more signals arrive.';
}

export function readinessFocusLabel(focus: DailyReadinessPrimaryFocus): string {
  if (focus === 'recovery_rhythm') return 'Recovery + Rhythm';
  if (focus === 'nourishment') return 'Nourishment';
  if (focus === 'movement_capacity') return 'Movement Capacity';
  if (focus === 'mind_life_load') return 'Mind + Life Load';
  return 'Balanced Day';
}
