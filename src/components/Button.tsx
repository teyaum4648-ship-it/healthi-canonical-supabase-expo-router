import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type PressableProps
} from 'react-native';

import { accentFill, colors, surfaces, cardSurface, radii, type } from '../styles/mobileTheme';

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
      accessibilityState={{ disabled: Boolean(isDisabled), busy: isLoading }}
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
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    paddingHorizontal: 20
  },
  primary: accentFill(colors.primary),
  secondary: {
    ...cardSurface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: surfaces.edge
  },
  danger: {
    ...cardSurface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.danger
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }]
  },
  disabled: {
    opacity: 0.45
  },
  label: {
    ...type.label,
    color: colors.text,
    fontSize: 16
  },
  primaryLabel: {
    color: colors.primaryText
  }
});
