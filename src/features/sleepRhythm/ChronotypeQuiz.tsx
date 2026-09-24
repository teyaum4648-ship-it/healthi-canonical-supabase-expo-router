import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  CHRONOTYPE_QUESTIONS,
  scoreChronotype,
  suggestDayArchitecture,
  type DaySlot
} from '../../engines/circadian';
import type { SleepPalette } from './SleepExperience';

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
  palette,
  onAccept,
  onDecline,
  onClose
}: {
  initialAnswers?: Record<string, string>;
  sleepNeedMinutes?: number;
  /** The Sleep tab's time-of-day palette, so the questions belong to the tab they open from. */
  palette: SleepPalette;
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
      <ScrollView
        contentContainerStyle={styles.page}
        keyboardShouldPersistTaps="handled"
        style={[styles.root, { backgroundColor: palette.background }]}
      >
        <Header palette={palette} title="A day built for your clock" onClose={onClose} />

        <View style={[styles.resultCard, { backgroundColor: palette.surfaceAlt, borderColor: palette.accent }]}>
          <Text style={[styles.eyebrow, { color: palette.accent }]}>{result.label}</Text>
          <Text style={[styles.resultSummary, { color: palette.text }]}>{result.summary}</Text>
          <Text style={[styles.resultMeta, { color: palette.faint }]}>
            From {answered} of {CHRONOTYPE_QUESTIONS.length} answers · {result.confidence} confidence.
            Your logged nights will sharpen this within a week or two.
          </Text>
        </View>

        {slots.map((slot) => (
          <View key={slot.id} style={[styles.slot, { backgroundColor: palette.surface, borderColor: palette.hairline }]}>
            <View style={styles.slotHead}>
              <View style={styles.flex}>
                <Text style={[styles.slotLabel, { color: palette.text }]}>{slot.label}</Text>
                <Text style={[styles.slotWhy, { color: palette.muted }]}>{slot.why}</Text>
              </View>
              <Text style={[styles.slotTime, { color: palette.accent }]}>{formatMinutes(slot.startMinutes)}</Text>
            </View>
            <View style={styles.nudgeRow}>
              <Pressable
                accessibilityLabel={`Move ${slot.label} fifteen minutes earlier`}
                accessibilityRole="button"
                onPress={() => nudge(slot, -STEP_MINUTES)}
                style={({ pressed }) => [styles.nudge, { backgroundColor: palette.chip }, pressed && styles.pressed]}
              >
                <Text style={[styles.nudgeText, { color: palette.text }]}>Earlier</Text>
              </Pressable>
              <Pressable
                accessibilityLabel={`Move ${slot.label} fifteen minutes later`}
                accessibilityRole="button"
                onPress={() => nudge(slot, STEP_MINUTES)}
                style={({ pressed }) => [styles.nudge, { backgroundColor: palette.chip }, pressed && styles.pressed]}
              >
                <Text style={[styles.nudgeText, { color: palette.text }]}>Later</Text>
              </Pressable>
              {slotOverrides[slot.id] !== undefined ? (
                <Pressable
                  accessibilityLabel={`Reset ${slot.label} to the suggested time`}
                  accessibilityRole="button"
                  onPress={() => setSlotOverrides(({ [slot.id]: _removed, ...rest }) => rest)}
                  style={({ pressed }) => [styles.nudge, { backgroundColor: palette.chip }, pressed && styles.pressed]}
                >
                  <Text style={[styles.nudgeText, { color: palette.text }]}>Reset</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        ))}

        <Text style={[styles.footnote, { color: palette.faint }]}>
          Move anything that does not match your experience. You know your own afternoons better
          than six questions do.
        </Text>

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            onPress={() => onAccept({ answers, slotOverrides })}
            style={({ pressed }) => [styles.primaryButton, { backgroundColor: palette.primary }, pressed && styles.pressed]}
          >
            <Text style={[styles.primaryButtonText, { color: palette.primaryText }]}>This fits — use it</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => onDecline(answers)}
            style={({ pressed }) => [styles.secondaryButton, { borderColor: palette.border }, pressed && styles.pressed]}
          >
            <Text style={[styles.secondaryButtonText, { color: palette.text }]}>Not me — go by my logged nights instead</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => setShowDay(false)}
            style={({ pressed }) => [styles.tertiaryButton, pressed && styles.pressed]}
          >
            <Text style={[styles.tertiaryButtonText, { color: palette.muted }]}>Change my answers</Text>
          </Pressable>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.page}
      keyboardShouldPersistTaps="handled"
      style={[styles.root, { backgroundColor: palette.background }]}
    >
      <Header palette={palette} title="When does your body want the day?" onClose={onClose} />
      <Text style={[styles.intro, { color: palette.muted }]}>
        Six questions about the days nothing is scheduled. Your logged nights will take over from
        these, but they give us somewhere honest to start.
      </Text>

      {CHRONOTYPE_QUESTIONS.map((question) => (
        <View key={question.id} style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <Text style={[styles.cardTitle, { color: palette.text }]}>{question.prompt}</Text>
          {question.note ? <Text style={[styles.cardNote, { color: palette.faint }]}>{question.note}</Text> : null}
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
                  style={({ pressed }) => [styles.option, { backgroundColor: palette.chip, borderColor: 'transparent' }, selected && { borderColor: palette.accent }, pressed && styles.pressed]}
                >
                  <Text style={[styles.optionText, { color: palette.muted }, selected && { color: palette.text, fontWeight: '600' }]}>{option.label}</Text>
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
        style={({ pressed }) => [styles.primaryButton, { backgroundColor: palette.primary }, answered === 0 && styles.buttonDisabled, pressed && styles.pressed]}
      >
        <Text style={[styles.primaryButtonText, { color: palette.primaryText }]}>
          {answered === 0 ? 'Answer one to continue' : 'See the day this suggests'}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

function Header({ title, onClose, palette }: { title: string; onClose: () => void; palette: SleepPalette }) {
  return (
    <View style={styles.header}>
      <Pressable
        accessibilityLabel="Close the clock questions"
        accessibilityRole="button"
        onPress={onClose}
        style={({ pressed }) => [styles.close, pressed && styles.pressed]}
      >
        <Ionicons color={palette.accent} name="chevron-back" size={22} />
      </Pressable>
      <Text accessibilityRole="header" style={[styles.title, { color: palette.text }]}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  page: { gap: 14, paddingBottom: 96, paddingHorizontal: 20, paddingTop: 56 },
  header: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  close: { alignItems: 'center', height: 44, justifyContent: 'center', width: 44 },
  title: { flex: 1, fontSize: 26, fontWeight: '600', lineHeight: 32 },
  intro: { fontSize: 15, lineHeight: 22 },
  flex: { flex: 1, gap: 4, minWidth: 0 },
  card: { borderRadius: 18, borderWidth: 1, gap: 6, paddingHorizontal: 18, paddingVertical: 16 },
  cardTitle: { fontSize: 19, fontWeight: '600', lineHeight: 25 },
  cardNote: { fontSize: 13, lineHeight: 19 },
  options: { gap: 6, marginTop: 6 },
  option: { borderRadius: 12, borderWidth: 1, justifyContent: 'center', minHeight: 48, paddingHorizontal: 14, paddingVertical: 10 },
  optionText: { fontSize: 15, lineHeight: 21 },
  resultCard: { borderRadius: 18, borderWidth: 1, gap: 10, paddingHorizontal: 18, paddingVertical: 16 },
  eyebrow: { fontSize: 12, fontWeight: '600', letterSpacing: 0 },
  resultSummary: { fontSize: 16, lineHeight: 23 },
  resultMeta: { fontSize: 13, lineHeight: 19 },
  slot: { borderRadius: 16, borderWidth: 1, gap: 10, padding: 14 },
  slotHead: { flexDirection: 'row', gap: 10 },
  slotLabel: { fontSize: 15, fontWeight: '600' },
  slotWhy: { fontSize: 13, lineHeight: 19 },
  slotTime: { fontSize: 17, fontVariant: ['tabular-nums'], fontWeight: '600' },
  nudgeRow: { flexDirection: 'row', gap: 6 },
  nudge: { alignItems: 'center', borderRadius: 10, justifyContent: 'center', minHeight: 44, paddingHorizontal: 14 },
  nudgeText: { fontSize: 13 },
  footnote: { fontSize: 13, lineHeight: 20 },
  actions: { gap: 10 },
  primaryButton: { alignItems: 'center', borderRadius: 12, justifyContent: 'center', minHeight: 52, paddingHorizontal: 14 },
  primaryButtonText: { fontSize: 16, fontWeight: '600' },
  secondaryButton: { alignItems: 'center', borderRadius: 12, borderWidth: 1, justifyContent: 'center', minHeight: 52, paddingHorizontal: 14 },
  secondaryButtonText: { fontSize: 15, textAlign: 'center' },
  tertiaryButton: { alignItems: 'center', justifyContent: 'center', minHeight: 44 },
  tertiaryButtonText: { fontSize: 13 },
  buttonDisabled: { opacity: 0.4 },
  pressed: { opacity: 0.65 }
});
