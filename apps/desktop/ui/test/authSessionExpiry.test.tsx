import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from '../src/app/App';
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

  it('boots to the auth page when the persisted token is already expired', async () => {
    (globalThis as any).fetch = async () => ({
      ok: false,
      status: 401,
    });

    render(<App />);

    expect(await screen.findByRole('button', { name: 'Sign In' })).toBeInTheDocument();
    await waitFor(() => {
      expect(useAppStore.getState().token).toBeNull();
      expect(useAppStore.getState().user).toBeNull();
    });
  });

  it('hydrates the current user from session bootstrap before showing authenticated screens', async () => {
    (globalThis as any).fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        user: {
          id: 'user-1',
          email: 'creator@example.com',
          displayName: 'Synced Creator',
        },
      }),
    });

    render(<App />);

    expect(await screen.findByText('Synced Creator')).toBeInTheDocument();
    await waitFor(() => {
      expect(useAppStore.getState().user?.displayName).toBe('Synced Creator');
    });
  });

  it('falls back to the auth page when session bootstrap fails for a non-expiry reason', async () => {
    (globalThis as any).fetch = async () => ({
      ok: false,
      status: 503,
    });

    render(<App />);

    expect(await screen.findByRole('button', { name: 'Sign In' })).toBeInTheDocument();
    expect(screen.getAllByRole('alert')[0]?.textContent).toContain('Session bootstrap failed: 503');
  });
});
