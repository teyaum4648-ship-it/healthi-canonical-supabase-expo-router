import { StyleSheet, View, type ViewProps } from 'react-native';

import { colors, radii, spacing } from '../styles/theme';
import { colors as mobileColors, radii as mobileRadii, spacing as mobileSpacing } from '../styles/mobileTheme';

type CardProps = ViewProps & {
  appearance?: 'default' | 'mobile';
};

export function Card({ appearance = 'default', style, ...props }: CardProps) {
  return <View style={[styles.card, appearance === 'mobile' ? mobileStyles.card : null, style]} {...props} />;
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    shadowColor: colors.deepViolet,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.06,
    shadowRadius: 24,
    padding: spacing.md
  }
});

const mobileStyles = StyleSheet.create({
  card: {
    backgroundColor: mobileColors.surface,
    borderColor: mobileColors.border,
    borderRadius: mobileRadii.lg,
    gap: mobileSpacing.sm,
    padding: 18,
    shadowOpacity: 0
  }
});
