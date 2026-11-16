import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { Button } from '../src/components/Button';
import { Screen } from '../src/components/Screen';
import { useAuth } from '../src/features/auth/AuthProvider';
import { DemoEntry } from '../src/features/auth/DemoEntry';
import { entryDestination } from '../src/features/auth/entryRouting';
import { colors, fonts, spacing, glassSurface } from '../src/styles/mobileTheme';
import { colors as mobileColors, type } from '../src/styles/mobileTheme';

import * as dv from '../src/styles/daywoven1c';
import { BandStatusBar } from '../src/components/thread/useBandStatusBar';
const signalTags = ['Sleep', 'Stress', 'Food', 'Recovery', 'Movement'];

export default function IndexRoute() {
  const { profile, session, isLoading, mode, startDemo } = useAuth();
  const { width } = useWindowDimensions();
  const isWide = width >= 820;
  const [startError, setStartError] = useState('');

  const destination = entryDestination({ isLoading, mode, hasSession: Boolean(session), onboardingStatus: profile?.onboarding_status });
  if (destination === 'loading') return <Screen><Text accessibilityLiveRegion="polite" style={{ ...type.body, color: mobileColors.text }}>Opening daywoven…</Text></Screen>;
  if (destination === 'demo') return <DemoEntry />;
  if (destination !== 'welcome') return <Redirect href={destination} />;
  /**
   * Entering the app from the landing screen.
   *
   * A demo build has no account registration — its auth provider rejects signUp
   * outright — so the demo path opens the local session with startDemo instead.
   * Calling signUp there left the button dead: the rejection was never caught, so
   * the navigation below it never ran and nothing told the person why.
   *
   * Anything that does fail now reaches the screen rather than an unhandled
   * rejection, because a primary call to action that silently does nothing is worse
   * than one that explains itself.
   */
  async function handleStart() {
    setStartError('');
    try {
      if (mode === 'demo') {
        await startDemo();
        router.replace('/(app)/(tabs)');
        return;
      }

      if (profile?.onboarding_status === 'completed') {
        router.replace('/(app)/(tabs)');
        return;
      }

      if (!session) {
        router.push('/(onboarding)');
        return;
      }

      router.push('/(onboarding)');
    } catch (error) {
      setStartError(error instanceof Error ? error.message : 'Could not open daywoven just now. Try again.');
    }
  }

  /**
   * Someone who has already finished onboarding does not need the pitch again.
   * Without this the landing screen is unconditional, so relaunching the installed
   * app — or reopening the demo — drops a returning person back on the marketing
   * page with their own data one tap away behind it.
   */
  if (!isLoading && session && profile?.onboarding_status === 'completed') {
    return <Redirect href="/(app)/(tabs)" />;
  }

  return (
    <Screen backgroundStyle={styles.brandBackground} contentStyle={styles.screen}>
      <BandStatusBar />
      <View style={styles.nav}>
        <Text style={styles.logo}>daywoven<Text style={{ color: dv.accent.amber }}>.</Text></Text>
        <Text style={styles.navLabel}>YOUR STARTING POINT</Text>
      </View>

      <View style={[styles.hero, isWide ? styles.heroWide : null]}>
        <View style={[styles.heroText, isWide ? styles.heroTextWide : null]}>
          <Text style={styles.eyebrow}>Adaptive Health Coaching</Text>
          <Text style={styles.headline}>
            Know what your body{'\n'}
            <Text style={styles.headlineAccent}>needs today.</Text>
          </Text>
          <Text style={styles.subcopy}>
            Sleep, food, movement and stress tell different parts of your story. Explore your
            starting point first, see a clear focus, and create an account only when you are ready to save.
          </Text>

          <Button
            disabled={isLoading}
            label="Explore your wellness baseline"
            tone="band"
            onPress={() => void handleStart()}
            style={styles.cta}
          />

          {!session && mode === 'account' ? (
            <Text onPress={() => router.push('/(auth)/login')} accessibilityRole="link" style={styles.signInLink}>Already have an account? Sign in</Text>
          ) : null}

          {startError ? (
            <Text accessibilityRole="alert" style={styles.startError}>{startError}</Text>
          ) : null}

          <View style={styles.tags}>
            {signalTags.map((tag) => (
              <Text key={tag} style={styles.tag}>
                {tag}
              </Text>
            ))}
          </View>
        </View>

        <View style={styles.visual}>
          <View style={styles.ringWrap}>
            <View style={styles.outerRing} />
            <View style={styles.mainRing} />
            <View style={styles.ringAccentOne} />
            <View style={styles.ringAccentTwo} />
            <View style={styles.ringInner}>
              <Text style={styles.ringScore}>14</Text>
              <Text style={styles.ringLabel}>Day Focus</Text>
              <Text style={styles.ringVerdict}>Calibrate first</Text>
            </View>
          </View>

          <View style={styles.metrics}>
            <View style={styles.metric}>
              <Text style={styles.metricValue}>Sleep</Text>
              <Text style={styles.metricLabel}>Rhythm</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.metric}>
              <Text style={styles.metricValue}>Food</Text>
              <Text style={styles.metricLabel}>Signal</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.metric}>
              <Text style={styles.metricValue}>Load</Text>
              <Text style={styles.metricLabel}>Context</Text>
            </View>
          </View>

          <View style={styles.protocol}>
            <View style={styles.protocolDot} />
            <View style={styles.protocolTextWrap}>
              <Text style={styles.protocolTitle}>First: your wellness test</Text>
              <Text style={styles.protocolText}>
                daywoven uses your answers to choose a calm first focus, not a label.
              </Text>
            </View>
          </View>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  brandBackground: { backgroundColor: dv.surface.band },
  signInLink: { color: dv.accent.amber, fontSize: 14, fontFamily: fonts.bodySemibold, textAlign: 'center', paddingVertical: 14 },
  startError: {
    color: colors.danger,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20
  },
  screen: {
    gap: spacing.xl,
    justifyContent: 'center',
    paddingVertical: spacing.xl
  },
  nav: {
    width: '100%',
    maxWidth: 1120,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  logo: { color: dv.bone.text, fontFamily: fonts.displayMedium, fontSize: 25, letterSpacing: -1.2 },
  navLabel: {
    color: dv.bone.soft,
    fontFamily: fonts.bodySemibold,
    fontSize: 10,
    letterSpacing: 0
  },
  hero: {
    width: '100%',
    maxWidth: 1120,
    alignSelf: 'center',
    gap: spacing.xl
  },
  heroWide: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  heroText: {
    gap: spacing.lg
  },
  heroTextWide: {
    flex: 1,
    maxWidth: 520
  },
  eyebrow: { color: dv.accent.amber, fontSize: 11, fontFamily: fonts.bodySemibold, letterSpacing: 1.2 },
  headline: { color: dv.bone.text, fontFamily: fonts.displayMedium, fontSize: 46, lineHeight: 50, letterSpacing: -1.8 },
  headlineAccent: { color: dv.accent.amber, fontFamily: fonts.bodySemibold },
  subcopy: {
    maxWidth: 430,
    color: dv.bone.soft,
    fontFamily: fonts.body,
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 27
  },
  cta: { alignSelf: 'stretch', borderRadius: 14, minHeight: 56 },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm
  },
  tag: { borderWidth: 1, borderColor: dv.bone.outline, color: dv.bone.soft, borderRadius: 18, fontSize: 11, fontFamily: fonts.bodySemibold, paddingHorizontal: 12, paddingVertical: 8 },
  visual: {
    alignItems: 'center',
    gap: spacing.lg
  },
  ringWrap: {
    width: 280,
    height: 280,
    alignItems: 'center',
    justifyContent: 'center'
  },
  outerRing: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderWidth: 1,
    borderColor: dv.bone.hairline,
    borderRadius: 130
  },
  mainRing: {
    position: 'absolute',
    width: 224,
    height: 224,
    borderWidth: 1,
    borderColor: dv.bone.hairline,
    borderRadius: 112
  },
  ringAccentOne: {
    position: 'absolute',
    top: 24,
    right: 54,
    width: 72,
    height: 72,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderColor: dv.bone.outline,
    borderRadius: 36
  },
  ringAccentTwo: {
    position: 'absolute',
    bottom: 44,
    left: 58,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: dv.bone.text,
    shadowColor: dv.surface.band,
    shadowOpacity: 0.6,
    shadowRadius: 12
  },
  ringInner: {
    alignItems: 'center',
    gap: spacing.xs
  },
  ringScore: {
    color: dv.bone.text,
    fontFamily: fonts.display,
    fontSize: 74,
    fontWeight: '300',
    lineHeight: 78
  },
  ringLabel: {
    color: dv.accent.amber,
    fontFamily: fonts.bodySemibold,
    fontSize: 10,
    letterSpacing: 0
  },
  ringVerdict: {
    color: dv.bone.soft,
    fontFamily: fonts.body,
    fontSize: 12
  },
  metrics: { width: 300, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: dv.bone.hairline, borderRadius: 20, backgroundColor: dv.bone.raised, paddingHorizontal: spacing.md, paddingVertical: spacing.md },
  metric: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs
  },
  metricValue: {
    color: dv.bone.text,
    fontFamily: fonts.display,
    fontSize: 18
  },
  metricLabel: {
    color: dv.bone.soft,
    fontFamily: fonts.bodySemibold,
    fontSize: 9,
    letterSpacing: 0
  },
  divider: {
    width: 1,
    height: 30,
    backgroundColor: dv.bone.raised
  },
  protocol: { width: 300, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderColor: dv.bone.hairline, borderLeftWidth: 3, borderLeftColor: dv.bone.outline, borderRadius: 18, backgroundColor: dv.bone.raised, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  protocolDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: dv.bone.text
  },
  protocolTextWrap: {
    flex: 1
  },
  protocolTitle: {
    color: dv.bone.text,
    fontFamily: fonts.bodySemibold,
    fontSize: 12
  },
  protocolText: {
    color: dv.bone.soft,
    fontFamily: fonts.body,
    fontSize: 11,
    lineHeight: 16
  }
});
