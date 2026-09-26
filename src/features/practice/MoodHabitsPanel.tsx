import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { TextInput } from '../../components/TextInput';
import { colors, hairlineWidth, type } from '../../styles/mobileTheme';
import { pillarTint, tabAccent } from '../../styles/pillarColors';
import {
  availableHabits,
  CUSTOM_HABIT_MAX_NAME,
  habitDayLine,
  isUsableHabitName,
  type HabitDay,
  type MoodHabit
} from './moodHabits';

/**
 * The routine: what you have chosen, what is left to choose, and room for your own.
 *
 * Built on the sleep wind-down's shape, with the one thing it lacks — a way to add
 * something that is not in the library. The recommendations cover the eight or nine
 * things worth suggesting to a stranger, which is nothing like the set of things that
 * work for one person. Whatever someone already does that helps is more likely to stick
 * than anything suggested here, so it needs a place to go.
 *
 * A completed habit stays visible rather than disappearing. A routine that empties as you
 * work through it gives you nothing to look at come evening, and "all four done" is the
 * only reward this screen has to offer.
 */

const MINUTE_CHOICES = [2, 5, 10, 15, 20, 30] as const;

export function MoodHabits({
  routine,
  day,
  onToggle,
  onAdd,
  onRemove,
  onAddCustom
}: {
  routine: MoodHabit[];
  day: HabitDay;
  onToggle: (habit: MoodHabit) => void;
  onAdd: (habit: MoodHabit) => void;
  onRemove: (habit: MoodHabit) => void;
  onAddCustom: (name: string, minutes: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [openWhy, setOpenWhy] = useState<string | null>(null);
  const [customName, setCustomName] = useState('');
  const [customMinutes, setCustomMinutes] = useState<number>(10);

  const available = availableHabits(routine.map((habit) => habit.id));

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>Routine</Text>
          <Text style={styles.meta}>{habitDayLine(day)}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => setEditing(!editing)}
          style={({ pressed }) => [styles.textButton, pressed && styles.pressed]}
        >
          <Text style={styles.textButtonLabel}>{editing ? 'Done' : 'Edit'}</Text>
        </Pressable>
      </View>

      {routine.length === 0 ? (
        <Text style={styles.body}>
          Nothing in your routine yet. Add a couple below — two you will actually do beats
          six you will not.
        </Text>
      ) : (
        <View style={styles.list}>
          {routine.map((habit, index) => {
            const done = day.completedIds.includes(habit.id);
            const why = openWhy === habit.id;

            return (
              <View key={habit.id}>
                {index > 0 ? <View style={styles.divider} /> : null}
                <View style={styles.row}>
                  <Pressable
                    accessibilityLabel={`${habit.name}${done ? ', done' : ''}`}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: done }}
                    hitSlop={6}
                    onPress={() => onToggle(habit)}
                    style={({ pressed }) => [styles.check, done && styles.checkDone, pressed && styles.pressed]}
                  >
                    {done ? (
                      <Ionicons accessible={false} color={colors.primaryText} name="checkmark" size={16} />
                    ) : null}
                  </Pressable>

                  <Pressable
                    accessibilityHint="Shows why this is on the list"
                    accessibilityLabel={habit.name}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: why }}
                    onPress={() => setOpenWhy(why ? null : habit.id)}
                    style={styles.rowCopy}
                  >
                    <Text style={[styles.name, done && styles.nameDone]}>{habit.name}</Text>
                    <Text style={styles.detail}>{habit.detail} · {habit.minutes}m</Text>
                  </Pressable>

                  {editing ? (
                    <Pressable
                      accessibilityLabel={`Remove ${habit.name}`}
                      accessibilityRole="button"
                      hitSlop={8}
                      onPress={() => onRemove(habit)}
                      style={({ pressed }) => [styles.remove, pressed && styles.pressed]}
                    >
                      <Ionicons accessible={false} color={colors.danger} name="remove-circle-outline" size={22} />
                    </Pressable>
                  ) : (
                    <Ionicons
                      accessible={false}
                      color={colors.textFaint}
                      name={habit.icon as never}
                      size={18}
                    />
                  )}
                </View>

                {why ? (
                  <View style={styles.why}>
                    <Text style={styles.whyText}>{habit.why}</Text>
                    {habit.caution ? (
                      <View style={styles.caution}>
                        <Text style={styles.cautionLabel}>Careful</Text>
                        <Text style={styles.cautionText}>{habit.caution}</Text>
                      </View>
                    ) : null}
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      )}

      {editing ? (
        <View style={styles.editor}>
          {available.length > 0 ? (
            <>
              <Text style={styles.label}>Add from the library</Text>
              <View style={styles.list}>
                {available.map((habit, index) => (
                  <View key={habit.id}>
                    {index > 0 ? <View style={styles.divider} /> : null}
                    <Pressable
                      accessibilityHint={habit.why}
                      accessibilityLabel={`Add ${habit.name}`}
                      accessibilityRole="button"
                      onPress={() => onAdd(habit)}
                      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                    >
                      <View style={styles.addIcon}>
                        <Ionicons accessible={false} color={tabAccent.mood} name="add" size={17} />
                      </View>
                      <View style={styles.rowCopy}>
                        <Text style={styles.name}>{habit.name}</Text>
                        <Text style={styles.detail}>{habit.detail} · {habit.minutes}m</Text>
                      </View>
                    </Pressable>
                  </View>
                ))}
              </View>
            </>
          ) : null}

          <Text style={styles.label}>Or add your own</Text>
          <Text style={styles.body}>
            Anything you already do that helps. A ritual, a walk to a particular place, a
            record you put on — it does not have to be on anyone's list to work.
          </Text>
          <TextInput
            label="What is it"
            maxLength={CUSTOM_HABIT_MAX_NAME}
            onChangeText={setCustomName}
            placeholder="Sit on the porch with coffee"
            value={customName}
          />
          <Text style={styles.label}>How long</Text>
          <View style={styles.chips}>
            {MINUTE_CHOICES.map((choice) => {
              const active = choice === customMinutes;
              return (
                <Pressable
                  accessibilityLabel={`${choice} minutes`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  key={choice}
                  onPress={() => setCustomMinutes(choice)}
                  style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && styles.pressed]}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{choice}m</Text>
                </Pressable>
              );
            })}
          </View>
          <Pressable
            accessibilityRole="button"
            disabled={!isUsableHabitName(customName)}
            onPress={() => { onAddCustom(customName, customMinutes); setCustomName(''); }}
            style={({ pressed }) => [
              styles.primary,
              !isUsableHabitName(customName) && styles.dim,
              pressed && styles.pressed
            ]}
          >
            <Text style={styles.primaryText}>Add to my routine</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  header: { alignItems: 'flex-start', flexDirection: 'row', gap: 10, justifyContent: 'space-between' },
  headerCopy: { flex: 1, gap: 3 },
  eyebrow: { ...type.label, color: colors.textMuted, fontSize: 13, letterSpacing: 0 },
  meta: { ...type.body, color: colors.textMuted },
  label: { ...type.label, color: colors.text, marginTop: 4 },
  body: { ...type.caption, color: colors.textMuted, lineHeight: 19 },

  list: { gap: 0 },
  divider: { backgroundColor: colors.border, height: hairlineWidth },
  row: { alignItems: 'center', flexDirection: 'row', gap: 11, minHeight: 56, paddingVertical: 8 },
  rowCopy: { flex: 1, gap: 2 },
  name: { ...type.body, color: colors.text, fontWeight: '600' },
  nameDone: { color: colors.textMuted, textDecorationLine: 'line-through' },
  detail: { ...type.caption, color: colors.textMuted },

  check: {
    alignItems: 'center',
    borderColor: colors.borderStrong,
    borderRadius: 13,
    borderWidth: 1.5,
    height: 26,
    justifyContent: 'center',
    width: 26
  },
  checkDone: { backgroundColor: tabAccent.mood, borderColor: tabAccent.mood },
  addIcon: {
    alignItems: 'center',
    backgroundColor: pillarTint('mind_life_load', 0.11),
    borderRadius: 13,
    height: 26,
    justifyContent: 'center',
    width: 26
  },
  remove: { alignItems: 'center', height: 30, justifyContent: 'center', width: 30 },

  why: { gap: 8, paddingBottom: 12, paddingLeft: 37, paddingRight: 4 },
  whyText: { ...type.caption, color: colors.text, lineHeight: 20 },
  caution: {
    backgroundColor: colors.surfaceInset,
    borderColor: colors.danger,
    borderRadius: 10,
    borderWidth: hairlineWidth,
    gap: 3,
    padding: 11
  },
  cautionLabel: { ...type.label, color: colors.danger },
  cautionText: { ...type.caption, color: colors.textMuted, lineHeight: 19 },

  editor: { borderTopColor: colors.border, borderTopWidth: hairlineWidth, gap: 10, paddingTop: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    backgroundColor: colors.surfaceInset,
    borderRadius: 999,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 15
  },
  chipActive: { backgroundColor: tabAccent.mood },
  chipText: { ...type.label, color: colors.textMuted },
  chipTextActive: { color: colors.primaryText },

  primary: {
    alignItems: 'center',
    backgroundColor: tabAccent.mood,
    borderRadius: 14,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 18
  },
  primaryText: { ...type.label, color: colors.primaryText, fontSize: 16 },
  dim: { opacity: 0.45 },
  textButton: { justifyContent: 'center', minHeight: 44, paddingHorizontal: 4 },
  textButtonLabel: { ...type.label, color: tabAccent.mood },
  pressed: { opacity: 0.7 }
});
