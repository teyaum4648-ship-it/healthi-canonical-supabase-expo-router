import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type PressableProps
} from 'react-native';

import { colors, radii, spacing } from '../styles/theme';

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
    borderRadius: radii.md,
    paddingHorizontal: spacing.md
  },
  primary: {
    backgroundColor: colors.primary
  },
  secondary: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface
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
    fontSize: 16,
    fontWeight: '700'
  },
  primaryLabel: {
    color: colors.primaryText
  }
});
