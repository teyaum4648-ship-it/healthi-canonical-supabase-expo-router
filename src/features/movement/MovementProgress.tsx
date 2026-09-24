import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { EntrySheet } from '../../components/mobile/EntrySheet';
import { SegmentedControl } from '../../components/mobile/SegmentedControl';
import { colors, hairlineWidth, type } from '../../styles/mobileTheme';
import {
  buildExerciseProgress,
  recentTopSetChange,
  type ExerciseProgress
} from './exerciseProgress';
import {
  buildTrainingCoverage,
  coverageSummary,
  type CoveragePattern
} from './trainingCoverage';
import { formatWeight, type WeightUnit } from './weightUnits';
import type {
  ExerciseLibraryItemRow,
  WorkoutExerciseEntryRow,
  WorkoutSessionRow,
  WorkoutSetEntryRow
} from './movementPersistence';

type Window = '7 days' | '28 days';
const WINDOW_DAYS: Record<Window, number> = { '7 days': 7, '28 days': 28 };

function formatDay(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** A bar whose width is a share of the busiest pattern, not of an invented target. */
function CoverageRow({ pattern, max, onPress }: { pattern: CoveragePattern; max: number; onPress: () => void }) {
  const share = max > 0 ? Math.max(0.06, pattern.working_sets / max) : 0;
  return (
    <Pressable
      accessibilityHint={`${pattern.working_sets} working sets`}
      accessibilityLabel={`${pattern.label}, ${pattern.working_sets} working sets`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.coverageRow, pressed && styles.pressed]}
    >
      <View style={styles.coverageHead}>
        <Text style={styles.coverageLabel}>{pattern.label}</Text>
        <Text style={styles.coverageCount}>{pattern.working_sets}</Text>
      </View>
      <View style={styles.coverageTrack}>
        <View style={[styles.coverageFill, { width: `${Math.round(share * 100)}%` }]} />
      </View>
      <Text style={styles.coverageMeta} numberOfLines={1}>
        {pattern.last_trained ? `Last ${formatDay(pattern.last_trained)} · ` : ''}{pattern.exercises.slice(0, 2).join(', ')}
      </Text>
    </Pressable>
  );
}

/** A sparkline of top sets. Endpoint emphasised; no axis invented. */
function TopSetTrend({ progress }: { progress: ExerciseProgress }) {
  const points = progress.sessions.filter((point) => point.top_weight !== null).slice(-8);
  if (points.length < 2) return null;
  const values = points.map((point) => point.top_weight!);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  return (
    <View style={styles.sparkRow}>
      {points.map((point, index) => {
        const height = 8 + ((point.top_weight! - min) / span) * 30;
        const isLast = index === points.length - 1;
        return (
          <View key={point.session_id} style={styles.sparkColumn}>
            <View style={[styles.sparkBar, { height }, isLast && styles.sparkBarLast]} />
          </View>
        );
      })}
    </View>
  );
}

export function MovementProgress({
  sessions,
  entries,
  sets,
  library,
  unit,
  today
}: {
  sessions: WorkoutSessionRow[];
  entries: WorkoutExerciseEntryRow[];
  sets: WorkoutSetEntryRow[];
  library: ExerciseLibraryItemRow[];
  unit: WeightUnit;
  today: string;
}) {
  const [window, setWindow] = useState<Window>('7 days');
  const [openExercise, setOpenExercise] = useState<ExerciseProgress | null>(null);
  const [openPattern, setOpenPattern] = useState<CoveragePattern | null>(null);

  const coverage = useMemo(
    () => buildTrainingCoverage({ sessions, entries, sets, library, today, windowDays: WINDOW_DAYS[window] }),
    [entries, library, sessions, sets, today, window]
  );
  const progress = useMemo(
    () => buildExerciseProgress({ sessions, entries, sets, unit }),
    [entries, sessions, sets, unit]
  );

  const maxSets = coverage.patterns[0]?.working_sets ?? 0;

  return (
    <View style={styles.stack}>
      <View style={styles.sectionHead}>
        <Text style={styles.eyebrow}>Training coverage</Text>
        <SegmentedControl onChange={setWindow} options={['7 days', '28 days'] as const} value={window} />
      </View>
      <Text style={styles.summary}>{coverageSummary(coverage)}</Text>

      {coverage.patterns.length > 0 ? (
        <View style={styles.coverageList}>
          {coverage.patterns.map((pattern) => (
            <CoverageRow key={pattern.pattern} max={maxSets} onPress={() => setOpenPattern(pattern)} pattern={pattern} />
          ))}
        </View>
      ) : (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>{coverage.total_working_sets > 0 ? 'Movement patterns unavailable' : 'Nothing logged in this window'}</Text>
          <Text style={styles.body}>{coverage.total_working_sets > 0 ? 'Your exercises are listed below. Pattern charts need a matching exercise-library entry.' : 'Log a session and the patterns you trained will show up here.'}</Text>
        </View>
      )}

      {coverage.patterns.length > 0 && coverage.uncovered.length > 0 ? (
        <Text style={styles.uncovered}>
          No logged work: {coverage.uncovered.map((pattern) => pattern.label.toLowerCase()).join(', ')}
        </Text>
      ) : null}
      {coverage.unclassified_sets > 0 ? (
        <Text style={styles.footnote}>
          {coverage.unclassified_sets} set{coverage.unclassified_sets === 1 ? '' : 's'} from exercises without a known
          movement pattern are counted in the total but not placed above.
        </Text>
      ) : null}

      <Text style={styles.eyebrow}>Exercises</Text>
      {progress.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No exercise history yet</Text>
          <Text style={styles.body}>Each logged movement builds its own record here.</Text>
        </View>
      ) : progress.slice(0, 12).map((item) => {
        const change = recentTopSetChange(item);
        return (
          <Pressable
            accessibilityLabel={`${item.name} history`}
            accessibilityRole="button"
            key={item.key}
            onPress={() => setOpenExercise(item)}
            style={({ pressed }) => [styles.exerciseRow, pressed && styles.pressed]}
          >
            <View style={styles.exerciseCopy}>
              <Text numberOfLines={1} style={styles.exerciseName}>{item.name}</Text>
              <Text style={styles.exerciseMeta}>
                {item.sessions.length} session{item.sessions.length === 1 ? '' : 's'} ·{' '}
                {item.heaviest ? `best ${formatWeight(item.heaviest.value, unit)}` : 'no comparable load'}
              </Text>
            </View>
            {change ? (
              <View style={styles.changeTag}>
                <Ionicons
                  color={change.delta > 0 ? colors.success : change.delta < 0 ? colors.danger : colors.textMuted}
                  name={change.delta > 0 ? 'trending-up' : change.delta < 0 ? 'trending-down' : 'remove'}
                  size={15}
                />
                <Text style={styles.changeText}>
                  {change.delta > 0 ? '+' : ''}{change.delta}
                </Text>
              </View>
            ) : null}
            <Ionicons accessible={false} color={colors.textMuted} name="chevron-forward" size={17} />
          </Pressable>
        );
      })}

      {openExercise ? (
        <EntrySheet onClose={() => setOpenExercise(null)} title={openExercise.name}>
          <TopSetTrend progress={openExercise} />
          <View style={styles.recordGrid}>
            <View style={styles.record}>
              <Text style={styles.recordLabel}>Heaviest set</Text>
              <Text style={styles.recordValue}>
                {openExercise.heaviest ? formatWeight(openExercise.heaviest.value, unit) : 'Not comparable'}
              </Text>
              <Text style={styles.recordMeta}>
                {openExercise.heaviest
                  ? `${openExercise.heaviest.reps ?? '—'} reps · ${formatDay(openExercise.heaviest.date)}`
                  : 'Needs a set logged with a unit'}
              </Text>
            </View>
            <View style={styles.record}>
              <Text style={styles.recordLabel}>Most reps</Text>
              <Text style={styles.recordValue}>{openExercise.most_reps?.value ?? '—'}</Text>
              <Text style={styles.recordMeta}>
                {openExercise.most_reps ? formatDay(openExercise.most_reps.date) : 'No reps recorded'}
              </Text>
            </View>
          </View>

          {openExercise.estimated_one_rep_max ? (
            <View style={styles.estimate}>
              <Text style={styles.recordLabel}>Estimated one-rep max</Text>
              <Text style={styles.recordValue}>{formatWeight(openExercise.estimated_one_rep_max.value, unit)}</Text>
              <Text style={styles.recordMeta}>{openExercise.estimated_one_rep_max.basis}</Text>
            </View>
          ) : (
            <Text style={styles.footnote}>
              No one-rep-max estimate yet. It needs a working set of ten reps or fewer, logged with a unit.
            </Text>
          )}

          {openExercise.sets_without_unit > 0 ? (
            <Text style={styles.footnote}>
              {openExercise.sets_without_unit} earlier set{openExercise.sets_without_unit === 1 ? '' : 's'} had no unit
              recorded, so {openExercise.sets_without_unit === 1 ? 'it is' : 'they are'} left out of load figures rather
              than assumed.
            </Text>
          ) : null}

          <Text style={styles.recordLabel}>Sessions</Text>
          <ScrollView style={styles.sessionScroll}>
            {[...openExercise.sessions].reverse().map((point) => (
              <View key={point.session_id} style={styles.sessionLine}>
                <Text style={styles.sessionDate}>{formatDay(point.date)}</Text>
                <Text style={styles.sessionDetail}>
                  {point.top_weight !== null ? `${formatWeight(point.top_weight, unit)} × ${point.top_reps ?? '—'}` : 'No comparable load'}
                </Text>
                <Text style={styles.sessionSets}>{point.working_sets} sets</Text>
              </View>
            ))}
          </ScrollView>
        </EntrySheet>
      ) : null}

      {openPattern ? (
        <EntrySheet onClose={() => setOpenPattern(null)} title={openPattern.label}>
          <Text style={styles.body}>
            {openPattern.working_sets} working set{openPattern.working_sets === 1 ? '' : 's'} across{' '}
            {openPattern.sessions} session{openPattern.sessions === 1 ? '' : 's'} in the last {coverage.window_days} days.
          </Text>
          <Text style={styles.recordMeta}>
            {openPattern.last_trained ? `Last trained ${formatDay(openPattern.last_trained)}` : 'Not trained in this window'}
          </Text>
          <Text style={styles.recordLabel}>Exercises that trained it</Text>
          {openPattern.exercises.map((name) => (
            <Text key={name} style={styles.body}>· {name}</Text>
          ))}
        </EntrySheet>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 12 },
  sectionHead: { gap: 10 },
  eyebrow: { ...type.eyebrow, color: colors.textFaint },
  summary: { ...type.body, color: colors.text },
  body: { ...type.caption, fontSize: 14, lineHeight: 20, color: colors.textMuted },
  footnote: { ...type.caption, color: colors.textFaint },
  uncovered: { ...type.caption, color: colors.textMuted },

  coverageList: { gap: 10 },
  coverageRow: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: hairlineWidth,
    gap: 7,
    padding: 14
  },
  coverageHead: { alignItems: 'baseline', flexDirection: 'row', justifyContent: 'space-between' },
  coverageLabel: { ...type.label, color: colors.text },
  coverageCount: { ...type.number, color: colors.accent },
  coverageTrack: { backgroundColor: colors.track, borderRadius: 3, height: 6, overflow: 'hidden' },
  coverageFill: { backgroundColor: colors.accent, borderRadius: 3, height: '100%' },
  coverageMeta: { ...type.caption, color: colors.textFaint },

  empty: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: hairlineWidth,
    gap: 5,
    padding: 16
  },
  emptyTitle: { ...type.label, color: colors.text },

  exerciseRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    minHeight: 62,
    borderBottomColor: colors.borderStrong,
    borderBottomWidth: hairlineWidth,
    paddingVertical: 12
  },
  exerciseCopy: { flex: 1, gap: 3, minWidth: 0 },
  exerciseName: { ...type.body, color: colors.text, fontWeight: '600' },
  exerciseMeta: { ...type.caption, color: colors.textMuted },
  changeTag: { alignItems: 'center', flexDirection: 'row', gap: 4 },
  changeText: { ...type.label, color: colors.textMuted },

  sparkRow: { alignItems: 'flex-end', flexDirection: 'row', gap: 6, height: 44 },
  sparkColumn: { flex: 1, justifyContent: 'flex-end' },
  sparkBar: { backgroundColor: colors.accentPale, borderRadius: 3, width: '100%' },
  sparkBarLast: { backgroundColor: colors.accent },

  recordGrid: { flexDirection: 'row', gap: 10 },
  record: {
    backgroundColor: colors.surfaceInset,
    borderRadius: 14,
    flex: 1,
    gap: 3,
    minWidth: 0,
    padding: 14
  },
  estimate: { backgroundColor: colors.surfaceInset, borderRadius: 14, gap: 3, padding: 14 },
  recordLabel: { ...type.caption, color: colors.textMuted },
  recordValue: { ...type.numberLg, color: colors.text },
  recordMeta: { ...type.caption, color: colors.textFaint },

  sessionScroll: { maxHeight: 220 },
  sessionLine: {
    alignItems: 'center',
    borderBottomColor: colors.borderStrong,
    borderBottomWidth: hairlineWidth,
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 10
  },
  sessionDate: { ...type.caption, color: colors.textMuted, width: 64 },
  sessionDetail: { ...type.label, color: colors.text, flex: 1 },
  sessionSets: { ...type.caption, color: colors.textFaint },

  pressed: { opacity: 0.7 }
});
