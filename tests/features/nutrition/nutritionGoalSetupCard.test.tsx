import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const rows = vi.hoisted(() => [] as { title: string; detail?: string; onPress: () => void }[]);
const saved = vi.hoisted(() => ({ value: null as unknown }));

vi.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
vi.mock('@react-native-async-storage/async-storage', () => ({ default: { getItem: async () => null, setItem: async () => undefined } }));
vi.mock('react-native', () => ({
  StyleSheet: { create: (value: unknown) => value, hairlineWidth: 1 },
  Platform: { select: (value: { web: string }) => value.web },
  ActivityIndicator: () => <span>Loading</span>,
  Text: ({ children }: React.PropsWithChildren) => <span>{children}</span>,
  TextInput: () => <input />,
  View: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  Pressable: ({ children }: React.PropsWithChildren) => <button>{children}</button>
}));
vi.mock('../../../src/components/mobile/EntrySheet', () => ({ EntrySheet: ({ children }: React.PropsWithChildren) => <div>{children}</div> }));
vi.mock('../../../src/components/mobile/ActionRow', () => ({
  ActionRow: (props: { title: string; detail?: string; onPress: () => void }) => { rows.push(props); return <div>{props.title}</div>; }
}));
vi.mock('../../../src/features/nutrition/nutritionGoalStore', () => ({ readGoalSetup: async () => null, saveGoalSetup: async () => null }));

import { GoalsCard } from '../../../src/features/nutrition/NutritionGoalSetup';
import { estimateNutritionGoals, type GoalAnswers, type GoalPatternInput, type GoalSetup } from '../../../src/features/nutrition/nutritionGoalEngine';

const adult: GoalAnswers = { age: 30, heightCm: 175, weightKg: 75, equation: 'male', activity: 'light', goal: 'maintain', needsGuidance: 'no' };

function render(pattern: GoalPatternInput | null, onOpenPattern = () => {}, setup: GoalSetup | null = saved.value as GoalSetup | null) {
  rows.length = 0;
  renderToStaticMarkup(<GoalsCard setup={setup} pattern={pattern} onEdit={() => {}} onOpenPattern={onOpenPattern} />);
  return rows;
}

describe('the goals card', () => {
  beforeEach(() => { saved.value = null; });

  it('offers the Food Pattern Test beside the goals themselves', () => {
    const shown = render(null);
    expect(shown.map(row => row.title)).toEqual(['Set up my goals', 'Take the Food Pattern Test']);
  });
  it('sends the pattern row to the quiz', () => {
    const open = vi.fn();
    render({ label: 'protein_forward', confidence: 'medium' }, open).at(-1)!.onPress();
    expect(open).toHaveBeenCalledTimes(1);
  });
  it('names a pattern that is shaping the split', () => {
    const shown = render({ label: 'protein_forward', confidence: 'medium' });
    expect(shown.at(-1)!.title).toBe('Protein-forward pattern');
    expect(shown.at(-1)!.detail).toContain('more protein');
  });
  it('does not send someone to the quiz when the goals row is what they want', () => {
    const edit = vi.fn(), open = vi.fn();
    rows.length = 0;
    renderToStaticMarkup(<GoalsCard setup={null} pattern={null} onEdit={edit} onOpenPattern={open} />);
    rows[0].onPress();
    expect(edit).toHaveBeenCalledTimes(1);
    expect(open).not.toHaveBeenCalled();
  });
  it('says so when a changed pattern would now give a different split', () => {
    saved.value = estimateNutritionGoals(adult, '2026-09-10T12:00:00Z', { label: 'protein_forward', confidence: 'medium' });
    const shown = render({ label: 'carb_supported', confidence: 'medium' });
    expect(shown[0].title).toBe('Your personalized goals');
    expect(shown[0].detail).toContain('food pattern changed');
  });
  it('leaves a saved estimate alone when the pattern still points the same way', () => {
    saved.value = estimateNutritionGoals(adult, '2026-09-10T12:00:00Z', { label: 'protein_forward', confidence: 'medium' });
    expect(render({ label: 'protein_forward', confidence: 'high' })[0].detail).toContain('Update your answers anytime');
  });
});
