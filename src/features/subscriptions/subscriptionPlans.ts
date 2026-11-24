import type { PurchasesPackage } from 'react-native-purchases';

type BillingPeriod = { count: number; unit: 'day' | 'week' | 'month' | 'year' };

function billingPeriod(item: PurchasesPackage): BillingPeriod | null {
  const match = /^P([1-9]\d*)(D|W|M|Y)$/.exec(item.product.subscriptionPeriod ?? '');
  if (!match) return null;
  const units = { D: 'day', W: 'week', M: 'month', Y: 'year' } as const;
  const count = Number(match[1]);
  const unit = units[match[2] as keyof typeof units];
  // Stores can express an annual period as either P1Y or P12M.
  return unit === 'month' && count === 12 ? { count: 1, unit: 'year' } : { count, unit };
}

/** Store-localized prices remain intact. No hardcoded prices or assumed free trials. */
export function subscriptionPlan(item: PurchasesPackage, packages: PurchasesPackage[] = []) {
  const period = billingPeriod(item);
  const price = item.product.priceString;
  if (!period) {
    return {
      title: item.packageType === 'LIFETIME' ? 'Lifetime' : item.product.title,
      price,
      cadence: '',
      detail: item.product.subscriptionPeriod ? item.product.description : 'One-time payment',
      renewal: item.product.subscriptionPeriod
        ? `${price}. Review the billing period and renewal terms in Apple’s confirmation.`
        : `${price}, paid once. No recurring charge.`,
      savings: null
    };
  }

  const { count, unit } = period;
  const duration = count === 1 ? unit : `${count} ${unit}s`;
  const title = count === 1
    ? ({ day: 'Daily', week: 'Weekly', month: 'Monthly', year: 'Yearly' } as const)[unit]
    : `Every ${duration}`;
  const isAnnual = unit === 'year' && count === 1;
  const monthly = isAnnual ? packages.find(candidate =>
    candidate.product.subscriptionPeriod === 'P1M'
    && candidate.product.currencyCode === item.product.currencyCode
    && candidate.product.price > 0
  ) : undefined;
  const discount = monthly ? Math.floor((1 - item.product.price / (monthly.product.price * 12)) * 100) : 0;
  const savings = Number.isFinite(discount) && discount > 0 && discount < 100 ? discount : null;

  return {
    title,
    price,
    cadence: ` / ${duration}`,
    detail: isAnnual && item.product.pricePerMonthString
      ? `Equivalent to ${item.product.pricePerMonthString} / month`
      : `Billed ${count === 1 ? ({ day: 'daily', week: 'weekly', month: 'monthly', year: 'yearly' } as const)[unit] : `every ${duration}`}`,
    renewal: `${price} every ${duration}. Renews automatically until cancelled in Apple Account settings.`,
    savings
  };
}
