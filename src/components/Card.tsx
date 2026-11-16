import { StyleSheet, View, type ViewProps } from 'react-native';

import { ink, radius, surface } from '../styles/daywoven1c';
import { spacing } from '../styles/mobileTheme';

/** A 1c white card (design language P5): white, a 1pt hairline edge, radius 14. */
export function Card({ style, ...props }: ViewProps) {
  return <View style={[styles.card, style]} {...props} />;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: surface.card,
    borderColor: ink.border,
    borderWidth: 1,
    borderRadius: radius.card,
    gap: spacing.sm,
    padding: 16
  }
});
