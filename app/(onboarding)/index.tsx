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
import { generateBiweeklyFocusProfile } from '../../src/features/onboarding/generateBiweeklyFocusProfile';
import { generateLifestylePlan } from '../../src/features/onboarding/generateLifestylePlan';
import { onboardingQuestions } from '../../src/features/onboarding/onboardingQuestions';
import {
  normalizeTimeAnswer,
  onboardingSteps,
  requiredQuestions
} from '../../src/features/onboarding/onboardingSteps';
import { onboardingV2FocusLabels, onboardingV2Welcome } from '../../src/features/onboarding/onboardingV2Copy';
import { generateOnboardingV2Result } from '../../src/features/onboarding/onboardingV2Model';
import type { OnboardingV2Result } from '../../src/features/onboarding/onboardingV2Types';
import { isSupabaseConfigured, supabase } from '../../src/lib/supabase';
import { subscriptionsEnabled } from '../../src/features/subscriptions/revenuecat';
import { colors, fonts, radii, spacing, glassSurface } from '../../src/styles/mobileTheme';
import type {
  BiweeklyFocusProfile,
  DynamicScoreSheet,
  FoundationDomain,
  OnboardingAnswerValue,
  OnboardingAnswers,
  PriorityBand,
  OnboardingQuestion
} from '../../src/types/onboarding';

const isDemoMode = process.env.EXPO_PUBLIC_DEMO_MODE === 'true';
const shouldUseLocalOnboarding = isDemoMode || !isSupabaseConfigured;
const demoOnboardingCompletedKey = 'healthi:demo:onboardingCompleted';
const demoOnboardingResultKey = 'healthi:demo:onboardingResult';

function isStringArray(value: OnboardingAnswerValue | undefined): value is string[] {
  return Array.isArray(value);
}

function getAnswerText(value: OnboardingAnswerValue | undefined) {
  return typeof value === 'string' ? value : '';
}

function isValidTime(value: OnboardingAnswerValue | undefined): boolean {
  return normalizeTimeAnswer(value) !== null;
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

  if (question.type === 'time') {
    return isValidTime(value);
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

const focusLabels: Record<FoundationDomain, string> = {
  recovery_rhythm: 'Recovery + Rhythm',
  nourishment: 'Nourishment',
  movement_capacity: 'Movement Capacity',
  mind_life_load: 'Mind + Life Load',
  balanced: 'Balanced'
};

const focusSummaries: Record<FoundationDomain, string> = {
  recovery_rhythm:
    'Your answers suggest Recovery + Rhythm should be your first calibration focus. For the next 2 weeks, daywoven will bias your plan toward steadier sleep timing, calmer wind-down, and better recovery spacing before pushing progression.',
  nourishment:
    'Your answers suggest Nourishment should be your first calibration focus. For the next 2 weeks, daywoven will bias your plan toward steadier hydration, meal rhythm, digestion support, and energy consistency before increasing demand.',
  movement_capacity:
    'Your answers suggest Movement Capacity should be your first calibration focus. For the next 2 weeks, daywoven will bias your plan toward movement quality, confidence, and consistency before adding more load.',
  mind_life_load:
    'Your answers suggest Mind + Life Load should be your first calibration focus. For the next 2 weeks, daywoven will bias your plan toward lower friction, decompression, and consistency that fits your current life load.',
  balanced:
    'Your answers suggest a balanced first calibration. For the next 2 weeks, daywoven will keep your plan steady while it learns which levers matter most for you.'
};

const baselineModeLabels: Record<OnboardingV2Result['baseline_mode'], string> = {
  build: 'Build',
  maintain: 'Maintain',
  correct: 'Steady reset',
  restore: 'Restore',
  professional_guidance: 'Guided'
};

const trainingBiasLabels: Record<BiweeklyFocusProfile['training_bias'], string> = {
  normal_progression: 'Build consistency with normal progression.',
  reduce_intensity: 'Keep intensity conservative while the first focus stabilizes.',
  increase_recovery_spacing: 'Add more recovery spacing between harder efforts.',
  movement_quality_first: 'Prioritize movement quality before adding load.',
  consistency_first: 'Favor repeatable sessions over aggressive progression.',
  stress_adapted_training: 'Use training that fits current stress and schedule load.'
};

const lifestyleBiasLabels: Record<BiweeklyFocusProfile['lifestyle_bias'], string> = {
  circadian_consistency: 'Anchor sleep and wake timing where possible.',
  hydration_and_meal_rhythm: 'Make hydration and meal rhythm easier to repeat.',
  stress_decompression: 'Protect small daily decompression windows.',
  movement_restoration: 'Add low-friction movement restoration through the day.',
  balanced: 'Keep lifestyle guidance simple while calibration continues.'
};

const nourishmentBiasLabels: Record<BiweeklyFocusProfile['nourishment_bias'], string> = {
  hydration_first: 'Start with hydration consistency.',
  meal_rhythm_first: 'Make meal timing steadier.',
  digestion_support: 'Keep meals simple and track response patterns.',
  protein_energy_adequacy: 'Support protein and energy adequacy.',
  food_constraints_awareness: 'Keep food constraints visible.',
  balanced: 'Keep food and hydration guidance balanced.'
};

const recoveryBiasLabels: Record<BiweeklyFocusProfile['recovery_bias'], string> = {
  sleep_timing: 'Start with a steadier sleep window.',
  wind_down: 'Support an easier wind-down routine.',
  morning_light: 'Use morning light to anchor rhythm.',
  caffeine_cutoff: 'Make caffeine timing more intentional.',
  recovery_spacing: 'Space recovery before harder efforts.',
  balanced: 'Keep recovery guidance balanced.'
};

function formatConfidence(confidence: BiweeklyFocusProfile['confidence']) {
  return `${confidence[0].toUpperCase()}${confidence.slice(1)} confidence`;
}

function formatDate(dateString: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(new Date(`${dateString}T00:00:00`));
}

function priorityColor(priority: PriorityBand) {
  if (priority === 'high') {
    return colors.signalCoral;
  }

  if (priority === 'moderate') {
    return colors.signalAmber;
  }

  return colors.signalGreen;
}

function formatPriority(priority: PriorityBand) {
  return `${priority[0].toUpperCase()}${priority.slice(1)} priority`;
}

function focusCopyLabel(focus: FoundationDomain) {
  if (focus === 'balanced') {
    return 'Balanced calibration';
  }

  return focusLabels[focus];
}

function renderScoreSheet(focusProfile: BiweeklyFocusProfile) {
  const scoreSheet = focusProfile.dynamic_score_sheet;
  const scoreColor = priorityColor(scoreSheet.overall_priority);
  const domainScores = [
    scoreSheet.domain_scores.recovery_rhythm,
    scoreSheet.domain_scores.nourishment,
    scoreSheet.domain_scores.mind_life_load,
    scoreSheet.domain_scores.movement_capacity
  ];

  return (
    <Card style={styles.scoreSheet}>
      <View style={styles.scoreGlowOne} />
      <View style={styles.scoreGlowTwo} />

      <View style={styles.scoreSheetHeader}>
        <Text style={styles.scoreSheetEyebrow}>daywoven Review</Text>
        <Text style={styles.scoreSheetTitle}>Your Score Sheet</Text>
        <Text style={styles.scoreSheetSubtitle}>
          Your answers were weighted to identify the strongest signals shaping your next 2-week
          focus.
        </Text>
      </View>

      <View style={styles.scoreSummary}>
        <View style={[styles.scoreCircle, { borderColor: scoreColor }]}>
          <View style={[styles.scoreAura, { backgroundColor: scoreColor }]} />
          <Text style={[styles.scorePriority, { color: scoreColor }]}>
            {formatPriority(scoreSheet.overall_priority)}
          </Text>
          <Text style={styles.scoreFocus}>{focusCopyLabel(focusProfile.primary_focus)}</Text>
          <Text style={styles.scoreCalibration}>Strongest signal for your next 2 weeks</Text>
          <Text style={styles.scoreValue}>Signal {scoreSheet.overall_score}</Text>
        </View>

        <View style={styles.domainGrid}>
          {domainScores.map((domain) => {
            const domainColor = priorityColor(domain.priority);
            const leadReason = domain.reasons[0]?.label ?? 'Calibration signal is still forming.';

            return (
              <View key={domain.label} style={styles.domainCard}>
                <View style={styles.domainTopRow}>
                  <View style={[styles.domainIndicator, { backgroundColor: domainColor }]} />
                  <Text style={[styles.domainPriority, { color: domainColor }]}>
                    {domain.priority}
                  </Text>
                </View>
                <Text style={styles.domainLabel}>{domain.label}</Text>
                <Text style={styles.domainSignal}>Signal {domain.score}</Text>
                <Text style={styles.domainReason}>{leadReason}</Text>
              </View>
            );
          })}
        </View>
      </View>

      <View style={styles.scoreSection}>
        <Text style={styles.scoreSectionTitle}>Top Signals</Text>
        {scoreSheet.ranked_reasons.length > 0 ? (
          scoreSheet.ranked_reasons.slice(0, 4).map((reason, index) => (
            <View key={`${reason.domain}-${reason.reason_code}-${index}`} style={styles.rankRow}>
              <View style={styles.rankNumber}>
                <Text style={styles.rankNumberText}>{index + 1}</Text>
              </View>
              <View style={styles.rankTextWrap}>
                <Text style={styles.rankDomain}>{focusLabels[reason.domain]}</Text>
                <Text style={styles.rankLabel}>{reason.label}</Text>
                <Text style={styles.rankExplanation}>{reason.explanation}</Text>
              </View>
              <Text style={styles.rankImpact}>Impact {reason.impact_score}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.rankExplanation}>
            No single signal strongly dominated. daywoven will keep the first cycle balanced while
            calibration continues.
          </Text>
        )}
      </View>

      <View style={styles.scoreSection}>
        <Text style={styles.scoreSectionTitle}>What daywoven will prioritize</Text>
        <Text style={styles.scoreMeaning}>{scoreSheet.summary}</Text>
      </View>
    </Card>
  );
}

export default function OnboardingScreen() {
  const { profile, refreshProfile, user, mode } = useAuth();
  const [answers, setAnswers] = useState<OnboardingAnswers>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [focusProfile, setFocusProfile] = useState<BiweeklyFocusProfile | null>(null);
  const [setupResult, setSetupResult] = useState<OnboardingV2Result | null>(null);
  const [resultStage, setResultStage] = useState<'baseline' | 'focus'>('baseline');
  const [isDraftLoaded, setIsDraftLoaded] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const step = onboardingSteps[Math.min(currentIndex, onboardingSteps.length - 1)];
  const draftKey = user ? `healthi:onboarding:${user.id}` : null;
  const progressPercent = ((currentIndex + 1) / onboardingSteps.length) * 100;
  // A step advances once its required questions are answered; optional detail can be left.
  const unanswered = requiredQuestions(step).filter((item) => !isAnswered(item, answers[item.key]));
  const canContinue = unanswered.length === 0;
  const isLastStep = currentIndex === onboardingSteps.length - 1;

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
          Math.min(parsed.currentIndex ?? 0, Math.max(onboardingSteps.length - 1, 0))
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
    () => `Step ${currentIndex + 1} of ${onboardingSteps.length}`,
    [currentIndex]
  );

  function setAnswer(key: OnboardingQuestion['key'], value: OnboardingAnswerValue) {
    setAnswers((current) => ({
      ...current,
      [key]: value
    }));
  }

  function handleBack() {
    setCurrentIndex((index) => Math.max(index - 1, 0));
  }

  function handleNext() {
    // The button is disabled while anything required is missing, so there is nothing
    // to alert about; the unanswered prompts are named inline instead.
    if (!canContinue) return;

    if (isLastStep) {
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
      const onboardingV2Result = generateOnboardingV2Result({ answers });
      const lifestylePlanResult = generateLifestylePlan(answers);
      const biweeklyFocusProfile = generateBiweeklyFocusProfile({
        userId: user.id,
        answers
      });

      if (shouldUseLocalOnboarding) {
        await AsyncStorage.setItem(
          demoOnboardingResultKey,
          JSON.stringify({
            answers,
            baselineProfile,
            onboardingV2Result,
            lifestylePlanResult,
            biweeklyFocusProfile
          })
        );
        await AsyncStorage.setItem(demoOnboardingCompletedKey, 'true');
        await AsyncStorage.removeItem(draftKey);
        setSetupResult(onboardingV2Result);
        setFocusProfile(biweeklyFocusProfile);
        return;
      }

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
        raw_result: {
          ...lifestylePlanResult,
          onboarding_v2: onboardingV2Result,
          biweekly_focus_profile: biweeklyFocusProfile
        }
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
      setSetupResult(onboardingV2Result);
      setFocusProfile(biweeklyFocusProfile);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to save onboarding right now.';
      Alert.alert('Setup could not be saved', message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleContinueFromFocus() {
    await refreshProfile();
    router.replace(subscriptionsEnabled && mode === 'account' ? '/paywall' : '/(app)/(tabs)');
  }

  function renderAnswerControl(question: OnboardingQuestion) {
    const answer = answers[question.key];

    if (question.type === 'scale') {
      // Labelled buckets where the question supplies them: the model compares these
      // against thresholds rather than reading the exact number, so three words beat
      // ten digits. Questions without buckets keep the full row.
      if (question.scaleLabels?.length) {
        return (
          <View style={styles.options}>
            {question.scaleLabels.map((bucket) => {
              const selected = answer === bucket.value;

              return (
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  key={bucket.value}
                  onPress={() => setAnswer(question.key, bucket.value)}
                  style={({ pressed }) => [
                    styles.option,
                    selected ? styles.optionSelected : null,
                    pressed ? styles.optionPressed : null
                  ]}
                >
                  <Text style={[styles.optionLabel, selected ? styles.optionLabelSelected : null]}>
                    {bucket.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        );
      }

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
                onPress={() => setAnswer(question.key, value)}
                style={({ pressed }) => [
                  styles.scaleOption,
                  selected ? styles.scaleOptionSelected : null,
                  pressed ? styles.optionPressed : null
                ]}
              >
                <Text style={[styles.scaleOptionLabel, selected ? styles.optionLabelSelected : null]}>
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
          keyboardType={question.type === 'time' ? 'numbers-and-punctuation' : 'default'}
          label={question.type === 'time' ? 'Time' : 'Answer'}
          onChangeText={(value) => setAnswer(question.key, value)}
          placeholder={question.type === 'time' ? '10:30pm' : 'Add a note'}
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
                if (question.type === 'multi') {
                  const current = isStringArray(answer) ? answer : [];
                  setAnswer(
                    question.key,
                    current.includes(option.value)
                      ? current.filter((item) => item !== option.value)
                      : [...current, option.value]
                  );
                  return;
                }
                setAnswer(question.key, option.value);
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

  /** One question, with its prompt, so a step can stack several of them. */
  function renderQuestion(question: OnboardingQuestion) {
    const answer = answers[question.key];
    const needsTimeFormat =
      question.type === 'time' && getAnswerText(answer).length > 0 && !isValidTime(answer);

    return (
      <Card key={question.key} style={styles.questionCard}>
        <Text style={styles.questionPrompt}>
          {question.prompt}
          {question.optional ? <Text style={styles.optionalTag}>  Optional</Text> : null}
        </Text>
        {question.helper ? <Text style={styles.helper}>{question.helper}</Text> : null}
        {renderAnswerControl(question)}
        {needsTimeFormat ? (
          <Text style={styles.timeHint}>That one did not read as a time. Try 10:30pm, 22:30 or 2230.</Text>
        ) : null}
      </Card>
    );
  }

  if (!isDraftLoaded) {
    return (
      <Screen scroll={false}>
        <SectionHeader title="daywoven" body="Loading your setup." />
      </Screen>
    );
  }

  if (focusProfile && resultStage === 'focus') {
    const topReasons =
      focusProfile.top_limiting_factors.length > 0
        ? focusProfile.top_limiting_factors
        : ['daywoven is still calibrating from your first answers.'];

    return (
      <Screen contentStyle={styles.resultScreen}>
        {renderScoreSheet(focusProfile)}

        <View style={styles.focusHeader}>
          <Text style={styles.focusHeaderEyebrow}>14-day calibration</Text>
          <Text style={styles.focusHeaderTitle}>Your 2-Week Focus</Text>
          <Text style={styles.focusHeaderBody}>{focusSummaries[focusProfile.primary_focus]}</Text>
        </View>

        <Card style={styles.focusCard}>
          <Text style={styles.focusLabel}>Primary focus</Text>
          <Text style={styles.focusTitle}>{focusLabels[focusProfile.primary_focus]}</Text>
          {focusProfile.secondary_focus ? (
            <Text style={styles.focusSecondary}>
              Also watching {focusLabels[focusProfile.secondary_focus]}
            </Text>
          ) : null}
        </Card>

        <Card style={styles.resultPanel}>
          <Text style={styles.cardTitle}>Top reasons</Text>
          {topReasons.slice(0, 3).map((reason) => (
            <View key={reason} style={styles.reasonRow}>
              <View style={styles.reasonDot} />
              <Text style={styles.reasonText}>{reason}</Text>
            </View>
          ))}
        </Card>

        <Card style={styles.resultPanel}>
          <Text style={styles.cardTitle}>What this changes</Text>
          <View style={styles.changeRow}>
            <Text style={styles.changeLabel}>Training</Text>
            <Text style={styles.changeText}>{trainingBiasLabels[focusProfile.training_bias]}</Text>
          </View>
          <View style={styles.changeRow}>
            <Text style={styles.changeLabel}>Lifestyle</Text>
            <Text style={styles.changeText}>
              {lifestyleBiasLabels[focusProfile.lifestyle_bias]}
            </Text>
          </View>
          <View style={styles.changeRow}>
            <Text style={styles.changeLabel}>Food / hydration</Text>
            <Text style={styles.changeText}>
              {nourishmentBiasLabels[focusProfile.nourishment_bias]}
            </Text>
          </View>
          <View style={styles.changeRow}>
            <Text style={styles.changeLabel}>Recovery</Text>
            <Text style={styles.changeText}>{recoveryBiasLabels[focusProfile.recovery_bias]}</Text>
          </View>
        </Card>

        <Card style={styles.resultPanel}>
          <Text style={styles.confidenceText}>{formatConfidence(focusProfile.confidence)}</Text>
          <Text style={styles.reassessmentText}>
            Reassessment due {formatDate(focusProfile.reassessment_due_at)}
          </Text>
        </Card>

        <Button label={subscriptionsEnabled && mode === 'account' ? 'Continue to membership' : 'Continue to daywoven'} onPress={handleContinueFromFocus} />
      </Screen>
    );
  }

  if (setupResult) {
    return (
      <Screen contentStyle={styles.resultScreen}>
        <View style={styles.focusHeader}>
          <Text style={styles.focusHeaderEyebrow}>Baseline setup complete</Text>
          <Text style={styles.focusHeaderTitle}>Your starting point</Text>
          <Text style={styles.focusHeaderBody}>{setupResult.summary}</Text>
        </View>

        <Card style={styles.focusCard}>
          <Text style={styles.focusLabel}>Suggested daywoven mode</Text>
          <Text style={styles.focusTitle}>{baselineModeLabels[setupResult.baseline_mode]}</Text>
          <Text style={styles.focusSecondary}>
            First focus: {onboardingV2FocusLabels[setupResult.primary_focus]}
          </Text>
        </Card>

        <Card style={styles.resultPanel}>
          <Text style={styles.cardTitle}>What daywoven is watching first</Text>
          {setupResult.calibration_hints.map((hint) => (
            <View key={hint.domain} style={styles.setupHintRow}>
              <View style={[styles.reasonDot, hint.priority >= 45 ? styles.reasonDotHigh : null]} />
              <View style={styles.rankTextWrap}>
                <Text style={styles.rankDomain}>{hint.label}</Text>
                <Text style={styles.rankExplanation}>{hint.detail}</Text>
              </View>
            </View>
          ))}
        </Card>

        <Card style={styles.resultPanel}>
          <Text style={styles.cardTitle}>Your first next steps</Text>
          {setupResult.next_steps.map((step) => (
            <View key={step.id} style={styles.setupHintRow}>
              <View style={styles.reasonDot} />
              <View style={styles.rankTextWrap}>
                <Text style={styles.rankDomain}>{step.title}</Text>
                <Text style={styles.rankExplanation}>{step.detail}</Text>
              </View>
            </View>
          ))}
        </Card>

        <Card style={styles.resultPanel}>
          <Text style={styles.confidenceText}>{formatConfidence(setupResult.confidence)}</Text>
          <Text style={styles.reassessmentText}>
            You can change these details later. daywoven will keep calibrating from your logged data.
          </Text>
        </Card>

        <Button label="See my full score and two-week focus" onPress={() => setResultStage('focus')} />
      </Screen>
    );
  }

  return (
    <Screen>
      {mode === 'account' ? <Button label="Delete account" variant="secondary" disabled={isSubmitting} onPress={() => router.push('/account/delete')} /> : null}
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
      </View>

      <SectionHeader eyebrow={sectionLabel} title={step.title} body={step.intro} />

      {currentIndex === 0 ? <Text style={styles.helper}>{onboardingV2Welcome}</Text> : null}

      {step.questions.map(renderQuestion)}

      {unanswered.length > 0 ? (
        <Text accessibilityRole="alert" style={styles.helper}>
          Still needed: {unanswered.map((item) => item.prompt).join(' ')}
        </Text>
      ) : null}

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
          label={isLastStep ? 'Review your baseline' : 'Next'}
          onPress={handleNext}
          style={styles.actionButton}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  questionCard: {
    gap: spacing.sm
  },
  questionPrompt: {
    color: colors.text,
    fontFamily: fonts.bodyMedium,
    fontSize: 17,
    lineHeight: 24
  },
  optionalTag: {
    color: colors.textFaint,
    fontFamily: fonts.body,
    fontSize: 13
  },
  progressTrack: {
    height: 4,
    overflow: 'hidden',
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceMuted
  },
  progressFill: {
    height: '100%',
    borderRadius: radii.sm,
    backgroundColor: colors.primary
  },
  helper: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 22
  },
  timeHint: {
    color: colors.signalAmber,
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 18
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
    borderRadius: radii.sm,
    ...glassSurface
  },
  scaleOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceMuted
  },
  scaleOptionLabel: {
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: 18,
    fontWeight: '400'
  },
  option: {
    minHeight: 48,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    ...glassSurface,
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
    fontFamily: fonts.body,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 21
  },
  optionLabelSelected: {
    color: colors.deepViolet
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm
  },
  actionButton: {
    flex: 1
  },
  resultScreen: {
    backgroundColor: colors.midnightPlum
  },
  scoreSheet: {
    position: 'relative',
    gap: spacing.lg,
    overflow: 'hidden',
    borderColor: 'rgba(239, 232, 255, 0.12)',
    borderRadius: radii.xl,
    backgroundColor: colors.plum,
    padding: spacing.lg
  },
  scoreGlowOne: {
    position: 'absolute',
    top: -64,
    right: -44,
    width: 168,
    height: 168,
    borderRadius: 84,
    backgroundColor: 'rgba(111, 97, 168, 0.22)'
  },
  scoreGlowTwo: {
    position: 'absolute',
    bottom: 120,
    left: -52,
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: 'rgba(111, 175, 142, 0.14)'
  },
  scoreSheetHeader: {
    gap: spacing.xs,
    position: 'relative'
  },
  scoreSheetEyebrow: {
    color: colors.signalGold,
    fontFamily: fonts.body,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0
  },
  scoreSheetTitle: {
    color: colors.cosmicWhite,
    fontFamily: fonts.display,
    fontSize: 42,
    fontWeight: '400',
    lineHeight: 46
  },
  scoreSheetSubtitle: {
    color: colors.mutedViolet,
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 23
  },
  scoreSummary: {
    gap: spacing.md,
    position: 'relative'
  },
  scoreCircle: {
    width: 214,
    minHeight: 214,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    overflow: 'hidden',
    borderWidth: 2,
    borderRadius: 107,
    backgroundColor: 'rgba(19, 10, 33, 0.74)',
    paddingHorizontal: spacing.lg
  },
  scoreAura: {
    position: 'absolute',
    width: 118,
    height: 118,
    borderRadius: 59,
    opacity: 0.13
  },
  scoreValue: {
    color: colors.mutedViolet,
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0,
    marginTop: spacing.xs
  },
  scorePriority: {
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0
  },
  scoreFocus: {
    color: colors.cosmicWhite,
    fontFamily: fonts.display,
    fontSize: 28,
    fontWeight: '400',
    lineHeight: 31,
    textAlign: 'center'
  },
  scoreCalibration: {
    color: colors.mutedViolet,
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center'
  },
  domainGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    position: 'relative'
  },
  domainCard: {
    flexGrow: 1,
    flexBasis: '47%',
    minHeight: 150,
    alignItems: 'stretch',
    justifyContent: 'space-between',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(239, 232, 255, 0.1)',
    borderRadius: radii.lg,
    backgroundColor: 'rgba(248, 245, 255, 0.07)',
    padding: spacing.md
  },
  domainTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm
  },
  domainIndicator: {
    width: 9,
    height: 9,
    borderRadius: 5
  },
  domainCircle: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderRadius: 24
  },
  domainScore: {
    color: colors.deepViolet,
    fontFamily: fonts.display,
    fontSize: 20,
    fontWeight: '400'
  },
  domainLabel: {
    color: colors.cosmicWhite,
    fontFamily: fonts.display,
    fontSize: 19,
    fontWeight: '400',
    lineHeight: 22
  },
  domainSignal: {
    color: colors.mutedViolet,
    fontFamily: fonts.body,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0
  },
  domainReason: {
    color: colors.mutedViolet,
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 17
  },
  domainPriority: {
    fontFamily: fonts.body,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0
  },
  scoreSection: {
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(239, 232, 255, 0.1)',
    paddingTop: spacing.md
  },
  scoreSectionTitle: {
    color: colors.cosmicWhite,
    fontFamily: fonts.display,
    fontSize: 24,
    fontWeight: '400'
  },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(239, 232, 255, 0.1)',
    borderRadius: radii.lg,
    backgroundColor: 'rgba(248, 245, 255, 0.07)',
    padding: spacing.sm
  },
  rankNumber: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: 'rgba(248, 245, 255, 0.13)'
  },
  rankNumberText: {
    color: '#FFFFFF',
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center'
  },
  rankTextWrap: {
    flex: 1,
    gap: 2
  },
  rankDomain: {
    color: colors.signalGold,
    fontFamily: fonts.body,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0
  },
  rankLabel: {
    color: colors.cosmicWhite,
    fontFamily: fonts.body,
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 19
  },
  rankExplanation: {
    color: colors.mutedViolet,
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 19
  },
  rankImpact: {
    minWidth: 54,
    color: colors.mutedViolet,
    fontFamily: fonts.body,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    textAlign: 'right'
  },
  scoreMeaning: {
    color: colors.mutedViolet,
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 23
  },
  focusHeader: {
    gap: spacing.xs,
    paddingTop: spacing.sm
  },
  focusHeaderEyebrow: {
    color: colors.signalGold,
    fontFamily: fonts.body,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0
  },
  focusHeaderTitle: {
    color: colors.cosmicWhite,
    fontFamily: fonts.display,
    fontSize: 36,
    fontWeight: '400',
    lineHeight: 40
  },
  focusHeaderBody: {
    color: colors.mutedViolet,
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 24
  },
  focusCard: {
    gap: spacing.xs,
    borderRadius: radii.lg,
    borderColor: 'rgba(239, 232, 255, 0.1)',
    backgroundColor: 'rgba(248, 245, 255, 0.08)'
  },
  resultPanel: {
    borderRadius: radii.lg,
    borderColor: 'rgba(239, 232, 255, 0.1)',
    backgroundColor: 'rgba(248, 245, 255, 0.07)'
  },
  focusLabel: {
    color: colors.signalGold,
    fontFamily: fonts.body,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0
  },
  focusTitle: {
    color: colors.cosmicWhite,
    fontFamily: fonts.display,
    fontSize: 38,
    fontWeight: '400',
    lineHeight: 42
  },
  focusSecondary: {
    color: colors.mutedViolet,
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 21
  },
  cardTitle: {
    color: colors.cosmicWhite,
    fontFamily: fonts.display,
    fontSize: 22,
    fontWeight: '400'
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm
  },
  reasonDot: {
    width: 7,
    height: 7,
    marginTop: 7,
    borderRadius: 4,
    backgroundColor: colors.primary
  },
  reasonDotHigh: {
    backgroundColor: colors.signalAmber
  },
  setupHintRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: spacing.xs
  },
  reasonText: {
    flex: 1,
    color: colors.cosmicWhite,
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 21
  },
  changeRow: {
    gap: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: 'rgba(239, 232, 255, 0.1)',
    paddingTop: spacing.sm
  },
  changeLabel: {
    color: colors.signalGold,
    fontFamily: fonts.body,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0
  },
  changeText: {
    color: colors.cosmicWhite,
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 21
  },
  confidenceText: {
    color: colors.cosmicWhite,
    fontFamily: fonts.body,
    fontSize: 16,
    fontWeight: '800'
  },
  reassessmentText: {
    color: colors.mutedViolet,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20
  }
});
