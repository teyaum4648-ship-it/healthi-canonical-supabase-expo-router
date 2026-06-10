import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { Screen } from '../../src/components/Screen';
import { SectionHeader } from '../../src/components/SectionHeader';
import { TextInput } from '../../src/components/TextInput';
import { useAuth } from '../../src/features/auth/AuthProvider';
import { generateBaselineProfile } from '../../src/features/onboarding/generateBaselineProfile';
import { generateLifestylePlan } from '../../src/features/onboarding/generateLifestylePlan';
import { onboardingQuestions } from '../../src/features/onboarding/onboardingQuestions';
import { supabase } from '../../src/lib/supabase';
import { colors, radii, spacing } from '../../src/styles/theme';
import type {
  OnboardingAnswerValue,
  OnboardingAnswers,
  OnboardingQuestion
} from '../../src/types/onboarding';

function isStringArray(value: OnboardingAnswerValue | undefined): value is string[] {
  return Array.isArray(value);
}

function getAnswerText(value: OnboardingAnswerValue | undefined) {
  return typeof value === 'string' ? value : '';
}

function isAnswered(question: OnboardingQuestion, value: OnboardingAnswerValue | undefined) {
  if (question.optional) {
    return true;
  }

  if (question.type === 'multi') {
    return isStringArray(value) && value.length > 0;
  }

  if (question.type === 'scale') {
    return typeof value === 'number';
  }

  return typeof value === 'string' && value.trim().length > 0;
}

function updateMultiAnswer(
  currentValue: OnboardingAnswerValue | undefined,
  selectedValue: string
) {
  const current = isStringArray(currentValue) ? currentValue : [];
  const exclusiveValues = ['none', 'no_clear_issue', 'low_stress', 'none_currently'];

  if (exclusiveValues.includes(selectedValue)) {
    return current.includes(selectedValue) ? [] : [selectedValue];
  }

  const withoutExclusiveValues = current.filter((value) => !exclusiveValues.includes(value));

  if (withoutExclusiveValues.includes(selectedValue)) {
    return withoutExclusiveValues.filter((value) => value !== selectedValue);
  }

  return [...withoutExclusiveValues, selectedValue];
}

export default function OnboardingScreen() {
  const { profile, refreshProfile, user } = useAuth();
  const [answers, setAnswers] = useState<OnboardingAnswers>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isDraftLoaded, setIsDraftLoaded] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const question = onboardingQuestions[currentIndex];
  const answer = answers[question.key];
  const draftKey = user ? `healthi:onboarding:${user.id}` : null;
  const progressPercent = ((currentIndex + 1) / onboardingQuestions.length) * 100;
  const canContinue = isAnswered(question, answer);
  const isLastQuestion = currentIndex === onboardingQuestions.length - 1;

  useEffect(() => {
    if (!draftKey) {
      return;
    }

    AsyncStorage.getItem(draftKey)
      .then((draft) => {
        if (!draft) {
          return;
        }

        const parsed = JSON.parse(draft) as {
          answers?: OnboardingAnswers;
          currentIndex?: number;
        };

        setAnswers(parsed.answers ?? {});
        setCurrentIndex(
          Math.min(parsed.currentIndex ?? 0, Math.max(onboardingQuestions.length - 1, 0))
        );
      })
      .catch(() => {
        Alert.alert('Draft unavailable', 'Your saved setup draft could not be loaded.');
      })
      .finally(() => {
        setIsDraftLoaded(true);
      });
  }, [draftKey]);

  useEffect(() => {
    if (!draftKey || !isDraftLoaded) {
      return;
    }

    AsyncStorage.setItem(draftKey, JSON.stringify({ answers, currentIndex })).catch(() => {
      // Local draft failure should not block the user from continuing.
    });
  }, [answers, currentIndex, draftKey, isDraftLoaded]);

  useEffect(() => {
    if (!user?.id || profile?.onboarding_status !== 'not_started') {
      return;
    }

    void (async () => {
      try {
        const { error } = await supabase
          .from('profiles')
          .update({ onboarding_status: 'in_progress' })
          .eq('id', user.id);

        if (error) {
          throw error;
        }
      } catch {
        // The completed submission updates this status again; this is only a helpful marker.
      }
    })();
  }, [profile?.onboarding_status, user?.id]);

  const sectionLabel = useMemo(
    () => `${question.section} ${currentIndex + 1}/${onboardingQuestions.length}`,
    [currentIndex, question.section]
  );

  function setAnswer(value: OnboardingAnswerValue) {
    setAnswers((current) => ({
      ...current,
      [question.key]: value
    }));
  }

  function handleBack() {
    setCurrentIndex((index) => Math.max(index - 1, 0));
  }

  function handleNext() {
    if (!canContinue) {
      Alert.alert('One detail needed', 'Choose an answer to continue.');
      return;
    }

    if (isLastQuestion) {
      void submitOnboarding();
      return;
    }

    setCurrentIndex((index) => index + 1);
  }

  async function submitOnboarding() {
    if (!user?.id || !draftKey) {
      return;
    }

    setIsSubmitting(true);

    try {
      const baselineProfile = generateBaselineProfile({
        userId: user.id,
        answers
      });
      const lifestylePlanResult = generateLifestylePlan(answers);

      const { data: session, error: sessionError } = await supabase
        .from('assessment_sessions')
        .insert({
          user_id: user.id,
          assessment_type: 'holistic_onboarding',
          status: 'completed',
          completed_at: new Date().toISOString(),
          metadata: { question_count: onboardingQuestions.length }
        })
        .select('id')
        .single();

      if (sessionError) {
        throw sessionError;
      }

      const answerRows = onboardingQuestions.map((item) => ({
        session_id: session.id,
        user_id: user.id,
        question_key: item.key,
        answer: { value: answers[item.key] ?? null }
      }));

      const { error: answersError } = await supabase.from('assessment_answers').insert(answerRows);

      if (answersError) {
        throw answersError;
      }

      const { error: baselineError } = await supabase.from('baseline_profiles').insert({
        ...baselineProfile,
        generated_at: new Date().toISOString()
      });

      if (baselineError) {
        throw baselineError;
      }

      const { error: planError } = await supabase.from('onboarding_plan_results').insert({
        user_id: user.id,
        assessment_session_id: session.id,
        archetype: lifestylePlanResult.archetype,
        metabolic_type: lifestylePlanResult.scores.metabolicType,
        dimension_scores: lifestylePlanResult.scores,
        tags: lifestylePlanResult.tags,
        plan: lifestylePlanResult.plan,
        raw_result: lifestylePlanResult
      });

      if (planError) {
        throw planError;
      }

      const foodConstraintRows = baselineProfile.food_constraints.map((constraint) => {
        const isAllergy = constraint.startsWith('allergy:');

        return {
          user_id: user.id,
          constraint_type: isAllergy ? 'allergy' : 'preference',
          constraint_value: isAllergy ? constraint.replace('allergy:', '') : constraint,
          severity: isAllergy ? 'allergy' : 'preference'
        };
      });

      if (foodConstraintRows.length > 0) {
        const { error: constraintsError } = await supabase
          .from('food_constraints')
          .insert(foodConstraintRows);

        if (constraintsError) {
          throw constraintsError;
        }
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          onboarding_status: 'completed',
          primary_goal: baselineProfile.primary_goal,
          training_experience: baselineProfile.training_capacity.experience
        })
        .eq('id', user.id);

      if (profileError) {
        throw profileError;
      }

      await AsyncStorage.removeItem(draftKey);
      await refreshProfile();
      router.replace('/(app)/(tabs)');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to save onboarding right now.';
      Alert.alert('Setup could not be saved', message);
    } finally {
      setIsSubmitting(false);
    }
  }

  function renderAnswerControl() {
    if (question.type === 'scale') {
      const min = question.min ?? 1;
      const max = question.max ?? 10;
      const values = Array.from({ length: max - min + 1 }, (_item, index) => min + index);

      return (
        <View style={styles.scaleGrid}>
          {values.map((value) => {
            const selected = answer === value;

            return (
              <Pressable
                accessibilityRole="adjustable"
                accessibilityState={{ selected }}
                key={value}
                onPress={() => setAnswer(value)}
                style={({ pressed }) => [
                  styles.scaleOption,
                  selected ? styles.scaleOptionSelected : null,
                  pressed ? styles.optionPressed : null
                ]}
              >
                <Text
                  style={[styles.scaleOptionLabel, selected ? styles.optionLabelSelected : null]}
                >
                  {value}
                </Text>
              </Pressable>
            );
          })}
        </View>
      );
    }

    if (question.type === 'text' || question.type === 'time') {
      return (
        <TextInput
          autoCapitalize="sentences"
          label={question.type === 'time' ? 'Time' : 'Answer'}
          onChangeText={setAnswer}
          placeholder={question.type === 'time' ? '07:00' : 'Add a note'}
          value={getAnswerText(answer)}
        />
      );
    }

    return (
      <View style={styles.options}>
        {question.options?.map((option) => {
          const selected =
            question.type === 'multi'
              ? isStringArray(answer) && answer.includes(option.value)
              : answer === option.value;

          return (
            <Pressable
              accessibilityRole={question.type === 'multi' ? 'checkbox' : 'radio'}
              accessibilityState={{ checked: selected }}
              key={option.value}
              onPress={() => {
                setAnswer(
                  question.type === 'multi'
                    ? updateMultiAnswer(answer, option.value)
                    : option.value
                );
              }}
              style={({ pressed }) => [
                styles.option,
                selected ? styles.optionSelected : null,
                pressed ? styles.optionPressed : null
              ]}
            >
              <Text style={[styles.optionLabel, selected ? styles.optionLabelSelected : null]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    );
  }

  if (!isDraftLoaded) {
    return (
      <Screen scroll={false}>
        <SectionHeader title="Healthi" body="Loading your setup." />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
      </View>

      <SectionHeader eyebrow={sectionLabel} title="Set up your baseline" body={question.prompt} />

      <Card>
        {currentIndex === 0 ? (
          <Text style={styles.helper}>
            The more you tell us now, the more specific your first plan can be.
          </Text>
        ) : null}
        {question.helper ? <Text style={styles.helper}>{question.helper}</Text> : null}
        {renderAnswerControl()}
      </Card>

      <View style={styles.actions}>
        <Button
          disabled={currentIndex === 0 || isSubmitting}
          label="Back"
          onPress={handleBack}
          style={styles.actionButton}
          variant="secondary"
        />
        <Button
          disabled={!canContinue}
          isLoading={isSubmitting}
          label={isLastQuestion ? 'Finish setup' : 'Next'}
          onPress={handleNext}
          style={styles.actionButton}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  progressTrack: {
    height: 8,
    overflow: 'hidden',
    borderRadius: radii.md,
    backgroundColor: colors.surfaceMuted
  },
  progressFill: {
    height: '100%',
    borderRadius: radii.md,
    backgroundColor: colors.primary
  },
  helper: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20
  },
  options: {
    gap: spacing.sm
  },
  scaleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm
  },
  scaleOption: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surface
  },
  scaleOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceMuted
  },
  scaleOptionLabel: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800'
  },
  option: {
    minHeight: 48,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  optionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceMuted
  },
  optionPressed: {
    opacity: 0.82
  },
  optionLabel: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700'
  },
  optionLabelSelected: {
    color: colors.primary
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm
  },
  actionButton: {
    flex: 1
  }
});
