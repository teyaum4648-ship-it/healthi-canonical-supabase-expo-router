import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { DailyProtocol, DailyProtocolAction, ProtocolActionKind, ProtocolActionStatus } from '../../src/engines/protocol';
import { useAuth } from '../../src/features/auth/AuthProvider';
import {
  confidenceLabel,
  dayModeLabel,
  focusLabel,
  localDailyProtocolStore,
  protocolScope,
  safetyStatusLabel,
  shouldSurfaceSafety
} from '../../src/features/dailyProtocol';
import { colors, hairlineWidth, radii, spacing, type } from '../../src/styles/theme';

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

const STATUS_OPTIONS: Array<{ value: ProtocolActionStatus; label: string }> = [
  { value: 'done', label: 'Done' },
  { value: 'skipped', label: 'Skip' },
  { value: 'deferred', label: 'Later' }
];

function ActionRow({
  action,
  onSetStatus
}: {
  action: DailyProtocolAction;
  onSetStatus: (id: string, status: ProtocolActionStatus) => void;
}) {
  const complete = action.status === 'done';
  return (
    <View style={[styles.actionCard, complete && styles.actionCardDone]}>
      <View style={styles.actionHead}>
        <View style={styles.actionIcon}>
          <Ionicons color={colors.accent} name={actionIcon(action.kind)} size={17} />
        </View>
        <View style={styles.actionCopy}>
          <Text style={styles.actionTitle}>{action.title}</Text>
          <Text style={styles.actionDetail}>{action.detail}</Text>
          {action.time_hint ? <Text style={styles.actionTime}>Around {action.time_hint}</Text> : null}
        </View>
      </View>
      <View style={styles.statusRow}>
        {STATUS_OPTIONS.map((option) => {
          const active = action.status === option.value;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              key={option.value}
              onPress={() => onSetStatus(action.id, active ? 'pending' : option.value)}
              style={({ pressed }) => [styles.statusChip, active && styles.statusChipActive, pressed && styles.pressed]}
            >
              <Text style={[styles.statusChipText, active && styles.statusChipTextActive]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function ProtocolScreen() {
  const { user } = useAuth();
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
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
        <Text style={styles.topTitle}>Today's protocol</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {isLoading ? (
          <Text style={styles.muted}>Loading today's protocol…</Text>
        ) : !protocol ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Your protocol is set up on Home</Text>
            <Text style={styles.muted}>Open the Home tab to generate today's protocol, then come back here to follow it.</Text>
          </View>
        ) : (
          <>
            <View style={styles.hero}>
              <View style={styles.tagRow}>
                <View style={styles.tag}><Text style={styles.tagText}>{dayModeLabel(protocol.day_mode)}</Text></View>
                <View style={styles.tag}><Text style={styles.tagText}>{focusLabel(protocol.primary_focus)}</Text></View>
              </View>
              <Text style={styles.heroTitle}>{protocol.headline}</Text>
              <Text style={styles.heroSummary}>{protocol.summary}</Text>
              <Text style={styles.metaLine}>
                {confidenceLabel(protocol.confidence)} · {doneCount}/{totalCount} done
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

            <View style={styles.actionsWrap}>
              {protocol.actions.map((action) => (
                <ActionRow action={action} key={action.id} onSetStatus={handleSetStatus} />
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
  tagText: { ...type.eyebrow, color: colors.accent },
  heroTitle: { ...type.title, color: colors.text, marginTop: 4 },
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
  actionsWrap: { gap: 10 },
  actionCard: {
    backgroundColor: colors.surface,
    borderColor: colors.hairline,
    borderRadius: radii.md,
    borderWidth: hairlineWidth,
    gap: 12,
    padding: spacing.md
  },
  actionCardDone: { borderColor: colors.accentPale },
  actionHead: { alignItems: 'flex-start', flexDirection: 'row', gap: 12 },
  actionIcon: {
    alignItems: 'center',
    backgroundColor: colors.accentWash,
    borderRadius: 999,
    height: 34,
    justifyContent: 'center',
    width: 34
  },
  actionCopy: { flex: 1, gap: 3 },
  actionTitle: { ...type.label, color: colors.text },
  actionDetail: { ...type.caption, color: colors.textMuted },
  actionTime: { ...type.caption, color: colors.textFaint, fontVariant: ['tabular-nums'] },
  statusRow: { flexDirection: 'row', gap: 8 },
  statusChip: {
    alignItems: 'center',
    borderColor: colors.hairline,
    borderRadius: radii.full,
    borderWidth: hairlineWidth,
    flex: 1,
    minHeight: 38,
    justifyContent: 'center'
  },
  statusChipActive: { backgroundColor: colors.accentWash, borderColor: colors.accent },
  statusChipText: { ...type.caption, color: colors.textMuted },
  statusChipTextActive: { color: colors.accent },
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
