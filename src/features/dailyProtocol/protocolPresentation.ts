import type { ProtocolDayMode, ProtocolPrimaryFocus, ProtocolStatus } from '../../engines/protocol';
import type { SafetyStatus } from '../../engines/safety';

/** Pure display labels for the coaching loop (no React Native dependencies). */

export function dayModeLabel(mode: ProtocolDayMode): string {
  switch (mode) {
    case 'build':
      return 'Build';
    case 'correct':
      return 'Correct';
    case 'restore':
      return 'Restore';
    case 'professional_guidance':
      return 'Gentle day';
    case 'maintain':
    default:
      return 'Maintain';
  }
}

export function focusLabel(focus: ProtocolPrimaryFocus): string {
  switch (focus) {
    case 'recovery_rhythm':
      return 'Recovery rhythm';
    case 'nourishment':
      return 'Nourishment';
    case 'movement_capacity':
      return 'Movement capacity';
    case 'mind_life_load':
      return 'Mind & life load';
    case 'balanced':
    default:
      return 'Balanced';
  }
}

export function protocolStatusLabel(status: ProtocolStatus): string {
  switch (status) {
    case 'professional_guidance':
      return 'Professional guidance';
    case 'limited':
      return 'Limited guidance';
    case 'calibrating':
      return 'Calibrating';
    case 'ready':
    default:
      return 'Ready';
  }
}

export function safetyStatusLabel(status: SafetyStatus): string {
  switch (status) {
    case 'professional_guidance':
      return 'Professional guidance';
    case 'limit_guidance':
      return 'Limited guidance';
    case 'caution':
      return 'Caution';
    case 'clear':
    default:
      return 'Clear';
  }
}

export function confidenceLabel(confidence: 'low' | 'medium' | 'high'): string {
  if (confidence === 'high') return 'High confidence';
  if (confidence === 'medium') return 'Medium confidence';
  return 'Low confidence';
}

/** True when the safety status warrants a visible, non-alarming note. */
export function shouldSurfaceSafety(status: SafetyStatus): boolean {
  return status === 'caution' || status === 'limit_guidance' || status === 'professional_guidance';
}
