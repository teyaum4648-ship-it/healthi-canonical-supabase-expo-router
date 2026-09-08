import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type PressableProps
} from 'react-native';

import { colors, fonts, radii, spacing } from '../styles/theme';
import {
  colors as mobileColors,
  fonts as mobileFonts,
  radii as mobileRadii
} from '../styles/mobileTheme';

type ButtonVariant = 'primary' | 'secondary' | 'danger';

type ButtonProps = PressableProps & {
  label: string;
  isLoading?: boolean;
  variant?: ButtonVariant;
  appearance?: 'default' | 'mobile';
};

export function Button({
  label,
  disabled,
  isLoading = false,
  variant = 'primary',
  appearance = 'default',
  style,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || isLoading;
  const usesMobileTheme = appearance === 'mobile';

  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      style={(state) => [
        styles.base,
        styles[variant],
        usesMobileTheme ? mobileStyles.base : null,
        usesMobileTheme ? mobileStyles[variant] : null,
        state.pressed && !isDisabled ? styles.pressed : null,
        isDisabled ? styles.disabled : null,
        typeof style === 'function' ? style(state) : style
      ]}
      {...props}
    >
      {isLoading ? (
        <ActivityIndicator color={variant === 'primary' ? (usesMobileTheme ? mobileColors.primaryText : colors.primaryText) : (usesMobileTheme ? mobileColors.primary : colors.primary)} />
      ) : (
        <Text
          style={[
            styles.label,
            variant === 'primary' ? styles.primaryLabel : null,
            usesMobileTheme ? mobileStyles.label : null,
            usesMobileTheme && variant === 'primary' ? mobileStyles.primaryLabel : null
          ]}
        >
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

const mobileStyles = StyleSheet.create({
  base: {
    borderRadius: mobileRadii.md,
    minHeight: 52,
    paddingHorizontal: 20
  },
  primary: {
    backgroundColor: mobileColors.primary,
    shadowOpacity: 0
  },
  secondary: {
    backgroundColor: mobileColors.surfaceInset,
    borderColor: mobileColors.borderStrong
  },
  danger: {
    backgroundColor: mobileColors.surfaceInset,
    borderColor: mobileColors.danger
  },
  label: {
    color: mobileColors.text,
    fontFamily: mobileFonts.bodyMedium,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.1,
    textTransform: 'none'
  },
  primaryLabel: {
    color: mobileColors.primaryText
  }
});
