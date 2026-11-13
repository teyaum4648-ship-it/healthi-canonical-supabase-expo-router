import { Link } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { Screen } from '../../src/components/Screen';
import { SectionHeader } from '../../src/components/SectionHeader';
import { TextInput } from '../../src/components/TextInput';
import { useAuth } from '../../src/features/auth/AuthProvider';
import { DemoEntry } from '../../src/features/auth/DemoEntry';
import {
  consentIsComplete,
  EMPTY_CONSENT,
  type ConsentState
} from '../../src/features/legal/consentModel';
import { CONSENT_VERSION } from '../../src/features/legal/legalLinks';
import { SignupConsent } from '../../src/features/legal/SignupConsent';
import { colors, spacing, glassSurface } from '../../src/styles/mobileTheme';

export default function SignupScreen() {
  const { signUp, mode } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [consent, setConsent] = useState<ConsentState>(EMPTY_CONSENT);
  const [consentError, setConsentError] = useState(false);
  const [feedback, setFeedback] = useState<{
    message: string;
    tone: 'error' | 'success';
  } | null>(null);

  async function handleSignup() {
    if (!email || password.length < 8) {
      setFeedback({
        message: 'Use an email and a password with at least 8 characters.',
        tone: 'error'
      });
      return;
    }

    /*
     * Checked before the request rather than after it, so an account is never created
     * in a state where we cannot show what its owner agreed to.
     */
    if (!consentIsComplete(consent)) {
      setConsentError(true);
      setFeedback(null);
      return;
    }

    setConsentError(false);
    setFeedback(null);
    setIsSubmitting(true);

    try {
      await signUp(email.trim(), password, {
        version: CONSENT_VERSION,
        terms: consent.agreement,
        privacy: consent.agreement,
        ageConfirmed: consent.agreement,
        healthData: consent.healthData
      }, firstName);
      setFeedback({
        message: 'Check your email to confirm the account, then return here and log in.',
        tone: 'success'
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to create an account right now.';
      setFeedback({ message, tone: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (mode === 'demo') return <DemoEntry />;
  return (
    <Screen backgroundStyle={styles.brandBackground} contentStyle={styles.screen}>
      <View style={styles.brandRow}>
        <Text style={styles.brandMark}>daywoven<Text style={styles.brandDot}>.</Text></Text>
        <Text style={styles.brandSide}>SAVE YOUR BASELINE</Text>
      </View>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>ONE LAST STEP</Text>
        <Text accessibilityRole="header" style={styles.heroTitle}>Make your progress yours.</Text>
        <Text style={styles.heroBody}>
          Create an account to securely save your wellness starting point and keep building from it. Your preview answers stay on your device until you agree to save them.
        </Text>
      </View>

      <Card style={styles.brandCard}>
        <TextInput
          autoCapitalize="words"
          autoComplete="given-name"
          label="First name"
          maxLength={40}
          onChangeText={setFirstName}
          placeholder="What should we call you? (optional)"
          value={firstName}
        />
        <TextInput
          autoComplete="email"
          inputMode="email"
          label="Email"
          onChangeText={setEmail}
          placeholder="you@example.com"
          value={email}
        />
        <TextInput
          autoComplete="new-password"
          label="Password"
          onChangeText={setPassword}
          placeholder="At least 8 characters"
          secureTextEntry
          value={password}
        />
        <SignupConsent onChange={setConsent} showError={consentError} value={consent} />
        <Button style={styles.brandButton} isLoading={isSubmitting} label="Save my baseline · create account" onPress={handleSignup} />
        {feedback ? (
          <View
            accessibilityLiveRegion="polite"
            accessibilityRole="alert"
            style={[
              styles.feedback,
              feedback.tone === 'error' ? styles.feedbackError : styles.feedbackSuccess
            ]}
          >
            <Text style={styles.feedbackTitle}>
              {feedback.tone === 'error' ? 'Signup failed' : 'Account created'}
            </Text>
            <Text style={styles.feedbackMessage}>{feedback.message}</Text>
          </View>
        ) : null}
      </Card>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Already have an account?</Text>
        <Link href="/(auth)/login" style={styles.link}>
          Log in
        </Link>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { justifyContent: 'center', gap: 18, paddingTop: 26, paddingBottom: 40 },
  brandBackground: { backgroundColor: '#13291D', experimental_backgroundImage: 'linear-gradient(180deg, #214932 0%, #13281D 38%, #0C1A13 100%)' },
  brandRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 12 },
  brandMark: { color: '#F6F8F4', fontSize: 25, fontWeight: '800', letterSpacing: -1.2 },
  brandDot: { color: '#C8F18C' },
  brandSide: { color: '#B8D69D', fontSize: 10, fontWeight: '800', letterSpacing: 1.1 },
  hero: { gap: 10, paddingBottom: 10 },
  eyebrow: { color: '#C8F18C', fontSize: 11, fontWeight: '800', letterSpacing: 1.3 },
  heroTitle: { color: '#F6F8F4', fontSize: 37, fontWeight: '700', lineHeight: 43, letterSpacing: -1.4 },
  heroBody: { color: '#B8CAB5', fontSize: 15, lineHeight: 24 },
  brandCard: { borderColor: 'rgba(200,241,140,0.16)', backgroundColor: '#1B3526', padding: 20, borderRadius: 22 },
  brandButton: { backgroundColor: '#C8F18C', borderRadius: 14, minHeight: 55 },
  footer: {
    alignItems: 'center',
    gap: spacing.xs
  },
  footerText: {
    color: colors.textMuted,
    fontSize: 15
  },
  link: {
    color: '#C8F18C',
    fontSize: 16,
    fontWeight: '800'
  },
  feedback: {
    gap: spacing.xs,
    borderWidth: 1,
    borderRadius: 10,
    padding: spacing.md
  },
  feedbackError: {
    borderColor: colors.danger,
    ...glassSurface
  },
  feedbackSuccess: {
    borderColor: colors.success,
    backgroundColor: colors.surfaceMuted
  },
  feedbackTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800'
  },
  feedbackMessage: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20
  }
});
