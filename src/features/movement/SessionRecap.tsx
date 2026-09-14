import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, hairlineWidth, type } from '../../styles/mobileTheme';
import {
  baselineNames,
  recapMeta,
  recordDetail,
  type SessionRecap
} from './sessionRecap';

/**
 * The screen a finished session lands on.
 *
 * Saving used to set a dismissible card and return to Today, which made a workout
 * feel filed rather than finished. Every block here reads an engine that already ran
 * at save time and went unsurfaced.
 *
 * A block with nothing to say is not rendered. That is the difference between a recap
 * and a dashboard: on a first-ever session this is a title, a meta line and a way out,
 * which is honest, rather than four empty panels.
 */

const palette = {
  background: '#000000',
  surface: '#121214',
  ink: '#F5F5F7',
  accent: '#0A84FF',
  accentMid: '#5AC8FA',
  slate: '#A1A1A6',
  faint: '#6E6E73',
  line: 'rgba(255, 255, 255, 0.075)',
  record: '#FF9F0A',
  up: '#63E6CE'
} as const;

function Eyebrow({ children }: { children: string }) {
  return <Text style={styles.eyebrow}>{children}</Text>;
}

export function SessionRecap({ recap, onDone, onSaveRoutine, savedLocally }: {
  recap: SessionRecap;
  onDone: () => void;
  onSaveRoutine: (() => void) | null;
  savedLocally: boolean;
}) {
  const topPattern = recap.patterns[0] ?? null;

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        <View style={styles.header}>
          <View style={styles.savedRow}>
            <Ionicons color={palette.up} name="checkmark-circle" size={18} />
            <Text style={styles.savedLabel}>
              {savedLocally ? 'SAVED ON THIS DEVICE' : 'SESSION SAVED'}
            </Text>
          </View>
          <Text style={styles.title}>{recap.title}</Text>
          <Text style={styles.meta}>{recapMeta(recap)}</Text>
        </View>

        {recap.changes.length > 0 ? (
          <View style={styles.panel}>
            <Eyebrow>AGAINST LAST TIME</Eyebrow>
            {recap.changes.map((change) => (
              <View key={change.exercise_id} style={styles.changeRow}>
                <Ionicons
                  color={change.direction === 'up' ? palette.up : change.direction === 'down' ? colors.danger : palette.slate}
                  name={change.direction === 'up' ? 'trending-up' : change.direction === 'down' ? 'trending-down' : 'remove'}
                  size={17}
                />
                <Text style={styles.changeName}>{change.exercise_name}</Text>
                <Text
                  style={[styles.changeDetail, change.direction === 'up' && styles.changeDetailUp]}
                >
                  {change.detail}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {recap.records.map((record) => (
          <View key={`${record.exercise_name}-${record.kind}`} style={styles.recordCard}>
            <Ionicons color={palette.record} name="trophy-outline" size={22} />
            <View style={styles.recordCopy}>
              <Text style={styles.recordTitle}>
                {record.kind === 'heaviest' ? 'Heaviest' : 'Most reps'} {record.exercise_name.toLowerCase()} yet
              </Text>
              <Text style={styles.recordDetail}>{recordDetail(record)}</Text>
            </View>
          </View>
        ))}

        {recap.baselines.length > 0 ? (
          <View style={styles.baseline}>
            <Ionicons color={palette.slate} name="flag-outline" size={17} />
            <Text style={styles.baselineText}>
              First measurement for {baselineNames(recap.baselines)} — from here there is
              something to beat.
            </Text>
          </View>
        ) : null}

        {topPattern ? (
          <View style={styles.panel}>
            <Eyebrow>WHAT THIS WEEK COVERS NOW</Eyebrow>
            {recap.patterns.slice(0, 4).map((item) => (
              <View key={item.pattern} style={styles.coverageRow}>
                <Text style={styles.coverageLabel}>{item.label}</Text>
                <View style={styles.coverageTrack}>
                  <View
                    style={[
                      styles.coverageFill,
                      { width: `${Math.max(6, Math.round((item.working_sets / topPattern.working_sets) * 100))}%` }
                    ]}
                  />
                </View>
                <Text style={styles.coverageValue}>
                  {item.working_sets} set{item.working_sets === 1 ? '' : 's'}
                </Text>
              </View>
            ))}
            {recap.uncovered.slice(0, 2).map((item) => (
              <View key={item.pattern} style={styles.coverageRow}>
                <Text style={styles.coverageLabel}>{item.label}</Text>
                <View style={styles.coverageTrack} />
                <Text style={styles.coverageNone}>none</Text>
              </View>
            ))}
            {recap.uncovered.length > 0 ? (
              <Text style={styles.coverageNote}>
                No logged {recap.uncovered.slice(0, 2).map((item) => item.label.toLowerCase()).join(' or ')} work
                this week. Worth a place in your next session.
              </Text>
            ) : null}
            {recap.unclassified_sets > 0 ? (
              <Text style={styles.coverageNote}>
                {recap.unclassified_sets} working set{recap.unclassified_sets === 1 ? '' : 's'} could not be matched to a
                movement pattern, so this read is partial.
              </Text>
            ) : null}
          </View>
        ) : null}

        {recap.next_time ? (
          <View style={styles.nextPanel}>
            <Eyebrow>NEXT TIME</Eyebrow>
            <Text style={styles.nextHeadline}>{recap.next_time.headline}</Text>
            <Text style={styles.nextName}>{recap.next_time.exercise_name}</Text>
            {recap.next_time.rationale.slice(0, 2).map((line) => (
              <Text key={line} style={styles.nextReason}>{line}</Text>
            ))}
            <Text style={styles.nextConfidence}>
              Based on {recap.next_time.confidence} confidence in your logged history. Nothing is applied for you.
            </Text>
          </View>
        ) : null}

        <View style={styles.actions}>
          {onSaveRoutine ? (
            <Pressable
              accessibilityRole="button"
              onPress={onSaveRoutine}
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
            >
              <Text style={styles.secondaryLabel}>Save as routine</Text>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            onPress={onDone}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
          >
            <Text style={styles.primaryLabel}>Done</Text>
          </Pressable>
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.background },
  scroll: { gap: 18, paddingBottom: 40, paddingHorizontal: 22, paddingTop: 30 },
  header: { gap: 8 },
  savedRow: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  savedLabel: { ...type.eyebrow, color: palette.up },
  title: { ...type.title, color: palette.ink },
  meta: { ...type.body, color: 'rgba(255, 255, 255, 0.62)', fontVariant: ['tabular-nums'] },
  eyebrow: { ...type.eyebrow, color: palette.faint },
  panel: {
    backgroundColor: palette.surface,
    borderColor: palette.line,
    borderRadius: 16,
    borderWidth: hairlineWidth,
    gap: 12,
    padding: 18
  },
  changeRow: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  changeName: { ...type.body, color: palette.ink, flex: 1 },
  changeDetail: { ...type.body, color: palette.slate, fontVariant: ['tabular-nums'] },
  changeDetailUp: { color: palette.up, fontFamily: type.label.fontFamily, fontWeight: '600' },
  baseline: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 4
  },
  baselineText: { ...type.caption, color: palette.slate, flex: 1 },
  recordCard: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 159, 10, 0.10)',
    borderColor: 'rgba(255, 159, 10, 0.26)',
    borderRadius: 16,
    borderWidth: hairlineWidth,
    flexDirection: 'row',
    gap: 14,
    padding: 16
  },
  recordCopy: { flex: 1, gap: 3 },
  recordTitle: { ...type.label, color: palette.record, fontSize: 15 },
  recordDetail: { ...type.caption, color: 'rgba(255, 255, 255, 0.62)' },
  coverageRow: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  coverageLabel: { ...type.caption, color: 'rgba(255, 255, 255, 0.72)', width: 68 },
  coverageTrack: { backgroundColor: 'rgba(255, 255, 255, 0.08)', borderRadius: 3, flex: 1, height: 6, overflow: 'hidden' },
  coverageFill: { backgroundColor: palette.accent, height: '100%' },
  coverageValue: { ...type.caption, color: palette.accentMid, fontVariant: ['tabular-nums'], textAlign: 'right', width: 52 },
  coverageNone: { ...type.caption, color: palette.faint, textAlign: 'right', width: 52 },
  coverageNote: { ...type.caption, color: 'rgba(255, 255, 255, 0.62)' },
  nextPanel: {
    backgroundColor: 'rgba(10, 132, 255, 0.10)',
    borderColor: 'rgba(10, 132, 255, 0.26)',
    borderRadius: 16,
    borderWidth: hairlineWidth,
    gap: 8,
    padding: 18
  },
  nextHeadline: { ...type.heading, color: palette.ink, fontSize: 20, lineHeight: 26 },
  nextName: { ...type.caption, color: palette.accentMid },
  nextReason: { ...type.caption, color: 'rgba(255, 255, 255, 0.68)' },
  nextConfidence: { ...type.caption, color: palette.faint },
  actions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  secondaryButton: {
    alignItems: 'center',
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 13,
    borderWidth: hairlineWidth,
    flex: 1,
    justifyContent: 'center',
    minHeight: 52
  },
  secondaryLabel: { ...type.label, color: 'rgba(255, 255, 255, 0.78)', fontSize: 15 },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: palette.accent,
    borderRadius: 13,
    flex: 1,
    justifyContent: 'center',
    minHeight: 52
  },
  primaryLabel: { ...type.label, color: '#FFFFFF', fontSize: 15 },
  pressed: { opacity: 0.6 }
});
