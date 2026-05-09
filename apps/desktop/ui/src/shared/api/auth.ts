import { API_BASE } from '../constants';
import type { UserInfo } from '../store/types';

type AuthSuccess = {
  accessToken: string;
  user: UserInfo;
};

const APP_SALT = 'orison:auth:v1';

async function hashPassword(password: string): Promise<string> {
  const encoded = new TextEncoder().encode(password + APP_SALT);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

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

export async function loginRequest(email: string, password: string): Promise<AuthSuccess> {
  const hashed = await hashPassword(password);
  return postAuth('/v1/auth/login', { email, password: hashed }, 'Login failed');
}

export async function registerRequest(email: string, password: string, displayName?: string): Promise<AuthSuccess> {
  const hashed = await hashPassword(password);
  return postAuth('/v1/auth/register', { email, password: hashed, displayName }, 'Registration failed');
}

