import { useEffect } from 'react';
import { AppState } from 'react-native';

/** An interrupted guided session ends; it never resumes a hold or counts time away. */
export function useStopOnBackground(active: boolean, stop: () => void) {
  useEffect(() => {
    if (!active) return;
    const subscription = AppState.addEventListener('change', state => {
      if (state !== 'active') stop();
    });
    return () => subscription.remove();
  }, [active, stop]);
}
