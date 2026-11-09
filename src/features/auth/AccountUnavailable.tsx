import { StyleSheet, Text } from 'react-native';
import { Screen } from '../../components/Screen';
import { colors, type } from '../../styles/mobileTheme';

/** No account routes or local demo stores are mounted on this failure path. */
export function AccountUnavailable() {
  return (
    <Screen contentStyle={styles.content}>
      <Text accessibilityRole="header" style={styles.title}>Accounts unavailable</Text>
      <Text accessibilityRole="alert" style={styles.body}>
        This version of Daywoven isn’t set up to connect to your account. Please check for an updated version.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { justifyContent: 'center' },
  title: { ...type.title, color: colors.text },
  body: { ...type.body, color: colors.textMuted }
});
