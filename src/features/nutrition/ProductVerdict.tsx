import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { colors, hairlineWidth, type, cardSurface } from '../../styles/mobileTheme';
import type { ProductLetterGrade } from '../../engines/nutrition/productScoring';
import type { CompositionSlice, ProductExplanation } from '../../engines/nutrition/productScoring/explain';
import { isCostRole } from '../../engines/nutrition/productScoring/explain';

/**
 * What a scan says back.
 *
 * The screen this replaces led with a letter and then spent six lines on the model:
 * "Provisional · Confidence: Medium", a score range, a supported-dimensions line, a
 * context line, and two lists headed WHAT HELPS and WHAT TO CONSIDER whose entries read
 * "Nutrition profile: What the label delivers." A person holding a box of crackers
 * learned the app's opinion of its own certainty and nothing about the crackers.
 *
 * The same failure the Guidance page had, in a different costume, and the same fix:
 * name the thing, then say why. Three blocks, in the order the question is actually
 * asked — what is this worth, what is it made of, and what decided it — and each one
 * disappears when it has nothing to say. The reasons come from `explain.ts`, which
 * carries the premise the old copy left out, so the screen's job here is to stay out of
 * the way of a sentence like "both are starches with the fibre milled out".
 *
 * Confidence has not gone; it has stopped leading. It sits with the source line at the
 * bottom, where a caveat belongs, and only when the grade is not settled.
 */

const GRADE_COLOR: Record<ProductLetterGrade, string> = {
  A: '#248A3D',
  B: '#4E9A1E',
  C: '#9A7400',
  D: '#C25400',
  F: '#D70015'
};

/** The bar reads left to right from what the product mostly is to what it least is. */
function sliceColor(slice: CompositionSlice): string {
  if (slice.role === 'unknown') return colors.surfaceMuted;
  if (slice.role === 'neutral') return '#3A3A3C';
  if (isCostRole(slice.role)) return slice.role === 'refined_starch' ? '#9A7400' : '#C25400';
  return '#248A3D';
}

export function ProductVerdict({ explanation, name, brand, score, grade, certaintyNote, sourceNote }: {
  explanation: ProductExplanation;
  name: string;
  brand?: string | null;
  score: number | null;
  grade: ProductLetterGrade | null;
  /** Shown only when the grade is not settled. A caveat, not a headline. */
  certaintyNote?: string | null;
  sourceNote?: string | null;
}) {
  const accent = grade ? GRADE_COLOR[grade] : colors.textMuted;
  // A sliver too thin to see is noise in the legend; it stays in the bar.
  const legend = explanation.composition.filter((slice) => slice.share >= 0.02);

  return (
    <View style={styles.page}>
      <View style={[styles.panel, { borderColor: `${accent}44` }]}>
        {brand ? <Text style={styles.eyebrow}>{brand.toUpperCase()}</Text> : null}
        <Text style={styles.productName}>{name}</Text>
        <View style={styles.verdictRow}>
          <View style={[styles.gradeBadge, { backgroundColor: `${accent}1F`, borderColor: `${accent}59` }]}>
            <Text style={[styles.gradeLetter, { color: accent }]}>{grade ?? '—'}</Text>
            <Text style={[styles.gradeScore, { color: accent }]}>{score ?? '--'}</Text>
          </View>
          <Text style={styles.verdictText}>{explanation.verdict}</Text>
        </View>
      </View>

      {legend.length > 0 ? (
        <View style={styles.panel}>
          <Text style={styles.eyebrow}>What it’s made of</Text>
          <View style={styles.bar}>
            {explanation.composition.map((slice) => (
              <View
                key={slice.role}
                style={{ backgroundColor: sliceColor(slice), flexGrow: slice.share, flexBasis: 0 }}
              />
            ))}
          </View>
          {legend.map((slice) => (
            <View key={slice.role} style={styles.legendRow}>
              <View style={[styles.legendDot, { backgroundColor: sliceColor(slice) }]} />
              <View style={styles.legendCopy}>
                <Text style={styles.legendLabel}>{slice.label}</Text>
                <Text numberOfLines={1} style={styles.legendNames}>{slice.names.join(', ')}</Text>
              </View>
              <Text style={styles.legendShare}>{Math.round(slice.share * 100)}%</Text>
            </View>
          ))}
          <Text style={styles.footnote}>
            Read by position. An ingredient list runs in order of mass, which is the only
            quantity a label has to give.
          </Text>
        </View>
      ) : null}

      {explanation.findings.length > 0 ? (
        <View style={styles.panel}>
          <Text style={styles.eyebrow}>Why this score</Text>
          {explanation.findings.map((finding) => (
            <View key={finding.id} style={styles.finding}>
              <View
                style={[
                  styles.findingRail,
                  { backgroundColor: finding.tone === 'strength' ? '#248A3D' : accent }
                ]}
              />
              <View style={styles.findingCopy}>
                <Text style={styles.findingHeadline}>{finding.headline}</Text>
                <Text style={styles.findingMechanism}>{finding.mechanism}</Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {explanation.unrecognised.length > 0 ? (
        <View style={styles.panel}>
          <Text style={styles.eyebrow}>Not yet recognised</Text>
          <Text style={styles.footnote}>
            {explanation.unrecognised.length === 1 ? 'This ingredient is' : 'These ingredients are'} not in
            the table yet, so {explanation.unrecognised.length === 1 ? 'it counts' : 'they count'} as
            neither food nor formulation: {explanation.unrecognised.join(', ')}.
          </Text>
        </View>
      ) : null}

      {certaintyNote || sourceNote ? (
        <View style={styles.caveat}>
          <Ionicons color={colors.textFaint} name="information-circle-outline" size={15} />
          <Text style={styles.caveatText}>
            {[certaintyNote, sourceNote].filter(Boolean).join(' · ')}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: 14 },
  panel: {
    ...cardSurface,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: hairlineWidth,
    gap: 12,
    padding: 18
  },
  eyebrow: { ...type.label, color: colors.textMuted, fontSize: 13, letterSpacing: 0 },

  productName: { ...type.heading, color: colors.text },
  verdictRow: { alignItems: 'center', flexDirection: 'row', gap: 16 },
  gradeBadge: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: hairlineWidth,
    justifyContent: 'center',
    minWidth: 76,
    paddingVertical: 10
  },
  gradeLetter: { ...type.title, fontSize: 38, lineHeight: 44 },
  gradeScore: { ...type.label, fontVariant: ['tabular-nums'], opacity: 0.85 },
  verdictText: { ...type.body, color: colors.text, flex: 1, minWidth: 0 },

  bar: { borderRadius: 6, flexDirection: 'row', height: 12, overflow: 'hidden', width: '100%' },
  legendRow: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  legendDot: { borderRadius: 3, height: 6, width: 6 },
  legendCopy: { flex: 1, minWidth: 0 },
  legendLabel: { ...type.label, color: colors.text },
  legendNames: { ...type.caption, color: colors.textFaint },
  legendShare: { ...type.label, color: colors.textMuted, fontVariant: ['tabular-nums'] },

  finding: { flexDirection: 'row', gap: 12 },
  findingRail: { borderRadius: 2, marginTop: 3, width: 3 },
  findingCopy: { flex: 1, gap: 4, minWidth: 0 },
  findingHeadline: { ...type.label, color: colors.text, fontSize: 15 },
  findingMechanism: { ...type.caption, color: colors.textMuted, lineHeight: 19 },

  footnote: { ...type.caption, color: colors.textFaint, lineHeight: 18 },
  caveat: { alignItems: 'flex-start', flexDirection: 'row', gap: 7, paddingHorizontal: 4 },
  caveatText: { ...type.caption, color: colors.textFaint, flex: 1, minWidth: 0 }
});
