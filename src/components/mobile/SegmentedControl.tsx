import { Pressable, StyleSheet, Text, View } from 'react-native';

import { bone, control, font, HIT, ink, radius } from '../../styles/daywoven1c';

/** A 1c segmented control (design language P14): a hairline track; the chosen segment is ink with bone text. */
export function SegmentedControl<T extends string>({ options, value, onChange }: {
  options: readonly T[]; value: T; onChange: (value: T) => void;
}) {
  return <View accessibilityRole="tablist" style={styles.row}>{options.map((option) => (
    <Pressable key={option} accessibilityRole="tab" accessibilityState={{ selected: value === option }} onPress={() => onChange(option)} style={({ pressed }) => [styles.option, value === option && styles.selected, pressed && value !== option && styles.pressed]}>
      <Text style={[styles.label, value === option && styles.selectedLabel]}>{option}</Text>
    </Pressable>
  ))}</View>;
}

const styles = StyleSheet.create({
  row: { backgroundColor: control.segmentTrack, borderColor: ink.hairline, borderRadius: radius.button, borderWidth: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 3, padding: 3 },
  option: { alignItems: 'center', borderRadius: radius.button - 3, flexBasis: 70, flexGrow: 1, justifyContent: 'center', minHeight: HIT - 4, paddingHorizontal: 8, paddingVertical: 8 },
  selected: { backgroundColor: ink.text },
  label: { color: ink.muted, fontFamily: font.bodyMedium, fontSize: 13.5, textAlign: 'center' },
  selectedLabel: { color: bone.text },
  pressed: { backgroundColor: ink.wash }
});
