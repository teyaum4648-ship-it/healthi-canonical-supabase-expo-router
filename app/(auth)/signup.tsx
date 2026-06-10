import { Link } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

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

  async function handleSignup() {
    if (!email || password.length < 8) {
      Alert.alert('Check your details', 'Use an email and a password with at least 8 characters.');
      return;
    }

    setIsSubmitting(true);

    try {
      await signUp(email.trim(), password);
      Alert.alert('Account created', 'Check your email if confirmation is enabled.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to create an account right now.';
      Alert.alert('Signup failed', message);
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
    color: colors.primary,
    fontSize: 16,
    fontWeight: '800'
  }
});
