import { serviceClient } from './auth.ts';

/** Revenue-backed subscription status stored only by trusted server code. */
export type PremiumAccess = 'free_launch' | 'active' | 'subscription_required' | 'unavailable';

export async function premiumAccessForUser(userId: string): Promise<PremiumAccess> {
  try {
    const admin = serviceClient();
    const { data: configuration, error: gateError } = await admin
      .from('billing_gate_settings').select('enabled').eq('id', 1).single();
    if (gateError || !configuration || typeof configuration.enabled !== 'boolean') return 'unavailable';
    if (!configuration.enabled) return 'free_launch';

    const { data: member, error } = await admin
      .from('subscription_status')
      .select('status, entitlement, current_period_end')
      .eq('user_id', userId).maybeSingle();

    if (error) return 'unavailable';
    const active = member?.status === 'active'
      && member.entitlement === 'pro'
      && (member.current_period_end === null
        || (typeof member.current_period_end === 'string'
          && Number.isFinite(Date.parse(member.current_period_end))
          && Date.parse(member.current_period_end) > Date.now()));

    return active ? 'active' : 'subscription_required';
  } catch {
    return 'unavailable';
  }
}
