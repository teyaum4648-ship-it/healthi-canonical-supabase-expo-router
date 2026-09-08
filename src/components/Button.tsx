import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type PressableProps
} from 'react-native';

import { colors, fonts, radii, spacing } from '../styles/theme';

type ButtonVariant = 'primary' | 'secondary' | 'danger';

type ButtonProps = PressableProps & {
  label: string;
  isLoading?: boolean;
  variant?: ButtonVariant;
};

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
      disabled={isDisabled}
      style={(state) => [
        styles.base,
        styles[variant],
        state.pressed && !isDisabled ? styles.pressed : null,
        isDisabled ? styles.disabled : null,
        typeof style === 'function' ? style(state) : style
      ]}
      {...props}
    >
      {isLoading ? (
        <ActivityIndicator color={variant === 'primary' ? colors.primaryText : colors.primary} />
      ) : (
        <Text style={[styles.label, variant === 'primary' ? styles.primaryLabel : null]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.sm,
    paddingHorizontal: spacing.lg
  },
  primary: {
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 16
  },
  secondary: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(255, 255, 255, 0.48)'
  },
  danger: {
    borderWidth: 1,
    borderColor: colors.danger,
    backgroundColor: colors.surface
  },
  pressed: {
    opacity: 0.82
  },
  disabled: {
    opacity: 0.55
  },
  label: {
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.1,
    textTransform: 'uppercase'
  },
  primaryLabel: {
    color: colors.primaryText
  }
});
