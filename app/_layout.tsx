import {
  Fraunces_300Light,
  Fraunces_400Regular,
  Fraunces_400Regular_Italic
} from '@expo-google-fonts/fraunces';
import {
  Inter_400Regular,
  Inter_500Medium
} from '@expo-google-fonts/inter';
import { useFonts } from 'expo-font';
import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from '../src/features/auth/AuthProvider';

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Fraunces_300Light,
    Fraunces_400Regular,
    Fraunces_400Regular_Italic,
    Inter_400Regular,
    Inter_500Medium,
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
        <AuthProvider>
          <Slot />
          <StatusBar style="light" />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1
  }
});
