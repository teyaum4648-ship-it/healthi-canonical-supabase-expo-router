import { ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { PropsWithChildren } from 'react';

import { groundStyle, spacing } from '../styles/mobileTheme';

type ScreenProps = PropsWithChildren<{
  scroll?: boolean;
  contentStyle?: ViewStyle;
  backgroundStyle?: ViewStyle;
}>;

export function Screen({ children, scroll = true, contentStyle, backgroundStyle }: ScreenProps) {
  const content = <View style={[styles.content, contentStyle]}>{children}</View>;

  return (
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

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    ...groundStyle()
  },
  scroll: {
    flexGrow: 1
  },
  content: {
    flex: 1,
    gap: spacing.md,
    paddingHorizontal: 22,
    paddingBottom: 34,
    paddingTop: 18
  }
});
