import { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput as NativeTextInput,
  type TextInputProps as NativeTextInputProps
} from 'react-native';

import { control, font, ink, radius, surface } from '../styles/daywoven1c';
import { spacing, type } from '../styles/mobileTheme';

type TextInputProps = NativeTextInputProps & {
  label: string;
};

/** A 1c text field (design language P15): white, a 1pt border, and an ink ring while focused. */
export function TextInput({ label, style, onFocus, onBlur, ...props }: TextInputProps) {
  const [focused, setFocused] = useState(false);
  return (
    <>
      <Text style={styles.label}>{label}</Text>
      <NativeTextInput
        accessibilityLabel={label}
        autoCapitalize="none"
        placeholderTextColor={ink.muted}
        onFocus={(event) => { setFocused(true); onFocus?.(event); }}
        onBlur={(event) => { setFocused(false); onBlur?.(event); }}
        style={[styles.input, focused && styles.focused, style]}
        {...props}
      />
    </>
  );
}

const styles = StyleSheet.create({
  label: {
    ...type.caption,
    color: ink.muted
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: control.inputBorder,
    borderRadius: radius.button,
    backgroundColor: surface.card,
    color: ink.text,
    fontFamily: font.body,
    fontSize: 16,
    paddingHorizontal: spacing.md
  },
  focused: {
    borderColor: control.focusRing,
    borderWidth: 1.5
  }
});
