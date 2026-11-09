import React from 'react';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PhotoEntrySheet } from '../../../src/features/nutrition/photoEstimate/PhotoEntrySheet';

const controls = vi.hoisted(() => [] as { disabled?: boolean; onPress: () => void }[]);
const consent = vi.hoisted(() => ({ checked: false, onChange: null as ((next: boolean) => void) | null }));
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return { ...actual, useState: () => [consent.checked, (next: boolean) => { consent.checked = next; }] };
});
vi.mock('../../../src/components/CheckBox', () => ({
  CheckBox: (props: { checked: boolean; onChange: (next: boolean) => void; label: string; disabled?: boolean }) => {
    consent.onChange = props.onChange;
    return <label>{props.label}<input type="checkbox" checked={props.checked} disabled={props.disabled} readOnly /></label>;
  }
}));
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


describe('Photo meal entry', () => {
  beforeEach(() => { controls.length = 0; consent.checked = false; consent.onChange = null; });
  const defaults = { busy: false, notice: '', onClose: vi.fn(), onSearch: vi.fn(), onCapture: vi.fn() };

  it('requires a separate affirmative AI consent before either capture path can run', () => {
    const onCapture = vi.fn();
    const html = renderToStaticMarkup(<PhotoEntrySheet {...defaults} available onCapture={onCapture} />);
    expect(html).toContain('Take a photo');
    expect(html).toContain('Choose a photo');
    expect(html).toContain('Review estimated foods and portions');
    expect(html).toContain('Anthropic');
    expect(html).toContain('daywoven does not store the photo');
    expect(consent.checked).toBe(false);
    expect(controls.slice(0, 2).every(control => control.disabled)).toBe(true);
    // A direct callback cannot bypass the disabled controls, either.
    controls[0].onPress(); controls[1].onPress();
    expect(onCapture).not.toHaveBeenCalled();

    consent.onChange?.(true);
    controls.length = 0;
    renderToStaticMarkup(<PhotoEntrySheet {...defaults} available onCapture={onCapture} />);
    expect(controls.slice(0, 2).some(control => control.disabled)).toBe(false);
    controls[0].onPress(); controls[1].onPress();
    expect(onCapture.mock.calls).toEqual([['camera'], ['library']]);

    consent.onChange?.(false);
    controls.length = 0;
    renderToStaticMarkup(<PhotoEntrySheet {...defaults} available onCapture={onCapture} />);
    controls[0].onPress();
    expect(onCapture).toHaveBeenCalledTimes(2);
  });

  it('explains demo availability before capture and retains a working search alternative', () => {
    const onSearch = vi.fn();
    const onCapture = vi.fn();
    consent.checked = true;
    const html = renderToStaticMarkup(<PhotoEntrySheet {...defaults} available={false} onSearch={onSearch} onCapture={onCapture} />);
    expect(html).toContain('Photo estimates are not enabled in this demo');
    expect(html).toContain('No photo will be uploaded');
    expect(controls.slice(0, 2).every(control => control.disabled)).toBe(true);
    controls[0].onPress(); controls[1].onPress();
    expect(onCapture).not.toHaveBeenCalled();
    controls[2].onPress();
    expect(onSearch).toHaveBeenCalledOnce();
  });

  it('prevents another capture while working and keeps provider errors visible', () => {
    consent.checked = true;
    const onCapture = vi.fn();
    const html = renderToStaticMarkup(<PhotoEntrySheet {...defaults} available busy onCapture={onCapture} notice="Service is unavailable. Try search instead." />);
    expect(controls.every(control => control.disabled)).toBe(true);
    controls[0].onPress(); controls[1].onPress();
    expect(onCapture).not.toHaveBeenCalled();
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
