import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type PressableProps
} from 'react-native';

import { control, font, ink, radius, safety } from '../styles/daywoven1c';
import { colors } from '../styles/mobileTheme';

type ButtonVariant = 'primary' | 'secondary' | 'danger';

type ButtonProps = PressableProps & {
  label: string;
  isLoading?: boolean;
  variant?: ButtonVariant;
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
  style,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || isLoading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(isDisabled), busy: isLoading }}
      disabled={isDisabled}
      style={(state) => [
        styles.base,
        styles[variant],
        state.pressed && !isDisabled ? (variant === 'primary' ? styles.primaryPressed : styles.pressed) : null,
        isDisabled ? styles.disabled : null,
        typeof style === 'function' ? style(state) : style
      ]}
      {...props}
    >
      {isLoading ? (
        <ActivityIndicator color={variant === 'primary' ? colors.primaryText : colors.primary} />
      ) : (
        <Text style={[styles.label, variant === 'primary' ? styles.primaryLabel : variant === 'danger' ? styles.dangerLabel : null]}>
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
  secondary: { backgroundColor: 'transparent', borderColor: ink.border, borderWidth: 1 },
  danger: { backgroundColor: 'transparent', borderColor: safety.onCanvas, borderWidth: 1 },
  pressed: { backgroundColor: ink.wash },
  disabled: { opacity: 0.45 },
  label: { color: colors.text, fontFamily: font.bodyMedium, fontSize: 14.5 },
  primaryLabel: { color: colors.primaryText },
  dangerLabel: { color: safety.onCanvas }
});
