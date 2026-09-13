import {
  StyleSheet,
  Text,
  TextInput as NativeTextInput,
  type TextInputProps as NativeTextInputProps
} from 'react-native';

import { colors, radii, spacing, type } from '../styles/mobileTheme';

type TextInputProps = NativeTextInputProps & {
  label: string;
};

export function TextInput({ label, style, ...props }: TextInputProps) {
  return (
    <>
      <Text style={styles.label}>{label}</Text>
      <NativeTextInput
        autoCapitalize="none"
        placeholderTextColor={colors.textFaint}
        style={[styles.input, style]}
        {...props}
      />
    </>
  );
}

const styles = StyleSheet.create({
  label: {
    ...type.caption,
    color: colors.textMuted
  },
  input: {
    minHeight: 52,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceInset,
    color: colors.text,
    fontSize: 16,
    paddingHorizontal: spacing.md
  }
});
