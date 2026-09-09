import { ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { PropsWithChildren } from 'react';

import { colors, spacing } from '../styles/theme';
import { colors as mobileColors, spacing as mobileSpacing } from '../styles/mobileTheme';

type ScreenProps = PropsWithChildren<{
  scroll?: boolean;
  contentStyle?: ViewStyle;
  appearance?: 'default' | 'mobile';
}>;

export function Screen({ children, scroll = true, contentStyle, appearance = 'default' }: ScreenProps) {
  const usesMobileTheme = appearance === 'mobile';
  const content = <View style={[styles.content, usesMobileTheme ? mobileStyles.content : null, contentStyle]}>{children}</View>;

  return (
    <SafeAreaView style={[styles.safeArea, usesMobileTheme ? mobileStyles.safeArea : null]}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={!usesMobileTheme}
        >
          {content}
        </ScrollView>
      ) : content}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background
  },
  scroll: {
    flexGrow: 1
  },
  content: {
    flex: 1,
    gap: spacing.md,
    padding: spacing.lg
  }
});

const mobileStyles = StyleSheet.create({
  safeArea: {
    backgroundColor: mobileColors.background
  },
  content: {
    gap: mobileSpacing.md,
    paddingHorizontal: 22,
    paddingBottom: 34,
    paddingTop: 18
  }
});
