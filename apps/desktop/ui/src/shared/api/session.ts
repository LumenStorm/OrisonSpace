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
