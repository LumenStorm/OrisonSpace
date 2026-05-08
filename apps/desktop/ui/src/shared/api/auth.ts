import { API_BASE } from '../constants';
import type { UserInfo } from '../store/types';

type AuthSuccess = {
  accessToken: string;
  user: UserInfo;
};

let cachedPublicKey: CryptoKey | null = null;

async function fetchPublicKey(): Promise<CryptoKey> {
  if (cachedPublicKey) return cachedPublicKey;
  const res = await fetch(`${API_BASE}/v1/auth/public-key`);
  if (!res.ok) throw new Error('Failed to fetch public key');
  const { publicKey } = (await res.json()) as { publicKey: string };
  const pem = publicKey.replace(/-----[^-]+-----/g, '').replace(/\s/g, '');
  const binary = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  cachedPublicKey = await crypto.subtle.importKey(
    'spki',
    binary,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['encrypt'],
  );
  return cachedPublicKey;
}

async function encryptPassword(password: string): Promise<string> {
  const key = await fetchPublicKey();
  const encoded = new TextEncoder().encode(password);
  const encrypted = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, key, encoded);
  return btoa(String.fromCharCode(...new Uint8Array(encrypted)));
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
  const encrypted = await encryptPassword(password);
  return postAuth('/v1/auth/login', { email, password: encrypted }, 'Login failed');
}

export async function registerRequest(email: string, password: string, displayName?: string): Promise<AuthSuccess> {
  const encrypted = await encryptPassword(password);
  return postAuth('/v1/auth/register', { email, password: encrypted, displayName }, 'Registration failed');
}

