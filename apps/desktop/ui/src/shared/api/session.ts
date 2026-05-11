import { storage } from '../store/storage';

export const AUTH_EXPIRED_EVENT = 'orison:auth-expired';

export class SessionExpiredError extends Error {
  constructor() {
    super('Session expired');
    this.name = 'SessionExpiredError';
  }
}

export function reportSessionExpired(): void {
  window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
}

export function throwIfSessionExpired(response: Response): void {
  if (response.status !== 401) return;
  reportSessionExpired();
  throw new SessionExpiredError();
}

export function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const token = storage.getString('token', '');
  return token ? { ...extra, Authorization: `Bearer ${token}` } : extra;
}

export function authJsonHeaders(): Record<string, string> {
  return authHeaders({ 'Content-Type': 'application/json' });
}
