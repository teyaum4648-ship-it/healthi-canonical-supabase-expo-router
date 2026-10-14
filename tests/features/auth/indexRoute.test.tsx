import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { auth, signup } = vi.hoisted(() => ({ auth: { current: {} as Record<string, unknown> }, signup: vi.fn() }));
vi.mock('../../../src/features/auth/AuthProvider', () => ({ useAuth: () => auth.current }));
vi.mock('expo-router', () => ({ Redirect: ({ href }: { href: string }) => <div data-destination={href} />, router: { push: vi.fn() } }));
vi.mock('react-native', () => ({
  StyleSheet: { create: (styles: unknown) => styles }, useWindowDimensions: () => ({ width: 390 }),
  Text: ({ children }: React.PropsWithChildren) => <span>{children}</span>,
  View: ({ children }: React.PropsWithChildren) => <div>{children}</div>
}));
vi.mock('../../../src/components/Screen', () => ({ Screen: ({ children }: React.PropsWithChildren) => <main>{children}</main> }));
vi.mock('../../../src/components/Button', () => ({ Button: ({ label }: { label: string }) => <button>{label}</button> }));
vi.mock('../../../src/features/auth/DemoEntry', () => ({ DemoEntry: () => <button>Continue demo</button> }));
vi.mock('../../../src/styles/mobileTheme', () => ({ colors: { text: '#fff' }, fonts: {}, spacing: {}, type: { body: {} }, glassSurface: {} }));
import IndexRoute from '../../../app/index';

describe('installed app root screen', () => {
  beforeEach(() => { signup.mockClear(); auth.current = { mode: 'demo', isLoading: false, session: null, profile: null, signUp: signup }; });
  it('renders Continue demo instead of the broken legacy signup button', () => {
    const html = renderToStaticMarkup(<IndexRoute />);
    expect(html).toContain('Continue demo');
    expect(html).not.toContain('Get started');
    expect(signup).not.toHaveBeenCalled();
  });
  it('redirects a hydrated returning user directly to the tab group', () => {
    auth.current = { ...auth.current, session: { user: { id: 'demo-user' } }, profile: { onboarding_status: 'completed' } };
    expect(renderToStaticMarkup(<IndexRoute />)).toContain('data-destination="/(app)/(tabs)"');
  });
  it('renders a loading message rather than prematurely opening onboarding', () => {
    auth.current = { ...auth.current, isLoading: true };
    const html = renderToStaticMarkup(<IndexRoute />);
    expect(html).toContain('Opening daywoven');
    expect(html).not.toContain('data-destination');
  });
  it('keeps the account welcome flow separate from local demo entry', () => {
    auth.current = { ...auth.current, mode: 'account' };
    const html = renderToStaticMarkup(<IndexRoute />);
    expect(html).toContain('Get started on your wellness test');
    expect(html).not.toContain('Continue demo');
  });
});
