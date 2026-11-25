import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  auth: {} as Record<string, unknown>, membership: {} as Record<string, unknown>
}));
vi.mock('../../../src/features/auth/AuthProvider', () => ({ useAuth: () => state.auth }));
vi.mock('../../../src/features/subscriptions/MembershipProvider', () => ({ useMembership: () => state.membership }));
vi.mock('expo-router', () => ({
  Redirect: ({ href }: { href: string }) => <div data-destination={href} />,
  Stack: () => <div>Protected screens</div>, router: { push: vi.fn() }
}));
vi.mock('react-native', () => ({
  Platform: { OS: 'ios' },
  StyleSheet: { create: (value: unknown) => value },
  Text: ({ children }: React.PropsWithChildren) => <span>{children}</span>,
  View: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  Pressable: ({ children }: React.PropsWithChildren) => <button>{children}</button>
}));
vi.mock('../../../src/components/Screen', () => ({ Screen: ({ children }: React.PropsWithChildren) => <main>{children}</main> }));
vi.mock('../../../src/components/SectionHeader', () => ({ SectionHeader: ({ body }: { body: string }) => <p>{body}</p> }));
vi.mock('../../../app/(app)/subscription', () => ({ MembershipScreen: () => <p>Membership options</p> }));
vi.mock('../../../app/(onboarding)/index', () => ({ default: () => <p>Saved questionnaire</p> }));

import ProtectedLayout from '../../../app/(app)/_layout';
import AuthLayout from '../../../app/(auth)/_layout';
import OnboardingLayout from '../../../app/(onboarding)/_layout';
import Paywall from '../../../app/paywall';
import QuestionnaireRoute from '../../../app/questionnaire';

describe('questionnaire skipping and membership boundaries', () => {
  beforeEach(() => {
    state.auth = { isLoading: false, session: { user: { id: 'account' } }, profile: { onboarding_status: 'skipped' }, signOut: vi.fn() };
    state.membership = { billingRequired: true, status: 'locked', refreshMembership: vi.fn() };
  });
  it('leaves signup and onboarding after a skip but still gates paid app screens', () => {
    expect(renderToStaticMarkup(<AuthLayout />)).toContain('data-destination="/(app)/(tabs)"');
    expect(renderToStaticMarkup(<OnboardingLayout />)).toContain('data-destination="/(app)/(tabs)"');
    expect(renderToStaticMarkup(<ProtectedLayout />)).toContain('data-destination="/paywall"');
  });
  it('offers a free questionnaire return route on the locked paywall', () => {
    const html = renderToStaticMarkup(<Paywall />);
    expect(html).toContain('Membership options');
    expect(html).toContain('Resume questionnaire');
    expect(renderToStaticMarkup(<QuestionnaireRoute />)).toContain('Saved questionnaire');
  });
  it('opens paid screens only after verified membership is active', () => {
    state.membership.status = 'active';
    expect(renderToStaticMarkup(<ProtectedLayout />)).toContain('Protected screens');
  });
  it('keeps unknown and unfinished setup states in onboarding', () => {
    for (const status of ['in_progress', 'not_started', 'unexpected']) {
      state.auth.profile = { onboarding_status: status };
      expect(renderToStaticMarkup(<ProtectedLayout />)).toContain('data-destination="/(onboarding)"');
      expect(renderToStaticMarkup(<Paywall />)).toContain('data-destination="/(onboarding)"');
    }
  });
  it('does not open private drafts for signed-out sessions or password recovery', () => {
    state.auth.session = null;
    expect(renderToStaticMarkup(<QuestionnaireRoute />)).toContain('data-destination="/(auth)/login"');
    state.auth.session = { user: { id: 'account' } };
    state.auth.isPasswordRecovery = true;
    expect(renderToStaticMarkup(<QuestionnaireRoute />)).toContain('data-destination="/auth/reset-password"');
  });
});
