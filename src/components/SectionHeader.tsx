import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing, type } from '../styles/mobileTheme';

type SectionHeaderProps = {
  eyebrow?: string;
  title: string;
  body?: string;
};

export function SectionHeader({ eyebrow, title, body }: SectionHeaderProps) {
  return (
    <View style={styles.container}>
      {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
      <Text accessibilityRole="header" style={styles.title}>{title}</Text>
      {body ? <Text style={styles.body}>{body}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs
  },
  eyebrow: {
    ...type.eyebrow,
    color: colors.accent
  },
  title: {
    ...type.largeTitle,
    color: colors.text
  },
  body: {
    ...type.body,
    color: colors.textMuted
  }
});
