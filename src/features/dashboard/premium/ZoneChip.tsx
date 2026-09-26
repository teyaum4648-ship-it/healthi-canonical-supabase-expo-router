import { StyleSheet, Text, View } from 'react-native';

import { type, zones, type ZoneTone } from '../../../styles/mobileTheme';

/** A zone as a soft wash with its word in the darker shade of the same hue. */
export function ZoneChip({ tone, label }: { tone: ZoneTone; label: string }) {
  const zone = zones[tone];
  return (
    <View style={[styles.chip, { backgroundColor: zone.background }]}>
      <View style={[styles.dot, { backgroundColor: zone.text }]} />
      <Text numberOfLines={1} style={[styles.text, { color: zone.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignSelf: 'flex-start',
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 14,
    flexDirection: 'row',
    gap: 6,
    minHeight: 26,
    paddingHorizontal: 10,
    paddingVertical: 4
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  text: { ...type.caption, fontSize: 13, fontWeight: '600', lineHeight: 17 }
});
