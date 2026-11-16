import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold
} from '@expo-google-fonts/inter';
import { Jost_400Regular, Jost_500Medium } from '@expo-google-fonts/jost';
import { DefaultTheme, ThemeProvider, type Theme } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from '../src/features/auth/AuthProvider';
import { MembershipProvider } from '../src/features/subscriptions/MembershipProvider';
import { colors } from '../src/styles/mobileTheme';

/**
 * Navigation's own surfaces, behind every screen and around the tab bar, are the 1c canvas
 * rather than the library's grey.
 */
const navigationTheme: Theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.background,
    card: colors.background,
    border: 'transparent',
    primary: colors.accent,
    text: colors.text
  }
};

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    /*
     * The 1c "Thread" faces (src/styles/daywoven1c.ts): Inter for text, Jost for display.
     * Fraunces is no longer loaded: no screen uses it after the 1c move.
     */
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Jost_400Regular,
    Jost_500Medium,
    Ionicons: require('../assets/fonts/Ionicons.ttf')
  });

  /**
   * Fonts gate the first render, but they must never gate it forever. A font file that
   * fails to load — a bad path, a blocked request, a host that serves the app from a
   * subdirectory — leaves fontsLoaded false for good, and returning null on that path
   * means the whole app is a black screen with nothing said about why. Rendering on
   * the error instead degrades to the system typeface, which is legible.
   */
  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <ThemeProvider value={navigationTheme}>
          <AuthProvider>
            <MembershipProvider>
              <Slot />
              {/* Dark text on the canvas by default; screens that open on the band switch it with useBandStatusBar. */}
              <StatusBar style="dark" />
            </MembershipProvider>
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background
  }
});
