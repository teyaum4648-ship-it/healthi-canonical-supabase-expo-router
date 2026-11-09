import type { Session, User } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
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
import { demoSessionActiveKey, demoOnboardingCompletedKey, parseDemoOnboardingStatus, resetDemoStorage } from './demoLifecycle';
import { authRedirectUrl, exchangeAuthCallback, parseAuthCallback } from './authLinks';
import { AccountUnavailable } from './AccountUnavailable';
import { clearAccountData } from './accountDataCleanup';
export { parseDemoOnboardingStatus } from './demoLifecycle';

const isDemoMode = process.env.EXPO_PUBLIC_DEMO_MODE === 'true';

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  profile: HealthiProfile | null;
  isLoading: boolean;
  mode: 'demo' | 'account';
  startDemo: (fresh?: boolean) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, consent?: SignupConsentRecord, firstName?: string) => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: (password: string) => Promise<{ localCleanupComplete: boolean }>;
  isPasswordRecovery: boolean;
  authCallbackUrl: string | null;
  requestPasswordReset: (email: string) => Promise<void>;
  completeAuthCallback: (url: string) => Promise<'recovery' | 'signed-in'>;
  updatePassword: (password: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
};

/**
 * What the signup form agreed to, carried into `auth.users.raw_user_meta_data` so the
 * database trigger can write it into `user_consents` the moment the account exists.
 *
 * It has to travel this way rather than as a client insert: with email confirmation on,
 * there is no session at signup, so row-level security would reject a direct write and
 * the record of what someone agreed to would be the one thing missing.
 */
export type SignupConsentRecord = {
  version: string;
  terms: boolean;
  privacy: boolean;
  healthData: boolean;
  ageConfirmed: boolean;
};

/** What sign-up stores on the new user: consent always when given, and a first name if one was typed. */
export function signupMetadata(consent?: SignupConsentRecord, firstName?: string): Record<string, unknown> {
  const name = firstName?.trim().replace(/\s+/g, ' ').slice(0, 40);
  return { ...(consent ? { healthi_consent: consent } : {}), ...(name ? { first_name: name, display_name: name } : {}) };
}


const AuthContext = createContext<AuthContextValue | undefined>(undefined);

type HealthiProfile = {
  id: string;
  display_name: string | null;
  primary_goal: string | null;
  training_experience: string | null;
  onboarding_status: 'not_started' | 'in_progress' | 'completed';
};

async function unavailableInDemo(): Promise<never> {
  throw new Error('Account recovery is not available in this local demo.');
}

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

function DemoAuthProvider({ children }: PropsWithChildren) {
  const [demoOnboardingStatus, setDemoOnboardingStatus] =
    useState<HealthiProfile['onboarding_status']>('not_started');
  const [isLocalDemoSignedOut, setIsLocalDemoSignedOut] = useState(true);
  const [demoRevision, setDemoRevision] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    Promise.all([AsyncStorage.getItem(demoOnboardingCompletedKey), AsyncStorage.getItem(demoSessionActiveKey)])
      .then(([value, active]) => {
        if (isMounted) {
          setDemoOnboardingStatus(parseDemoOnboardingStatus(value));
          setIsLocalDemoSignedOut(active !== 'true');
        }
      })
      .catch(() => {
        if (isMounted) {
          setDemoOnboardingStatus('not_started');
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

  const startDemo = useCallback(async (fresh = false) => {
    setIsLoading(true);
    try {
      if (fresh) await resetDemoStorage(AsyncStorage);
      else await AsyncStorage.setItem(demoSessionActiveKey, 'true');
      setDemoOnboardingStatus(parseDemoOnboardingStatus(await AsyncStorage.getItem(demoOnboardingCompletedKey)));
      setDemoRevision((revision) => revision + 1);
      setIsLocalDemoSignedOut(false);
    } finally { setIsLoading(false); }
  }, []);

  const signIn = useCallback(async () => { throw new Error('This preview uses a local demo. Choose Continue demo to enter.'); }, []);
  const signUp = useCallback(async (_email: string, _password: string, _consent?: SignupConsentRecord, _firstName?: string) => { throw new Error('Account registration is not enabled in this demo build.'); }, []);

  const signOut = useCallback(async () => {
    await AsyncStorage.removeItem(demoSessionActiveKey);
    setIsLocalDemoSignedOut(true);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session: isLocalDemoSignedOut ? null : demoSession,
      user: isLocalDemoSignedOut ? null : demoUser,
      profile: isLocalDemoSignedOut ? null : demoProfile,
      isLoading,
      mode: 'demo',
      isPasswordRecovery: false,
      authCallbackUrl: null,
      requestPasswordReset: unavailableInDemo,
      completeAuthCallback: unavailableInDemo,
      updatePassword: unavailableInDemo,
      deleteAccount: unavailableInDemo,
      startDemo,
      refreshProfile,
      signIn,
      signUp,
      signOut
    }),
    [demoProfile, isLoading, isLocalDemoSignedOut, refreshProfile, signIn, signOut, signUp, startDemo]
  );

  return <AuthContext.Provider key={`${isLocalDemoSignedOut}:${demoRevision}`} value={value}>{children}</AuthContext.Provider>;
}

function RemoteAuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<HealthiProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const isMounted = useRef(true);
  const sessionRequestId = useRef(0);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const [authCallbackUrl, setAuthCallbackUrl] = useState<string | null>(null);
  const callbackRequest = useRef<{ url: string; promise: Promise<'recovery' | 'signed-in'> } | null>(null);

  useEffect(() => {
    let active = true;
    let receivedLiveLink = false;
    const subscription = Linking.addEventListener('url', ({ url }) => {
      receivedLiveLink = true;
      if (active) setAuthCallbackUrl(url);
    });
    void Linking.getInitialURL().then(url => {
      if (active && !receivedLiveLink) setAuthCallbackUrl(url);
    }).catch(() => undefined);
    return () => { active = false; subscription.remove(); };
  }, []);

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

    const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === 'PASSWORD_RECOVERY') setIsPasswordRecovery(true);
      if (event === 'SIGNED_OUT') setIsPasswordRecovery(false);
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

    setIsPasswordRecovery(false);
    await synchronizeSession(data.session);
  }, [synchronizeSession]);

  const signUp = useCallback(async (email: string, password: string, consent?: SignupConsentRecord, firstName?: string) => {
    /*
     * The first name rides in the same metadata as consent. Home greets by first_name, and
     * the profile trigger copies display_name into profiles, which otherwise falls back to
     * the email address.
     */
    const data = signupMetadata(consent, firstName);
    const { data: result, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data, emailRedirectTo: authRedirectUrl(Linking.createURL('auth/callback')) }
    });

    if (error) {
      throw error;
    }

    if (result.session) {
      await synchronizeSession(result.session);
    }
  }, [synchronizeSession]);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      throw error;
    }

    setIsPasswordRecovery(false);
    callbackRequest.current = null;
    await synchronizeSession(null);
  }, [synchronizeSession]);

  const requestPasswordReset = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: authRedirectUrl(Linking.createURL('auth/callback'), true)
    });
    if (error) throw error;
  }, []);

  const completeAuthCallback = useCallback((url: string): Promise<'recovery' | 'signed-in'> => {
    // React remounts and duplicate deep-link events must not exchange a one-use code twice.
    if (callbackRequest.current?.url === url) return callbackRequest.current.promise;
    const promise = (async () => {
      const callback = parseAuthCallback(url, Linking.createURL('auth/callback'));
      const result = await exchangeAuthCallback<Session>(supabase.auth, callback);
      setIsPasswordRecovery(result.recovery);
      await synchronizeSession(result.session);
      return result.recovery ? 'recovery' as const : 'signed-in' as const;
    })();
    callbackRequest.current = { url, promise };
    return promise;
  }, [synchronizeSession]);

  const updatePassword = useCallback(async (password: string) => {
    if (!session) throw new Error('Open the newest password-reset link from your email first.');
    if (password.length < 8) throw new Error('Choose a password with at least 8 characters.');
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
    setIsPasswordRecovery(false);
    callbackRequest.current = null;
  }, [session]);

  const deleteAccount = useCallback(async (password: string) => {
    const userId = session?.user.id;
    if (!userId || !password) throw new Error('Sign in and confirm your password first.');
    const { data, error } = await supabase.functions.invoke('delete-account', { body: { confirmation: 'DELETE', password } });
    if (error || data?.deleted !== true) throw new Error('Account deletion was not confirmed.');
    let localCleanupComplete = true;
    try { await clearAccountData(AsyncStorage, userId); } catch { localCleanupComplete = false; }
    try {
      const { error: signOutError } = await supabase.auth.signOut({ scope: 'local' });
      if (signOutError) localCleanupComplete = false;
    } catch { localCleanupComplete = false; }
    setIsPasswordRecovery(false);
    callbackRequest.current = null;
    await synchronizeSession(null);
    return { localCleanupComplete };
  }, [session, synchronizeSession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      mode: 'account',
      isPasswordRecovery,
      authCallbackUrl,
      requestPasswordReset,
      completeAuthCallback,
      updatePassword,
      deleteAccount,
      startDemo: async () => { throw new Error('Demo reset is only available in the separate demo preview.'); },
      profile,
      user: session?.user ?? null,
      isLoading,
      refreshProfile,
      signIn,
      signUp,
      signOut
    }),
    [isLoading, profile, refreshProfile, session, signIn, signOut, signUp, isPasswordRecovery, authCallbackUrl, requestPasswordReset, completeAuthCallback, updatePassword, deleteAccount]
  );

  return <AuthContext.Provider key={session?.user.id ?? 'signed-out'} value={value}>{children}</AuthContext.Provider>;
}

export function AuthProvider({ children }: PropsWithChildren) {
  if (isDemoMode) return <DemoAuthProvider>{children}</DemoAuthProvider>;
  // A misconfigured account build must never open local demo data or initialize
  // the unavailable Supabase client. Only an explicit demo build may do that.
  if (!isSupabaseConfigured) return <AccountUnavailable />;
  return <RemoteAuthProvider>{children}</RemoteAuthProvider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider.');
  }

  return context;
}
