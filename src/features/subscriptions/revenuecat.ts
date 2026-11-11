import Purchases, { type CustomerInfo, type PurchasesOfferings, type PurchasesPackage } from 'react-native-purchases';
import { Platform } from 'react-native';

// RevenueCat's public *iOS* SDK key is expected here. No secret Store API key in Expo.
const iosPublicKey = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY || '';
const entitlementId = process.env.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID || 'pro';
export const subscriptionsEnabled = process.env.EXPO_PUBLIC_SUBSCRIPTIONS_ENABLED === 'true';

let configured = false;
let configuredUser: string | null = null;

/**
 * All purchase actions fail closed if the public SDK key or launch toggle is missing.
 * RevenueCat validates StoreKit receipts and handles subscription renewal lifecycle.
 * This client-side access check must NEVER authorize paid server resources by itself.
 */
export async function connectPurchases(userId: string): Promise<boolean> {
  if (!subscriptionsEnabled || !iosPublicKey || Platform.OS !== 'ios' || !userId || userId === 'demo-user') return false;
  if (!configured) {
    Purchases.configure({ apiKey: iosPublicKey, appUserID: userId });
    configured = true;
    configuredUser = userId;
  } else if (configuredUser !== userId) {
    await Purchases.logIn(userId);
    configuredUser = userId;
  }
  return true;
}

export function hasPremiumAccess(customerInfo: Pick<CustomerInfo, 'entitlements'> | null): boolean {
  return Boolean(customerInfo?.entitlements.active[entitlementId]);
}

export async function getSubscriptionCatalog(userId: string): Promise<{
  enabled: boolean;
  active: boolean;
  packages: PurchasesPackage[];
}> {
  if (!(await connectPurchases(userId))) return { enabled: false, active: false, packages: [] };
  const [customerInfo, offerings]: [CustomerInfo, PurchasesOfferings] = await Promise.all([
    Purchases.getCustomerInfo(),
    Purchases.getOfferings()
  ]);
  return {
    enabled: true,
    active: hasPremiumAccess(customerInfo),
    packages: offerings.current?.availablePackages ?? []
  };
}

export async function buySubscription(userId: string, item: PurchasesPackage): Promise<boolean> {
  if (!(await connectPurchases(userId))) throw new Error('Subscriptions have not been activated.');
  const response = await Purchases.purchasePackage(item);
  return hasPremiumAccess(response.customerInfo);
}

export async function restoreSubscriptions(userId: string): Promise<boolean> {
  if (!(await connectPurchases(userId))) throw new Error('Subscriptions have not been activated.');
  const info = await Purchases.restorePurchases();
  return hasPremiumAccess(info);
}

export async function refreshSubscriptionStatus(userId: string): Promise<boolean> {
  if (!(await connectPurchases(userId))) return false;
  return hasPremiumAccess(await Purchases.getCustomerInfo());
}
