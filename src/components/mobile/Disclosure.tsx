import { useState, type PropsWithChildren } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { font, ink, radius, surface } from '../../styles/daywoven1c';
import { RotatingChevron } from '../thread/RotatingChevron';

/**
 * A 1c disclosure (design language P3): a white card, radius 14, whose header opens what it
 * holds, with a chevron that turns over. Safety notices never go inside one.
 */
export function Disclosure({ title, detail, children, initiallyOpen = false }: PropsWithChildren<{
  title: string; detail?: string; initiallyOpen?: boolean;
}>) {
  const [open, setOpen] = useState(initiallyOpen);
  return (
    <View style={styles.section}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen(!open)} style={({ pressed }) => [styles.header, pressed && styles.pressed]}>
        <View style={styles.copy}>
          <Text style={styles.title}>{title}</Text>
          {detail ? <Text style={styles.detail}>{detail}</Text> : null}
        </View>
        <RotatingChevron open={open} color={ink.text} size={17} />
      </Pressable>
      {open ? <View style={styles.content}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { backgroundColor: surface.card, borderColor: ink.border, borderRadius: radius.card, borderWidth: 1, paddingHorizontal: 16 },
  header: { alignItems: 'center', flexDirection: 'row', gap: 12, minHeight: 56, paddingVertical: 14 },
  copy: { flex: 1, gap: 3 },
  title: { color: ink.text, fontFamily: font.bodySemibold, fontSize: 15, lineHeight: 20 },
  detail: { color: ink.muted, fontFamily: font.body, fontSize: 12.5, lineHeight: 17.5 },
  content: { gap: 12, paddingBottom: 16 },
  pressed: { opacity: 0.65 }
});
