import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../../src/features/auth/AuthProvider';
import { protocolScope } from '../../src/features/dailyProtocol';
import {
  evaluateEveningCloseout,
  localEveningCloseoutStore,
  type CloseoutAdherenceLabel,
  type CloseoutResponseLabel,
  type EveningCloseoutAnswers,
  type EveningCloseoutResult
} from '../../src/features/eveningCloseout';
import { colors, hairlineWidth, radii, spacing, type, glassSurface } from '../../src/styles/mobileTheme';

type QuestionKey = keyof EveningCloseoutAnswers;

const QUESTIONS: Array<{ key: QuestionKey; prompt: string; options: Array<{ value: string; label: string }> }> = [
  {
    key: 'followed_plan',
    prompt: 'Did you follow today’s movement or restore plan?',
    options: [
      { value: 'yes', label: 'Yes' },
      { value: 'partly', label: 'Partly' },
      { value: 'no', label: 'No' }
    ]
  },
  {
    key: 'body_response',
    prompt: 'How did your body respond?',
    options: [
      { value: 'better', label: 'Better' },
      { value: 'same', label: 'Same' },
      { value: 'lower_energy', label: 'Lower energy' },
      { value: 'more_tense', label: 'More tense' }
    ]
  },
  {
    key: 'movement_discomfort',
    prompt: 'Any pain or discomfort during movement?',
    options: [
      { value: 'no', label: 'No' },
      { value: 'mild_discomfort', label: 'Mild discomfort' },
      { value: 'pain', label: 'Pain' }
    ]
  },
  {
    key: 'digestion',
    prompt: 'How was digestion today?',
    options: [
      { value: 'comfortable', label: 'Comfortable' },
      { value: 'okay', label: 'Okay' },
      { value: 'off', label: 'Off' }
    ]
  },
  {
    key: 'caffeine_after_cutoff',
    prompt: 'Any caffeine after the suggested cutoff?',
    options: [
      { value: 'no', label: 'No' },
      { value: 'yes', label: 'Yes' },
      { value: 'not_sure', label: 'Not sure' }
    ]
  },
  {
    key: 'outdoor_light_or_walk',
    prompt: 'Did you get outdoor light or a walk?',
    options: [
      { value: 'yes', label: 'Yes' },
      { value: 'no', label: 'No' }
    ]
  }
];

const ADHERENCE_LABEL: Record<CloseoutAdherenceLabel, string> = {
  followed: 'Followed',
  partial: 'Partly followed',
  missed: 'Missed',
  unknown: 'Not recorded'
};

const RESPONSE_LABEL: Record<CloseoutResponseLabel, string> = {
  supported: 'Supported',
  neutral: 'Neutral',
  strained: 'Ran lower',
  needs_attention: 'Worth easing',
  unknown: 'Not recorded'
};

export default function CloseoutScreen() {
  const { user } = useAuth();
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const scope = useMemo(() => protocolScope(user?.id), [user?.id]);
  const [answers, setAnswers] = useState<EveningCloseoutAnswers>({});
  const [result, setResult] = useState<EveningCloseoutResult | null>(null);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      localEveningCloseoutStore
        .read(scope, today)
        .then((record) => {
          if (mounted && record) {
            setAnswers(record.answers);
            setResult(record.result);
          }
        })
        .catch(() => undefined);
      return () => {
        mounted = false;
      };
    }, [scope, today])
  );

  const select = useCallback((key: QuestionKey, value: string) => {
    setAnswers((current) => ({ ...current, [key]: current[key] === value ? undefined : value }));
    setResult(null);
  }, []);

  const answeredCount = Object.values(answers).filter((value) => value != null).length;

  const handleSave = useCallback(() => {
    const evaluated = evaluateEveningCloseout(today, answers);
    setResult(evaluated);
    void localEveningCloseoutStore.write(scope, { answers, result: evaluated, saved_at: new Date().toISOString() });
  }, [answers, scope, today]);

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <View style={styles.topBar}>
        <Pressable accessibilityLabel="Back" accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}>
          <Ionicons color={colors.text} name="chevron-back" size={22} />
        </Pressable>
        <Text style={styles.topTitle}>Evening closeout</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.intro}>A short check-in to close the day. Answer what you can — anything you skip just keeps confidence lower.</Text>

        {QUESTIONS.map((question) => (
          <View key={question.key} style={styles.questionBlock}>
            <Text style={styles.prompt}>{question.prompt}</Text>
            <View style={styles.optionWrap}>
              {question.options.map((option) => {
                const active = answers[question.key] === option.value;
                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    key={option.value}
                    onPress={() => select(question.key, option.value)}
                    style={({ pressed }) => [styles.option, active && styles.optionActive, pressed && styles.pressed]}
                  >
                    <Text style={[styles.optionText, active && styles.optionTextActive]}>{option.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}

        <Pressable
          accessibilityRole="button"
          disabled={answeredCount === 0}
          onPress={handleSave}
          style={({ pressed }) => [
            styles.saveButton,
            answeredCount === 0 && styles.saveButtonDisabled,
            pressed && answeredCount > 0 && styles.pressed
          ]}
        >
          <Text style={styles.saveButtonText}>{result ? 'Update closeout' : 'Save closeout'}</Text>
        </Pressable>

        {result ? (
          <View style={styles.resultCard}>
            <Text style={styles.resultEyebrow}>Today’s closeout</Text>
            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>Plan</Text>
              <Text style={styles.resultValue}>{ADHERENCE_LABEL[result.adherence_label]}</Text>
            </View>
            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>Body response</Text>
              <Text style={styles.resultValue}>{RESPONSE_LABEL[result.response_label]}</Text>
            </View>
            {result.next_day_adjustments.length > 0 ? (
              <View style={styles.adjustments}>
                <Text style={styles.adjustTitle}>Tomorrow</Text>
                {result.next_day_adjustments.map((adjustment) => (
                  <View key={adjustment.id} style={styles.adjustRow}>
                    <Ionicons color={colors.accentMid} name="arrow-forward-circle-outline" size={16} />
                    <View style={styles.adjustCopy}>
                      <Text style={styles.adjustHeading}>{adjustment.title}</Text>
                      <Text style={styles.adjustDetail}>{adjustment.detail}</Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.adjustDetail}>No changes suggested for tomorrow — nicely done.</Text>
            )}
            <Text style={styles.footnote}>General wellness guidance based on your available data.</Text>
          </View>
        ) : null}
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
  scroll: { gap: spacing.lg, paddingBottom: 96, paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  intro: { ...type.body, color: colors.textMuted },
  questionBlock: { gap: 10 },
  prompt: { ...type.label, color: colors.text },
  optionWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: {
    borderColor: colors.hairline,
    borderRadius: radii.full,
    borderWidth: hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  optionActive: { backgroundColor: colors.accentWash, borderColor: colors.accent },
  optionText: { ...type.caption, color: colors.textMuted },
  optionTextActive: { color: colors.accent },
  saveButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    justifyContent: 'center',
    minHeight: 52
  },
  saveButtonDisabled: { opacity: 0.5 },
  saveButtonText: { ...type.label, color: colors.textInverse },
  pressed: { opacity: 0.82 },
  resultCard: {
    ...glassSurface,
    borderColor: colors.hairline,
    borderRadius: radii.lg,
    borderWidth: hairlineWidth,
    gap: 10,
    padding: spacing.lg
  },
  resultEyebrow: { ...type.eyebrow, color: colors.textFaint },
  resultRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  resultLabel: { ...type.body, color: colors.textMuted },
  resultValue: { ...type.label, color: colors.text },
  adjustments: {
    borderTopColor: colors.hairlineSoft,
    borderTopWidth: hairlineWidth,
    gap: 10,
    marginTop: 4,
    paddingTop: 12
  },
  adjustTitle: { ...type.eyebrow, color: colors.textFaint },
  adjustRow: { alignItems: 'flex-start', flexDirection: 'row', gap: 8 },
  adjustCopy: { flex: 1, gap: 2 },
  adjustHeading: { ...type.label, color: colors.text },
  adjustDetail: { ...type.caption, color: colors.textMuted },
  footnote: { ...type.caption, color: colors.textFaint, marginTop: 4 }
});
