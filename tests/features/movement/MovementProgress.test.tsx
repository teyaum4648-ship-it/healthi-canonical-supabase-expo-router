import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
vi.mock('react-native', () => ({
  StyleSheet: { create: (value: unknown) => value, hairlineWidth: 1 },
  Platform: { select: (value: { web: string }) => value.web },
  Text: ({ children }: React.PropsWithChildren) => <span>{children}</span>,
  View: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  ScrollView: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  Pressable: ({ children }: React.PropsWithChildren) => <button>{children}</button>
}));
vi.mock('../../../src/components/mobile/EntrySheet', () => ({ EntrySheet: ({ children }: React.PropsWithChildren) => <div>{children}</div> }));

import { MovementProgress } from '../../../src/features/movement/MovementProgress';
import { createDemoQuickWorkoutRows, createQuickWorkoutFromText, quickWorkoutToInputs } from '../../../src/features/movement/workoutQuickLog';

describe('History progress screen rendering', () => {
  it('renders custom exercise history without a movement-pattern match', () => {
    const draft = createQuickWorkoutFromText('My custom lift', '2026-09-12T15:00:00Z')!;
    draft.exercises[0].sets[0] = { ...draft.exercises[0].sets[0], reps: '8', weight: '40', completed: true };
    const result = quickWorkoutToInputs(draft, 'demo', '2026-09-12T15:30:00Z');
    if (!result.ok) throw new Error(result.error);
    const rows = createDemoQuickWorkoutRows(result.value);
    const html = renderToStaticMarkup(<MovementProgress sessions={[rows.session]} entries={rows.exercises} sets={rows.sets} library={[]} unit="lb" today="2026-09-12" />);
    expect(html).toContain('Movement patterns are not available');
    expect(html).toContain('My Custom Lift');
    expect(html).toContain('EXERCISES');
    expect(html).not.toContain('Nothing logged in this window');
  });

  it('renders a useful empty history for a new user', () => {
    const html = renderToStaticMarkup(<MovementProgress sessions={[]} entries={[]} sets={[]} library={[]} unit="lb" today="2026-09-12" />);
    expect(html).toContain('No exercise history yet');
    expect(html).toContain('No working sets logged');
  });
});
