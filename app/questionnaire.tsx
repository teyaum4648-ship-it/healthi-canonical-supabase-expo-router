import { Redirect } from 'expo-router';
import { Text } from 'react-native';
import { Screen } from '../src/components/Screen';
import { useAuth } from '../src/features/auth/AuthProvider';
import OnboardingScreen from './(onboarding)/index';

/** Questionnaire access remains free, including after setup was skipped. */
export default function QuestionnaireRoute() {
  const { session, isLoading, isPasswordRecovery } = useAuth();
  if (isLoading) return <Screen><Text>Loading your questionnaire.</Text></Screen>;
  if (isPasswordRecovery && session) return <Redirect href="/auth/reset-password" />;
  if (!session) return <Redirect href="/(auth)/login" />;
  return <OnboardingScreen revisiting />;
}
