import { API_BASE } from '../constants';
import type { UserInfo } from '../store/types';

type AuthSuccess = {
  accessToken: string;
  user: UserInfo;
};

async function postAuth(path: string, body: Record<string, unknown>, fallbackError: string): Promise<AuthSuccess> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.error || fallbackError);
  }
  return (await res.json()) as AuthSuccess;
}

export function loginRequest(email: string, password: string): Promise<AuthSuccess> {
  return postAuth('/v1/auth/login', { email, password }, 'Login failed');
}

export function registerRequest(email: string, password: string, displayName?: string): Promise<AuthSuccess> {
  return postAuth('/v1/auth/register', { email, password, displayName }, 'Registration failed');
}
