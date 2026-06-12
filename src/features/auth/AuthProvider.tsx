import type { Session, User } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
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

export function AuthProvider({ children }: PropsWithChildren) {
  const shouldUseLocalDemoAuth = isDemoMode || !isSupabaseConfigured;
  const [demoOnboardingStatus, setDemoOnboardingStatus] =
    useState<HealthiProfile['onboarding_status']>('in_progress');
  const [isLocalDemoSignedOut, setIsLocalDemoSignedOut] = useState(!isSupabaseConfigured);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<HealthiProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!shouldUseLocalDemoAuth) {
      return;
    }

    AsyncStorage.getItem(demoOnboardingCompletedKey)
      .then((value) => {
        setDemoOnboardingStatus(value === 'true' ? 'completed' : 'in_progress');
      })
      .catch(() => {
        setDemoOnboardingStatus('in_progress');
      });
  }, [shouldUseLocalDemoAuth]);

  if (shouldUseLocalDemoAuth) {
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
    const demoProfile: HealthiProfile = {
      id: demoUser.id,
      display_name: 'Demo User',
      primary_goal: null,
      training_experience: null,
      onboarding_status: demoOnboardingStatus
    };
    const refreshDemoProfile = async () => {
      const value = await AsyncStorage.getItem(demoOnboardingCompletedKey);
      setDemoOnboardingStatus(value === 'true' ? 'completed' : 'in_progress');
    };
    const value: AuthContextValue = {
      session: isLocalDemoSignedOut ? null : demoSession,
      user: isLocalDemoSignedOut ? null : demoUser,
      profile: isLocalDemoSignedOut ? null : demoProfile,
      isLoading: false,
      refreshProfile: refreshDemoProfile,
      signIn: async () => {
        await AsyncStorage.removeItem(demoOnboardingCompletedKey);
        setDemoOnboardingStatus('in_progress');
        setIsLocalDemoSignedOut(false);
      },
      signUp: async () => {
        await AsyncStorage.removeItem(demoOnboardingCompletedKey);
        setDemoOnboardingStatus('in_progress');
        setIsLocalDemoSignedOut(false);
      },
      signOut: async () => {
        await AsyncStorage.removeItem(demoOnboardingCompletedKey);
        setDemoOnboardingStatus('in_progress');
        setIsLocalDemoSignedOut(true);
      }
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
  }

  const loadProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, display_name, primary_goal, training_experience, onboarding_status')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    setProfile((data as HealthiProfile | null) ?? null);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!session?.user.id) {
      setProfile(null);
      return;
    }

    await loadProfile(session.user.id);
  }, [loadProfile, session?.user.id]);

  useEffect(() => {
    let isMounted = true;

    supabase.auth
      .getSession()
      .then(async ({ data }) => {
        if (isMounted) {
          setSession(data.session);
        }

        if (data.session?.user.id) {
          await loadProfile(data.session.user.id);
        } else if (isMounted) {
          setProfile(null);
        }
      })
      .catch(() => {
        if (isMounted) {
          setProfile(null);
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);

      if (!nextSession?.user.id) {
        setProfile(null);
        setIsLoading(false);
        return;
      }

      loadProfile(nextSession.user.id)
        .catch(() => {
          setProfile(null);
        })
        .finally(() => {
          setIsLoading(false);
        });
    });

    return () => {
      isMounted = false;
      data.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      throw error;
    }
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password
    });

    if (error) {
      throw error;
    }
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      throw error;
    }
  }, []);

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

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider.');
  }

  return context;
}
