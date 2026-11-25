import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '../../src/components/Button';
import { Screen } from '../../src/components/Screen';
import { TextInput } from '../../src/components/TextInput';
import { Eyebrow, ThreadBand } from '../../src/components/thread/ThreadParts';
import { useAuth } from '../../src/features/auth/AuthProvider';
import { DemoEntry } from '../../src/features/auth/DemoEntry';
import {
  consentIsComplete,
  EMPTY_CONSENT,
  type ConsentState
} from '../../src/features/legal/consentModel';
import { CONSENT_VERSION } from '../../src/features/legal/legalLinks';
import { SignupConsent } from '../../src/features/legal/SignupConsent';
import { generateBiweeklyFocusProfile } from '../../src/features/onboarding/generateBiweeklyFocusProfile';
import { loadGuestPreview, SIGNUP_FIRST_NAME_KEY } from '../../src/features/onboarding/guestPreview';
import { focusName } from '../../src/features/onboarding/personalReviewModel';
import { accent, bone, font, HIT, ink, radius, space, surface, type } from '../../src/styles/daywoven1c';

/** A form never stretches across a desktop window; on a phone this is the full width. */
const FORM_WIDTH = 440;

function emailProblem(email: string): string | null {
  if (!email.trim()) return 'Add the email you want to sign in with.';
  return /^\S+@\S+\.\S+$/.test(email.trim()) ? null : 'That email does not look complete.';
}

/** Server messages in plain words, always ending as a sentence. */
function readableFailure(error: unknown): string {
  const raw = error instanceof Error ? error.message.trim() : '';
  if (!raw || /failed to fetch|network|timed? ?out/i.test(raw)) return 'We could not reach Daywoven. Check your connection and try again.';
  return /[.!?]$/.test(raw) ? raw : `${raw}.`;
}

function passwordProblem(password: string): string | null {
  return password.length >= 8 ? null : 'Use at least 8 characters.';
}

/**
 * Account creation (design language 1c): the next step after the Personal Review, not a
 * separate portal. A short charcoal band says what is being saved, the focus carried over
 * from the review; the form is compact, with each problem shown under its own field.
 *
 * Unchanged underneath: Supabase signup through useAuth().signUp, the consent model and
 * its version, the requirement that both consents are ticked before any request, and demo
 * mode, which never creates an account. The questionnaire answers stay in the guest draft
 * on this device whatever happens here, so a failed attempt loses nothing.
 */
export default function SignupScreen() {
  const { signUp, mode } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [attempted, setAttempted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [consent, setConsent] = useState<ConsentState>(EMPTY_CONSENT);
  const [consentError, setConsentError] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [created, setCreated] = useState(false);
  const [focus, setFocus] = useState<{ name: string; summary: string } | null>(null);
  const [questionnaireDeferred, setQuestionnaireDeferred] = useState(false);

  /* The focus from the Personal Review, read from the same on-device draft it was built from. */
  useEffect(() => {
    let live = true;
    void loadGuestPreview().then((preview) => {
      if (!live) return;
      setQuestionnaireDeferred(Boolean(preview?.deferred));
      if (!preview?.previewComplete) return;
      const profile = generateBiweeklyFocusProfile({ userId: 'local-preview', answers: preview.answers });
      setFocus({ name: focusName(profile.primary_focus), summary: profile.dynamic_score_sheet.summary });
    });
    void AsyncStorage.getItem(SIGNUP_FIRST_NAME_KEY).then((saved) => {
      if (live && saved) setFirstName((current) => current || saved);
    }).catch(() => undefined);
    return () => { live = false; };
  }, []);

  const updateFirstName = (value: string) => {
    setFirstName(value);
    void AsyncStorage.setItem(SIGNUP_FIRST_NAME_KEY, value).catch(() => undefined);
  };

  const errors = useMemo(() => (attempted ? { email: emailProblem(email), password: passwordProblem(password) } : { email: null, password: null }), [attempted, email, password]);

  async function handleSignup() {
    setAttempted(true);
    setServerError(null);
    const fieldsOk = !emailProblem(email) && !passwordProblem(password);
    /*
     * Checked before the request rather than after it, so an account is never created
     * in a state where we cannot show what its owner agreed to.
     */
    const consentOk = consentIsComplete(consent);
    setConsentError(!consentOk);
    if (!fieldsOk || !consentOk) return;

    setIsSubmitting(true);
    try {
      await signUp(email.trim(), password, {
        version: CONSENT_VERSION,
        terms: consent.agreement,
        privacy: consent.agreement,
        ageConfirmed: consent.agreement,
        healthData: consent.healthData
      }, firstName);
      setCreated(true);
      void AsyncStorage.removeItem(SIGNUP_FIRST_NAME_KEY).catch(() => undefined);
    } catch (error) {
      setServerError(readableFailure(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (mode === 'demo') return <DemoEntry />;

  const band = (
    <ThreadBand>
      <View style={styles.readable}>
        <View style={styles.brandRow}>
          <Text style={styles.wordmark}>daywoven<Text style={styles.dot}>.</Text></Text>
          <Eyebrow tone="band">Create your account</Eyebrow>
        </View>
        {focus && router.canGoBack() ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Back to your Personal Review" hitSlop={6} onPress={() => router.back()} style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
            <Ionicons accessible={false} color={bone.text} name="chevron-back" size={18} />
            <Text style={styles.backText}>Your review</Text>
          </Pressable>
        ) : null}
        <Text accessibilityRole="header" style={styles.headline}>Make this yours.</Text>
        <Text style={styles.sub}>
          {questionnaireDeferred
            ? 'Create your account and finish the optional questionnaire later from Profile. Your progress stays on this device.'
            : 'Save your starting point and keep building from it. Your answers stay on this device until you agree below.'}
        </Text>
        {focus ? (
          <View accessible accessibilityLabel={`Saving your 14-day focus: ${focus.name}`} style={styles.focus}>
            <View style={styles.focusMark} />
            <View style={styles.focusCopy}>
              <Text style={styles.focusKicker}>YOUR 14-DAY FOCUS</Text>
              <Text style={styles.focusName}>{focus.name}</Text>
              <Text numberOfLines={2} style={styles.focusSummary}>{focus.summary}</Text>
            </View>
          </View>
        ) : null}
      </View>
    </ThreadBand>
  );

  return (
    <Screen band={band} contentStyle={styles.content}>
      <View style={styles.readable}>
        {created ? (
          <View accessibilityLiveRegion="polite" style={styles.card}>
            <Ionicons accessible={false} color={ink.text} name="mail-unread-outline" size={26} />
            <Text accessibilityRole="header" style={styles.doneTitle}>Check your email</Text>
            <Text style={styles.doneBody}>
              We sent a link to {email.trim()}. Confirm it, then come back and log in. Your answers are still saved on this device.
            </Text>
            <Button label="Go to log in" onPress={() => router.replace('/(auth)/login')} />
          </View>
        ) : (
          <View style={styles.card}>
            <TextInput
              autoCapitalize="words"
              autoComplete="given-name"
              hint="Optional. Used to greet you."
              label="First name"
              maxLength={40}
              onChangeText={updateFirstName}
              placeholder="What should we call you?"
              returnKeyType="next"
              textContentType="givenName"
              value={firstName}
            />
            <TextInput
              autoComplete="email"
              error={errors.email}
              inputMode="email"
              keyboardType="email-address"
              label="Email"
              onChangeText={setEmail}
              placeholder="you@example.com"
              returnKeyType="next"
              textContentType="emailAddress"
              value={email}
            />
            <TextInput
              autoComplete="new-password"
              error={errors.password}
              hint="At least 8 characters."
              label="Password"
              onChangeText={setPassword}
              onSubmitEditing={() => void handleSignup()}
              placeholder="Choose a password"
              returnKeyType="go"
              secureTextEntry
              textContentType="newPassword"
              value={password}
            />

            <View style={styles.consent}>
              <SignupConsent onChange={(next) => { setConsent(next); if (consentIsComplete(next)) setConsentError(false); }} showError={consentError} value={consent} />
            </View>

            {serverError ? (
              <View accessibilityLiveRegion="polite" accessibilityRole="alert" style={styles.serverError}>
                <Ionicons accessible={false} color={accent.amberDeep} name="alert-circle-outline" size={18} />
                <View style={styles.serverErrorCopy}>
                  <Text style={styles.serverErrorTitle}>Your account was not created</Text>
                  <Text style={styles.serverErrorBody}>{serverError} Your answers are still saved on this device.</Text>
                </View>
              </View>
            ) : null}

            <Button isLoading={isSubmitting} disabled={isSubmitting} label="Create my account" onPress={() => void handleSignup()} />
          </View>
        )}

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account?</Text>
          <Pressable accessibilityRole="link" hitSlop={8} onPress={() => router.push('/(auth)/login')} style={styles.footerLink}>
            <Text style={styles.footerLinkText}>Log in</Text>
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  readable: { alignSelf: 'center', maxWidth: FORM_WIDTH, width: '100%' },
  content: { gap: 0, paddingBottom: 40, paddingTop: space.xl },
  brandRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', minHeight: HIT },
  wordmark: { ...type.wordmark, color: bone.text },
  dot: { color: accent.amber },
  back: { alignItems: 'center', alignSelf: 'flex-start', flexDirection: 'row', gap: 2, marginLeft: -4, marginTop: 4, minHeight: HIT },
  backText: { ...type.button, color: bone.text },
  pressed: { opacity: 0.7 },
  headline: { color: bone.text, fontFamily: font.display, fontSize: 34, letterSpacing: -0.4, lineHeight: 42, marginTop: 14 },
  sub: { ...type.body, color: bone.soft, marginTop: 10 },
  focus: { borderColor: bone.hairline, borderRadius: radius.card, borderWidth: 1, flexDirection: 'row', gap: 12, marginTop: 20, overflow: 'hidden', padding: 14 },
  focusMark: { backgroundColor: accent.amber, borderRadius: 2, width: 3 },
  focusCopy: { flex: 1, gap: 3 },
  focusKicker: { color: accent.amber, fontFamily: font.bodySemibold, fontSize: 10.5, letterSpacing: 1.1 },
  focusName: { color: bone.text, fontFamily: font.display, fontSize: 21 },
  focusSummary: { ...type.caption, color: bone.soft },
  card: { backgroundColor: surface.card, borderColor: ink.border, borderRadius: radius.card, borderWidth: 1, gap: 10, padding: 18 },
  consent: { borderTopColor: ink.hairline, borderTopWidth: 1, marginTop: 6, paddingTop: 12 },
  serverError: { backgroundColor: surface.sunken, borderColor: accent.amberDeep, borderRadius: radius.button, borderWidth: 1, flexDirection: 'row', gap: 10, padding: 12 },
  serverErrorCopy: { flex: 1, gap: 2 },
  serverErrorTitle: { color: ink.text, fontFamily: font.bodySemibold, fontSize: 14 },
  serverErrorBody: { ...type.caption, color: ink.muted },
  doneTitle: { color: ink.text, fontFamily: font.display, fontSize: 24 },
  doneBody: { ...type.body, color: ink.muted },
  footer: { alignItems: 'center', flexDirection: 'row', gap: 6, justifyContent: 'center', marginTop: 18 },
  footerText: { ...type.body, color: ink.muted },
  footerLink: { justifyContent: 'center', minHeight: HIT },
  footerLinkText: { ...type.button, color: ink.text, textDecorationLine: 'underline' }
});
