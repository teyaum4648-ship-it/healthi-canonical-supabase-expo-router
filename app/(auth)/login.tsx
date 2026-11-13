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
import { colors, spacing, glassSurface } from '../../src/styles/mobileTheme';

export default function LoginScreen() {
  const { signIn, mode } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{
    message: string;
    tone: 'error' | 'success';
  } | null>(null);

  async function handleLogin() {
    if (!email || !password) {
      setFeedback({
        message: 'Enter your email and password to continue.',
        tone: 'error'
      });
      return;
    }

    setFeedback(null);
    setIsSubmitting(true);

    try {
      await signIn(email.trim(), password);
      setFeedback({
        message: 'Signed in. Opening daywoven…',
        tone: 'success'
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to log in right now.';
      setFeedback({ message, tone: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (mode === 'demo') return <DemoEntry />;
  return (
    <Screen contentStyle={styles.screen}>
      <SectionHeader
        eyebrow="Welcome back"
        title="daywoven"
        body="Sign in to continue to your wellness dashboard."
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
          autoComplete="password"
          label="Password"
          onChangeText={setPassword}
          placeholder="Your password"
          secureTextEntry
          value={password}
        />
        <Button isLoading={isSubmitting} label="Log in" onPress={handleLogin} />
        <Link href="/(auth)/forgot-password" style={styles.link}>Forgot your password?</Link>
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
              {feedback.tone === 'error' ? 'Login failed' : 'Login successful'}
            </Text>
            <Text style={styles.feedbackMessage}>{feedback.message}</Text>
          </View>
        ) : null}
      </Card>

      <View style={styles.footer}>
        <Text style={styles.footerText}>New to daywoven?</Text>
        <Link href="/(onboarding)" style={styles.link}>
          Try the wellness questionnaire first
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
