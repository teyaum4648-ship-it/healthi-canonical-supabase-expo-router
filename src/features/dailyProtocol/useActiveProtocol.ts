import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import type { DailyProtocol } from '../../engines/protocol';
import { localDailyProtocolStore } from './dailyProtocolPersistence';

/**
 * Read-only access to the active daily protocol that Home has generated and
 * persisted for `date`, scoped to the current user. Re-reads on focus so
 * surfacing tabs (Plan, Move, Diet, Sleep, Profile, Trends) stay consistent
 * with Home without recomputing the protocol themselves. Returns null when no
 * protocol has been generated yet (honest calibrating/setup state).
 */
export function useActiveProtocol(scope: string, date: string): DailyProtocol | null {
  const [protocol, setProtocol] = useState<DailyProtocol | null>(null);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      localDailyProtocolStore
        .read(scope, date)
        .then((value) => {
          if (mounted) setProtocol(value);
        })
        .catch(() => {
          if (mounted) setProtocol(null);
        });
      return () => {
        mounted = false;
      };
    }, [scope, date])
  );

  return protocol;
}
