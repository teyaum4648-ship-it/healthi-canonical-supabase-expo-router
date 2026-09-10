import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, type } from '../../styles/mobileTheme';

export function SegmentedControl<T extends string>({ options, value, onChange }: {
  options: readonly T[]; value: T; onChange: (value: T) => void;
}) {
  return <View accessibilityRole="tablist" style={styles.row}>{options.map((option) => (
    <Pressable key={option} accessibilityRole="tab" accessibilityState={{ selected: value === option }} onPress={() => onChange(option)} style={({ pressed }) => [styles.option, value === option && styles.selected, pressed && styles.pressed]}>
      <Text style={[styles.label, value === option && styles.selectedLabel]}>{option}</Text>
    </Pressable>
  ))}</View>;
}
const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', padding: 4, borderRadius: 15, backgroundColor: colors.surfaceInset, gap: 4 },
  option: { flexGrow: 1, flexBasis: 70, minHeight: 44, borderRadius: 11, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8, paddingVertical: 8 },
  selected: { backgroundColor: colors.surfaceMuted },
  label: { ...type.label, color: colors.textMuted, textAlign: 'center' },
  selectedLabel: { color: colors.text },
  pressed: { opacity: 0.7 }
});
