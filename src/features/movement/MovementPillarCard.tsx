import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { FoundationScore } from '../../engines/foundations';

/**
 * Where movement stands, and what is holding it there.
 *
 * Takes its colours from the host tab rather than from the global tokens. The Move tab
 * runs blue on black and the Sleep tab runs sage on warm black, and a card built from
 * the shared palette matched neither — it read as a component from another app dropped
 * into the page, which is the exact failure a design system is supposed to prevent.
 *
 * With nothing logged there is no score block at all. An earlier version showed an
 * em-dash next to the words "No data", which rendered as a stray horizontal rule that
 * looked like a divider, above a grey panel announcing that nothing had happened yet —
 * competing with the one button a new person should press. An empty pillar is an
 * invitation, so it is drawn as one.
 */

export type MovementCardPalette = {
  surface: string;
  ink: string;
  accent: string;
  muted: string;
  line: string;
  wash: string;
};

export function MovementPillarCard({
  score,
  causes,
  onOpenScreen,
  hasScreen,
  palette
}: {
  score: FoundationScore;
  causes: string[];
  onOpenScreen: () => void;
  hasScreen: boolean;
  palette: MovementCardPalette;
}) {
  const unread = score.score === null;

  const checkRow = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={hasScreen ? 'Redo your movement check' : 'Start your movement check'}
      onPress={onOpenScreen}
      style={({ pressed }) => [
        styles.action,
        !unread && { borderTopColor: palette.line, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 14 },
        pressed && styles.pressed
      ]}
    >
      <Ionicons accessible={false} color={palette.accent} name="body-outline" size={20} />
      <View style={styles.flex}>
        <Text style={[styles.actionTitle, { color: palette.ink }]}>
          {hasScreen ? 'Check again' : 'Check how you move'}
        </Text>
        <Text style={[styles.actionDetail, { color: palette.muted }]}>
          {hasScreen
            ? 'Seven checks. Worth repeating every month or two.'
            : 'Seven checks you can do now, in a room, with nothing.'}
        </Text>
      </View>
      <Ionicons accessible={false} color={palette.muted} name="chevron-forward" size={17} />
    </Pressable>
  );

  if (unread) {
    return (
      <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.line }]}>
        {checkRow}
      </View>
    );
  }

  return (
    <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.line }]}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={[styles.eyebrow, { color: palette.muted }]}>Movement</Text>
          <Text style={[styles.summary, { color: palette.ink }]}>{score.summary}</Text>
        </View>
        <View style={styles.scoreBlock}>
          <Text style={[styles.score, { color: palette.accent }]}>{score.score}</Text>
          <Text style={[styles.scoreUnit, { color: palette.muted }]}>/ 100</Text>
        </View>
      </View>

      <Text style={[styles.meta, { color: palette.muted }]}>
        {score.confidence} confidence · {Math.round(score.coverage * 100)}% of the signals we look at
      </Text>

      {score.limiters.length > 0 ? (
        <View style={styles.limiters}>
          {score.limiters.map((limiter) => (
            <View key={limiter.id} style={styles.limiterRow}>
              <View style={[styles.limiterDot, { backgroundColor: palette.accent }]} />
              <View style={styles.flex}>
                <Text style={[styles.limiterLabel, { color: palette.ink }]}>{limiter.label}</Text>
                <Text style={[styles.limiterDetail, { color: palette.muted }]}>{limiter.detail}</Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {causes.length > 0 ? (
        <View style={[styles.causes, { backgroundColor: palette.wash }]}>
          {causes.map((cause) => (
            <Text key={cause} style={[styles.cause, { color: palette.ink }]}>{cause}</Text>
          ))}
        </View>
      ) : null}

      {checkRow}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 18, borderWidth: 1, gap: 14, paddingHorizontal: 18, paddingVertical: 16 },
  header: { alignItems: 'flex-start', flexDirection: 'row', gap: 14 },
  headerCopy: { flex: 1, gap: 6, minWidth: 0 },
  flex: { flex: 1, gap: 2, minWidth: 0 },
  eyebrow: { fontSize: 12, fontWeight: '600', letterSpacing: 1.1, textTransform: 'uppercase' },
  summary: { fontSize: 17, lineHeight: 24 },
  scoreBlock: { alignItems: 'flex-end' },
  score: { fontSize: 34, fontVariant: ['tabular-nums'], fontWeight: '600', lineHeight: 38 },
  scoreUnit: { fontSize: 12 },
  meta: { fontSize: 13, lineHeight: 18 },
  limiters: { gap: 10 },
  limiterRow: { flexDirection: 'row', gap: 10 },
  limiterDot: { borderRadius: 3, height: 6, marginTop: 7, width: 6 },
  limiterLabel: { fontSize: 15, fontWeight: '600' },
  limiterDetail: { fontSize: 13, lineHeight: 19 },
  causes: { borderRadius: 12, gap: 8, padding: 14 },
  cause: { fontSize: 13, lineHeight: 20 },
  action: { alignItems: 'center', flexDirection: 'row', gap: 12, minHeight: 52 },
  actionTitle: { fontSize: 16, fontWeight: '600' },
  actionDetail: { fontSize: 13, lineHeight: 19 },
  pressed: { opacity: 0.65 }
});
