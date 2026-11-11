import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { PurchasesPackage } from 'react-native-purchases';
import Constants from 'expo-constants';
import { router } from 'expo-router';

import { useAuth } from '../../src/features/auth/AuthProvider';
import { supabase } from '../../src/lib/supabase';
import { useMembership } from '../../src/features/subscriptions/MembershipProvider';
import { getSubscriptionCatalog, buySubscription, restoreSubscriptions } from '../../src/features/subscriptions/revenuecat';
import { colors, fonts, spacing } from '../../src/styles/mobileTheme';

// This is a US-first release; enable external web checkout only for a reviewed
// US App Store distribution. Storefront-specific policy must be revisited before
// releasing the iOS app in any additional country.
const websiteCheckoutEnabled = process.env.EXPO_PUBLIC_WEB_CHECKOUT_ENABLED === 'true'
  && process.env.EXPO_PUBLIC_SUBSCRIPTIONS_ENABLED === 'true';

export function MembershipScreen({ gated = false, onUnlocked }: { gated?: boolean; onUnlocked?: () => Promise<boolean> }) {
  const { user, mode } = useAuth();
  const { refreshMembership } = useMembership();
  const [enabled, setEnabled] = useState(false);
  const [active, setActive] = useState(false);
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const canBuyNative = Constants.appOwnership !== 'expo';
  const webCheckoutAvailable = websiteCheckoutEnabled && mode === 'account' && Boolean(user?.id);

  useEffect(() => {
    let live = true;
    const userId = mode === 'account' ? user?.id : undefined;
    if (!userId) {
      setEnabled(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    void getSubscriptionCatalog(userId)
      .then(result => {
        if (!live) return;
        setEnabled(result.enabled);
        setActive(result.active);
        setPackages(result.packages);
        setSelected(result.packages[0]?.identifier ?? null);
      })
      .catch(() => { if (live) setError('Subscriptions could not load. Please retry when connected.'); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [mode, user?.id]);

  const selectedPackage = packages.find(item => item.identifier === selected);

  async function startWebsiteCheckout() {
    if (!webCheckoutAvailable || busy) return;
    setBusy(true);
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
      setBusy(false);
    }
  }

  async function checkWebsitePurchase() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const unlocked = await (onUnlocked ? onUnlocked() : refreshMembership());
      setActive(unlocked);
      if (!unlocked) setError('We have not verified an active Daywoven membership yet. If you just paid, return to the app after checkout and try again.');
    } catch {
      setError('Unable to verify your subscription. Please try again when connected.');
    } finally {
      setBusy(false);
    }
  }

  async function purchase() {
    if (!user?.id || !selectedPackage || busy || !canBuyNative) return;
    setBusy(true);
    setError('');
    try {
      const unlocked = await buySubscription(user.id, selectedPackage);
      if (unlocked) {
        setActive(true);
        if (onUnlocked && !(await onUnlocked())) setError('Your Apple purchase is recorded, but access has not been verified by the server yet. Retry Restore purchases.');
      }
      else setError('The purchase was not confirmed. No premium access has been granted.');
    } catch (failure) {
      const message = failure instanceof Error ? failure.message : 'Payment was not completed.';
      // Payment cancellations are common and must not be treated as an account error.
      if (!/cancel/i.test(message)) Alert.alert('Purchase not completed', message);
    } finally { setBusy(false); }
  }

  async function restore() {
    if (!user?.id || busy || !canBuyNative) return;
    setBusy(true);
    setError('');
    try {
      const unlocked = await restoreSubscriptions(user.id);
      setActive(unlocked);
      if (unlocked && onUnlocked && !(await onUnlocked())) {
        setError('Your subscription was restored with Apple, but server verification has not completed. Please retry.');
      } else {
        Alert.alert('Restore purchases', unlocked ? 'Your active subscription was restored.' : 'No active subscription was found for this Apple Account.');
      }
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not restore purchases.');
    } finally { setBusy(false); }
  }

  return (
    <ScrollView contentContainerStyle={styles.page}>
      {!gated ? <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.back}>
        <Text style={styles.link}>‹ Back to settings</Text>
      </Pressable> : null}
      <Text style={styles.eyebrow}>DAYWOVEN</Text>
      <Text style={styles.title}>{gated ? 'Your next chapter starts here' : 'Membership'}</Text>
      <Text style={styles.body}>{gated ? 'You’ve completed your free baseline and seen your personal results. Subscribe to continue with your day-by-day wellness plan, meal and sleep tracking, movement tools and progress insights.' : 'Daywoven is free to download. Membership gives access to your personalized daily wellness tools.'}</Text>

      {loading ? <ActivityIndicator color={colors.accent} /> : null}
      {active ? <View style={styles.panel}><Text style={styles.heading}>Premium active</Text><Text style={styles.body}>Your Daywoven subscription is active.</Text></View> : null}

      {webCheckoutAvailable && !active ? (
        <View style={styles.webPanel}>
          <Text style={styles.heading}>Subscribe on our website</Text>
          <Text style={styles.body}>Choose a monthly or annual plan on Daywoven's secure website. Your purchase will be linked to this account and unlock Premium here after verification.</Text>
          <Pressable accessibilityRole="button" disabled={busy} onPress={() => void startWebsiteCheckout()} style={[styles.button, busy && styles.buttonDisabled]}>
            <Text style={styles.buttonText}>{busy ? 'Opening…' : 'Choose plans on daywovenapp.com'}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" disabled={busy} onPress={() => void checkWebsitePurchase()} style={styles.secondary}>
            <Text style={styles.link}>I've paid on the website · Check my access</Text>
          </Pressable>
        </View>
      ) : null}
      {!enabled ? <Text style={styles.notice}>In-app subscriptions are not available yet. Your free features remain available.</Text> : null}
      {enabled && !packages.length && !active && !loading ? <Text style={styles.notice}>No subscription plans are available to purchase right now.</Text> : null}

      {enabled && packages.length > 0 && !active ? (
        <View style={styles.panel}>
          <Text style={styles.heading}>{webCheckoutAvailable ? 'Or subscribe through Apple' : 'Available plans'}</Text>
          <Text style={styles.body}>Review the benefits, price, and renewal terms before subscribing. Payments are processed by Apple.</Text>
          {packages.map(item => (
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ checked: selected === item.identifier }}
              key={item.identifier}
              onPress={() => setSelected(item.identifier)}
              style={[styles.plan, selected === item.identifier && styles.planSelected]}
            >
              <Text style={styles.planTitle}>{item.product.title}</Text>
              <Text style={styles.body}>{item.product.priceString} · {item.product.description}</Text>
            </Pressable>
          ))}
          <Pressable
            accessibilityRole="button"
            disabled={!selectedPackage || busy || !canBuyNative}
            onPress={() => void purchase()}
            style={[styles.button, (!selectedPackage || busy || !canBuyNative) && styles.buttonDisabled]}
          >
            <Text style={styles.buttonText}>{busy ? 'Processing…' : 'Subscribe through Apple'}</Text>
          </Pressable>
        </View>
      ) : null}

      {!canBuyNative && enabled ? <Text style={styles.notice}>Real purchases are only available in a signed iOS build, not Expo Go.</Text> : null}
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      <Pressable accessibilityRole="button" onPress={() => void restore()} disabled={busy || !enabled || !canBuyNative} style={styles.secondary}>
        <Text style={styles.link}>Restore purchases</Text>
      </Pressable>
      <Pressable accessibilityRole="link" onPress={() => void Linking.openURL('https://apps.apple.com/account/subscriptions')} style={styles.secondary}>
        <Text style={styles.link}>Manage Apple-billed subscription</Text>
      </Pressable>
      <View style={styles.footer}>
        {webCheckoutAvailable ? <Text style={styles.body}>Subscriptions purchased on our website are billed and managed through our web checkout provider, not Apple's subscription settings. Use the billing-management link in your purchase confirmation.</Text> : null}
        <Text style={styles.body}>Auto-renewing subscriptions continue until cancelled. Subscription pricing, duration, and applicable terms are shown before purchase. You can cancel in Apple Account settings.</Text>
        <Pressable accessibilityRole="link" onPress={() => void Linking.openURL('https://daywovenapp.com/legal/terms.html')}><Text style={styles.link}>Terms of Service</Text></Pressable>
        <Pressable accessibilityRole="link" onPress={() => void Linking.openURL('https://daywovenapp.com/legal/privacy.html')}><Text style={styles.link}>Privacy Policy</Text></Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { backgroundColor: colors.background, flexGrow: 1, gap: spacing.md, padding: 24, paddingTop: 64 },
  back: { minHeight: 42, justifyContent: 'center' },
  eyebrow: { color: colors.accent, fontFamily: fonts.bodyMedium, fontSize: 12, letterSpacing: 2 },
  title: { color: colors.text, fontFamily: fonts.display, fontSize: 35 },
  body: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 15, lineHeight: 22 },
  panel: { backgroundColor: colors.surfaceInset, borderRadius: 16, gap: 12, padding: 20 },
  webPanel: { backgroundColor: colors.surfaceInset, borderRadius: 16, gap: 14, padding: 20, borderColor: colors.accent, borderWidth: 1 },
  heading: { color: colors.text, fontFamily: fonts.bodyMedium, fontSize: 19 },
  plan: { borderColor: colors.borderStrong, borderRadius: 12, borderWidth: 1, gap: 4, padding: 12 },
  planSelected: { borderColor: colors.accent },
  planTitle: { color: colors.text, fontFamily: fonts.bodyMedium, fontSize: 16 },
  button: { backgroundColor: colors.accent, borderRadius: 12, minHeight: 50, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  buttonDisabled: { opacity: .5 },
  buttonText: { color: colors.background, fontFamily: fonts.bodyMedium, fontSize: 15 },
  notice: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 14, lineHeight: 20 },
  error: { color: '#ff8b8b', fontSize: 14 },
  secondary: { minHeight: 44, justifyContent: 'center' },
  link: { color: colors.accent, fontFamily: fonts.bodyMedium, fontSize: 15 },
  footer: { gap: 10, marginTop: 16 }
});

export default function SubscriptionScreen() {
  return <MembershipScreen />;
}
