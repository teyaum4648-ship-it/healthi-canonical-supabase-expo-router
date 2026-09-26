import { StyleSheet, View, type ViewProps } from 'react-native';

import { surfaces, cardSurface, radii, spacing } from '../styles/mobileTheme';

export function Card({ style, ...props }: ViewProps) {
  return <View style={[styles.card, style]} {...props} />;
}

const styles = StyleSheet.create({
  card: {
    ...cardSurface,
    borderColor: surfaces.edge,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.lg,
    gap: spacing.sm,
    padding: 18
  }
});
