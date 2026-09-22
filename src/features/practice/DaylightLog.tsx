import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, type } from '../../styles/mobileTheme';
import {
  ASSUMED_MINUTES,
  LIGHT_WINDOWS,
  lightWindow,
  MINUTE_CHOICES,
  windowForHour,
  type LightWindow
} from './daylightModel';

/**
 * Logging time outside, in one tap or three.
 *
 * The friction problem is the whole design problem here. Asking for duration and time of
 * day every time turns a two-second log into a form, and a form that appears daily stops
 * being filled in — at which point the feature measures nothing. But assuming a duration
 * and presenting it as fact is the dishonesty this app keeps avoiding elsewhere.
 *
 * So: one tap logs it, with the window read off the clock and the duration marked as an
 * assumption. Anyone who wants to be exact opens the detail and is exact. The estimate
 * flag travels with the row, so the copy downstream can say "about 15 minutes" rather
 * than "15 minutes", and a day built from taps never claims more precision than it has.
 */

export function DaylightLog({
  onLog,
  busy = false
}: {
  onLog: (minutes: number, window: LightWindow, estimated: boolean) => void;
  busy?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [minutes, setMinutes] = useState<number>(ASSUMED_MINUTES);
  const [window, setWindow] = useState<LightWindow>(() => windowForHour(new Date().getHours()));

  const nowWindow = windowForHour(new Date().getHours());

  return (
    <View style={styles.wrap}>
      <Text style={styles.eyebrow}>DAYLIGHT</Text>

      {!open ? (
        <>
          <Pressable
            accessibilityHint={`Logs about ${ASSUMED_MINUTES} minutes in the ${lightWindow(nowWindow).label.toLowerCase()} window`}
            accessibilityLabel="I got outside"
            accessibilityRole="button"
            disabled={busy}
            onPress={() => onLog(ASSUMED_MINUTES, nowWindow, true)}
            style={({ pressed }) => [styles.primary, (pressed || busy) && styles.pressed]}
          >
            <Text style={styles.primaryText}>I got outside</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => { setWindow(nowWindow); setOpen(true); }}
            style={({ pressed }) => [styles.textButton, pressed && styles.pressed]}
          >
            <Text style={styles.textButtonLabel}>Say how long, or when</Text>
          </Pressable>
          <Text style={styles.body}>
            One tap records about {ASSUMED_MINUTES} minutes, marked as an estimate. It is a
            log, not a light meter — it cannot tell open noon from overcast dusk, so the
            time of day is what it weighs.
          </Text>
        </>
      ) : (
        <>
          <Text style={styles.label}>How long</Text>
          <View style={styles.chips}>
            {MINUTE_CHOICES.map((choice) => {
              const active = choice === minutes;
              return (
                <Pressable
                  accessibilityLabel={`${choice} minutes`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  key={choice}
                  onPress={() => setMinutes(choice)}
                  style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && styles.pressed]}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{choice}m</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.label}>When</Text>
          <View style={styles.chips}>
            {LIGHT_WINDOWS.map((entry) => {
              const active = entry.id === window;
              return (
                <Pressable
                  accessibilityHint={entry.note}
                  accessibilityLabel={entry.label}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  key={entry.id}
                  onPress={() => setWindow(entry.id)}
                  style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && styles.pressed]}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{entry.label}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.body}>{lightWindow(window).note}</Text>

          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={() => { onLog(minutes, window, false); setOpen(false); setMinutes(ASSUMED_MINUTES); }}
              style={({ pressed }) => [styles.primary, styles.grow, (pressed || busy) && styles.pressed]}
            >
              <Text style={styles.primaryText}>Log {minutes} minutes</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => setOpen(false)}
              style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
            >
              <Text style={styles.secondaryText}>Cancel</Text>
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  eyebrow: { ...type.label, color: colors.textFaint, fontSize: 12, letterSpacing: 1.1 },
  label: { ...type.label, color: colors.text },
  body: { ...type.caption, color: colors.textMuted, lineHeight: 19 },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    backgroundColor: colors.surfaceInset,
    borderRadius: 999,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 15
  },
  chipActive: { backgroundColor: colors.accent },
  chipText: { ...type.label, color: colors.textMuted },
  chipTextActive: { color: colors.primaryText },

  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2 },
  grow: { flexGrow: 1 },
  primary: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 14,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 18
  },
  primaryText: { ...type.label, color: colors.primaryText, fontSize: 16 },
  secondary: {
    alignItems: 'center',
    backgroundColor: colors.surfaceInset,
    borderRadius: 14,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 18
  },
  secondaryText: { ...type.label, color: colors.text },
  textButton: { alignSelf: 'flex-start', justifyContent: 'center', minHeight: 44 },
  textButtonLabel: { ...type.label, color: colors.accent },
  pressed: { opacity: 0.7 }
});
