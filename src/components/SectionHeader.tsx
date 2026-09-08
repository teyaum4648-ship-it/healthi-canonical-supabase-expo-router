import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts, spacing } from '../styles/theme';

type SectionHeaderProps = {
  eyebrow?: string;
  title: string;
  body?: string;
};

export function SectionHeader({ eyebrow, title, body }: SectionHeaderProps) {
  return (
    <View style={styles.container}>
      {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
      <Text style={styles.title}>{title}</Text>
      {body ? <Text style={styles.body}>{body}</Text> : null}
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
