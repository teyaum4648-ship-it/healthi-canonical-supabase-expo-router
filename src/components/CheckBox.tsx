import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, spacing, type } from '../styles/mobileTheme';

/**
 * A checkbox, for the handful of places where the app needs an affirmative act rather
 * than a preference.
 *
 * It is a Pressable rather than a Switch because a consent is a box you tick, and
 * because `accessibilityRole="checkbox"` with a checked state is what a screen reader
 * needs in order to say "not checked" before a person commits to something.
 *
 * The whole row is the target, not just the 22pt square, and the row is at least 44pt
 * tall. Nothing here is ticked by default: a pre-ticked consent is not consent.
 */

export function CheckBox({
  checked,
  onChange,
  label,
  children,
  hint,
  style,
  disabled = false
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  /** The accessible name. Required even when `children` renders richer text. */
  label: string;
  /** Optional rendered label, for text that needs inline links. Falls back to `label`. */
  children?: React.ReactNode;
  hint?: string;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityHint={hint}
      accessibilityLabel={label}
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      disabled={disabled}
      hitSlop={6}
      onPress={() => onChange(!checked)}
      style={({ pressed }) => [styles.row, pressed && !disabled ? styles.pressed : null, style]}
    >
      <View style={[styles.box, checked ? styles.boxChecked : null]}>
        {/*
          A drawn tick rather than an icon font: two rotated rules, so the mark scales
          with the box and needs no glyph to load before the state is visible.
        */}
        {checked ? (
          <View style={styles.tick}>
            <View style={styles.tickShort} />
            <View style={styles.tickLong} />
          </View>
        ) : null}
      </View>
      <View style={styles.labelWrap}>
        {children ?? <Text style={styles.label}>{label}</Text>}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 44,
    paddingVertical: 6
  },
  pressed: { opacity: 0.7 },
  box: {
    alignItems: 'center',
    borderColor: colors.borderStrong,
    borderRadius: 6,
    borderWidth: 1.5,
    height: 22,
    justifyContent: 'center',
    marginTop: 1,
    width: 22
  },
  boxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  tick: { height: 12, width: 12 },
  tickShort: {
    backgroundColor: colors.primaryText,
    borderRadius: 1,
    height: 1.8,
    left: 0.5,
    position: 'absolute',
    top: 6.5,
    transform: [{ rotate: '45deg' }],
    width: 5.5
  },
  tickLong: {
    backgroundColor: colors.primaryText,
    borderRadius: 1,
    height: 1.8,
    left: 3,
    position: 'absolute',
    top: 5.5,
    transform: [{ rotate: '-50deg' }],
    width: 9.5
  },
  labelWrap: { flex: 1 },
  label: {
    ...type.caption,
    color: colors.textMuted,
    lineHeight: 19
  }
});
