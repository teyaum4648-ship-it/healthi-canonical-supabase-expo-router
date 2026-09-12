import { StyleSheet, View, type ViewProps } from 'react-native';

import { colors, radii, spacing } from '../styles/mobileTheme';

export function Card({ style, ...props }: ViewProps) {
  return <View style={[styles.card, style]} {...props} />;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.lg,
    gap: spacing.sm,
    padding: 18
  }
});
