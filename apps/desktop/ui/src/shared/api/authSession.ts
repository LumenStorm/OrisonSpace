import { API_BASE } from '../constants';
import type { UserInfo } from '../store/types';
import { throwIfSessionExpired } from './session';

type SessionResponse = {
  user: UserInfo;
};

/**
 * Lightweight session bootstrap check used on app startup.
 *
 * If the persisted token is expired or invalid, `throwIfSessionExpired`
 * dispatches the shared auth-expired event so the renderer logs out before
 * showing authenticated screens.
 */
export async function fetchAuthSession(token: string): Promise<UserInfo> {
  const response = await fetch(`${API_BASE}/v1/auth/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  throwIfSessionExpired(response);

  if (!response.ok) {
    throw new Error(`Session bootstrap failed: ${response.status}`);
  }

  const body = (await response.json()) as SessionResponse;
  return body.user;
}
