import { useEffect, useRef, useState } from 'react';
import { Alert, Linking, Platform } from 'react-native';
import type { PurchasesPackage } from 'react-native-purchases';
import Constants from 'expo-constants';
import { router } from 'expo-router';

import { useAuth } from '../../src/features/auth/AuthProvider';
import { supabase } from '../../src/lib/supabase';
import { useMembership } from '../../src/features/subscriptions/MembershipProvider';
import { connectPurchases, getCurrentSubscriptionPackages, catalogErrorMessage, buySubscription, restoreSubscriptions } from '../../src/features/subscriptions/revenuecat';
import { MembershipPaywall } from '../../src/features/subscriptions/MembershipPaywall';

import { useBandStatusBar } from '../../src/components/thread/useBandStatusBar';

// This is a US-first release; enable external web checkout only for a reviewed
// US App Store distribution. Storefront-specific policy must be revisited before
// releasing the iOS app in any additional country.
const websiteCheckoutEnabled = process.env.EXPO_PUBLIC_WEB_CHECKOUT_ENABLED === 'true'
  && process.env.EXPO_PUBLIC_SUBSCRIPTIONS_ENABLED === 'true';

export function MembershipScreen({ gated = false, onUnlocked }: { gated?: boolean; onUnlocked?: () => Promise<boolean> }) {
  const { user, mode } = useAuth();
  const { status, billingRequired, refreshMembership } = useMembership();
  const [enabled, setEnabled] = useState(false);
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<'purchase' | 'restore' | 'website' | 'verify' | null>(null);
  const actionLock = useRef(false);
  const [catalogAttempt, setCatalogAttempt] = useState(0);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  // Never display premium access based only on a local StoreKit/RevenueCat result.
  // The server-verified MembershipProvider is the authority.
  const active = billingRequired && status === 'active';
  const canBuyNative = Platform.OS === 'ios' && Constants.appOwnership !== 'expo';
  const webCheckoutAvailable = websiteCheckoutEnabled && mode === 'account' && Boolean(user?.id);
  useBandStatusBar();

  useEffect(() => {
    let live = true;
    const userId = mode === 'account' ? user?.id : undefined;
    setEnabled(false);
    setPackages([]);
    setSelected(null);
    setError('');
    if (!userId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    // Keep restore available when the SDK connects but loading the offering fails.
    void connectPurchases(userId)
      .then(async ready => {
        if (!live) return;
        setEnabled(ready);
        if (!ready) return;
        const available = await getCurrentSubscriptionPackages();
        if (!live) return;
        setPackages(available);
        setSelected(available[0]?.identifier ?? null);
      })
      .catch(failure => { if (live) setError(catalogErrorMessage(failure)); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [mode, user?.id, catalogAttempt]);

  const selectedPackage = packages.find(item => item.identifier === selected);

  async function startWebsiteCheckout() {
    if (!webCheckoutAvailable || actionLock.current) return;
    actionLock.current = true;
    setAction('website');
    setError('');
    try {
      // The server authenticates the actual logged-in Supabase user, then
      // mints a short-lived signed browser session. It never accepts a user ID
      // supplied by this button or generates a checkout URL in the app.
      const { data, error: checkoutError } = await supabase.functions.invoke('web-checkout', {
        method: 'POST',
        body: {}
      });
      if (checkoutError || typeof data?.url !== 'string') {
        throw new Error('Website checkout is not activated yet. Please try again later.');
      }
      const checkoutUrl = new URL(data.url);
      if (checkoutUrl.origin !== 'https://daywovenapp.com'
          || checkoutUrl.pathname !== '/pricing'
          || !checkoutUrl.searchParams.get('session')) {
        throw new Error('The checkout link could not be verified.');
      }
      await Linking.openURL(checkoutUrl.toString());
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not open website checkout.');
    } finally {
      actionLock.current = false;
      setAction(null);
    }
  }

  async function checkWebsitePurchase() {
    if (actionLock.current) return;
    actionLock.current = true;
    setAction('verify');
    setError('');
    try {
      const unlocked = await (onUnlocked ? onUnlocked() : refreshMembership());
      if (!unlocked) setError('We have not verified an active Daywoven membership yet. If you just paid, return to the app after checkout and try again.');
    } catch {
      setError('Unable to verify your subscription. Please try again when connected.');
    } finally {
      actionLock.current = false;
      setAction(null);
    }
  }

  async function purchase() {
    if (!user?.id || !enabled || !selectedPackage || actionLock.current || !canBuyNative) return;
    actionLock.current = true;
    setAction('purchase');
    setError('');
    try {
      const purchased = await buySubscription(user.id, selectedPackage);
      if (purchased) {
        const verified = await (onUnlocked ? onUnlocked() : refreshMembership());
        if (!verified) setError('Your Apple purchase is recorded, but access has not been verified by the server yet. Retry Restore purchases.');
      } else {
        setError('The purchase was not confirmed. No premium access has been granted.');
      }
    } catch (failure) {
      const message = failure instanceof Error ? failure.message : 'Payment was not completed.';
      // Payment cancellations are common and must not be treated as an account error.
      if (!/cancel/i.test(message)) Alert.alert('Purchase not completed', message);
    } finally {
      actionLock.current = false;
      setAction(null);
    }
  }

  async function restore() {
    if (!user?.id || !enabled || actionLock.current || !canBuyNative) return;
    actionLock.current = true;
    setAction('restore');
    setError('');
    try {
      const restored = await restoreSubscriptions(user.id);
      if (restored) {
        const verified = await (onUnlocked ? onUnlocked() : refreshMembership());
        if (!verified) {
          setError('Your subscription was restored with Apple, but server verification has not completed. Please retry.');
        } else {
          Alert.alert('Restore purchases', 'Your active subscription was restored.');
        }
      } else {
        Alert.alert('Restore purchases', 'No active subscription was found for this Apple Account.');
      }
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not restore purchases.');
    } finally {
      actionLock.current = false;
      setAction(null);
    }
  }

  return (
    <MembershipPaywall
      gated={gated}
      active={active}
      enabled={enabled}
      loading={loading}
      action={action}
      canBuyNative={canBuyNative}
      packages={packages}
      selected={selected}
      error={error}
      webCheckoutAvailable={webCheckoutAvailable}
      onSelect={setSelected}
      onPurchase={() => void purchase()}
      onRestore={() => void restore()}
      onRetry={() => setCatalogAttempt(attempt => attempt + 1)}
      onPreview={() => router.push('/app-preview')}
      onBack={() => router.back()}
      onManage={() => void Linking.openURL('https://apps.apple.com/account/subscriptions')}
      onTerms={() => void Linking.openURL('https://daywovenapp.com/legal/terms.html')}
      onPrivacy={() => void Linking.openURL('https://daywovenapp.com/legal/privacy.html')}
      onWebsiteCheckout={() => void startWebsiteCheckout()}
      onCheckWebsitePurchase={() => void checkWebsitePurchase()}
    />
  );
}

export default function SubscriptionScreen() {
  return <MembershipScreen />;
}
