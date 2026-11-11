import { createContext, useCallback, useContext, useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { AppState } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../../lib/supabase';
import { subscriptionsEnabled } from './revenuecat';

export type MembershipStatus = 'checking' | 'active' | 'locked';
type MembershipContextValue = {
  status: MembershipStatus;
  billingRequired: boolean;
  refreshMembership: () => Promise<boolean>;
};

const MembershipContext = createContext<MembershipContextValue | null>(null);

/**
 * App navigation uses a server-verified membership, never an editable local flag
 * or a RevenueCat client response. The release toggle stays off until App Store
 * products, the RevenueCat backend key, and real premium benefits are validated.
 */
export function MembershipProvider({ children }: PropsWithChildren) {
  const { mode, user, session, profile } = useAuth();
  const userId = user?.id ?? null;
  const ready = subscriptionsEnabled && mode === 'account' && !!session && !!userId && profile?.onboarding_status === 'completed';
  const [access, setAccess] = useState<{ userId: string | null; status: MembershipStatus }>({
    userId: null, status: 'checking'
  });
  const latestUser = useRef<string | null>(userId);
  latestUser.current = userId;

  const refreshMembership = useCallback(async (): Promise<boolean> => {
    if (!ready || !userId) return !subscriptionsEnabled || mode === 'demo';
    setAccess({ userId, status: 'checking' });
    try {
      // The backend authenticates the JWT, queries RevenueCat and persists status
      // with the service role. An inactive/expired entitlement is never unlocked.
      const { data, error } = await supabase.functions.invoke('subscription-access', { method: 'GET' });
      const active = !error && data?.active === true;
      if (latestUser.current === userId) setAccess({ userId, status: active ? 'active' : 'locked' });
      return active;
    } catch {
      if (latestUser.current === userId) setAccess({ userId, status: 'locked' });
      return false;
    }
  }, [ready, userId, mode]);

  useEffect(() => {
    if (ready) void refreshMembership();
  }, [ready, refreshMembership]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active' && ready) void refreshMembership();
    });
    return () => subscription.remove();
  }, [ready, refreshMembership]);

  const status: MembershipStatus = !subscriptionsEnabled || mode === 'demo'
    ? 'active'
    : !ready || access.userId !== userId ? 'checking' : access.status;

  return (
    <MembershipContext.Provider value={{ status, billingRequired: subscriptionsEnabled && mode === 'account', refreshMembership }}>
      {children}
    </MembershipContext.Provider>
  );
}

export function useMembership(): MembershipContextValue {
  const context = useContext(MembershipContext);
  if (!context) throw new Error('MembershipProvider is missing');
  return context;
}
