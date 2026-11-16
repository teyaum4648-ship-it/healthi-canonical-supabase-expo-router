import { useFocusEffect } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { useCallback } from 'react';

/**
 * A screen that opens on the charcoal 1c band (design language P1) shows light-content
 * status bar text while it is focused, and hands back the canvas default (dark text) when
 * it loses focus, so the clock and battery stay readable on either ground.
 *
 * `active` is for screens that sometimes show a full-screen view on the canvas instead of
 * the band (a workout in progress): the bar follows whichever is showing.
 */
export function useBandStatusBar(active = true) {
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle(active ? 'light' : 'dark');
      return () => setStatusBarStyle('dark');
    }, [active])
  );
}

/** The same, as an element, for screens that choose the band in JSX after early returns. */
export function BandStatusBar({ active = true }: { active?: boolean }) {
  useBandStatusBar(active);
  return null;
}
