import { StyleSheet, View, type ViewProps } from 'react-native';

import { glass, glassSurface, radii, spacing } from '../styles/mobileTheme';

export function Card({ style, ...props }: ViewProps) {
  return <View style={[styles.card, style]} {...props} />;
}

const styles = StyleSheet.create({
  card: {
    ...glassSurface,
    borderColor: glass.edge,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.lg,
    gap: spacing.sm,
    padding: 18
  }
});
