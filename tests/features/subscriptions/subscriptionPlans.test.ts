import type { PurchasesPackage } from 'react-native-purchases';
import { describe, expect, it } from 'vitest';
import { subscriptionPlan } from '../../../src/features/subscriptions/subscriptionPlans';

function plan(overrides: Record<string, unknown> = {}, packageType = 'CUSTOM'): PurchasesPackage {
  return {
    identifier: 'test',
    packageType,
    product: {
      title: 'Daywoven membership', description: 'Membership', price: 9.99,
      priceString: '$9.99', currencyCode: 'USD', subscriptionPeriod: 'P1M',
      pricePerMonthString: null, ...overrides
    }
  } as unknown as PurchasesPackage;
}

describe('store-backed paywall copy', () => {
  it('keeps the full localized store price and billing cadence visible', () => {
    const display = subscriptionPlan(plan({ priceString: '9,99 €', currencyCode: 'EUR' }));
    expect(display).toMatchObject({ title: 'Monthly', price: '9,99 €', cadence: ' / month', detail: 'Billed monthly' });
    expect(display.renewal).toBe('9,99 € every month. Renews automatically until cancelled in Apple Account settings.');
    expect(display.renewal).not.toMatch(/trial|free/i);
  });

  it('shows the annual charge, a store-provided monthly equivalent, and a conservative calculated discount', () => {
    const monthly = plan();
    const annual = plan({ price: 69.99, priceString: '$69.99', subscriptionPeriod: 'P1Y', pricePerMonthString: '$5.83' }, 'ANNUAL');
    expect(subscriptionPlan(annual, [annual, monthly])).toMatchObject({
      title: 'Yearly', price: '$69.99', cadence: ' / year', detail: 'Equivalent to $5.83 / month', savings: 41
    });
  });

  it('normalizes a 12-month store period without assuming its package identifier', () => {
    expect(subscriptionPlan(plan({ subscriptionPeriod: 'P12M' }))).toMatchObject({ title: 'Yearly', cadence: ' / year' });
  });

  it.each(['P1W', 'P3M', 'P2Y'])('uses the actual recurring duration for %s', period => {
    const result = subscriptionPlan(plan({ subscriptionPeriod: period }));
    expect(result.renewal).toContain(period === 'P1W' ? 'every week' : period === 'P3M' ? 'every 3 months' : 'every 2 years');
  });

  it('never compares prices in different currencies', () => {
    const annual = plan({ price: 69.99, subscriptionPeriod: 'P1Y', currencyCode: 'EUR' });
    expect(subscriptionPlan(annual, [plan()]).savings).toBeNull();
  });

  it('omits savings when there is no monthly comparison, no real discount, or an invalid price', () => {
    for (const price of [119.88, 140, NaN, Infinity]) {
      expect(subscriptionPlan(plan({ price, subscriptionPeriod: 'P1Y' }), [plan()]).savings).toBeNull();
    }
    expect(subscriptionPlan(plan({ price: 69.99, subscriptionPeriod: 'P1Y' })).savings).toBeNull();
    expect(subscriptionPlan(plan({ price: 69.99, subscriptionPeriod: 'P1Y' }), [plan({ price: 0 })]).savings).toBeNull();
  });

  it('does not describe a one-time product as auto-renewing', () => {
    expect(subscriptionPlan(plan({ subscriptionPeriod: null }, 'LIFETIME'))).toMatchObject({
      title: 'Lifetime', cadence: '', detail: 'One-time payment', renewal: '$9.99, paid once. No recurring charge.'
    });
  });

  it('defers unsupported subscription durations to the store instead of claiming a one-time charge', () => {
    const result = subscriptionPlan(plan({ subscriptionPeriod: 'P1M2D' }));
    expect(result.renewal).toContain('Review the billing period and renewal terms');
    expect(result.renewal).not.toContain('paid once');
  });
});
