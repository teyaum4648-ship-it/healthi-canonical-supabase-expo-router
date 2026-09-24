import { describe, expect, it, vi } from 'vitest';

import { BREATH_TECHNIQUES, techniqueById } from '../../../src/features/practice/breathTechniques';
import { techniquesToShow } from '../../../src/features/practice/TechniquePicker';

/* vi.mock is hoisted above the imports, so the picker loads against these stubs. */
vi.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
vi.mock('react-native', () => ({ Pressable: () => null, StyleSheet: { create: (styles: unknown) => styles, hairlineWidth: 1 }, Text: () => null, View: () => null, Platform: { select: (options: Record<string, unknown>) => options.default } }));

describe('techniquesToShow', () => {
  it('shows the first three until More is opened', () => {
    expect(techniquesToShow(BREATH_TECHNIQUES, BREATH_TECHNIQUES[0]!.id, false)).toHaveLength(3);
    expect(techniquesToShow(BREATH_TECHNIQUES, BREATH_TECHNIQUES[0]!.id, true)).toHaveLength(BREATH_TECHNIQUES.length);
  });

  it('keeps the technique in use visible even when it is further down', () => {
    const last = BREATH_TECHNIQUES[BREATH_TECHNIQUES.length - 1]!;
    const shown = techniquesToShow(BREATH_TECHNIQUES, last.id, false);
    expect(shown).toHaveLength(4);
    expect(shown[3]?.id).toBe(last.id);
  });
});

describe('technique names', () => {
  it('use original names rather than a trademarked method', () => {
    for (const technique of BREATH_TECHNIQUES) expect(`${technique.name} ${technique.summary} ${technique.when} ${technique.why}`).not.toMatch(/wim hof/i);
    expect(techniqueById('cyclic_hyperventilation').name).toBe('Vitalizing breathing');
  });
});
