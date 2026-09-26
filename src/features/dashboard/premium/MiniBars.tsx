import { StyleSheet, View } from 'react-native';

/**
 * Seven flat bars, oldest to newest, with the newest in the metric's colour and the rest
 * in a quiet grey. No axis, no gridlines: the card's number carries the value and this
 * carries only the shape of the week. A day with nothing logged is a short stub, so a
 * gap reads as missing rather than as zero.
 */
export function MiniBars({ values, color, height = 40, label }: {
  values: (number | null)[];
  color: string;
  height?: number;
  /** What the bars show, for screen readers. */
  label: string;
}) {
  const max = Math.max(1, ...values.map((value) => value ?? 0));
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={label} style={[styles.row, { height }]}>
      {values.map((value, index) => {
        const last = index === values.length - 1;
        if (value === null || value <= 0) return <View key={index} style={styles.stub} />;
        return (
          <View
            key={index}
            style={[styles.bar, { height: Math.max(4, Math.round((value / max) * height)), backgroundColor: last ? color : '#E3E3E8' }]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 5 },
  bar: { flex: 1, borderRadius: 4, borderCurve: 'continuous' },
  stub: { flex: 1, height: 4, borderRadius: 2, backgroundColor: '#EDEDF0' }
});
