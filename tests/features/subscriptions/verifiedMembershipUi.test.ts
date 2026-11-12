import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const membershipScreen = readFileSync('app/(app)/subscription.tsx', 'utf8');
const membershipProvider = readFileSync('src/features/subscriptions/MembershipProvider.tsx', 'utf8');

describe('subscription status presentation uses verified server access', () => {
  it('does not render a locally optimistic Premium active state', () => {
    expect(membershipScreen).toContain("const active = billingRequired && status === 'active'");
    expect(membershipScreen).not.toContain('setActive(');
    expect(membershipScreen).not.toContain('setActive(result.active)');
  });

  it('verifies a purchase or restore with the server before reporting success', () => {
    expect(membershipScreen).toMatch(/const purchased = await buySubscription[\s\S]*?const verified = await \(onUnlocked \? onUnlocked\(\) : refreshMembership\(\)\)/);
    expect(membershipScreen).toMatch(/const restored = await restoreSubscriptions[\s\S]*?const verified = await \(onUnlocked \? onUnlocked\(\) : refreshMembership\(\)\)/);
  });

  it('keeps server-backed membership as the navigation authority', () => {
    expect(membershipProvider).toContain("supabase.functions.invoke('subscription-access'");
    expect(membershipProvider).toContain("data?.active === true");
  });
});
