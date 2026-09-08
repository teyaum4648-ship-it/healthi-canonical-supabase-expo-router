import { Link } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { Screen } from '../../src/components/Screen';
import { SectionHeader } from '../../src/components/SectionHeader';
import { TextInput } from '../../src/components/TextInput';
import { useAuth } from '../../src/features/auth/AuthProvider';
import { colors, spacing } from '../../src/styles/theme';

export default function SignupScreen() {
  const { signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
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

    setFeedback(null);
    setIsSubmitting(true);

    try {
      await signUp(email.trim(), password);
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

  return (
    <Screen contentStyle={styles.screen}>
      <SectionHeader
        eyebrow="Create account"
        title="Start with Healthi"
        body="Set up secure access now. Profile and onboarding come in the next feature layer."
      />

      <Card>
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
        <Button isLoading={isSubmitting} label="Create account" onPress={handleSignup} />
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
  screen: {
    justifyContent: 'center'
  },
  footer: {
    alignItems: 'center',
    gap: spacing.xs
  },
  footerText: {
    color: colors.textMuted,
    fontSize: 15
  },
  link: {
    color: colors.deepViolet,
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
    backgroundColor: colors.surface
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
