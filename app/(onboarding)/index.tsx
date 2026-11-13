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
// Anonymous answers never leave the device. They are only uploaded after signup consent.
const guestOnboardingDraftKey = 'daywoven:onboarding:guest-preview';

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
  const sheet = focusProfile.dynamic_score_sheet;
  const domains = [
    sheet.domain_scores.recovery_rhythm,
    sheet.domain_scores.nourishment,
    sheet.domain_scores.mind_life_load,
    sheet.domain_scores.movement_capacity
  ];
  const topSignals = sheet.ranked_reasons.slice(0, 3);

  return (
    <View style={styles.scoreSheet}>
      <Text style={styles.scoreSheetEyebrow}>DAYWOVEN / YOUR PERSONAL REVIEW</Text>
      <Text accessibilityRole="header" style={styles.scoreSheetTitle}>A clearer place to start.</Text>
      <Text style={styles.scoreSheetSubtitle}>
        A first look at the patterns in your answers, not a diagnosis or a fixed label.
      </Text>

      <View style={styles.scoreHero}>
        <Text style={styles.scoreHeroKicker}>YOUR 14-DAY FOCUS</Text>
        <Text style={styles.scoreHeroTitle}>{focusCopyLabel(focusProfile.primary_focus)}</Text>
        <Text style={styles.scoreHeroSummary}>{sheet.summary}</Text>
        <View style={styles.scorePill}>
          <View style={styles.scorePillDot} />
          <Text style={styles.scorePillText}>{formatPriority(sheet.overall_priority)} · provisional</Text>
        </View>
      </View>

      <View style={styles.scoreSection}>
        <Text style={styles.scoreSectionTitle}>Your four foundations</Text>
        <Text style={styles.scoreSectionBody}>Higher signals suggest areas worth paying more attention to, not a judgment about your health.</Text>
        {domains.map((domain) => {
          const leadReason = domain.reasons[0]?.label ?? 'Your baseline is still forming.';
          const width = `${Math.max(3, Math.min(100, domain.score))}%` as `${number}%`;
          return (
            <View key={domain.label} style={styles.domainRow}>
              <View style={styles.domainTopRow}>
                <Text style={styles.domainLabel}>{domain.label}</Text>
                <Text style={styles.domainSignal}>Signal {domain.score}</Text>
              </View>
              <View style={styles.domainTrack}>
                <View style={[styles.domainBar, { width, backgroundColor: priorityColor(domain.priority) }]} />
              </View>
              <Text style={styles.domainReason}>{leadReason}</Text>
            </View>
          );
        })}
      </View>

      <View style={styles.scoreSection}>
        <Text style={styles.scoreSectionTitle}>What stood out</Text>
        {topSignals.length ? topSignals.map((reason, index) => (
          <View key={`${reason.domain}-${reason.reason_code}-${index}`} style={styles.rankRow}>
            <View style={styles.rankNumber}><Text style={styles.rankNumberText}>0{index + 1}</Text></View>
            <View style={styles.rankTextWrap}>
              <Text style={styles.rankDomain}>{focusLabels[reason.domain]}</Text>
              <Text style={styles.rankLabel}>{reason.label}</Text>
              <Text style={styles.rankExplanation}>{reason.explanation}</Text>
            </View>
          </View>
        )) : (
          <Text style={styles.scoreSectionBody}>Your starting signals are balanced. A few logged days will help make the picture clearer.</Text>
        )}
      </View>
    </View>
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
  const [loadedDraftKey, setLoadedDraftKey] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [previewNeedsSave, setPreviewNeedsSave] = useState(false);
  const step = onboardingSteps[Math.min(currentIndex, onboardingSteps.length - 1)];
  const draftKey = user ? `healthi:onboarding:${user.id}` : guestOnboardingDraftKey;
  const progressPercent = ((currentIndex + 1) / onboardingSteps.length) * 100;
  // A step advances once its required questions are answered; optional detail can be left.
  const unanswered = requiredQuestions(step).filter((item) => !isAnswered(item, answers[item.key]));
  const canContinue = unanswered.length === 0;
  const isLastStep = currentIndex === onboardingSteps.length - 1;

  useEffect(() => {
    let active = true;
    setIsDraftLoaded(false);
    setLoadedDraftKey(null);
    setAnswers({});
    setCurrentIndex(0);
    setSetupResult(null);
    setFocusProfile(null);
    setPreviewNeedsSave(false);
    setResultStage('baseline');
    // An existing user's private draft takes precedence over an anonymous preview.
    // Never upload a guest preview automatically: the user must choose to save it.
    void (async () => {
      try {
        const ownDraft = await AsyncStorage.getItem(draftKey);
        const guestDraft = user?.id ? await AsyncStorage.getItem(guestOnboardingDraftKey) : null;
        const rawDraft = ownDraft ?? guestDraft;
        if (!rawDraft || !active) return;

        const parsed = JSON.parse(rawDraft) as {
          answers?: OnboardingAnswers;
          currentIndex?: number;
          previewComplete?: boolean;
        };
        const restoredAnswers = parsed.answers ?? {};
        if (!active) return;
        setAnswers(restoredAnswers);
        setCurrentIndex(Math.max(0, Math.min(parsed.currentIndex ?? 0, onboardingSteps.length - 1)));

        if (user?.id && !ownDraft && parsed.previewComplete) {
          setSetupResult(generateOnboardingV2Result({ answers: restoredAnswers }));
          setFocusProfile(generateBiweeklyFocusProfile({ userId: user.id, answers: restoredAnswers }));
          setResultStage('focus');
          setPreviewNeedsSave(true);
        } else if (!user?.id && parsed.previewComplete) {
          setSetupResult(generateOnboardingV2Result({ answers: restoredAnswers }));
          setFocusProfile(generateBiweeklyFocusProfile({ userId: 'local-preview', answers: restoredAnswers }));
        }
      } catch {
        if (active) Alert.alert('Draft unavailable', 'Your saved setup draft could not be loaded.');
      } finally {
        if (active) {
          setLoadedDraftKey(draftKey);
          setIsDraftLoaded(true);
        }
      }
    })();
    return () => { active = false; };
  }, [draftKey, user?.id]);

  useEffect(() => {
    if (!draftKey || !isDraftLoaded || loadedDraftKey !== draftKey) {
      return;
    }

    AsyncStorage.setItem(draftKey, JSON.stringify({ answers, currentIndex })).catch(() => {
      // Local draft failure should not block the user from continuing.
    });
  }, [answers, currentIndex, draftKey, isDraftLoaded, loadedDraftKey]);

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
    if (!draftKey || isSubmitting) return;

    setIsSubmitting(true);

    try {
      const baselineProfile = generateBaselineProfile({
        userId: user?.id ?? 'local-preview',
        answers
      });
      const onboardingV2Result = generateOnboardingV2Result({ answers });
      const lifestylePlanResult = generateLifestylePlan(answers);
      const biweeklyFocusProfile = generateBiweeklyFocusProfile({
        userId: user?.id ?? 'local-preview',
        answers
      });

      if (!user?.id) {
        // Preview only: nothing is transmitted before creating an account.
        await AsyncStorage.setItem(guestOnboardingDraftKey, JSON.stringify({
          answers, currentIndex, previewComplete: true
        }));
        setSetupResult(onboardingV2Result);
        setFocusProfile(biweeklyFocusProfile);
        setResultStage('baseline');
        return;
      }

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

      await AsyncStorage.multiRemove([draftKey, guestOnboardingDraftKey]);
      setPreviewNeedsSave(false);
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
    if (!user?.id && mode === 'account') {
      await AsyncStorage.setItem(guestOnboardingDraftKey, JSON.stringify({
        answers, currentIndex, previewComplete: true
      }));
      router.push('/(auth)/signup');
      return;
    }
    if (previewNeedsSave) {
      // Explicitly save only after authentication and the signup health-consent step.
      await submitOnboarding();
      return;
    }
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
        <Text style={styles.questionEyebrow}>A LITTLE ABOUT YOU</Text>
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
      <Screen backgroundStyle={styles.onboardingBackground} contentStyle={styles.resultScreen}>
        <View style={styles.brandRow}><Text style={styles.brandMark}>daywoven<Text style={styles.brandDot}>.</Text></Text><Text style={styles.brandSide}>YOUR BASELINE</Text></View>
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

        {!user?.id && mode === 'account' ? <Text style={styles.privatePreviewNote}>Your answers are stored on this device only. Create an account to save them securely to Daywoven.</Text> : null}
        <Button
          disabled={isSubmitting}
          isLoading={isSubmitting}
          label={!user?.id && mode === 'account'
            ? 'Create account to save my plan'
            : previewNeedsSave ? 'Save these answers to my account'
            : subscriptionsEnabled && mode === 'account' ? 'Continue to membership' : 'Continue to daywoven'}
          onPress={() => void handleContinueFromFocus()}
          style={styles.brandButton}
        />
      </Screen>
    );
  }

  if (setupResult) {
    return (
      <Screen backgroundStyle={styles.onboardingBackground} contentStyle={styles.resultScreen}>
        <View style={styles.brandRow}><Text style={styles.brandMark}>daywoven<Text style={styles.brandDot}>.</Text></Text><Text style={styles.brandSide}>YOUR BASELINE</Text></View>
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

        <Button style={styles.brandButton} label="See my full score and two-week focus" onPress={() => setResultStage('focus')} />
      </Screen>
    );
  }

  return (
    <Screen backgroundStyle={styles.onboardingBackground} contentStyle={styles.onboardingContent}>
      <View style={styles.brandRow}>
        <Text style={styles.brandMark}>daywoven<Text style={styles.brandDot}>.</Text></Text>
        <Text style={styles.brandSide}>YOUR BASELINE</Text>
      </View>
      <View style={styles.progressHeading}>
        <Text style={styles.stepCount}>{sectionLabel.toUpperCase()}</Text>
        <Text style={styles.stepPercent}>{Math.round(progressPercent)}% COMPLETE</Text>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
      </View>
      <View style={styles.introBlock}>
        <Text style={styles.stageEyebrow}>GET TO KNOW YOUR RHYTHM</Text>
        <Text accessibilityRole="header" style={styles.stageTitle}>{step.title}</Text>
        <Text style={styles.stageIntro}>{step.intro}</Text>
      </View>
      {currentIndex === 0 ? <Text style={styles.welcomeNote}>{onboardingV2Welcome}</Text> : null}
      {step.questions.map(renderQuestion)}

      {unanswered.length > 0 ? (
        <Text accessibilityRole="alert" style={styles.helper}>
          Still needed: {unanswered.map((item) => item.prompt).join(' ')}
        </Text>
      ) : null}

      {!user?.id && mode === 'account' ? (
        <Text style={styles.privatePreviewNote}>Private preview · your answers stay on this device until you create an account and agree to save them.</Text>
      ) : null}
      <View style={styles.actions}>
        <Button
          disabled={currentIndex === 0 || isSubmitting}
          label="Back"
          onPress={handleBack}
          style={[styles.actionButton, styles.brandSecondaryButton]}
          variant="secondary"
        />
        <Button
          disabled={!canContinue}
          isLoading={isSubmitting}
          label={isLastStep ? 'Review your baseline' : 'Next'}
          onPress={handleNext}
          style={[styles.actionButton, styles.brandButton]}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  onboardingBackground: { backgroundColor: '#13291D', experimental_backgroundImage: 'linear-gradient(180deg, #214932 0%, #13281D 38%, #0C1A13 100%)' },
  onboardingContent: { gap: 18, paddingTop: 24, paddingBottom: 42 },
  brandRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 8 },
  brandMark: { color: '#F6F8F4', fontSize: 25, fontWeight: '800', letterSpacing: -1.2 },
  brandDot: { color: '#C8F18C' },
  brandSide: { color: '#B8D69D', fontSize: 10, fontWeight: '800', letterSpacing: 1.1 },
  progressHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  stepCount: { color: '#F6F8F4', fontSize: 12, fontWeight: '700' },
  stepPercent: { color: '#B8D69D', fontSize: 11, fontWeight: '700' },
  introBlock: { gap: 11, paddingVertical: 18 },
  stageEyebrow: { color: '#C8F18C', fontSize: 11, fontWeight: '800', letterSpacing: 1.3 },
  stageTitle: { color: '#F6F8F4', fontSize: 37, lineHeight: 43, fontWeight: '700', letterSpacing: -1.4 },
  stageIntro: { color: '#B8CAB5', fontSize: 16, lineHeight: 26 },
  welcomeNote: { color: '#C9DDC4', fontSize: 13, lineHeight: 21 },
  questionEyebrow: { color: '#B8D69D', fontSize: 10, fontWeight: '800', letterSpacing: 1.15 },
  brandButton: { backgroundColor: '#C8F18C', borderRadius: 14, minHeight: 56 },
  brandSecondaryButton: { borderColor: 'rgba(200,241,140,0.32)', borderRadius: 14, minHeight: 56 },
  privatePreviewNote: { color: '#AFC6AD', textAlign: 'center', fontSize: 12, lineHeight: 19 },
  scoreHero: { gap: 12, padding: 22, borderRadius: 20, backgroundColor: '#2B5037', borderColor: 'rgba(200,241,140,0.20)', borderWidth: 1 },
  scoreHeroKicker: { color: '#C8F18C', fontSize: 11, fontWeight: '800', letterSpacing: 1.3 },
  scoreHeroTitle: { color: '#F7FBEF', fontSize: 30, fontWeight: '700', lineHeight: 36, letterSpacing: -0.9 },
  scoreHeroSummary: { color: '#D4E6CF', fontSize: 14, lineHeight: 23 },
  scorePill: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(200,241,140,0.12)', borderRadius: 24, paddingVertical: 8, paddingHorizontal: 12 },
  scorePillDot: { width: 7, height: 7, backgroundColor: '#C8F18C', borderRadius: 4 },
  scorePillText: { color: '#E4F7C9', fontSize: 12, fontWeight: '700' },
  scoreSectionBody: { color: '#AEC6AB', fontSize: 12, lineHeight: 20 },
  domainRow: { gap: 8, paddingVertical: 7 },
  domainTrack: { height: 6, overflow: 'hidden', borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.11)' },
  domainBar: { height: '100%', borderRadius: 5 },
  questionCard: { gap: 16, backgroundColor: '#1D3526', borderColor: 'rgba(200,241,140,0.16)', borderWidth: 1, borderRadius: 22, padding: 21 },
  questionPrompt: { color: '#F6F8F4', fontFamily: fonts.bodyMedium, fontSize: 21, lineHeight: 29, fontWeight: '700', letterSpacing: -0.45 },
  optionalTag: {
    color: colors.textFaint,
    fontFamily: fonts.body,
    fontSize: 13
  },
  progressTrack: { height: 5, overflow: 'hidden', borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.14)' },
  progressFill: { height: '100%', borderRadius: 10, backgroundColor: '#C8F18C' },
  helper: { color: '#B8CAB5', fontFamily: fonts.body, fontSize: 14, lineHeight: 22 },
  timeHint: {
    color: colors.signalAmber,
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 18
  },
  options: { gap: 10 },
  scaleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm
  },
  scaleOption: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(246,248,244,0.16)', borderRadius: 14, backgroundColor: '#172D20' },
  scaleOptionSelected: { borderColor: '#C8F18C', backgroundColor: '#2D4934' },
  scaleOptionLabel: { color: '#F6F8F4', fontSize: 18, fontWeight: '700' },
  option: { minHeight: 58, justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(246,248,244,0.15)', borderRadius: 14, backgroundColor: '#14281C', paddingHorizontal: 18, paddingVertical: 14 },
  optionSelected: { borderColor: '#C8F18C', backgroundColor: '#2D4934' },
  optionPressed: {
    opacity: 0.82
  },
  optionLabel: { color: '#E8F2E4', fontFamily: fonts.body, fontSize: 15, fontWeight: '600', lineHeight: 23 },
  optionLabelSelected: { color: '#D9FBAF' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  actionButton: {
    flex: 1
  },
  resultScreen: { backgroundColor: 'transparent', gap: 18, paddingTop: 24, paddingBottom: 42 },
  scoreSheet: { gap: 22, borderColor: 'rgba(200,241,140,0.16)', borderRadius: 24, borderWidth: 1, backgroundColor: '#152D1F', padding: 22 },
  scoreGlowOne: {
    position: 'absolute',
    top: -64,
    right: -44,
    width: 168,
    height: 168,
    borderRadius: 84,
    backgroundColor: 'rgba(124,181,103,0.16)'
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
  scoreSheetEyebrow: { color: '#C8F18C', fontSize: 11, fontWeight: '800', letterSpacing: 1.3 },
  scoreSheetTitle: { color: '#F6F8F4', fontSize: 37, fontWeight: '700', lineHeight: 43, letterSpacing: -1.4 },
  scoreSheetSubtitle: { color: '#B8CAB5', fontSize: 14, lineHeight: 22 },
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
    color: '#B8CAB5',
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
    color: '#F6F8F4',
    fontFamily: fonts.display,
    fontSize: 28,
    fontWeight: '400',
    lineHeight: 31,
    textAlign: 'center'
  },
  scoreCalibration: {
    color: '#B8CAB5',
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
    borderColor: 'rgba(200, 241, 140, 0.14)',
    borderRadius: radii.lg,
    backgroundColor: '#1C3627',
    padding: spacing.md
  },
  domainTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
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
    color: '#C8F18C',
    fontFamily: fonts.display,
    fontSize: 20,
    fontWeight: '400'
  },
  domainLabel: { color: '#F6F8F4', fontFamily: fonts.body, fontSize: 15, fontWeight: '700', flexShrink: 1 },
  domainSignal: { color: '#C8F18C', fontFamily: fonts.body, fontSize: 12, fontWeight: '700' },
  domainReason: { color: '#AEBEAC', fontFamily: fonts.body, fontSize: 12, lineHeight: 18 },
  domainPriority: {
    fontFamily: fonts.body,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0
  },
  scoreSection: { gap: 14, borderTopWidth: 1, borderTopColor: 'rgba(200,241,140,0.14)', paddingTop: 18 },
  scoreSectionTitle: { color: '#F6F8F4', fontFamily: fonts.display, fontSize: 21, fontWeight: '700' },
  rankRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, paddingVertical: 7 },
  rankNumber: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: 'rgba(200,241,140,0.12)' },
  rankNumberText: { color: '#C8F18C', fontSize: 12, fontWeight: '800' },
  rankTextWrap: { flex: 1, gap: 4 },
  rankDomain: { color: '#B8D69D', fontSize: 11, fontWeight: '700' },
  rankLabel: { color: '#F6F8F4', fontSize: 15, fontWeight: '700', lineHeight: 21 },
  rankExplanation: { color: '#B8CAB5', fontSize: 13, lineHeight: 20 },
  rankImpact: {
    minWidth: 54,
    color: '#B8CAB5',
    fontFamily: fonts.body,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    textAlign: 'right'
  },
  scoreMeaning: {
    color: '#B8CAB5',
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 23
  },
  focusHeader: { gap: 10, paddingTop: 9 },
  focusHeaderEyebrow: { color: '#C8F18C', fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  focusHeaderTitle: { color: '#F6F8F4', fontSize: 31, fontWeight: '700', lineHeight: 38, letterSpacing: -0.9 },
  focusHeaderBody: { color: '#B8CAB5', fontSize: 15, lineHeight: 24 },
  focusCard: { gap: 10, borderRadius: 20, borderColor: 'rgba(200,241,140,0.22)', backgroundColor: '#264932' },
  resultPanel: { gap: 14, borderRadius: 20, borderColor: 'rgba(200,241,140,0.13)', backgroundColor: '#1B3526', padding: 20 },
  focusLabel: { color: '#B9D69D', fontSize: 11, fontWeight: '800', letterSpacing: 0.7 },
  focusTitle: { color: '#F6F8F4', fontSize: 33, fontWeight: '700', lineHeight: 40 },
  focusSecondary: { color: '#B8CAB5', fontSize: 15, lineHeight: 22 },
  cardTitle: { color: '#F6F8F4', fontSize: 20, fontWeight: '700' },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm
  },
  reasonDot: { width: 7, height: 7, marginTop: 7, borderRadius: 4, backgroundColor: '#C8F18C' },
  reasonDotHigh: {
    backgroundColor: colors.signalAmber
  },
  setupHintRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: spacing.xs
  },
  reasonText: { flex: 1, color: '#E8F2E4', fontSize: 14, lineHeight: 22 },
  changeRow: { gap: 6, borderTopWidth: 1, borderTopColor: 'rgba(200,241,140,0.12)', paddingTop: 13 },
  changeLabel: { color: '#B9D69D', fontSize: 11, fontWeight: '700' },
  changeText: { color: '#E8F2E4', fontSize: 15, lineHeight: 22 },
  confidenceText: { color: '#F6F8F4', fontSize: 15, fontWeight: '700' },
  reassessmentText: { color: '#B8CAB5', fontSize: 13, lineHeight: 21 },
});
