import { describe, expect, it, vi } from 'vitest';

const sdk = vi.hoisted(() => ({
  getOfferings: vi.fn(),
  getCustomerInfo: vi.fn().mockRejectedValue(new Error('Account service unavailable')),
  PURCHASES_ERROR_CODE: { NETWORK_ERROR: '10', CONFIGURATION_ERROR: '23' }
}));
vi.mock('react-native-purchases', () => ({ default: sdk }));
vi.mock('react-native', () => ({ Platform: { OS: 'ios' } }));

import { catalogErrorMessage, getCurrentSubscriptionPackages } from '../../../src/features/subscriptions/revenuecat';

describe('membership catalog', () => {
  it('loads the current offering even when customer info is unavailable', async () => {
    const plans = [{ identifier: '$rc_monthly' }, { identifier: '$rc_annual' }];
    sdk.getOfferings.mockResolvedValue({ current: { availablePackages: plans } });
    expect(await getCurrentSubscriptionPackages()).toEqual(plans);
    expect(sdk.getCustomerInfo).not.toHaveBeenCalled();
  });

  it('offers no purchase when there is no current offering', async () => {
    sdk.getOfferings.mockResolvedValue({ current: null });
    expect(await getCurrentSubscriptionPackages()).toEqual([]);
  });

  it('keeps a configuration error distinct from a connectivity error on retry', async () => {
    const failure = { code: '23' };
    sdk.getOfferings.mockRejectedValue(failure);
    await expect(getCurrentSubscriptionPackages()).rejects.toEqual(failure);
    expect(catalogErrorMessage(failure)).toContain('Code 23');
    expect(catalogErrorMessage({ code: '10' })).toContain('connection');
  });
});
