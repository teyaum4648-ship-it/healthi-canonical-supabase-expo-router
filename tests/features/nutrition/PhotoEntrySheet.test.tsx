import React from 'react';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const controls = vi.hoisted(() => [] as { disabled?: boolean; onPress: () => void }[]);
vi.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
vi.mock('react-native', () => ({
  StyleSheet: { create: (value: unknown) => value, hairlineWidth: 1 },
  Platform: { select: (value: { web: string }) => value.web },
  ActivityIndicator: () => <span>Loading</span>,
  Text: ({ children }: React.PropsWithChildren) => <span>{children}</span>,
  View: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  Pressable: (props: React.PropsWithChildren<{ disabled?: boolean; onPress: () => void }>) => {
    controls.push(props);
    return <button disabled={props.disabled}>{props.children}</button>;
  }
}));
vi.mock('../../../src/components/mobile/EntrySheet', () => ({
  EntrySheet: ({ children, title }: React.PropsWithChildren<{ title: string }>) => <div><h1>{title}</h1>{children}</div>
}));

import { PhotoEntrySheet } from '../../../src/features/nutrition/photoEstimate/PhotoEntrySheet';

describe('Photo meal entry', () => {
  beforeEach(() => { controls.length = 0; });
  const defaults = { busy: false, notice: '', onClose: vi.fn(), onSearch: vi.fn(), onCapture: vi.fn() };

  it('offers both camera and library with the right capture source', () => {
    const onCapture = vi.fn();
    const html = renderToStaticMarkup(<PhotoEntrySheet {...defaults} available onCapture={onCapture} />);
    expect(html).toContain('Take a photo');
    expect(html).toContain('Choose a photo');
    expect(html).toContain('Review estimated foods and portions');
    controls[0].onPress();
    controls[1].onPress();
    expect(onCapture.mock.calls).toEqual([['camera'], ['library']]);
  });

  it('explains demo availability before capture and retains a working search alternative', () => {
    const onSearch = vi.fn();
    const html = renderToStaticMarkup(<PhotoEntrySheet {...defaults} available={false} onSearch={onSearch} />);
    expect(html).toContain('Photo estimates are not enabled in this demo');
    expect(html).toContain('No photo will be uploaded');
    expect(controls.slice(0, 2).every(control => control.disabled)).toBe(true);
    controls[2].onPress();
    expect(onSearch).toHaveBeenCalledOnce();
  });

  it('prevents another capture while working and keeps provider errors visible', () => {
    const html = renderToStaticMarkup(<PhotoEntrySheet {...defaults} available busy notice="Service is unavailable. Try search instead." />);
    expect(controls.every(control => control.disabled)).toBe(true);
    expect(html).toContain('Preparing your photo estimate');
    expect(html).toContain('Service is unavailable');
  });

  it('wires entry to the diary and picker, and returns confirmed foods to meal review', () => {
    const screen = readFileSync('app/(app)/(tabs)/food.tsx', 'utf8');
    const diary = screen.slice(screen.indexOf('function renderDiary()'), screen.indexOf('function renderGuidance()'));
    expect(diary).toContain('title="Photo meal"');
    expect(diary).toContain('onPress={openPhotoEntry}');
    // The diary row only appears where photo estimates work; the picker still explains them.
    expect(diary).toContain('{canUseRemote ? <ActionRow title="Photo meal"');
    expect(diary.indexOf('<DietIntakeSummary')).toBeLessThan(diary.indexOf('title="Photo meal"'));
    expect(screen).toContain('onPhoto={openPhotoEntry}');
    const confirm = screen.slice(screen.indexOf('async function confirmPhotoEstimate()'), screen.indexOf('function openPhotoEntry()'));
    expect(confirm).toContain("setActiveSegment('Build Meal')");
    expect(confirm).toContain("'photo'");
  });
});
