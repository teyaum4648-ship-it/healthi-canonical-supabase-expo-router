import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BIOMARKER_SPECS, formatBiomarkerValue, type BiomarkerKind, type BiomarkerSummary } from '../../../engines/biomarkers';
import { font, ink, radius, surface, type } from '../../../styles/daywoven1c';

/**
 * Last night's HRV, resting heart rate and respiratory rate, each against the person's own
 * usual. In 1c it sits under "Explore your analysis" on Today (it used to open from the
 * readiness ring). Each tile opens the entry sheet for that measure, so an empty tile is
 * also the way to fill it.
 */
export function BiomarkerBreakdown({ summaries, onEdit }: {
  summaries: BiomarkerSummary[];
  onEdit: (kind: BiomarkerKind) => void;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text accessibilityRole="header" style={styles.title}>Overnight readings</Text>
        <Text style={styles.meta}>vs your usual</Text>
      </View>
      <View style={styles.grid}>
        {summaries.map((summary) => {
          const spec = BIOMARKER_SPECS[summary.kind];
          const value = summary.latest ? formatBiomarkerValue(summary.kind, summary.latest.value) : null;
          return (
            <Pressable
              key={summary.kind}
              accessibilityRole="button"
              accessibilityLabel={`${spec.label}: ${value ? `${value} ${spec.unit}, ${summary.deltaLabel ?? summary.status}` : 'no reading yet'}. ${value ? 'Update' : 'Add'} reading`}
              onPress={() => onEdit(summary.kind)}
              style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
            >
              <Text numberOfLines={2} style={styles.name}>{spec.shortLabel}</Text>
              <View style={styles.valueRow}>
                <Text style={[styles.value, !value && styles.valueEmpty]}>{value ?? '—'}</Text>
                {value ? <Text style={styles.unit}>{spec.unit}</Text> : null}
              </View>
              <Text numberOfLines={2} style={styles.status}>{summary.deltaLabel ?? (value ? summary.status : 'Add reading')}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.note}>
        From readings you add or a connected health app, compared with your own recent average. Shown alongside the estimate, not scored into it.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: surface.card, borderColor: ink.border, borderRadius: radius.card, borderWidth: 1, gap: 10, paddingHorizontal: 16, paddingVertical: 14 },
  header: { alignItems: 'baseline', flexDirection: 'row', gap: 8, justifyContent: 'space-between' },
  title: { fontFamily: font.bodySemibold, fontSize: 14, color: ink.text },
  meta: { ...type.caption, color: ink.muted },
  grid: { flexDirection: 'row', gap: 8 },
  tile: { backgroundColor: surface.canvas, borderRadius: radius.tile, flex: 1, gap: 4, minHeight: 88, minWidth: 0, padding: 10 },
  pressed: { opacity: 0.7 },
  name: { ...type.small, color: ink.muted },
  valueRow: { alignItems: 'baseline', flexDirection: 'row', gap: 3 },
  value: { fontFamily: font.display, fontSize: 22, lineHeight: 27, color: ink.text, fontVariant: ['tabular-nums'] },
  valueEmpty: { color: ink.muted },
  unit: { fontFamily: font.body, fontSize: 11, color: ink.muted },
  status: { fontFamily: font.body, fontSize: 11, lineHeight: 14, color: ink.muted },
  note: { ...type.small, color: ink.muted }
});
