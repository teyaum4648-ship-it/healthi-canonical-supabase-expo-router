import { Ionicons } from '@expo/vector-icons';
import type { PropsWithChildren, ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { control, HIT, ink, surface, type } from '../../styles/daywoven1c';
import { useReducedMotion } from './useReducedMotion';

/**
 * Every sheet in the 1c style (design language P15): the canvas, a 20pt top radius, a Jost
 * title, and the primary action pinned at the bottom.
 */
export function EntrySheet({ title, children, onClose, footer, busy = false }: PropsWithChildren<{
  title: string; onClose: () => void; footer?: ReactNode; busy?: boolean;
}>) {
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  return (
    <Modal transparent animationType={reducedMotion ? 'none' : 'fade'} onRequestClose={() => { if (!busy) onClose(); }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.backdrop}>
        <Pressable accessible={false} disabled={busy} onPress={onClose} style={StyleSheet.absoluteFill} />
        <View accessibilityViewIsModal style={[styles.sheet, { paddingBottom: Math.max(16, insets.bottom), marginTop: insets.top + 12 }]}>
          <View style={styles.grabber} />
          <View style={styles.header}>
            <Text accessibilityRole="header" style={styles.title}>{title}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Close" disabled={busy} onPress={onClose} style={({ pressed }) => [styles.close, pressed && styles.pressed]}>
              <Ionicons accessible={false} name="close" size={20} color={ink.text} />
            </Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={styles.content}>
            {children}
          </ScrollView>
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: control.scrim },
  sheet: { alignSelf: 'center', backgroundColor: surface.canvas, borderTopLeftRadius: control.sheetRadius, borderTopRightRadius: control.sheetRadius, maxHeight: '92%', maxWidth: 620, width: '100%' },
  grabber: { alignSelf: 'center', backgroundColor: ink.border, borderRadius: 3, height: 5, marginTop: 8, width: 38 },
  header: { alignItems: 'center', flexDirection: 'row', gap: 12, paddingBottom: 6, paddingHorizontal: 20, paddingTop: 8 },
  title: { ...type.sectionTitle, color: ink.text, flex: 1 },
  close: { alignItems: 'center', backgroundColor: ink.wash, borderRadius: HIT / 2, justifyContent: 'center', minHeight: HIT, minWidth: HIT },
  pressed: { opacity: 0.65 },
  content: { gap: 16, paddingBottom: 20, paddingHorizontal: 20, paddingTop: 10 },
  footer: { borderTopColor: ink.hairline, borderTopWidth: 1, paddingHorizontal: 20, paddingTop: 12 }
});
