import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
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
import { colors, fonts, spacing } from '../../src/styles/mobileTheme';
import type {
  BiweeklyFocusProfile,
  OnboardingAnswerValue,
  OnboardingAnswers,
  OnboardingQuestion
} from '../../src/types/onboarding';

import * as dv from '../../src/styles/daywoven1c';
import { BandStatusBar } from '../../src/components/thread/useBandStatusBar';
import { PersonalReviewScreen } from '../../src/features/onboarding/PersonalReview';
import { buildPersonalReview } from '../../src/features/onboarding/personalReviewModel';
import { GUEST_ONBOARDING_DRAFT_KEY } from '../../src/features/onboarding/guestPreview';
import { hasFinishedSetup, questionnaireKey, readQuestionnaireDraft, saveQuestionnaireForLater, type QuestionnaireDraft } from '../../src/features/onboarding/questionnaireDraft';
const isDemoMode = process.env.EXPO_PUBLIC_DEMO_MODE === 'true';
const shouldUseLocalOnboarding = isDemoMode || !isSupabaseConfigured;
const demoOnboardingCompletedKey = 'healthi:demo:onboardingCompleted';
const demoOnboardingResultKey = 'healthi:demo:onboardingResult';
// Anonymous answers never leave the device. They are only uploaded after signup consent.
const guestOnboardingDraftKey = GUEST_ONBOARDING_DRAFT_KEY;

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

const baselineModeLabels: Record<OnboardingV2Result['baseline_mode'], string> = {
  build: 'Build',
  maintain: 'Maintain',
  correct: 'Steady reset',
  restore: 'Restore',
  professional_guidance: 'Guided'
};

function formatConfidence(confidence: BiweeklyFocusProfile['confidence']) {
  return `${confidence[0].toUpperCase()}${confidence.slice(1)} confidence`;
}

export default function OnboardingScreen({ revisiting = false }: { revisiting?: boolean }) {
  const { profile, refreshProfile, user, mode } = useAuth();
  const [answers, setAnswers] = useState<OnboardingAnswers>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [focusProfile, setFocusProfile] = useState<BiweeklyFocusProfile | null>(null);
  const [setupResult, setSetupResult] = useState<OnboardingV2Result | null>(null);
  const [resultStage, setResultStage] = useState<'baseline' | 'focus'>('baseline');
  const [isDraftLoaded, setIsDraftLoaded] = useState(false);
  const [loadedDraftKey, setLoadedDraftKey] = useState<string | null>(null);
  const [usingGuestDraft, setUsingGuestDraft] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const actionLock = useRef(false);
  const [previewNeedsSave, setPreviewNeedsSave] = useState(false);
  const step = onboardingSteps[Math.min(currentIndex, onboardingSteps.length - 1)];
  const draftKey = questionnaireKey(user?.id);
  const progressPercent = ((currentIndex + 1) / onboardingSteps.length) * 100;
  // A step advances once its required questions are answered; optional detail can be left.
  const unanswered = requiredQuestions(step).filter((item) => !isAnswered(item, answers[item.key]));
  const canContinue = unanswered.length === 0;
  const isLastStep = currentIndex === onboardingSteps.length - 1;

  useEffect(() => {
    let active = true;
    setIsDraftLoaded(false);
    setLoadedDraftKey(null);
    setUsingGuestDraft(false);
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
        setUsingGuestDraft(Boolean(user?.id && !ownDraft && guestDraft));

        const parsed = readQuestionnaireDraft(rawDraft, onboardingSteps.length);
        const restoredAnswers = parsed.answers;
        if (!active) return;
        setAnswers(restoredAnswers);
        setCurrentIndex(parsed.currentIndex);

        if (user?.id && !ownDraft && parsed.deferred && !hasFinishedSetup(profile?.onboarding_status)) {
          await continueWithoutQuestionnaire(parsed);
          return;
        }

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
    if (!user?.id || profile?.onboarding_status !== 'not_started' || actionLock.current || !isDraftLoaded) {
      return;
    }

    void (async () => {
      try {
        const { error } = await supabase
          .from('profiles')
          .update({ onboarding_status: 'in_progress' })
          .eq('id', user.id)
          .eq('onboarding_status', 'not_started');

        if (error) {
          throw error;
        }
      } catch {
        // The completed submission updates this status again; this is only a helpful marker.
      }
    })();
  }, [profile?.onboarding_status, user?.id, isDraftLoaded]);

  const sectionLabel = useMemo(
    () => `Step ${currentIndex + 1} of ${onboardingSteps.length}`,
    [currentIndex]
  );

  function setAnswer(key: OnboardingQuestion['key'], value: OnboardingAnswerValue) {
    if (actionLock.current) return;
    setAnswers((current) => ({
      ...current,
      [key]: value
    }));
  }

  function handleBack() {
    if (actionLock.current) return;
    setCurrentIndex((index) => Math.max(index - 1, 0));
  }

  function handleNext() {
    // The button is disabled while anything required is missing, so there is nothing
    // to alert about; the unanswered prompts are named inline instead.
    if (!canContinue || actionLock.current) return;

    if (isLastStep) {
      void submitOnboarding();
      return;
    }

    setCurrentIndex((index) => index + 1);
  }

  async function continueWithoutQuestionnaire(draft: QuestionnaireDraft = { answers, currentIndex }) {
    if (actionLock.current) return;
    actionLock.current = true;
    setIsSubmitting(true);
    try {
      await saveQuestionnaireForLater({
        storage: AsyncStorage,
        draft,
        userId: user?.id,
        status: profile?.onboarding_status,
        localDemo: shouldUseLocalOnboarding,
        consumeGuestDraft: usingGuestDraft || Boolean(draft.deferred),
        saveSkippedStatus: async () => {
          const { error } = await supabase.from('profiles')
            .update({ onboarding_status: 'skipped' }).eq('id', user!.id)
            .select('id').single();
          if (error) throw error;
        }
      });
      if (!user?.id) {
        router.push('/(auth)/signup');
      } else {
        await refreshProfile();
        router.replace(subscriptionsEnabled && mode === 'account' ? '/paywall' : '/(app)/(tabs)');
      }
    } catch {
      Alert.alert('Could not continue', 'Your questionnaire has not been submitted. Please try Skip for now again.');
    } finally {
      actionLock.current = false;
      setIsSubmitting(false);
    }
  }

  async function submitOnboarding() {
    if (!draftKey || actionLock.current) return;

    actionLock.current = true;
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
      actionLock.current = false;
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
          <Text style={styles.timeHint}>That one did not read as a time. Try something like 10:30 PM.</Text>
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
    return (
      <PersonalReviewScreen
        review={buildPersonalReview(focusProfile, answers)}
        ctaLabel={!user?.id && mode === 'account'
          ? 'Create account to save my plan'
          : previewNeedsSave ? 'Save these answers to my account'
          : subscriptionsEnabled && mode === 'account' ? 'Continue to membership' : 'Continue to daywoven'}
        onContinue={() => void handleContinueFromFocus()}
        isSubmitting={isSubmitting}
        note={!user?.id && mode === 'account' ? 'Your answers are stored on this device only. Create an account to save them securely to Daywoven.' : null}
      />
    );
  }

  if (setupResult) {
    return (
      <Screen key="baseline" backgroundStyle={styles.onboardingBackground} contentStyle={styles.resultScreen}>
        <BandStatusBar />
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

        <Button style={styles.brandButton} tone="band" label="See my full score and two-week focus" onPress={() => setResultStage('focus')} />
      </Screen>
    );
  }

  return (
    <Screen key={currentIndex} backgroundStyle={styles.onboardingBackground} contentStyle={styles.onboardingContent}>
      <BandStatusBar />
      <View style={styles.brandRow}>
        <Text style={styles.brandMark}>daywoven<Text style={styles.brandDot}>.</Text></Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Skip questionnaire for now"
          accessibilityState={{ disabled: isSubmitting }} disabled={isSubmitting}
          hitSlop={8} onPress={() => void continueWithoutQuestionnaire()} style={styles.skipButton}>
          <Text style={styles.skipText}>{revisiting ? 'Finish later' : 'Skip for now'}</Text>
        </Pressable>
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
      <Text style={styles.welcomeNote}>This questionnaire is optional. Skip now and finish later from Profile. Your progress stays on this device.</Text>
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
          tone="band"
        />
        <Button
          disabled={!canContinue || isSubmitting}
          isLoading={isSubmitting}
          label={isLastStep ? 'Review your baseline' : 'Next'}
          onPress={handleNext}
          style={[styles.actionButton, styles.brandButton]}
          tone="band"
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  onboardingBackground: { backgroundColor: dv.surface.band },
  onboardingContent: { gap: 18, paddingTop: 24, paddingBottom: 42 },
  brandRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 8 },
  brandMark: { color: dv.bone.text, fontSize: 25, fontFamily: fonts.bodySemibold, letterSpacing: -1.2 },
  brandDot: { color: dv.accent.amber },
  brandSide: { color: dv.bone.soft, fontSize: 10, fontFamily: fonts.bodySemibold, letterSpacing: 1.1 },
  skipButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 },
  skipText: { color: dv.bone.text, fontFamily: fonts.bodySemibold, fontSize: 14 },
  progressHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  stepCount: { color: dv.bone.text, fontSize: 12, fontFamily: fonts.bodySemibold },
  stepPercent: { color: dv.bone.soft, fontSize: 11, fontFamily: fonts.bodySemibold },
  introBlock: { gap: 11, paddingVertical: 18 },
  stageEyebrow: { color: dv.accent.amber, fontSize: 11, fontFamily: fonts.bodySemibold, letterSpacing: 1.3 },
  stageTitle: { color: dv.bone.text, fontSize: 37, lineHeight: 43, fontFamily: fonts.bodySemibold, letterSpacing: -1.4 },
  stageIntro: { color: dv.bone.soft, fontSize: 16, lineHeight: 26 },
  welcomeNote: { color: dv.bone.soft, fontSize: 13, lineHeight: 21 },
  questionEyebrow: { color: dv.bone.soft, fontSize: 10, fontFamily: fonts.bodySemibold, letterSpacing: 1.15 },
  brandButton: { borderRadius: 14, minHeight: 56 },
  brandSecondaryButton: { borderColor: dv.bone.outline, borderRadius: 14, minHeight: 56 },
  privatePreviewNote: { color: dv.bone.muted, textAlign: 'center', fontSize: 12, lineHeight: 19 },
  questionCard: { gap: 16, backgroundColor: dv.bone.raised, borderColor: dv.bone.hairline, borderWidth: 1, borderRadius: 22, padding: 21 },
  questionPrompt: { color: dv.bone.text, fontFamily: fonts.bodySemibold, fontSize: 21, lineHeight: 29, letterSpacing: -0.45 },
  optionalTag: {
    color: dv.bone.muted,
    fontFamily: fonts.body,
    fontSize: 13
  },
  progressTrack: { height: 5, overflow: 'hidden', borderRadius: 10, backgroundColor: dv.bone.raised },
  progressFill: { height: '100%', borderRadius: 10, backgroundColor: dv.bone.text },
  helper: { color: dv.bone.soft, fontFamily: fonts.body, fontSize: 14, lineHeight: 22 },
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
  scaleOption: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: dv.bone.hairline, borderRadius: 14, backgroundColor: dv.bone.raised },
  scaleOptionSelected: { borderColor: dv.bone.outline, backgroundColor: dv.bone.raised },
  scaleOptionLabel: { color: dv.bone.text, fontSize: 18, fontFamily: fonts.bodySemibold },
  option: { minHeight: 58, justifyContent: 'center', borderWidth: 1, borderColor: dv.bone.hairline, borderRadius: 14, backgroundColor: dv.bone.raised, paddingHorizontal: 18, paddingVertical: 14 },
  optionSelected: { borderColor: dv.bone.outline, backgroundColor: dv.bone.raised },
  optionPressed: {
    opacity: 0.82
  },
  optionLabel: { color: dv.bone.text, fontFamily: fonts.bodySemibold, fontSize: 15, lineHeight: 23 },
  optionLabelSelected: { color: dv.accent.amber },
  actions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  actionButton: {
    flex: 1
  },
  resultScreen: { backgroundColor: 'transparent', gap: 18, paddingTop: 24, paddingBottom: 42 },
  rankTextWrap: { flex: 1, gap: 4 },
  rankDomain: { color: dv.bone.soft, fontSize: 11, fontFamily: fonts.bodySemibold },
  rankExplanation: { color: dv.bone.soft, fontSize: 13, lineHeight: 20 },
  focusHeader: { gap: 10, paddingTop: 9 },
  focusHeaderEyebrow: { color: dv.accent.amber, fontSize: 11, fontFamily: fonts.bodySemibold, letterSpacing: 1.2 },
  focusHeaderTitle: { color: dv.bone.text, fontSize: 31, fontFamily: fonts.bodySemibold, lineHeight: 38, letterSpacing: -0.9 },
  focusHeaderBody: { color: dv.bone.soft, fontSize: 15, lineHeight: 24 },
  focusCard: { gap: 10, borderRadius: 20, borderColor: dv.bone.hairline, backgroundColor: dv.bone.raised },
  resultPanel: { gap: 14, borderRadius: 20, borderColor: dv.bone.hairline, backgroundColor: dv.bone.raised, padding: 20 },
  focusLabel: { color: dv.bone.soft, fontSize: 11, fontFamily: fonts.bodySemibold, letterSpacing: 0.7 },
  focusTitle: { color: dv.bone.text, fontSize: 33, fontFamily: fonts.bodySemibold, lineHeight: 40 },
  focusSecondary: { color: dv.bone.soft, fontSize: 15, lineHeight: 22 },
  cardTitle: { color: dv.bone.text, fontSize: 20, fontFamily: fonts.bodySemibold },
  reasonDot: { width: 7, height: 7, marginTop: 7, borderRadius: 4, backgroundColor: dv.bone.text },
  reasonDotHigh: {
    backgroundColor: colors.signalAmber
  },
  setupHintRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: spacing.xs
  },
  confidenceText: { color: dv.bone.text, fontSize: 15, fontFamily: fonts.bodySemibold },
  reassessmentText: { color: dv.bone.soft, fontSize: 13, lineHeight: 21 },
});
