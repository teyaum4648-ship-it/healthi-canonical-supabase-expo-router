import { StyleSheet, Text, View } from 'react-native';

import { FluidPressable } from '../../../components/mobile/FluidPressable';
import { BIOMARKER_SPECS, formatBiomarkerValue, type BiomarkerKind, type BiomarkerSummary } from '../../../engines/biomarkers';
import { colors, type, zones } from '../../../styles/mobileTheme';

/**
 * The deep layer behind the readiness ring: last night's HRV, resting heart rate and
 * respiratory rate, each against the person's own usual. Each tile opens the entry sheet
 * for that measure, so an empty tile is also the way to fill it.
 */
export function BiomarkerBreakdown({ summaries, onEdit }: {
  summaries: BiomarkerSummary[];
  onEdit: (kind: BiomarkerKind) => void;
}) {
  return (
    <View style={styles.wrap}>
      <View style={styles.grid}>
        {summaries.map((summary) => {
          const spec = BIOMARKER_SPECS[summary.kind];
          const zone = zones[summary.zone];
          const value = summary.latest ? formatBiomarkerValue(summary.kind, summary.latest.value) : null;
          return (
            <FluidPressable
              key={summary.kind}
              accessibilityRole="button"
              accessibilityLabel={`${spec.label}: ${value ? `${value} ${spec.unit}, ${summary.status}` : 'no reading yet'}. ${value ? 'Update' : 'Add'} reading`}
              onPress={() => onEdit(summary.kind)}
              style={styles.tile}
              hoverStyle={styles.tileHover}
            >
              <Text numberOfLines={1} style={styles.name}>{spec.shortLabel}</Text>
              <View style={styles.valueRow}>
                <Text style={[styles.value, !value && styles.valueEmpty]}>{value ?? '—'}</Text>
                {value ? <Text style={styles.unit}>{spec.unit}</Text> : null}
              </View>
              <View style={[styles.status, { backgroundColor: zone.background }]}>
                <Text numberOfLines={2} style={[styles.statusText, { color: zone.text }]}>
                  {summary.deltaLabel ?? (value ? summary.status : 'Add reading')}
                </Text>
              </View>
            </FluidPressable>
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
  wrap: { alignSelf: 'stretch', gap: 10, paddingBottom: 12 },
  grid: { flexDirection: 'row', gap: 8 },
  tile: {
    backgroundColor: colors.surfaceInset,
    borderCurve: 'continuous',
    borderRadius: 14,
    flex: 1,
    gap: 6,
    minHeight: 112,
    padding: 12
  },
  tileHover: { backgroundColor: '#ECECF0' },
  name: { ...type.caption, color: colors.textMuted, fontWeight: '600' },
  valueRow: { alignItems: 'baseline', flexDirection: 'row', gap: 3 },
  value: { color: colors.text, fontSize: 24, fontVariant: ['tabular-nums'], fontWeight: '700', letterSpacing: -0.5, lineHeight: 28 },
  valueEmpty: { color: colors.textMuted },
  unit: { ...type.caption, color: colors.textMuted, fontSize: 12 },
  status: { alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 3 },
  statusText: { fontSize: 11, fontWeight: '600', lineHeight: 14 },
  note: { ...type.caption, color: colors.textMuted, fontSize: 12, lineHeight: 16, textAlign: 'center' }
});
