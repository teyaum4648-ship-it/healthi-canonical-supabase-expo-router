import type { Session, User } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren
} from 'react';

import { isSupabaseConfigured, supabase } from '../../lib/supabase';

const isDemoMode = process.env.EXPO_PUBLIC_DEMO_MODE === 'true';
const demoOnboardingCompletedKey = 'healthi:demo:onboardingCompleted';

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  profile: HealthiProfile | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

type HealthiProfile = {
  id: string;
  display_name: string | null;
  primary_goal: string | null;
  training_experience: string | null;
  onboarding_status: 'not_started' | 'in_progress' | 'completed';
};

const demoUser = {
  id: 'demo-user',
  email: 'demo@healthi.local'
} as User;

const demoSession = {
  access_token: 'demo',
  refresh_token: 'demo',
  expires_in: 3600,
  token_type: 'bearer',
  user: demoUser
} as Session;

export function parseDemoOnboardingStatus(value: string | null): HealthiProfile['onboarding_status'] {
  return value === 'false' ? 'in_progress' : 'completed';
}

function DemoAuthProvider({ children }: PropsWithChildren) {
  const [demoOnboardingStatus, setDemoOnboardingStatus] =
    useState<HealthiProfile['onboarding_status']>('completed');
  const [isLocalDemoSignedOut, setIsLocalDemoSignedOut] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    AsyncStorage.getItem(demoOnboardingCompletedKey)
      .then((value) => {
        if (isMounted) {
          setDemoOnboardingStatus(parseDemoOnboardingStatus(value));
        }
      })
      .catch(() => {
        if (isMounted) {
          setDemoOnboardingStatus('completed');
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const demoProfile = useMemo<HealthiProfile>(
    () => ({
      id: demoUser.id,
      display_name: 'Demo User',
      primary_goal: null,
      training_experience: null,
      onboarding_status: demoOnboardingStatus
    }),
    [demoOnboardingStatus]
  );

  const refreshProfile = useCallback(async () => {
    const value = await AsyncStorage.getItem(demoOnboardingCompletedKey);
    setDemoOnboardingStatus(parseDemoOnboardingStatus(value));
  }, []);

  const signIn = useCallback(async () => {
    await AsyncStorage.setItem(demoOnboardingCompletedKey, 'true');
    setDemoOnboardingStatus('completed');
    setIsLocalDemoSignedOut(false);
  }, []);

  const signUp = useCallback(async () => {
    await AsyncStorage.setItem(demoOnboardingCompletedKey, 'true');
    setDemoOnboardingStatus('completed');
    setIsLocalDemoSignedOut(false);
  }, []);

  const signOut = useCallback(async () => {
    await AsyncStorage.removeItem(demoOnboardingCompletedKey);
    setDemoOnboardingStatus('in_progress');
    setIsLocalDemoSignedOut(true);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session: isLocalDemoSignedOut ? null : demoSession,
      user: isLocalDemoSignedOut ? null : demoUser,
      profile: isLocalDemoSignedOut ? null : demoProfile,
      isLoading,
      refreshProfile,
      signIn,
      signUp,
      signOut
    }),
    [demoProfile, isLoading, isLocalDemoSignedOut, refreshProfile, signIn, signOut, signUp]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function RemoteAuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<HealthiProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const isMounted = useRef(true);
  const sessionRequestId = useRef(0);

  const fetchProfile = useCallback(async (userId: string): Promise<HealthiProfile | null> => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, display_name, primary_goal, training_experience, onboarding_status')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return (data as HealthiProfile | null) ?? null;
  }, []);

  const synchronizeSession = useCallback(async (nextSession: Session | null) => {
    const requestId = ++sessionRequestId.current;

    if (!isMounted.current) {
      return;
    }

    setSession(nextSession);
    setIsLoading(true);

    if (!nextSession?.user.id) {
      setProfile(null);
      setIsLoading(false);
      return;
    }

    try {
      const nextProfile = await fetchProfile(nextSession.user.id);
      if (isMounted.current && requestId === sessionRequestId.current) {
        setProfile(nextProfile);
      }
    } catch {
      if (isMounted.current && requestId === sessionRequestId.current) {
        setProfile(null);
      }
    } finally {
      if (isMounted.current && requestId === sessionRequestId.current) {
        setIsLoading(false);
      }
    }
  }, [fetchProfile]);

  useEffect(() => {
    isMounted.current = true;

    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (error) {
          throw error;
        }
        return synchronizeSession(data.session);
      })
      .catch(() => {
        if (isMounted.current) {
          setSession(null);
          setProfile(null);
          setIsLoading(false);
        }
      });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      void synchronizeSession(nextSession);
    });

    return () => {
      isMounted.current = false;
      sessionRequestId.current += 1;
      data.subscription.unsubscribe();
    };
  }, [synchronizeSession]);

  const refreshProfile = useCallback(async () => {
    if (!session?.user.id) {
      setProfile(null);
      return;
    }

    setIsLoading(true);
    try {
      const nextProfile = await fetchProfile(session.user.id);
      if (isMounted.current) {
        setProfile(nextProfile);
      }
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
      }
    }
  }, [fetchProfile, session?.user.id]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      throw error;
    }

    if (!data.session) {
      throw new Error('Sign in completed without an active session. Please try again.');
    }

    await synchronizeSession(data.session);
  }, [synchronizeSession]);

  const signUp = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password
    });

    if (error) {
      throw error;
    }

    if (data.session) {
      await synchronizeSession(data.session);
    }
  }, [synchronizeSession]);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      throw error;
    }

    await synchronizeSession(null);
  }, [synchronizeSession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      profile,
      user: session?.user ?? null,
      isLoading,
      refreshProfile,
      signIn,
      signUp,
      signOut
    }),
    [isLoading, profile, refreshProfile, session, signIn, signOut, signUp]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function AuthProvider({ children }: PropsWithChildren) {
  const shouldUseLocalDemoAuth = isDemoMode || !isSupabaseConfigured;
  return shouldUseLocalDemoAuth
    ? <DemoAuthProvider>{children}</DemoAuthProvider>
    : <RemoteAuthProvider>{children}</RemoteAuthProvider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider.');
  }

  return context;
}
