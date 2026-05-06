import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from '../src/app/App';
import { ensureProjectRegistration } from '../src/shared/api/projects';
import { useAppStore } from '../src/shared/store/appStore';

describe('auth session expiry', () => {
  beforeEach(() => {
    localStorage.clear();
    useAppStore.setState({
      token: 'expired-token',
      user: {
        id: 'user-1',
        email: 'creator@example.com',
        displayName: 'Creator',
      },
      currentProject: null,
    } as any);
  });

  afterEach(() => {
    cleanup();
  });

  it('logs out when the API layer reports an expired auth session', async () => {
    render(<App />);

    window.dispatchEvent(new Event('orison:auth-expired'));

    await waitFor(() => {
      expect(useAppStore.getState().token).toBeNull();
      expect(useAppStore.getState().user).toBeNull();
    });
    expect(await screen.findByRole('button', { name: 'Sign In' })).toBeInTheDocument();
  });

  it('reports an expired auth session when a token-protected API returns 401', async () => {
    const expired = new Promise<void>((resolve) => {
      window.addEventListener('orison:auth-expired', () => resolve(), { once: true });
    });
    (globalThis as any).fetch = async () => ({
      ok: false,
      status: 401,
    });

    await expect(
      ensureProjectRegistration({
        token: 'expired-token',
        project: {
          name: 'Expired Project',
          type: 'novel',
          path: 'C:\\Projects\\Expired',
        },
      }),
    ).rejects.toThrow('Session expired');
    await expect(expired).resolves.toBeUndefined();
  });
});
