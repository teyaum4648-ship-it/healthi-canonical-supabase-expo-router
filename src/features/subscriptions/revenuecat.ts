import Purchases, { type CustomerInfo, type PurchasesPackage } from 'react-native-purchases';
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

/** The paywall has already connected the signed-in account. Only prices are needed here. */
export async function getCurrentSubscriptionPackages(): Promise<PurchasesPackage[]> {
  const offerings = await Purchases.getOfferings();
  return offerings.current?.availablePackages ?? [];
}

export function catalogErrorMessage(error: unknown): string {
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
  const codes = Purchases.PURCHASES_ERROR_CODE;
  switch (code) {
    case codes.NETWORK_ERROR:
    case codes.OFFLINE_CONNECTION_ERROR:
      return 'Could not connect to load membership plans. Check your connection and try again.';
    case codes.STORE_PROBLEM_ERROR:
    case codes.PRODUCT_REQUEST_TIMED_OUT_ERROR:
    case codes.PRODUCT_NOT_AVAILABLE_FOR_PURCHASE_ERROR:
      return `The App Store could not return membership prices. Please try again. (Code ${code})`;
    case codes.CONFIGURATION_ERROR:
    case codes.INVALID_CREDENTIALS_ERROR:
      return `Membership plans are temporarily unavailable. (Code ${code})`;
    default:
      return 'Membership plans could not be loaded. Please try again.';
  }
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
