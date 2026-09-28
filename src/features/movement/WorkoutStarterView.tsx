import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { SegmentedControl } from '../../components/mobile/SegmentedControl';
import { colors, hairlineWidth, type, glassSurface } from '../../styles/mobileTheme';
import { tabAccent } from '../../styles/pillarColors';
import {
  canStart,
  minimumSets,
  namedMovements,
  starterTitle,
  type StarterDraft,
  type StarterMovement,
  type StarterSource,
  type StarterTab
} from './workoutStarter';

/**
 * The one screen that starts a workout.
 *
 * It replaces a chooser sheet, a Templates segment and a separate build form, which
 * between them asked someone to decide how they wanted to start before they could
 * start. The order here is the order of the decision: what this session is called,
 * what is in it, and only then the shelf of things you could pull it from.
 *
 * Add movement sits directly under the list rather than below everything else — on an
 * empty draft it is the second thing on the screen. Picking from the shelf fills this
 * same draft instead of launching, so what is about to start is always visible and
 * still editable.
 *
 * The same screen edits a session that is already running, which is where the logger's
 * back arrow goes: the place the list was made is the obvious place to change it. In
 * that mode the shelf is gone — replacing a running session wholesale is not an edit —
 * and anything already logged is protected: the set count will not go below what has
 * been completed, and removing such a movement asks first.
 */

const TABS: readonly StarterTab[] = ['Routines', 'Templates', 'Recent'];

const EMPTY_COPY: Record<StarterTab, string> = {
  Routines: 'Routines you save from a finished session land here.',
  Templates: 'No starting points available.',
  Recent: 'Sessions you log will show up here, ready to repeat.'
};

function MovementRow({ movement, index, total, onChange, onRemove, onMove }: {
  movement: StarterMovement;
  index: number;
  total: number;
  onChange: (update: Partial<StarterMovement>) => void;
  onRemove: () => void;
  onMove: (direction: -1 | 1) => void;
}) {
  // Removing logged work takes two taps, and the second one says what it costs.
  const [confirming, setConfirming] = useState(false);
  const logged = movement.logged_sets ?? 0;
  const floor = minimumSets(movement);

  return (
    <View style={styles.movement}>
      <View style={styles.movementHead}>
        <Text style={styles.movementIndex}>{index + 1}</Text>
        <TextInput
          accessibilityLabel={`Movement ${index + 1} name`}
          autoCapitalize="words"
          onChangeText={(name) => onChange({ name })}
          placeholder="Movement name"
          placeholderTextColor={colors.textFaint}
          style={styles.movementName}
          value={movement.name}
        />
        <Pressable
          accessibilityLabel={logged > 0
            ? `Remove ${movement.name || `movement ${index + 1}`} and lose ${logged} logged set${logged === 1 ? '' : 's'}`
            : `Remove movement ${index + 1}`}
          accessibilityRole="button"
          onPress={() => {
            if (logged > 0 && !confirming) { setConfirming(true); return; }
            onRemove();
          }}
          style={({ pressed }) => [styles.iconAction, pressed && styles.pressed]}
        >
          <Ionicons color={confirming ? colors.danger : colors.textMuted} name="close" size={18} />
        </Pressable>
      </View>

      {confirming ? (
        <View style={styles.confirm}>
          <Text style={styles.confirmText}>
            {logged === 1 ? 'Remove this and 1 logged set goes with it.' : `Remove this and ${logged} logged sets go with it.`}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => setConfirming(false)}
            style={({ pressed }) => [styles.confirmKeep, pressed && styles.pressed]}
          >
            <Text style={styles.confirmKeepText}>Keep it</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.movementFoot}>
        <Text style={styles.movementLabel}>Sets</Text>
        <View style={styles.setStepper}>
          <Pressable
            accessibilityLabel={`One fewer set for movement ${index + 1}`}
            accessibilityRole="button"
            disabled={movement.sets <= floor}
            onPress={() => onChange({ sets: Math.max(floor, movement.sets - 1) })}
            style={({ pressed }) => [styles.setButton, movement.sets <= floor && styles.faded, pressed && styles.pressed]}
          >
            <Ionicons color={colors.text} name="remove" size={17} />
          </Pressable>
          <Text style={styles.setCount}>{movement.sets}</Text>

          <Pressable
            accessibilityLabel={`One more set for movement ${index + 1}`}
            accessibilityRole="button"
            onPress={() => onChange({ sets: Math.min(10, movement.sets + 1) })}
            style={({ pressed }) => [styles.setButton, pressed && styles.pressed]}
          >
            <Ionicons color={colors.text} name="add" size={17} />
          </Pressable>
        </View>

        {logged > 0 ? (
          <Text style={styles.loggedNote}>{logged} logged</Text>
        ) : null}

        <View style={styles.reorder}>
          <Pressable
            accessibilityLabel={`Move movement ${index + 1} up`}
            accessibilityRole="button"
            disabled={index === 0}
            onPress={() => onMove(-1)}
            style={({ pressed }) => [styles.iconAction, index === 0 && styles.faded, pressed && styles.pressed]}
          >
            <Ionicons color={colors.textMuted} name="chevron-up" size={18} />
          </Pressable>
          <Pressable
            accessibilityLabel={`Move movement ${index + 1} down`}
            accessibilityRole="button"
            disabled={index === total - 1}
            onPress={() => onMove(1)}
            style={({ pressed }) => [styles.iconAction, index === total - 1 && styles.faded, pressed && styles.pressed]}
          >
            <Ionicons color={colors.textMuted} name="chevron-down" size={18} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function SourceRow({ source, allowed, onPick }: {
  source: StarterSource;
  allowed: boolean;
  onPick: () => void;
}) {
  return (
    <Pressable
      accessibilityHint={allowed
        ? 'Fills this session with that workout, ready to adjust'
        : 'Outside today’s suggested movement range'}
      accessibilityRole="button"
      disabled={!allowed}
      onPress={onPick}
      style={({ pressed }) => [styles.source, !allowed && styles.faded, pressed && styles.sourcePressed]}
    >
      <View style={styles.sourceCopy}>
        <Text numberOfLines={1} style={styles.sourceTitle}>{source.title}</Text>
        <Text numberOfLines={1} style={styles.sourceDetail}>
          {allowed ? source.detail : `${source.detail} · limited today`}
        </Text>
        <Text numberOfLines={1} style={styles.sourceMovements}>
          {source.movements.map((movement) => movement.name).join(' · ')}
        </Text>
      </View>
      <Ionicons color={tabAccent.movement} name="arrow-forward" size={18} />
    </Pressable>
  );
}

export function WorkoutStarter(props: {
  draft: StarterDraft;
  /**
   * 'start' builds a new session; 'edit' changes one that is already running, reached
   * from the logger's back arrow. Edit hides the shelf and keeps a way back to the
   * session that applies nothing.
   */
  mode: 'start' | 'edit';
  sources: Record<StarterTab, StarterSource[]>;
  /** Today's guidance. A source outside it is shown but cannot be started. */
  isAllowed: (source: StarterSource) => boolean;
  /** Why today is what it is, in one line. Absent when there is nothing to say. */
  capacityNote: string | null;
  onChangeTitle: (title: string) => void;
  onAddMovement: () => void;
  onUpdateMovement: (id: string, update: Partial<StarterMovement>) => void;
  onRemoveMovement: (id: string) => void;
  onMoveMovement: (id: string, direction: -1 | 1) => void;
  onPickSource: (source: StarterSource) => void;
  onStart: () => void;
  onClose: () => void;
  /** Edit mode only: leave the session open and go back to Move. */
  onLeave?: () => void;
  /** Set when the last start attempt was refused, shown beside the button. */
  notice: string | null;
}) {
  const [tab, setTab] = useState<StarterTab>(
    props.sources.Routines.length > 0 ? 'Routines' : props.sources.Recent.length > 0 ? 'Recent' : 'Templates'
  );
  const movements = props.draft.movements;
  const editing = props.mode === 'edit';
  const ready = canStart(props.draft);
  const count = namedMovements(props.draft).length;
  const rows = props.sources[tab];

  return (
    <View style={styles.shell}>
      <View style={styles.topBar}>
        <Pressable
          accessibilityLabel={editing ? 'Back to the session without applying changes' : 'Close without starting'}
          accessibilityRole="button"
          onPress={props.onClose}
          style={({ pressed }) => [styles.topAction, pressed && styles.pressed]}
        >
          <Ionicons color={tabAccent.movement} name="chevron-back" size={24} />
        </Pressable>
        <Text style={styles.topTitle}>{editing ? 'Edit workout' : 'Start a workout'}</Text>
        <View style={styles.topAction} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <TextInput
          accessibilityLabel="Workout name"
          autoCapitalize="words"
          onChangeText={props.onChangeTitle}
          placeholder="Workout name"
          placeholderTextColor={colors.textFaint}
          style={styles.name}
          value={props.draft.title}
        />
        {props.capacityNote ? <Text style={styles.capacity}>{props.capacityNote}</Text> : null}

        {movements.map((movement, index) => (
          <MovementRow
            key={movement.id}
            index={index}
            movement={movement}
            onChange={(update) => props.onUpdateMovement(movement.id, update)}
            onMove={(direction) => props.onMoveMovement(movement.id, direction)}
            onRemove={() => props.onRemoveMovement(movement.id)}
            total={movements.length}
          />
        ))}

        <Pressable
          accessibilityRole="button"
          onPress={props.onAddMovement}
          style={({ pressed }) => [styles.addMovement, pressed && styles.pressed]}
        >
          <Ionicons color={tabAccent.movement} name="add" size={20} />
          <Text style={styles.addMovementText}>Add movement</Text>
        </Pressable>

        {/* Swapping a running session for a routine is not an edit, so the shelf is
            only offered when there is nothing underway to lose. */}
        {editing ? (
          props.onLeave ? (
            <Pressable
              accessibilityRole="button"
              onPress={props.onLeave}
              style={({ pressed }) => [styles.leave, pressed && styles.pressed]}
            >
              <Text style={styles.leaveText}>Leave the session open · back to Move</Text>
            </Pressable>
          ) : null
        ) : (
          <View style={styles.shelf}>
            <Text style={styles.shelfLabel}>Or start from</Text>
            <SegmentedControl onChange={setTab} options={TABS} value={tab} />
            {rows.length > 0 ? rows.map((source) => (
              <SourceRow
                key={source.id}
                allowed={props.isAllowed(source)}
                onPick={() => props.onPickSource(source)}
                source={source}
              />
            )) : (
              <Text style={styles.shelfEmpty}>{EMPTY_COPY[tab]}</Text>
            )}
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        {props.notice ? (
          <Text accessibilityRole="alert" style={styles.notice}>{props.notice}</Text>
        ) : null}
        <Pressable
          accessibilityLabel={ready
            ? editing ? 'Apply these changes and go back to the session' : `Start ${starterTitle(props.draft)}`
            : 'Add a movement first'}
          accessibilityRole="button"
          disabled={!ready}
          onPress={props.onStart}
          style={({ pressed }) => [styles.start, !ready && styles.startDisabled, pressed && styles.pressed]}
        >
          <Text style={[styles.startText, !ready && styles.startTextDisabled]}>
            {ready
              ? editing
                ? `Back to workout · ${count} movement${count === 1 ? '' : 's'}`
                : `Start · ${count} movement${count === 1 ? '' : 's'}`
              : 'Add a movement'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: colors.background },
  topBar: { alignItems: 'center', flexDirection: 'row', gap: 4, paddingHorizontal: 12, paddingBottom: 6 },
  topAction: { alignItems: 'center', justifyContent: 'center', minHeight: 44, minWidth: 44 },
  topTitle: { ...type.label, color: colors.text, flex: 1, textAlign: 'center' },

  scroll: { gap: 12, padding: 16, paddingBottom: 28 },
  name: {
    ...type.title,
    ...glassSurface,
    borderRadius: 16,
    color: colors.text,
    minHeight: 60,
    minWidth: 0,
    paddingHorizontal: 16,
    paddingVertical: 12
  },
  capacity: { ...type.caption, color: colors.textMuted, paddingHorizontal: 4 },

  movement: {
    ...glassSurface,
    borderRadius: 16,
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  movementHead: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  movementIndex: { ...type.caption, color: colors.textFaint, minWidth: 14 },
  movementName: {
    ...type.body,
    color: colors.text,
    flex: 1,
    fontWeight: '600',
    minHeight: 44,
    // Web inputs keep an intrinsic width of about twenty characters and will push the
    // remove button off a phone screen without this.
    minWidth: 0
  },
  movementFoot: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  movementLabel: { ...type.caption, color: colors.textMuted },
  setStepper: {
    alignItems: 'center',
    backgroundColor: colors.surfaceInset,
    borderRadius: 12,
    flexDirection: 'row',
    gap: 2
  },
  setButton: { alignItems: 'center', justifyContent: 'center', minHeight: 40, minWidth: 40 },
  setCount: { ...type.body, color: colors.text, minWidth: 20, textAlign: 'center' },
  reorder: { flexDirection: 'row', gap: 2, marginLeft: 'auto' },
  iconAction: { alignItems: 'center', justifyContent: 'center', minHeight: 40, minWidth: 40 },

  addMovement: {
    alignItems: 'center',
    borderColor: colors.borderStrong,
    borderRadius: 16,
    borderStyle: 'dashed',
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 54
  },
  addMovementText: { ...type.body, color: tabAccent.movement, fontWeight: '600' },

  confirm: {
    alignItems: 'center',
    backgroundColor: colors.surfaceInset,
    borderRadius: 12,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  confirmText: { ...type.caption, color: colors.danger, flex: 1 },
  confirmKeep: { alignItems: 'center', justifyContent: 'center', minHeight: 40, paddingHorizontal: 10 },
  confirmKeepText: { ...type.caption, color: tabAccent.movement, fontWeight: '600' },
  loggedNote: { ...type.caption, color: colors.textFaint },

  leave: { alignItems: 'center', justifyContent: 'center', marginTop: 12, minHeight: 48 },
  leaveText: { ...type.caption, color: tabAccent.movement },

  shelf: { gap: 10, marginTop: 10 },
  shelfLabel: { ...type.label, color: colors.textMuted, letterSpacing: 0 },
  shelfEmpty: { ...type.caption, color: colors.textMuted, paddingHorizontal: 4, paddingVertical: 8 },
  source: {
    alignItems: 'center',
    ...glassSurface,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: hairlineWidth,
    flexDirection: 'row',
    gap: 12,
    minHeight: 68,
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  sourcePressed: { backgroundColor: colors.surfaceInset },
  sourceCopy: { flex: 1, gap: 2, minWidth: 0 },
  sourceTitle: { ...type.body, color: colors.text, fontWeight: '600' },
  sourceDetail: { ...type.caption, color: colors.textMuted },
  sourceMovements: { ...type.caption, color: colors.textFaint },

  footer: {
    borderTopColor: colors.borderStrong,
    borderTopWidth: hairlineWidth,
    paddingBottom: 8,
    paddingHorizontal: 16,
    paddingTop: 12
  },
  notice: { ...type.caption, color: colors.danger, marginBottom: 10 },
  start: {
    alignItems: 'center',
    backgroundColor: tabAccent.movement,
    borderRadius: 15,
    justifyContent: 'center',
    minHeight: 52
  },
  startDisabled: { backgroundColor: colors.surfaceInset },
  startText: { ...type.label, color: colors.primaryText, fontSize: 16 },
  startTextDisabled: { color: colors.textFaint },

  faded: { opacity: 0.45 },
  pressed: { opacity: 0.7 }
});
