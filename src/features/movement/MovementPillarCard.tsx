import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { FoundationScore } from '../../engines/foundations';
import { colors, radii, spacing, type } from '../../styles/mobileTheme';

/**
 * Where movement stands, and what is holding it there.
 *
 * The number is the least interesting part of this card, which is why it does not get to
 * be the whole of it. A score with no reason attached is a verdict; the rows underneath
 * are what make it something a person can do anything about — and where the reason lives
 * outside movement, the card says so rather than implying the training is the problem.
 */
export function MovementPillarCard({
  score,
  causes,
  onOpenScreen,
  hasScreen
}: {
  score: FoundationScore;
  causes: string[];
  onOpenScreen: () => void;
  hasScreen: boolean;
}) {
  const unread = score.score === null;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>Movement</Text>
          <Text style={styles.summary}>{score.summary}</Text>
        </View>
        <View style={styles.scoreBlock}>
          <Text style={[styles.score, unread && styles.scoreUnread]}>{unread ? '—' : score.score}</Text>
          <Text style={styles.scoreUnit}>{unread ? 'No data' : '/ 100'}</Text>
        </View>
      </View>

      <Text style={styles.meta}>
        {score.confidence} confidence · {Math.round(score.coverage * 100)}% of the signals we look at
      </Text>

      {score.limiters.length > 0 ? (
        <View style={styles.limiters}>
          {score.limiters.map((limiter) => (
            <View key={limiter.id} style={styles.limiterRow}>
              <View style={styles.limiterDot} />
              <View style={styles.limiterCopy}>
                <Text style={styles.limiterLabel}>{limiter.label}</Text>
                <Text style={styles.limiterDetail}>{limiter.detail}</Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {causes.length > 0 ? (
        <View style={styles.causes}>
          {causes.map((cause) => (
            <Text key={cause} style={styles.cause}>{cause}</Text>
          ))}
        </View>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={hasScreen ? 'Redo your movement check' : 'Start your movement check'}
        onPress={onOpenScreen}
        style={({ pressed }) => [styles.action, pressed && styles.pressed]}
      >
        <Ionicons accessible={false} color={colors.accentMid} name="body-outline" size={20} />
        <View style={styles.actionCopy}>
          <Text style={styles.actionTitle}>{hasScreen ? 'Check again' : 'Check how you move'}</Text>
          <Text style={styles.actionDetail}>
            {hasScreen
              ? 'Seven checks. Worth repeating every month or two.'
              : 'Seven checks you can do now, in a room, with nothing.'}
          </Text>
        </View>
        <Ionicons accessible={false} color={colors.textMuted} name="chevron-forward" size={17} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.lg
  },
  header: { alignItems: 'flex-start', flexDirection: 'row', gap: spacing.md },
  headerCopy: { flex: 1, gap: 6, minWidth: 0 },
  eyebrow: { ...type.eyebrow, color: colors.textFaint },
  summary: { ...type.body, color: colors.text },
  scoreBlock: { alignItems: 'flex-end' },
  score: { ...type.numberLg, color: colors.accentMid },
  scoreUnread: { color: colors.textFaint },
  scoreUnit: { ...type.caption, color: colors.textFaint },
  meta: { ...type.caption, color: colors.textFaint },
  limiters: { gap: spacing.sm },
  limiterRow: { flexDirection: 'row', gap: spacing.sm },
  limiterDot: {
    backgroundColor: colors.accentSoft,
    borderRadius: 3,
    height: 6,
    marginTop: 7,
    width: 6
  },
  limiterCopy: { flex: 1, gap: 2, minWidth: 0 },
  limiterLabel: { ...type.label, color: colors.text },
  limiterDetail: { ...type.caption, color: colors.textMuted },
  causes: {
    backgroundColor: colors.surfaceInset,
    borderRadius: radii.md,
    gap: spacing.sm,
    padding: spacing.md
  },
  cause: { ...type.caption, color: colors.textMuted, lineHeight: 20 },
  action: {
    alignItems: 'center',
    borderTopColor: colors.borderMuted,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 56,
    paddingTop: spacing.md
  },
  actionCopy: { flex: 1, gap: 2, minWidth: 0 },
  actionTitle: { ...type.body, color: colors.text, fontWeight: '600' },
  actionDetail: { ...type.caption, color: colors.textMuted },
  pressed: { opacity: 0.65 }
});
