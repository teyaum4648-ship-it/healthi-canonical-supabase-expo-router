import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  CHRONOTYPE_QUESTIONS,
  scoreChronotype,
  suggestDayArchitecture,
  type DaySlot
} from '../../engines/circadian';
import { colors, radii, spacing, type } from '../../styles/mobileTheme';

/**
 * Six questions, then a day built from the answers that the person gets to argue with.
 *
 * The arguing is the point. A questionnaire knows less about somebody's afternoons than
 * they do, so the day is offered rather than applied: every slot carries the reason it
 * sits where it does, any slot can be moved, and declining is a real answer that stops
 * the suggestion coming back. Only an accepted day becomes the prior the rhythm engine
 * reads — and even then, logged nights overrule it within a week.
 */

const STEP_MINUTES = 15;

function formatMinutes(minutes: number): string {
  const wrapped = ((minutes % 1440) + 1440) % 1440;
  const hour = Math.floor(wrapped / 60);
  const minute = wrapped % 60;
  const suffix = hour < 12 ? 'am' : 'pm';
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display}:${String(minute).padStart(2, '0')}${suffix}`;
}

export function ChronotypeQuiz({
  initialAnswers,
  sleepNeedMinutes,
  onAccept,
  onDecline,
  onClose
}: {
  initialAnswers?: Record<string, string>;
  sleepNeedMinutes?: number;
  onAccept: (result: { answers: Record<string, string>; slotOverrides: Record<string, number> }) => void;
  onDecline: (answers: Record<string, string>) => void;
  onClose: () => void;
}) {
  const [answers, setAnswers] = useState<Record<string, string>>(() => ({ ...(initialAnswers ?? {}) }));
  const [slotOverrides, setSlotOverrides] = useState<Record<string, number>>({});
  const [showDay, setShowDay] = useState(false);

  const answered = CHRONOTYPE_QUESTIONS.filter((question) => answers[question.id]).length;
  const result = useMemo(() => scoreChronotype(answers), [answers]);
  const slots = useMemo(
    () => suggestDayArchitecture({
      preferredMidSleepMinutes: result.preferredMidSleepMinutes,
      sleepNeedMinutes
    }).map((slot) => ({ ...slot, startMinutes: slotOverrides[slot.id] ?? slot.startMinutes })),
    [result.preferredMidSleepMinutes, sleepNeedMinutes, slotOverrides]
  );

  const nudge = (slot: DaySlot, deltaMinutes: number) =>
    setSlotOverrides((current) => ({
      ...current,
      [slot.id]: (((slot.startMinutes + deltaMinutes) % 1440) + 1440) % 1440
    }));

  if (showDay) {
    return (
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <Header title="A day built for your clock" onClose={onClose} />

        <View style={styles.resultCard}>
          <Text style={styles.eyebrow}>{result.label}</Text>
          <Text style={styles.resultSummary}>{result.summary}</Text>
          <Text style={styles.resultMeta}>
            From {answered} of {CHRONOTYPE_QUESTIONS.length} answers · {result.confidence} confidence.
            Your logged nights will sharpen this within a week or two.
          </Text>
        </View>

        {slots.map((slot) => (
          <View key={slot.id} style={styles.slot}>
            <View style={styles.slotHead}>
              <View style={styles.flex}>
                <Text style={styles.slotLabel}>{slot.label}</Text>
                <Text style={styles.slotWhy}>{slot.why}</Text>
              </View>
              <Text style={styles.slotTime}>{formatMinutes(slot.startMinutes)}</Text>
            </View>
            <View style={styles.nudgeRow}>
              <Pressable
                accessibilityLabel={`Move ${slot.label} fifteen minutes earlier`}
                accessibilityRole="button"
                onPress={() => nudge(slot, -STEP_MINUTES)}
                style={({ pressed }) => [styles.nudge, pressed && styles.pressed]}
              >
                <Text style={styles.nudgeText}>Earlier</Text>
              </Pressable>
              <Pressable
                accessibilityLabel={`Move ${slot.label} fifteen minutes later`}
                accessibilityRole="button"
                onPress={() => nudge(slot, STEP_MINUTES)}
                style={({ pressed }) => [styles.nudge, pressed && styles.pressed]}
              >
                <Text style={styles.nudgeText}>Later</Text>
              </Pressable>
              {slotOverrides[slot.id] !== undefined ? (
                <Pressable
                  accessibilityLabel={`Reset ${slot.label} to the suggested time`}
                  accessibilityRole="button"
                  onPress={() => setSlotOverrides(({ [slot.id]: _removed, ...rest }) => rest)}
                  style={({ pressed }) => [styles.nudge, pressed && styles.pressed]}
                >
                  <Text style={styles.nudgeText}>Reset</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        ))}

        <Text style={styles.footnote}>
          Move anything that does not match your experience. You know your own afternoons better
          than six questions do.
        </Text>

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            onPress={() => onAccept({ answers, slotOverrides })}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
          >
            <Text style={styles.primaryButtonText}>This fits — use it</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => onDecline(answers)}
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
          >
            <Text style={styles.secondaryButtonText}>Not me — go by my logged nights instead</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => setShowDay(false)}
            style={({ pressed }) => [styles.tertiaryButton, pressed && styles.pressed]}
          >
            <Text style={styles.tertiaryButtonText}>Change my answers</Text>
          </Pressable>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <Header title="When does your body want the day?" onClose={onClose} />
      <Text style={styles.intro}>
        Six questions about the days nothing is scheduled. Your logged nights will take over from
        these, but they give us somewhere honest to start.
      </Text>

      {CHRONOTYPE_QUESTIONS.map((question) => (
        <View key={question.id} style={styles.card}>
          <Text style={styles.cardTitle}>{question.prompt}</Text>
          {question.note ? <Text style={styles.cardNote}>{question.note}</Text> : null}
          <View style={styles.options}>
            {question.options.map((option) => {
              const selected = answers[question.id] === option.value;
              return (
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  key={option.value}
                  onPress={() => setAnswers((current) => {
                    if (selected) {
                      const { [question.id]: _removed, ...rest } = current;
                      return rest;
                    }
                    return { ...current, [question.id]: option.value };
                  })}
                  style={({ pressed }) => [styles.option, selected && styles.optionSelected, pressed && styles.pressed]}
                >
                  <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{option.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: answered === 0 }}
        disabled={answered === 0}
        onPress={() => setShowDay(true)}
        style={({ pressed }) => [styles.primaryButton, answered === 0 && styles.buttonDisabled, pressed && styles.pressed]}
      >
        <Text style={styles.primaryButtonText}>
          {answered === 0 ? 'Answer one to continue' : 'See the day this suggests'}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

function Header({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <View style={styles.header}>
      <Pressable
        accessibilityLabel="Close the clock questions"
        accessibilityRole="button"
        onPress={onClose}
        style={({ pressed }) => [styles.close, pressed && styles.pressed]}
      >
        <Ionicons color={colors.accentMid} name="chevron-back" size={22} />
      </Pressable>
      <Text accessibilityRole="header" style={styles.title}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: spacing.md, paddingBottom: spacing.xl * 2 },
  header: { alignItems: 'center', flexDirection: 'row', gap: spacing.xs },
  close: { alignItems: 'center', height: 44, justifyContent: 'center', width: 44 },
  title: { ...type.title, color: colors.text, flex: 1 },
  intro: { ...type.body, color: colors.textMuted, lineHeight: 22 },
  flex: { flex: 1, gap: 4, minWidth: 0 },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.lg
  },
  cardTitle: { ...type.heading, color: colors.text },
  cardNote: { ...type.caption, color: colors.textFaint },
  options: { gap: spacing.xs, marginTop: spacing.xs },
  option: {
    backgroundColor: colors.surfaceInset,
    borderColor: 'transparent',
    borderRadius: radii.md,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  optionSelected: { backgroundColor: colors.accentWash, borderColor: colors.accentMid },
  optionText: { ...type.body, color: colors.textMuted },
  optionTextSelected: { color: colors.text, fontWeight: '600' },
  resultCard: {
    backgroundColor: colors.surface,
    borderColor: colors.accentMid,
    borderRadius: radii.lg,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.lg
  },
  eyebrow: { ...type.eyebrow, color: colors.accentMid },
  resultSummary: { ...type.body, color: colors.text, lineHeight: 23 },
  resultMeta: { ...type.caption, color: colors.textFaint, lineHeight: 19 },
  slot: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md
  },
  slotHead: { flexDirection: 'row', gap: spacing.sm },
  slotLabel: { ...type.label, color: colors.text },
  slotWhy: { ...type.caption, color: colors.textMuted, lineHeight: 19 },
  slotTime: { ...type.number, color: colors.accentMid },
  nudgeRow: { flexDirection: 'row', gap: spacing.xs },
  nudge: {
    alignItems: 'center',
    backgroundColor: colors.surfaceInset,
    borderRadius: radii.sm,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: spacing.md
  },
  nudgeText: { ...type.caption, color: colors.text },
  footnote: { ...type.caption, color: colors.textFaint, lineHeight: 20 },
  actions: { gap: spacing.sm },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: spacing.md
  },
  primaryButtonText: { ...type.body, color: colors.primaryText, fontWeight: '600' },
  secondaryButton: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: spacing.md
  },
  secondaryButtonText: { ...type.body, color: colors.text, textAlign: 'center' },
  tertiaryButton: { alignItems: 'center', justifyContent: 'center', minHeight: 44 },
  tertiaryButtonText: { ...type.caption, color: colors.textMuted },
  buttonDisabled: { backgroundColor: colors.surfaceMuted },
  pressed: { opacity: 0.65 }
});
