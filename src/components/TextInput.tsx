import {
  StyleSheet,
  Text,
  TextInput as NativeTextInput,
  type TextInputProps as NativeTextInputProps
} from 'react-native';

import { colors, radii, spacing } from '../styles/theme';

type TextInputProps = NativeTextInputProps & {
  label: string;
};

export function TextInput({ label, style, ...props }: TextInputProps) {
  return (
    <>
      <Text style={styles.label}>{label}</Text>
      <NativeTextInput
        autoCapitalize="none"
        placeholderTextColor={colors.textMuted}
        style={[styles.input, style]}
        {...props}
      />
    </>
  );
}

const styles = StyleSheet.create({
  label: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700'
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    color: colors.text,
    fontSize: 16,
    paddingHorizontal: spacing.md
  }
});
