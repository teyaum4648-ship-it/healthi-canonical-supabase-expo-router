import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { DailyProtocol, DailyProtocolAction, ProtocolActionKind, ProtocolActionStatus } from '../../src/engines/protocol';
import { useAuth } from '../../src/features/auth/AuthProvider';
import { useLocalToday } from '../../src/features/navigation/useLocalToday';
import {
  confidenceLabel,
  dayModeLabel,
  focusLabel,
  localDailyProtocolStore,
  protocolScope,
  safetyStatusLabel,
  shouldSurfaceSafety
} from '../../src/features/dailyProtocol';
import { colors, hairlineWidth, radii, spacing, type } from '../../src/styles/mobileTheme';

function actionIcon(kind: ProtocolActionKind): keyof typeof Ionicons.glyphMap {
  switch (kind) {
    case 'movement':
      return 'barbell-outline';
    case 'restore':
      return 'leaf-outline';
    case 'hydration':
      return 'water-outline';
    case 'meal':
      return 'nutrition-outline';
    case 'walk':
      return 'walk-outline';
    case 'caffeine_cutoff':
      return 'cafe-outline';
    case 'wind_down':
      return 'moon-outline';
    case 'reflection':
      return 'sparkles-outline';
    case 'schedule':
      return 'calendar-outline';
    default:
      return 'ellipse-outline';
  }
}

/**
 * One protocol action as a checklist row.
 *
 * Each action used to carry three equal buttons — Done, Skip, Later — so five actions put
 * fifteen buttons on the screen and made "skip" look as expected as "do". Done is now the
 * row's check, the way a to-do list works; skipping or moving it to later is one tap
 * further, behind the row's "more" button, and says so on the row once chosen.
 */
function ActionRow({
  action,
  last,
  onSetStatus
}: {
  action: DailyProtocolAction;
  last: boolean;
  onSetStatus: (id: string, status: ProtocolActionStatus) => void;
}) {
  const [options, setOptions] = useState(false);
  const done = action.status === 'done';
  const aside = action.status === 'skipped' ? 'Skipped for today' : action.status === 'deferred' ? 'Moved to later' : null;
  const choose = (status: ProtocolActionStatus) => { setOptions(false); onSetStatus(action.id, status); };
  return (
    <View style={[styles.row, !last && styles.rowDivider]}>
      <View style={styles.rowMain}>
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: done }}
          accessibilityLabel={action.title}
          hitSlop={6}
          onPress={() => onSetStatus(action.id, done ? 'pending' : 'done')}
          style={({ pressed }) => [styles.check, done && styles.checkDone, pressed && styles.pressed]}
        >
          {done ? <Ionicons accessible={false} color={colors.textInverse} name="checkmark" size={16} /> : null}
        </Pressable>
        <View style={styles.actionCopy}>
          <View style={styles.titleLine}>
            <Ionicons accessible={false} color={colors.textMuted} name={actionIcon(action.kind)} size={15} />
            <Text style={[styles.actionTitle, (done || aside) && styles.actionTitleQuiet]}>{action.title}</Text>
          </View>
          <Text style={styles.actionDetail}>{action.detail}</Text>
          {aside || action.time_hint ? <Text style={styles.actionTime}>{aside ?? `Around ${action.time_hint}`}</Text> : null}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`More options for ${action.title}`}
          accessibilityState={{ expanded: options }}
          onPress={() => setOptions((open) => !open)}
          style={({ pressed }) => [styles.more, pressed && styles.pressed]}
        >
          <Ionicons accessible={false} color={colors.textMuted} name="ellipsis-horizontal" size={18} />
        </Pressable>
      </View>
      {options ? (
        <View style={styles.optionRow}>
          {action.status === 'skipped' || action.status === 'deferred'
            ? <Pressable accessibilityRole="button" onPress={() => choose('pending')} style={({ pressed }) => [styles.option, pressed && styles.pressed]}><Text style={styles.optionText}>Put back</Text></Pressable>
            : <>
              <Pressable accessibilityRole="button" onPress={() => choose('deferred')} style={({ pressed }) => [styles.option, pressed && styles.pressed]}><Text style={styles.optionText}>Later</Text></Pressable>
              <Pressable accessibilityRole="button" onPress={() => choose('skipped')} style={({ pressed }) => [styles.option, pressed && styles.pressed]}><Text style={styles.optionText}>Skip today</Text></Pressable>
            </>}
        </View>
      ) : null}
    </View>
  );
}

export default function ProtocolScreen() {
  const { user } = useAuth();
  /* The local day Home wrote the protocol under; a UTC date lost it every evening in the Americas. */
  const today = useLocalToday();
  const scope = useMemo(() => protocolScope(user?.id), [user?.id]);
  const [protocol, setProtocol] = useState<DailyProtocol | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      setIsLoading(true);
      localDailyProtocolStore
        .read(scope, today)
        .then((value) => {
          if (mounted) {
            setProtocol(value);
            setIsLoading(false);
          }
        })
        .catch(() => {
          if (mounted) {
            setProtocol(null);
            setIsLoading(false);
          }
        });
      return () => {
        mounted = false;
      };
    }, [scope, today])
  );

  const handleSetStatus = useCallback(
    (actionId: string, status: ProtocolActionStatus) => {
      setProtocol((current) =>
        current
          ? { ...current, actions: current.actions.map((item) => (item.id === actionId ? { ...item, status } : item)) }
          : current
      );
      void localDailyProtocolStore.setActionStatus(scope, today, actionId, status);
    },
    [scope, today]
  );

  const doneCount = protocol?.actions.filter((action) => action.status === 'done').length ?? 0;
  const totalCount = protocol?.actions.length ?? 0;

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <View style={styles.topBar}>
        <Pressable accessibilityLabel="Back" accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}>
          <Ionicons color={colors.text} name="chevron-back" size={22} />
        </Pressable>
        <View style={styles.backButton} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {isLoading ? (
          <Text style={styles.muted}>Loading today’s protocol…</Text>
        ) : !protocol ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Your protocol is set up on Home</Text>
            <Text style={styles.muted}>Open Home to build today’s protocol, then come back here to follow it.</Text>
          </View>
        ) : (
          <>
            <View style={styles.hero}>
              <Text accessibilityRole="header" style={styles.largeTitle}>Daily Protocol</Text>
              <View style={styles.tagRow}>
                <View style={styles.tag}><Text style={styles.tagText}>{dayModeLabel(protocol.day_mode)}</Text></View>
                <View style={styles.tag}><Text style={styles.tagText}>{focusLabel(protocol.primary_focus)}</Text></View>
              </View>
              <Text style={styles.heroTitle}>{protocol.headline}</Text>
              <Text style={styles.heroSummary}>{protocol.summary}</Text>
              <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${totalCount ? Math.round((doneCount / totalCount) * 100) : 0}%` }]} /></View>
              <Text style={styles.metaLine}>
                {doneCount} of {totalCount} done · {confidenceLabel(protocol.confidence).toLowerCase()}
              </Text>
            </View>

            {shouldSurfaceSafety(protocol.safety.status) ? (
              <View style={styles.safetyNote}>
                <Ionicons color={colors.accentMid} name="shield-checkmark-outline" size={16} />
                <Text style={styles.safetyText}>
                  {safetyStatusLabel(protocol.safety.status)} · {protocol.safety.summary}
                </Text>
              </View>
            ) : null}

            <View style={styles.list}>
              {protocol.actions.map((action, index) => (
                <ActionRow action={action} key={action.id} last={index === protocol.actions.length - 1} onSetStatus={handleSetStatus} />
              ))}
            </View>

            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/closeout')}
              style={({ pressed }) => [styles.closeoutButton, pressed && styles.pressed]}
            >
              <Ionicons color={colors.textInverse} name="moon-outline" size={18} />
              <Text style={styles.closeoutButtonText}>Evening closeout</Text>
            </Pressable>

            <Text style={styles.footnote}>General wellness guidance based on your available data.</Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  backButton: { alignItems: 'center', height: 40, justifyContent: 'center', width: 40 },
  topTitle: { ...type.label, color: colors.text },
  scroll: { gap: spacing.md, paddingBottom: 96, paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  muted: { ...type.caption, color: colors.textMuted },
  emptyCard: {
    backgroundColor: colors.surface,
    borderColor: colors.hairline,
    borderRadius: radii.lg,
    borderWidth: hairlineWidth,
    gap: 8,
    padding: spacing.lg
  },
  emptyTitle: { ...type.heading, color: colors.text },
  hero: { gap: 8 },
  tagRow: { flexDirection: 'row', gap: 8 },
  tag: {
    backgroundColor: colors.accentWash,
    borderRadius: radii.full,
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  tagText: { ...type.caption, fontWeight: '600', color: colors.accent },
  heroTitle: { ...type.heading, color: colors.text, marginTop: 4 },
  heroSummary: { ...type.body, color: colors.textMuted },
  metaLine: { ...type.caption, color: colors.textFaint, marginTop: 2 },
  safetyNote: {
    alignItems: 'flex-start',
    backgroundColor: colors.accentWash,
    borderRadius: radii.md,
    flexDirection: 'row',
    gap: 8,
    padding: spacing.md
  },
  safetyText: { ...type.caption, color: colors.textMuted, flex: 1 },
  list: { backgroundColor: colors.surface, borderRadius: 20, paddingHorizontal: 16 },
  row: { paddingVertical: 12, gap: 10 },
  rowDivider: { borderBottomWidth: hairlineWidth, borderBottomColor: colors.borderStrong },
  rowMain: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  check: { width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, borderColor: colors.textMuted, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  checkDone: { backgroundColor: colors.primary, borderColor: colors.primary },
  actionCopy: { flex: 1, gap: 3 },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionTitle: { ...type.body, fontWeight: '600', color: colors.text, flexShrink: 1 },
  actionTitleQuiet: { color: colors.textMuted },
  actionDetail: { ...type.caption, fontSize: 14, lineHeight: 20, color: colors.textMuted },
  actionTime: { ...type.caption, color: colors.textMuted, fontVariant: ['tabular-nums'] },
  more: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginTop: -9, marginRight: -10 },
  optionRow: { flexDirection: 'row', gap: 8, paddingLeft: 38 },
  option: { minHeight: 44, paddingHorizontal: 16, borderRadius: 22, backgroundColor: colors.surfaceInset, alignItems: 'center', justifyContent: 'center' },
  optionText: { ...type.label, color: colors.text },
  progressTrack: { height: 4, borderRadius: 2, backgroundColor: colors.track, overflow: 'hidden', marginTop: 6 },
  progressFill: { height: 4, borderRadius: 2, backgroundColor: colors.primary },
  largeTitle: { ...type.largeTitle, color: colors.text },
  closeoutButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 52,
    marginTop: spacing.sm
  },
  closeoutButtonText: { ...type.label, color: colors.textInverse },
  pressed: { opacity: 0.82 },
  footnote: { ...type.caption, color: colors.textFaint, marginTop: 4 }
});
