import { Ionicons } from '@expo/vector-icons';
import { useKeepAwake } from 'expo-keep-awake';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { SegmentedControl } from '../../components/mobile/SegmentedControl';
import { colors, hairlineWidth, type } from '../../styles/mobileTheme';
import {
  formatRestClock,
  isRestPaused,
  REST_ADJUST_STEP_SECONDS,
  restRemainingSeconds,
  type RestTimer
} from './restTimer';
import {
  convertWeightForDisplay,
  formatWeight,
  stepWeight,
  weightStep,
  type WeightUnit
} from './weightUnits';
import type { ProgressionSuggestion } from './exerciseProgression';
import { previousSetFor, type QuickExerciseDraft, type QuickSetDraft, type QuickWorkoutDraft } from './workoutQuickLog';

export type LoggerView = 'Focus' | 'Overview';
export type SaveState = 'idle' | 'saving' | 'error';

type SetUpdate = Partial<QuickSetDraft>;

export type WorkoutSessionLoggerProps = {
  draft: QuickWorkoutDraft;
  unit: WeightUnit;
  view: LoggerView;
  onViewChange: (view: LoggerView) => void;
  focusIndex: number;
  onFocusIndexChange: (index: number) => void;
  now: string;
  restTimer: RestTimer | null;
  onCompleteSet: (exerciseId: string, setId: string) => void;
  onUpdateSet: (exerciseId: string, setId: string, update: SetUpdate) => void;
  onAddSet: (exerciseId: string) => void;
  onDuplicateSet: (exerciseId: string, setId: string) => void;
  onRemoveSet: (exerciseId: string, setId: string) => void;
  onRenameExercise: (exerciseId: string, name: string) => void;
  onRemoveExercise: (exerciseId: string) => void;
  onMoveExercise: (exerciseId: string, direction: -1 | 1) => void;
  onAddExercise: () => void;
  onSaveRoutine: () => void;
  /** Frozen at session start; never recomputed while the lifter is working. */
  suggestion: ProgressionSuggestion | null;
  onAcceptSuggestion: () => void;
  suggestionAccepted: boolean;
  onToggleRest: () => void;
  onAdjustRest: (deltaSeconds: number) => void;
  onSkipRest: () => void;
  onFinish: () => void;
  onExit: () => void;
  onUndo: () => void;
  canUndo: boolean;
  undoLabel: string | null;
  saveState: SaveState;
  savedLocally: boolean;
  /**
   * Why the last finish attempt did not save. It belongs here rather than only on the
   * Move screen: a refusal rendered on a screen the lifter is not looking at makes the
   * primary button read as broken.
   */
  notice: string | null;
};

/** A number field that keeps only digits and a single decimal point. */
function numericText(value: string): string {
  const cleaned = value.replace(/[^0-9.]/g, '');
  const [head, ...rest] = cleaned.split('.');
  return rest.length ? `${head}.${rest.join('')}` : head;
}

function parseNumber(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Previous performance, converted into the unit being entered today. */
function previousLabel(exercise: QuickExerciseDraft, set: QuickSetDraft, unit: WeightUnit): string | null {
  const previous = previousSetFor(exercise, set.set_index);
  if (!previous) return null;
  const { weight, reps, weight_unit } = previous.set;
  const shown = weight === null
    ? null
    : weight_unit && weight_unit !== unit
      ? convertWeightForDisplay(weight, weight_unit, unit)
      : weight;
  const core = [
    shown === null ? null : formatWeight(shown, weight_unit ? unit : null),
    reps === null ? null : `${reps} reps`
  ].filter(Boolean).join(' × ');
  if (!core) return null;
  return previous.exact ? `Last time · ${core}` : `Set ${previous.set.set_index} last time · ${core}`;
}

function Stepper({
  label,
  accessibilityLabel,
  value,
  onChange,
  step,
  suffix
}: {
  label: string;
  accessibilityLabel: string;
  value: string;
  onChange: (value: string) => void;
  step: number;
  suffix?: string;
}) {
  const current = parseNumber(value);
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}{suffix ? ` (${suffix})` : ''}</Text>
      <View style={styles.fieldRow}>
        <Pressable
          accessibilityLabel={`Decrease ${accessibilityLabel}`}
          accessibilityRole="button"
          onPress={() => onChange(String(Math.max(0, (current ?? step) - step)))}
          style={({ pressed }) => [styles.stepButton, pressed && styles.pressed]}
        >
          <Ionicons color={colors.text} name="remove" size={22} />
        </Pressable>
        <TextInput
          accessibilityLabel={accessibilityLabel}
          keyboardType="decimal-pad"
          onChangeText={(next) => onChange(numericText(next))}
          placeholder="—"
          placeholderTextColor={colors.textFaint}
          selectTextOnFocus
          style={styles.fieldInput}
          value={value}
        />
        <Pressable
          accessibilityLabel={`Increase ${accessibilityLabel}`}
          accessibilityRole="button"
          onPress={() => onChange(String((current ?? 0) + step))}
          style={({ pressed }) => [styles.stepButton, pressed && styles.pressed]}
        >
          <Ionicons color={colors.text} name="add" size={22} />
        </Pressable>
      </View>
    </View>
  );
}

function SetCard({
  exercise,
  set,
  unit,
  onCompleteSet,
  onUpdateSet,
  onDuplicateSet,
  onRemoveSet,
  canRemove
}: {
  exercise: QuickExerciseDraft;
  set: QuickSetDraft;
  unit: WeightUnit;
  onCompleteSet: (exerciseId: string, setId: string) => void;
  onUpdateSet: (exerciseId: string, setId: string, update: SetUpdate) => void;
  onDuplicateSet: (exerciseId: string, setId: string) => void;
  onRemoveSet: (exerciseId: string, setId: string) => void;
  canRemove: boolean;
}) {
  const previous = previousLabel(exercise, set, unit);
  return (
    <View style={[styles.setCard, set.completed && styles.setCardDone]}>
      <View style={styles.setHeader}>
        <View style={styles.setIdentity}>
          <Text style={styles.setNumber}>Set {set.set_index}</Text>
          {set.warmup ? <Text style={styles.warmupTag}>Warm-up</Text> : null}
        </View>
        <View style={styles.setHeaderActions}>
          <Pressable
            accessibilityLabel={set.warmup ? `Mark set ${set.set_index} as a working set` : `Mark set ${set.set_index} as a warm-up`}
            accessibilityRole="button"
            accessibilityState={{ selected: set.warmup }}
            onPress={() => onUpdateSet(exercise.id, set.id, { warmup: !set.warmup })}
            style={({ pressed }) => [styles.iconAction, pressed && styles.pressed]}
          >
            <Ionicons color={set.warmup ? colors.accent : colors.textMuted} name="flame-outline" size={19} />
          </Pressable>
          <Pressable
            accessibilityLabel={`Duplicate set ${set.set_index}`}
            accessibilityRole="button"
            onPress={() => onDuplicateSet(exercise.id, set.id)}
            style={({ pressed }) => [styles.iconAction, pressed && styles.pressed]}
          >
            <Ionicons color={colors.textMuted} name="copy-outline" size={18} />
          </Pressable>
          <Pressable
            accessibilityLabel={`Remove set ${set.set_index}`}
            accessibilityRole="button"
            disabled={!canRemove}
            onPress={() => onRemoveSet(exercise.id, set.id)}
            style={({ pressed }) => [styles.iconAction, !canRemove && styles.disabled, pressed && styles.pressed]}
          >
            <Ionicons color={colors.danger} name="trash-outline" size={18} />
          </Pressable>
        </View>
      </View>

      {previous ? <Text style={styles.previousLine}>{previous}</Text> : <Text style={styles.previousLineFaint}>No previous set to compare</Text>}

      <View style={styles.fieldsRow}>
        <Stepper
          accessibilityLabel={`Set ${set.set_index} weight in ${unit}`}
          label="Weight"
          onChange={(value) => onUpdateSet(exercise.id, set.id, { weight: value })}
          step={weightStep(unit)}
          suffix={unit}
          value={set.weight}
        />
        <Stepper
          accessibilityLabel={`Set ${set.set_index} reps`}
          label="Reps"
          onChange={(value) => onUpdateSet(exercise.id, set.id, { reps: value })}
          step={1}
          value={set.reps}
        />
      </View>

      <Pressable
        accessibilityLabel={set.completed ? `Undo set ${set.set_index}` : `Complete set ${set.set_index}`}
        accessibilityRole="button"
        accessibilityState={{ selected: set.completed }}
        onPress={() => onCompleteSet(exercise.id, set.id)}
        style={({ pressed }) => [styles.completeButton, set.completed && styles.completeButtonDone, pressed && styles.pressed]}
      >
        <Ionicons
          color={set.completed ? colors.accent : colors.primaryText}
          name={set.completed ? 'checkmark-circle' : 'checkmark'}
          size={20}
        />
        <Text style={[styles.completeText, set.completed && styles.completeTextDone]}>
          {set.completed ? 'Logged' : 'Complete set'}
        </Text>
      </Pressable>
    </View>
  );
}

/**
 * A proposal, not an instruction. It shows what it is based on, and nothing is
 * written to the session until the lifter accepts it — after which the fields
 * remain editable like any other.
 */
function SuggestionCard({
  suggestion,
  accepted,
  onAccept
}: {
  suggestion: ProgressionSuggestion;
  accepted: boolean;
  onAccept: () => void;
}) {
  const [showWhy, setShowWhy] = useState(false);
  return (
    <View style={styles.suggestion}>
      <View style={styles.suggestionHead}>
        <Text style={styles.suggestionEyebrow}>Suggested next</Text>
        <Text style={styles.suggestionConfidence}>{suggestion.confidence} confidence</Text>
      </View>
      <Text style={styles.suggestionHeadline}>{suggestion.headline}</Text>
      {suggestion.target_reps !== null ? (
        <Text style={styles.suggestionTarget}>
          {suggestion.target_sets ?? '—'} × {suggestion.target_reps} reps
          {suggestion.target_weight !== null ? ` at ${suggestion.target_weight} ${suggestion.unit}` : ''}
        </Text>
      ) : null}

      <Pressable
        accessibilityHint="Shows what this suggestion is based on"
        accessibilityLabel="Why this suggestion"
        accessibilityRole="button"
        accessibilityState={{ expanded: showWhy }}
        onPress={() => setShowWhy((current) => !current)}
        style={({ pressed }) => [styles.whyRow, pressed && styles.pressed]}
      >
        <Text style={styles.whyText}>Why this</Text>
        <Ionicons color={colors.accent} name={showWhy ? 'chevron-up' : 'chevron-down'} size={16} />
      </Pressable>
      {showWhy ? (
        <View style={styles.whyList}>
          {suggestion.rationale.map((line) => (
            <Text key={line} style={styles.whyLine}>· {line}</Text>
          ))}
        </View>
      ) : null}

      <Pressable
        accessibilityLabel={accepted ? 'Suggestion already applied' : 'Use this suggestion'}
        accessibilityRole="button"
        disabled={accepted}
        onPress={onAccept}
        style={({ pressed }) => [styles.useButton, accepted && styles.disabled, pressed && styles.pressed]}
      >
        <Ionicons color={colors.accent} name={accepted ? 'checkmark' : 'arrow-down'} size={17} />
        <Text style={styles.useText}>{accepted ? 'Applied — edit freely' : 'Use these targets'}</Text>
      </Pressable>
    </View>
  );
}

export function WorkoutSessionLogger(props: WorkoutSessionLoggerProps) {
  // The screen stays awake for as long as this component is mounted, which is
  // exactly as long as a session is open — no explicit teardown to get wrong.
  useKeepAwake('healthi-workout-session');
  const { draft, unit, view, focusIndex, now, restTimer } = props;
  const total = draft.exercises.length;
  const safeIndex = Math.min(Math.max(0, focusIndex), Math.max(0, total - 1));
  const exercise = draft.exercises[safeIndex];
  const completedSets = draft.exercises.reduce(
    (count, item) => count + item.sets.filter((set) => set.completed).length,
    0
  );

  return (
    <View style={styles.shell}>
      <View style={styles.topBar}>
        <Pressable
          accessibilityLabel="Edit this workout's movements"
          accessibilityRole="button"
          onPress={props.onExit}
          style={({ pressed }) => [styles.topAction, pressed && styles.pressed]}
        >
          <Ionicons color={colors.accent} name="chevron-back" size={24} />
        </Pressable>
        <View style={styles.topCopy}>
          <Text numberOfLines={1} style={styles.topTitle}>{draft.title || 'Workout'}</Text>
          <Text style={styles.topMeta}>
            {completedSets} set{completedSets === 1 ? '' : 's'} logged
            {props.saveState === 'saving' ? ' · Saving' : props.savedLocally ? ' · Saved on this device' : ''}
          </Text>
        </View>
        {props.canUndo ? (
          <Pressable
            accessibilityLabel={props.undoLabel ?? 'Undo'}
            accessibilityRole="button"
            onPress={props.onUndo}
            style={({ pressed }) => [styles.undoAction, pressed && styles.pressed]}
          >
            <Ionicons color={colors.accent} name="arrow-undo-outline" size={17} />
            <Text style={styles.undoText}>Undo</Text>
          </Pressable>
        ) : <View style={styles.topAction} />}
      </View>

      {restTimer ? (
        <View style={styles.restBar}>
          <Pressable
            accessibilityLabel={isRestPaused(restTimer) ? 'Resume rest timer' : 'Pause rest timer'}
            accessibilityRole="button"
            onPress={props.onToggleRest}
            style={({ pressed }) => [styles.restPlay, pressed && styles.pressed]}
          >
            <Ionicons color={colors.accent} name={isRestPaused(restTimer) ? 'play' : 'pause'} size={18} />
          </Pressable>
          <View style={styles.restCopy}>
            <Text style={styles.restClock}>{formatRestClock(restRemainingSeconds(restTimer, now))}</Text>
            <Text style={styles.restLabel}>
              {restRemainingSeconds(restTimer, now) <= 0 ? 'Rest complete' : isRestPaused(restTimer) ? 'Paused' : 'Resting'}
            </Text>
          </View>
          <Pressable
            accessibilityLabel={`Subtract ${REST_ADJUST_STEP_SECONDS} seconds of rest`}
            accessibilityRole="button"
            onPress={() => props.onAdjustRest(-REST_ADJUST_STEP_SECONDS)}
            style={({ pressed }) => [styles.restAdjust, pressed && styles.pressed]}
          >
            <Text style={styles.restAdjustText}>−{REST_ADJUST_STEP_SECONDS}s</Text>
          </Pressable>
          <Pressable
            accessibilityLabel={`Add ${REST_ADJUST_STEP_SECONDS} seconds of rest`}
            accessibilityRole="button"
            onPress={() => props.onAdjustRest(REST_ADJUST_STEP_SECONDS)}
            style={({ pressed }) => [styles.restAdjust, pressed && styles.pressed]}
          >
            <Text style={styles.restAdjustText}>+{REST_ADJUST_STEP_SECONDS}s</Text>
          </Pressable>
          <Pressable
            accessibilityLabel="Skip rest"
            accessibilityRole="button"
            onPress={props.onSkipRest}
            style={({ pressed }) => [styles.restSkip, pressed && styles.pressed]}
          >
            <Text style={styles.restSkipText}>Skip</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.viewToggle}>
        <SegmentedControl
          onChange={(next) => props.onViewChange(next)}
          options={['Focus', 'Overview'] as const}
          value={view}
        />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {view === 'Focus' && exercise ? (
          <>
            <View style={styles.focusHeader}>
              <Pressable
                accessibilityLabel="Previous movement"
                accessibilityRole="button"
                disabled={safeIndex === 0}
                onPress={() => props.onFocusIndexChange(safeIndex - 1)}
                style={({ pressed }) => [styles.focusNav, safeIndex === 0 && styles.disabled, pressed && styles.pressed]}
              >
                <Ionicons color={colors.text} name="chevron-back" size={22} />
              </Pressable>
              <View style={styles.focusCopy}>
                <Text style={styles.focusPosition}>Movement {safeIndex + 1} of {total}</Text>
                <TextInput
                  accessibilityLabel="Movement name"
                  onChangeText={(value) => props.onRenameExercise(exercise.id, value)}
                  placeholder="Movement name"
                  placeholderTextColor={colors.textFaint}
                  style={styles.focusName}
                  value={exercise.exercise_name}
                />
                <Text style={styles.focusPrevious}>
                  {exercise.previous_date ? `Last logged ${exercise.previous_date}` : 'No previous entry yet'}
                </Text>
              </View>
              <Pressable
                accessibilityLabel="Next movement"
                accessibilityRole="button"
                disabled={safeIndex >= total - 1}
                onPress={() => props.onFocusIndexChange(safeIndex + 1)}
                style={({ pressed }) => [styles.focusNav, safeIndex >= total - 1 && styles.disabled, pressed && styles.pressed]}
              >
                <Ionicons color={colors.text} name="chevron-forward" size={22} />
              </Pressable>
            </View>

            {props.suggestion && props.suggestion.action !== 'no_history' ? (
              <SuggestionCard
                accepted={props.suggestionAccepted}
                onAccept={props.onAcceptSuggestion}
                suggestion={props.suggestion}
              />
            ) : null}

            {exercise.sets.map((set) => (
              <SetCard
                canRemove={exercise.sets.length > 1}
                exercise={exercise}
                key={set.id}
                onCompleteSet={props.onCompleteSet}
                onDuplicateSet={props.onDuplicateSet}
                onRemoveSet={props.onRemoveSet}
                onUpdateSet={props.onUpdateSet}
                set={set}
                unit={unit}
              />
            ))}

            <Pressable
              accessibilityLabel={`Add a set to ${exercise.exercise_name || 'this movement'}`}
              accessibilityRole="button"
              onPress={() => props.onAddSet(exercise.id)}
              style={({ pressed }) => [styles.secondaryAction, pressed && styles.pressed]}
            >
              <Ionicons color={colors.accent} name="add" size={20} />
              <Text style={styles.secondaryActionText}>Add set</Text>
            </Pressable>
          </>
        ) : null}

        {view === 'Overview' ? (
          <>
            {draft.exercises.map((item, index) => {
              const done = item.sets.filter((set) => set.completed).length;
              return (
                <View key={item.id} style={styles.overviewRow}>
                  <Pressable
                    accessibilityLabel={`Open ${item.exercise_name || `movement ${index + 1}`}`}
                    accessibilityRole="button"
                    onPress={() => { props.onFocusIndexChange(index); props.onViewChange('Focus'); }}
                    style={styles.overviewCopy}
                  >
                    <Text numberOfLines={1} style={styles.overviewName}>{item.exercise_name || `Movement ${index + 1}`}</Text>
                    <Text style={styles.overviewMeta}>{done} of {item.sets.length} sets logged</Text>
                  </Pressable>
                  <Pressable
                    accessibilityLabel={`Move ${item.exercise_name || `movement ${index + 1}`} up`}
                    accessibilityRole="button"
                    disabled={index === 0}
                    onPress={() => props.onMoveExercise(item.id, -1)}
                    style={({ pressed }) => [styles.iconAction, index === 0 && styles.disabled, pressed && styles.pressed]}
                  >
                    <Ionicons color={colors.textMuted} name="arrow-up" size={18} />
                  </Pressable>
                  <Pressable
                    accessibilityLabel={`Move ${item.exercise_name || `movement ${index + 1}`} down`}
                    accessibilityRole="button"
                    disabled={index === draft.exercises.length - 1}
                    onPress={() => props.onMoveExercise(item.id, 1)}
                    style={({ pressed }) => [styles.iconAction, index === draft.exercises.length - 1 && styles.disabled, pressed && styles.pressed]}
                  >
                    <Ionicons color={colors.textMuted} name="arrow-down" size={18} />
                  </Pressable>
                  <Pressable
                    accessibilityLabel={`Remove ${item.exercise_name || `movement ${index + 1}`}`}
                    accessibilityRole="button"
                    disabled={draft.exercises.length <= 1}
                    onPress={() => props.onRemoveExercise(item.id)}
                    style={({ pressed }) => [styles.iconAction, draft.exercises.length <= 1 && styles.disabled, pressed && styles.pressed]}
                  >
                    <Ionicons color={colors.danger} name="close" size={18} />
                  </Pressable>
                </View>
              );
            })}
            <Pressable
              accessibilityLabel="Add a movement"
              accessibilityRole="button"
              onPress={props.onAddExercise}
              style={({ pressed }) => [styles.secondaryAction, pressed && styles.pressed]}
            >
              <Ionicons color={colors.accent} name="add" size={20} />
              <Text style={styles.secondaryActionText}>Add movement</Text>
            </Pressable>
            <Pressable
              accessibilityLabel="Save this session as a reusable routine"
              accessibilityRole="button"
              onPress={props.onSaveRoutine}
              style={({ pressed }) => [styles.secondaryAction, pressed && styles.pressed]}
            >
              <Ionicons color={colors.accent} name="bookmark-outline" size={19} />
              <Text style={styles.secondaryActionText}>Save as routine</Text>
            </Pressable>
          </>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        {props.notice ? (
          <Text accessibilityRole="alert" style={styles.notice}>{props.notice}</Text>
        ) : null}
        <Pressable
          accessibilityLabel="Finish and save this workout"
          accessibilityRole="button"
          disabled={props.saveState === 'saving'}
          onPress={props.onFinish}
          style={({ pressed }) => [styles.finishButton, props.saveState === 'saving' && styles.disabled, pressed && styles.pressed]}
        >
          <Text style={styles.finishText}>{props.saveState === 'saving' ? 'Saving…' : 'Finish workout'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: colors.background },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 12,
    paddingBottom: 10
  },
  topAction: { alignItems: 'center', justifyContent: 'center', minHeight: 44, minWidth: 44 },
  topCopy: { flex: 1, minWidth: 0 },
  topTitle: { ...type.label, color: colors.text },
  topMeta: { ...type.caption, color: colors.textMuted, marginTop: 2 },
  undoAction: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 5,
    minHeight: 44,
    paddingHorizontal: 10
  },
  undoText: { ...type.label, color: colors.accent },

  restBar: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.borderStrong,
    borderRadius: 18,
    borderWidth: hairlineWidth,
    flexDirection: 'row',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  restPlay: {
    alignItems: 'center',
    backgroundColor: colors.accentWash,
    borderRadius: 999,
    height: 40,
    justifyContent: 'center',
    width: 40
  },
  restCopy: { flex: 1, minWidth: 0 },
  restClock: { ...type.numberLg, color: colors.text },
  restLabel: { ...type.caption, color: colors.textMuted },
  restAdjust: {
    alignItems: 'center',
    backgroundColor: colors.surfaceInset,
    borderRadius: 10,
    justifyContent: 'center',
    minHeight: 40,
    paddingHorizontal: 10
  },
  restAdjustText: { ...type.label, color: colors.text },
  restSkip: { alignItems: 'center', justifyContent: 'center', minHeight: 40, paddingHorizontal: 8 },
  restSkipText: { ...type.label, color: colors.accent },

  viewToggle: { paddingHorizontal: 16, paddingBottom: 4 },
  scroll: { gap: 12, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 28 },

  focusHeader: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  focusNav: {
    alignItems: 'center',
    backgroundColor: colors.surfaceInset,
    borderRadius: 999,
    height: 44,
    justifyContent: 'center',
    width: 44
  },
  focusCopy: { flex: 1, minWidth: 0 },
  focusPosition: { ...type.caption, color: colors.textFaint, textAlign: 'center' },
  focusName: { ...type.heading, color: colors.text, textAlign: 'center' },
  focusPrevious: { ...type.caption, color: colors.textMuted, textAlign: 'center' },

  setCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 20,
    borderWidth: hairlineWidth,
    gap: 12,
    padding: 16
  },
  setCardDone: { borderColor: colors.accentPale },
  setHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  setIdentity: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  setNumber: { ...type.label, color: colors.text },
  warmupTag: {
    ...type.caption,
    backgroundColor: colors.surfaceInset,
    borderRadius: 6,
    color: colors.textMuted,
    fontSize: 11,
    overflow: 'hidden',
    paddingHorizontal: 6,
    paddingVertical: 2
  },
  setHeaderActions: { flexDirection: 'row', gap: 2 },
  iconAction: { alignItems: 'center', justifyContent: 'center', minHeight: 44, minWidth: 44 },

  previousLine: { ...type.caption, color: colors.accentMid },
  previousLineFaint: { ...type.caption, color: colors.textFaint },

  fieldsRow: { flexDirection: 'row', gap: 10 },
  field: { flex: 1, gap: 6, minWidth: 0 },
  fieldLabel: { ...type.caption, color: colors.textMuted },
  fieldRow: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  stepButton: {
    alignItems: 'center',
    backgroundColor: colors.surfaceInset,
    borderRadius: 12,
    height: 48,
    justifyContent: 'center',
    width: 44
  },
  fieldInput: {
    ...type.numberLg,
    backgroundColor: colors.surfaceInset,
    borderRadius: 12,
    color: colors.text,
    flex: 1,
    minHeight: 48,
    // On the web a text input keeps a default intrinsic width of about twenty
    // characters, which at this type size refuses to shrink and pushes the reps
    // stepper off the side of a phone screen. Native ignores this; the web needs it.
    minWidth: 0,
    textAlign: 'center'
  },

  completeButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 14,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 50
  },
  completeButtonDone: { backgroundColor: colors.accentWash },
  completeText: { ...type.label, color: colors.primaryText, fontSize: 16 },
  completeTextDone: { color: colors.accent },

  secondaryAction: {
    alignItems: 'center',
    borderColor: colors.borderStrong,
    borderRadius: 14,
    borderWidth: hairlineWidth,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 50
  },
  secondaryActionText: { ...type.label, color: colors.accent, fontSize: 16 },

  overviewRow: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: hairlineWidth,
    flexDirection: 'row',
    paddingLeft: 14,
    paddingRight: 4
  },
  overviewCopy: { flex: 1, gap: 2, minWidth: 0, paddingVertical: 14 },
  overviewName: { ...type.body, color: colors.text, fontWeight: '600' },
  overviewMeta: { ...type.caption, color: colors.textMuted },

  footer: {
    borderTopColor: colors.borderStrong,
    borderTopWidth: hairlineWidth,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8
  },
  finishButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 15,
    justifyContent: 'center',
    minHeight: 52
  },
  finishText: { ...type.label, color: colors.primaryText, fontSize: 16 },
  notice: { ...type.caption, color: colors.danger, marginBottom: 10 },

  suggestion: {
    backgroundColor: colors.surfaceInset,
    borderColor: colors.accentPale,
    borderRadius: 18,
    borderWidth: hairlineWidth,
    gap: 8,
    padding: 16
  },
  suggestionHead: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  suggestionEyebrow: { ...type.eyebrow, color: colors.accent },
  suggestionConfidence: { ...type.caption, color: colors.textFaint, textTransform: 'capitalize' },
  suggestionHeadline: { ...type.heading, color: colors.text },
  suggestionTarget: { ...type.body, color: colors.textMuted },
  whyRow: { alignItems: 'center', flexDirection: 'row', gap: 6, minHeight: 44 },
  whyText: { ...type.label, color: colors.accent },
  whyList: { gap: 6 },
  whyLine: { ...type.caption, color: colors.textMuted },
  useButton: {
    alignItems: 'center',
    borderColor: colors.accentPale,
    borderRadius: 13,
    borderWidth: hairlineWidth,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 48
  },
  useText: { ...type.label, color: colors.accent, fontSize: 15 },

  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.35 }
});
