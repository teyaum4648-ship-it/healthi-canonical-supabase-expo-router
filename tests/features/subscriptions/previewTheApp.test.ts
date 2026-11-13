import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const membershipScreen = readFileSync('app/(app)/subscription.tsx', 'utf8');
const tour = readFileSync('app/app-preview.tsx', 'utf8');
const protectedLayout = readFileSync('app/(app)/_layout.tsx', 'utf8');

describe('membership feature preview', () => {
  it('offers a Preview the app link on the membership screen', () => {
    expect(membershipScreen).toContain('Preview the app');
    expect(membershipScreen).toContain("router.push('/app-preview')");
  });

  it('renders an informational tour using Daywoven screenshot assets', () => {
    for (const asset of ['home.webp', 'food-results.webp', 'rhythm.webp', 'movement.webp', 'mood.webp']) {
      expect(tour).toContain(asset);
    }
    expect(tour).toContain('FOOD SEARCH + BARCODE SCANNER');
    expect(tour).toContain('Back to membership options');
    expect(tour).toContain("router.back()");
  });

  it('does not route into premium features or grant membership', () => {
    expect(tour).not.toContain('refreshMembership(');
    expect(tour).not.toContain('buySubscription(');
    expect(tour).not.toContain("router.push('/(app)/(tabs)')");
    expect(protectedLayout).toContain("return <Redirect href=\"/paywall\" />");
  });
});
