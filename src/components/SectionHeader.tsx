import { StyleSheet, Text, View } from 'react-native';

import { ink } from '../styles/daywoven1c';
import { spacing, type } from '../styles/mobileTheme';

type SectionHeaderProps = {
  eyebrow?: string;
  title: string;
  body?: string;
};

/** A screen or section heading in 1c: a muted eyebrow, a Jost title and a muted line. */
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
  container: { gap: spacing.xs },
  eyebrow: { ...type.eyebrow, color: ink.muted },
  title: { ...type.largeTitle, color: ink.text },
  body: { ...type.body, color: ink.muted }
});
