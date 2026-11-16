import { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput as NativeTextInput,
  type TextInputProps as NativeTextInputProps
} from 'react-native';

import { accent, control, font, ink, radius, surface } from '../styles/daywoven1c';
import { spacing, type } from '../styles/mobileTheme';

type TextInputProps = NativeTextInputProps & {
  label: string;
  /** A short line under the field. Replaced by `error` while there is one. */
  hint?: string | null;
  /** What is wrong with this field, in plain words. Marks the field and is announced. */
  error?: string | null;
};

/**
 * A 1c text field (design language P15): white, a 1pt border, and an ink ring while focused.
 * An error marks the border amber and sits right under the field it belongs to.
 */
export function TextInput({ label, hint, error, style, onFocus, onBlur, ...props }: TextInputProps) {
  const [focused, setFocused] = useState(false);
  return (
    <>
      <Text style={styles.label}>{label}</Text>
      <NativeTextInput
        accessibilityLabel={label}
        accessibilityHint={error ?? hint ?? undefined}
        autoCapitalize="none"
        placeholderTextColor={ink.muted}
        onFocus={(event) => { setFocused(true); onFocus?.(event); }}
        onBlur={(event) => { setFocused(false); onBlur?.(event); }}
        style={[styles.input, focused && styles.focused, error ? styles.invalid : null, style]}
        {...props}
      />
      {error ? (
        <Text accessibilityLiveRegion="polite" accessibilityRole="alert" style={styles.error}>{error}</Text>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
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
  },
  invalid: {
    borderColor: accent.amberDeep,
    borderWidth: 1.5
  },
  hint: { ...type.caption, color: ink.muted, marginTop: -4 },
  error: { ...type.caption, color: accent.amberDeep, fontFamily: font.bodyMedium, marginTop: -4 }
});
