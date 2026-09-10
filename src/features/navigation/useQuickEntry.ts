import { useCallback, useRef } from 'react';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { quickEntryRequest } from './navigationModel';

/** Consume an entry intent once; ordinary tab switches never reopen a form. */
export function useQuickEntry(open: () => void, ready = true) {
  const { action, entry } = useLocalSearchParams<{ action?: string | string[]; entry?: string | string[] }>();
  const consumed = useRef<string | null>(null);
  useFocusEffect(useCallback(() => {
    const request = quickEntryRequest(action, entry);
    if (!request) { consumed.current = null; return; }
    if (!ready || !request || consumed.current === request) return;
    consumed.current = request;
    open();
    router.setParams({ action: undefined, entry: undefined });
  }, [action, entry, open, ready]));
}
