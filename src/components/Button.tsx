import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type PressableProps
} from 'react-native';

import { bone, control, font, ink, radius, safety } from '../styles/daywoven1c';
import { colors } from '../styles/mobileTheme';

type ButtonVariant = 'primary' | 'secondary' | 'danger';

type ButtonProps = PressableProps & {
  label: string;
  isLoading?: boolean;
  variant?: ButtonVariant;
  /** 'band' for a button on the charcoal band (P13): primary turns bone with ink text, secondary takes bone text. */
  tone?: 'canvas' | 'band';
};

/**
 * The shared button in the 1c style (design language P13): 46pt, radius 12. Primary is an
 * ink fill with bone text; secondary is a 1pt outline; danger is the outline in the safety
 * red, kept for the few destructive actions.
 */
export function Button({
  label,
  disabled,
  isLoading = false,
  variant = 'primary',
  tone = 'canvas',
  style,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || isLoading;
  const onBandPrimary = tone === 'band' && variant === 'primary';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(isDisabled), busy: isLoading }}
      disabled={isDisabled}
      style={(state) => [
        styles.base,
        styles[variant],
        onBandPrimary ? styles.bandPrimary : null,
        state.pressed && !isDisabled ? (onBandPrimary ? styles.bandPrimaryPressed : variant === 'primary' ? styles.primaryPressed : styles.pressed) : null,
        isDisabled ? styles.disabled : null,
        typeof style === 'function' ? style(state) : style
      ]}
      {...props}
    >
      {isLoading ? (
        <ActivityIndicator color={onBandPrimary ? ink.text : variant === 'primary' ? colors.primaryText : colors.primary} />
      ) : (
        <Text style={[styles.label, onBandPrimary ? styles.bandPrimaryLabel : tone === 'band' && variant === 'secondary' ? styles.bandSecondaryLabel : variant === 'primary' ? styles.primaryLabel : variant === 'danger' ? styles.dangerLabel : null]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: control.buttonHeight,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.button,
    paddingHorizontal: 18
  },
  primary: { backgroundColor: colors.primary },
  primaryPressed: { backgroundColor: control.primaryPressed },
  bandPrimary: { backgroundColor: bone.text },
  bandPrimaryPressed: { backgroundColor: bone.soft },
  secondary: { backgroundColor: 'transparent', borderColor: ink.border, borderWidth: 1 },
  danger: { backgroundColor: 'transparent', borderColor: safety.onCanvas, borderWidth: 1 },
  pressed: { backgroundColor: ink.wash },
  disabled: { opacity: 0.45 },
  label: { color: colors.text, fontFamily: font.bodyMedium, fontSize: 14.5 },
  primaryLabel: { color: colors.primaryText },
  bandPrimaryLabel: { color: ink.text },
  bandSecondaryLabel: { color: bone.text },
  dangerLabel: { color: safety.onCanvas }
});
