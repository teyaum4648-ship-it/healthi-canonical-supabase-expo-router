import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts, spacing } from '../styles/theme';
import { colors as mobileColors, fonts as mobileFonts, spacing as mobileSpacing } from '../styles/mobileTheme';

type SectionHeaderProps = {
  eyebrow?: string;
  title: string;
  body?: string;
  appearance?: 'default' | 'mobile';
};

export function SectionHeader({ eyebrow, title, body, appearance = 'default' }: SectionHeaderProps) {
  const usesMobileTheme = appearance === 'mobile';
  return (
    <View style={[styles.container, usesMobileTheme ? mobileStyles.container : null]}>
      {eyebrow ? <Text style={[styles.eyebrow, usesMobileTheme ? mobileStyles.eyebrow : null]}>{eyebrow}</Text> : null}
      <Text style={[styles.title, usesMobileTheme ? mobileStyles.title : null]}>{title}</Text>
      {body ? <Text style={[styles.body, usesMobileTheme ? mobileStyles.body : null]}>{body}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs
  },
  eyebrow: {
    color: colors.deepViolet,
    fontFamily: fonts.body,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase'
  },
  title: {
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: 36,
    fontWeight: '400',
    lineHeight: 40
  },
  body: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 25
  }
});

const mobileStyles = StyleSheet.create({
  container: {
    gap: mobileSpacing.xs
  },
  eyebrow: {
    color: mobileColors.accent,
    fontFamily: mobileFonts.bodyMedium,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase'
  },
  title: {
    color: mobileColors.text,
    fontFamily: mobileFonts.display,
    fontSize: 34,
    fontWeight: '700',
    letterSpacing: -0.8,
    lineHeight: 40
  },
  body: {
    color: mobileColors.textMuted,
    fontFamily: mobileFonts.body,
    fontSize: 16,
    lineHeight: 23
  }
});
