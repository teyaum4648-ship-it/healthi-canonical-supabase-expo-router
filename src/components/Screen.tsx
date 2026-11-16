import { ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { PropsWithChildren, ReactNode } from 'react';

import { surface } from '../styles/daywoven1c';
import { groundStyle, spacing } from '../styles/mobileTheme';
import { useBandStatusBar } from './thread/useBandStatusBar';

type ScreenProps = PropsWithChildren<{
  scroll?: boolean;
  contentStyle?: ViewStyle;
  backgroundStyle?: ViewStyle;
  /**
   * A 1c header band (usually ThreadDetailBand) drawn full width above the content. The top
   * inset takes the band's colour and the status bar turns light while the screen is focused.
   */
  band?: ReactNode;
}>;

export function Screen({ children, scroll = true, contentStyle, backgroundStyle, band }: ScreenProps) {
  const content = <View style={[styles.content, contentStyle]}>{children}</View>;
  return band ? (
    <BandScreen band={band} scroll={scroll} backgroundStyle={backgroundStyle}>{content}</BandScreen>
  ) : (
    <SafeAreaView style={[styles.safeArea, backgroundStyle]}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {content}
        </ScrollView>
      ) : content}
    </SafeAreaView>
  );
}

function BandScreen({ band, scroll, backgroundStyle, children }: PropsWithChildren<{ band: ReactNode; scroll: boolean; backgroundStyle?: ViewStyle }>) {
  useBandStatusBar();
  return (
    <SafeAreaView edges={['top']} style={[styles.safeArea, styles.bandTop, backgroundStyle]}>
      {scroll ? (
        <ScrollView
          style={styles.canvas}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {band}
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.canvas, styles.scroll]}>{band}{children}</View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    ...groundStyle()
  },
  bandTop: { backgroundColor: surface.band },
  canvas: { backgroundColor: surface.canvas, flex: 1 },
  scroll: {
    flexGrow: 1
  },
  content: {
    flex: 1,
    gap: spacing.md,
    paddingHorizontal: 20,
    paddingBottom: 34,
    paddingTop: 18
  }
});
