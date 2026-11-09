import { beforeEach, describe, expect, it, vi } from 'vitest';
const platform = vi.hoisted(() => ({ openURL: vi.fn(), alert: vi.fn() }));
vi.mock('react-native', () => ({ Linking: { openURL: platform.openURL }, Alert: { alert: platform.alert } }));
import { openLegalUrl } from '../../../src/features/legal/openLegalUrl';
beforeEach(() => vi.clearAllMocks());
describe('Opening required policies', () => {
  it('opens the configured policy', async () => {
    platform.openURL.mockResolvedValue(undefined); await openLegalUrl('https://daywovenapp.com/legal/privacy.html');
    expect(platform.openURL).toHaveBeenCalledOnce(); expect(platform.alert).not.toHaveBeenCalled();
  });
  it('reports failure without an unhandled rejection', async () => {
    platform.openURL.mockRejectedValue(new Error('unavailable'));
    await expect(openLegalUrl('https://daywovenapp.com/legal/privacy.html')).resolves.toBeUndefined();
    expect(platform.alert).toHaveBeenCalledWith('Could not open the policy', expect.any(String));
  });
});
