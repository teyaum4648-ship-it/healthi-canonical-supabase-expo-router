import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, hairlineWidth, type, glassSurface } from '../../styles/mobileTheme';
import { tabAccent } from '../../styles/pillarColors';
import type { ProductLetterGrade } from '../../engines/nutrition/productScoring';
import { reviewCoverageLine, type FoodQualityReview, type GradedItem } from './foodQualityReview';

/**
 * The page that used to be called Guidance.
 *
 * It showed a verdict, a confidence meter, a list headed "Priorities" and two blocks
 * called "Adaptive nutrient field" and "Coverage builder" — all of it about the app's
 * reasoning, none of it naming a single thing the person had eaten. A page that cannot
 * say "the cola was the F" is a status readout, not guidance.
 *
 * So it answers the question the scanner exists for and the diary cannot show: across
 * what you logged, what did it come to, what was the worst of it, and what were the
 * poor grades actually made of. The worst item leads, because that is the end of the
 * list anything can be done about.
 *
 * Nothing here is averaged out of an item that has no grade. A meal someone cooked is
 * unmeasured, not bad, and the count of those is on screen rather than hidden.
 */

const GRADE_COLOR: Record<ProductLetterGrade, string> = {
  A: '#30D158',
  B: '#9BE36D',
  C: '#FFD60A',
  D: '#FF9F0A',
  F: '#FF6B6B'
};

function GradeBadge({ grade, size = 'small' }: { grade: ProductLetterGrade; size?: 'small' | 'large' }) {
  const large = size === 'large';
  return (
    <View
      style={[
        styles.badge,
        large && styles.badgeLarge,
        { backgroundColor: `${GRADE_COLOR[grade]}22`, borderColor: `${GRADE_COLOR[grade]}66` }
      ]}
    >
      <Text style={[styles.badgeText, large && styles.badgeTextLarge, { color: GRADE_COLOR[grade] }]}>{grade}</Text>
    </View>
  );
}

function ItemRow({ item, note }: { item: GradedItem; note?: string }) {
  return (
    <View style={styles.itemRow}>
      <GradeBadge grade={item.grade} />
      <View style={styles.itemCopy}>
        <Text numberOfLines={1} style={styles.itemName}>{item.name}</Text>
        {note ? <Text style={styles.itemNote}>{note}</Text> : null}
      </View>
      <Text style={styles.itemScore}>{item.score}</Text>
    </View>
  );
}

export function FoodQualityReviewPanel({ review, windowLabel, onOpenScanner, onOpenPreferences }: {
  review: FoodQualityReview;
  /** What span this covers, in the words the screen already uses. */
  windowLabel: string;
  onOpenScanner: () => void;
  onOpenPreferences: () => void;
}) {
  if (review.empty) {
    return (
      <View style={styles.page}>
        <View style={styles.panel}>
          <Text style={styles.eyebrow}>{windowLabel.toUpperCase()}</Text>
          <Text style={styles.emptyTitle}>Nothing graded yet</Text>
          <Text style={styles.emptyCopy}>
            {review.ungradedCount > 0
              ? `You logged ${review.ungradedCount} ${review.ungradedCount === 1 ? 'item' : 'items'}, but ${review.ungradedCount === 1 ? 'it was' : 'they were'} entered by hand or cooked, so there is nothing to grade. Scan a packaged product and it will show up here.`
              : 'Scan a packaged product and its grade — and what earned it — will show up here.'}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={onOpenScanner}
            style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
          >
            <Ionicons color={colors.primaryText} name="barcode-outline" size={20} />
            <Text style={styles.primaryText}>Scan a product</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const topCount = Math.max(...review.distribution.map((entry) => entry.count), 1);

  return (
    <View style={styles.page}>
      <View style={styles.panel}>
        <Text style={styles.eyebrow}>{windowLabel.toUpperCase()}</Text>
        <View style={styles.headline}>
          {review.averageGrade ? <GradeBadge grade={review.averageGrade} size="large" /> : null}
          <View style={styles.headlineCopy}>
            <Text style={styles.headlineScore}>{review.average}</Text>
            <Text style={styles.headlineLabel}>
              average across {review.graded.length} graded {review.graded.length === 1 ? 'item' : 'items'}
            </Text>
          </View>
        </View>
        <Text style={styles.coverage}>{reviewCoverageLine(review)}</Text>

        <View style={styles.distribution}>
          {review.distribution.map((entry) => (
            <View key={entry.grade} style={styles.distributionColumn}>
              <View style={styles.distributionTrack}>
                <View
                  style={[
                    styles.distributionFill,
                    {
                      backgroundColor: GRADE_COLOR[entry.grade],
                      height: `${entry.count === 0 ? 2 : Math.round((entry.count / topCount) * 100)}%`
                    }
                  ]}
                />
              </View>
              <Text style={[styles.distributionGrade, { color: GRADE_COLOR[entry.grade] }]}>{entry.grade}</Text>
              <Text style={styles.distributionCount}>{entry.count}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* The two items that make the point, before the full list repeats them. */}
      {review.worst && review.best && review.worst.id !== review.best.id ? (
        <View style={styles.panel}>
          <Text style={styles.eyebrow}>The range</Text>
          <ItemRow item={review.worst} note="The lowest thing you logged" />
          <View style={styles.divider} />
          <ItemRow item={review.best} note="The highest" />
        </View>
      ) : null}

      {review.burdens.length > 0 ? (
        <View style={styles.panel}>
          <Text style={styles.eyebrow}>What the low grades were made of</Text>
          <Text style={styles.burdenIntro}>
            Read from the front of each ingredient list, where what a product is actually
            made of lives.
          </Text>
          {review.burdens.slice(0, 4).map((burden) => (
            <View key={burden.role} style={styles.burdenRow}>
              <View style={styles.burdenDot} />
              <View style={styles.burdenCopy}>
                <Text style={styles.burdenLabel}>{burden.label}</Text>
                <Text numberOfLines={2} style={styles.burdenProducts}>{burden.products.join(' · ')}</Text>
              </View>
              <Text style={styles.burdenCount}>{burden.products.length}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {review.graded.length > 2 ? (
        <View style={styles.panel}>
          <Text style={styles.eyebrow}>Everything graded</Text>
          {review.graded.map((item, index) => (
            <View key={item.id}>
              {index > 0 ? <View style={styles.divider} /> : null}
              <ItemRow item={item} />
            </View>
          ))}
        </View>
      ) : null}

      <Pressable
        accessibilityRole="button"
        onPress={onOpenPreferences}
        style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
      >
        <Text style={styles.secondaryText}>Food preferences and personal responses</Text>
        <Ionicons color={tabAccent.food} name="chevron-forward" size={17} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  // The add-meal dock floats over the bottom of the scroll, so the last row needs to
  // clear it rather than finishing underneath it.
  page: { gap: 14, paddingBottom: 76 },
  panel: {
    ...glassSurface,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: hairlineWidth,
    gap: 12,
    padding: 18
  },
  eyebrow: { ...type.label, color: colors.textMuted, letterSpacing: 0 },

  headline: { alignItems: 'center', flexDirection: 'row', gap: 14 },
  headlineCopy: { flex: 1, minWidth: 0 },
  headlineScore: { ...type.title, color: colors.text, fontVariant: ['tabular-nums'] },
  headlineLabel: { ...type.caption, color: colors.textMuted },
  coverage: { ...type.caption, color: colors.textMuted },

  distribution: { flexDirection: 'row', gap: 10, height: 96 },
  distributionColumn: { alignItems: 'center', flex: 1, gap: 6 },
  distributionTrack: {
    backgroundColor: colors.surfaceInset,
    borderRadius: 7,
    flex: 1,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    width: '100%'
  },
  distributionFill: { borderRadius: 7, width: '100%' },
  distributionGrade: { ...type.label },
  distributionCount: { ...type.caption, color: colors.textFaint, fontVariant: ['tabular-nums'] },

  badge: {
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: hairlineWidth,
    height: 34,
    justifyContent: 'center',
    width: 34
  },
  badgeLarge: { borderRadius: 16, height: 58, width: 58 },
  badgeText: { ...type.label, fontSize: 17 },
  badgeTextLarge: { fontSize: 30, lineHeight: 36 },

  itemRow: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  itemCopy: { flex: 1, gap: 2, minWidth: 0 },
  itemName: { ...type.body, color: colors.text },
  itemNote: { ...type.caption, color: colors.textFaint },
  itemScore: { ...type.body, color: colors.textMuted, fontVariant: ['tabular-nums'] },
  divider: { backgroundColor: colors.border, height: hairlineWidth, marginVertical: 10 },

  burdenIntro: { ...type.caption, color: colors.textMuted },
  burdenRow: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  burdenDot: { backgroundColor: tabAccent.food, borderRadius: 3, height: 6, width: 6 },
  burdenCopy: { flex: 1, gap: 2, minWidth: 0 },
  burdenLabel: { ...type.body, color: colors.text },
  burdenProducts: { ...type.caption, color: colors.textFaint },
  burdenCount: { ...type.body, color: colors.textMuted, fontVariant: ['tabular-nums'] },

  emptyTitle: { ...type.heading, color: colors.text },
  emptyCopy: { ...type.body, color: colors.textMuted },
  primary: {
    alignItems: 'center',
    backgroundColor: tabAccent.food,
    borderRadius: 14,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 50
  },
  primaryText: { ...type.body, color: colors.primaryText, fontWeight: '600' },
  secondary: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
    minHeight: 48,
    paddingHorizontal: 4
  },
  secondaryText: { ...type.body, color: tabAccent.food },
  pressed: { opacity: 0.7 }
});
