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

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleLogin() {
    if (!email || !password) {
      Alert.alert('Missing details', 'Enter your email and password to continue.');
      return;
    }

    setIsSubmitting(true);

    try {
      await signIn(email.trim(), password);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to log in right now.';
      Alert.alert('Login failed', message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Screen contentStyle={styles.screen}>
      <SectionHeader
        eyebrow="Welcome back"
        title="Healthi"
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
      </Card>

      <View style={styles.footer}>
        <Text style={styles.footerText}>New to Healthi?</Text>
        <Link href="/(auth)/signup" style={styles.link}>
          Create an account
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
