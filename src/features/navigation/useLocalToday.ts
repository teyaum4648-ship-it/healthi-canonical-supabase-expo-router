import { useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { localDay } from '../../utils/localDay';

/** Recheck after midnight, tab focus, or a phone returning from the background. */
export function useLocalToday() {
  const [today, setToday] = useState(() => localDay());
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const refresh = () => {
      setToday(localDay());
      clearTimeout(timer);
      const now = new Date();
      const midnight = new Date(now);
      midnight.setHours(24, 0, 0, 0);
      timer = setTimeout(refresh, midnight.getTime() - now.getTime() + 50);
    };
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') refresh(); });
    if (Platform.OS === 'web') {
      window.addEventListener('focus', refresh);
      document.addEventListener('visibilitychange', refresh);
    }
    refresh();
    return () => {
      clearTimeout(timer);
      subscription.remove();
      if (Platform.OS === 'web') {
        window.removeEventListener('focus', refresh);
        document.removeEventListener('visibilitychange', refresh);
      }
    };
  }, []);
  return today;
}
