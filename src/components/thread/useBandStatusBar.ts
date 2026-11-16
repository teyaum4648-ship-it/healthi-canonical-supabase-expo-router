import { useFocusEffect } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { useCallback } from 'react';

/**
 * A screen that opens on the charcoal 1c band (design language P1) shows light-content
 * status bar text while it is focused, and hands back the canvas default (dark text) when
 * it loses focus, so the clock and battery stay readable on either ground.
 */
export function useBandStatusBar() {
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle('light');
      return () => setStatusBarStyle('dark');
    }, [])
  );
}
