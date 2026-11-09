import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { TextInput } from '../../../src/components/TextInput';

vi.mock('react-native', () => ({
  StyleSheet: { create: (value: unknown) => value, hairlineWidth: 1 },
  Platform: { select: (value: { web: string }) => value.web },
  Text: ({ children }: React.PropsWithChildren) => <span>{children}</span>,
  TextInput: ({ accessibilityLabel, value }: { accessibilityLabel?: string; value?: string }) => <input aria-label={accessibilityLabel} value={value} readOnly />
}));

describe('Shared text field accessible name', () => {
  it('exposes the visible field label to assistive technology', () => {
    const html = renderToStaticMarkup(<TextInput label="Email address" value="" />);
    expect(html).toContain('aria-label="Email address"');
  });

  it('preserves a caller-provided more specific accessible name', () => {
    const html = renderToStaticMarkup(<TextInput label="Answer" accessibilityLabel="Usual bedtime" value="" />);
    expect(html).toContain('aria-label="Usual bedtime"');
    expect(html).not.toContain('aria-label="Answer"');
  });
});
