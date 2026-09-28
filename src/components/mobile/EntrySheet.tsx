import { Ionicons } from '@expo/vector-icons';
import type { PropsWithChildren, ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, type, glassSurface } from '../../styles/mobileTheme';
import { useReducedMotion } from './useReducedMotion';

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
          <View style={styles.header}>
            <Text accessibilityRole="header" style={styles.title}>{title}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Close" disabled={busy} onPress={onClose} style={styles.close}>
              <Ionicons accessible={false} name="close" size={23} color={colors.textMuted} />
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
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: { ...glassSurface, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '92%', width: '100%', maxWidth: 620, alignSelf: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.borderStrong },
  header: { flexDirection: 'row', gap: 12, alignItems: 'center', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  title: { ...type.heading, flex: 1, color: colors.text },
  close: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: colors.surfaceInset },
  content: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 20, gap: 16 },
  footer: { borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.borderStrong, paddingTop: 12, paddingHorizontal: 20 }
});
