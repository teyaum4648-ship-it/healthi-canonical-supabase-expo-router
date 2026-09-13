import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/**
 * Physical confirmation for session actions.
 *
 * Haptics are unsupported on web and can reject on a device that has them
 * disabled, so every call is fire-and-forget and swallows its own failure: a
 * missing tick must never interrupt the set in front of the lifter. iOS and
 * Android already honour the system haptics setting, so there is nothing to
 * gate here beyond platform support.
 */

const supported = Platform.OS === 'ios' || Platform.OS === 'android';

/** A logged set — the most frequent confirmation, so it stays light. */
export function setLoggedFeedback(): void {
  if (!supported) return;
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}

/** Rest reaching zero, which the lifter usually is not looking at the screen for. */
export function restCompleteFeedback(): void {
  if (!supported) return;
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

/** The whole session saved. */
export function sessionSavedFeedback(): void {
  if (!supported) return;
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}
