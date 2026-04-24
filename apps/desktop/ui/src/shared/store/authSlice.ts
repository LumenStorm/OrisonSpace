import type { StateCreator } from 'zustand';
import type { UserInfo } from './types';
import { storage } from './storage';
import { API_BASE } from '../constants';

export type AuthSlice = {
  token: string | null;
  user: UserInfo | null;
  authError: string | null;
  authLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName?: string) => Promise<void>;
  logout: () => void;
};

export const createAuthSlice: StateCreator<AuthSlice, [], [], AuthSlice> = (set) => ({
  token: storage.getString('token', '') || null,
  user: storage.get<UserInfo | null>('user', null),
  authError: null,
  authLoading: false,

  async login(email, password) {
    set({ authLoading: true, authError: null });
    try {
      const res = await fetch(`${API_BASE}/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Login failed');
      }
      const data = await res.json();
      storage.set('token', data.accessToken);
      storage.set('user', data.user);
      set({ token: data.accessToken, user: data.user, authLoading: false });
    } catch (e: any) {
      set({ authError: e.message, authLoading: false });
    }
  },

  async register(email, password, displayName) {
    set({ authLoading: true, authError: null });
    try {
      const res = await fetch(`${API_BASE}/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, displayName }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Registration failed');
      }
      const data = await res.json();
      storage.set('token', data.accessToken);
      storage.set('user', data.user);
      set({ token: data.accessToken, user: data.user, authLoading: false });
    } catch (e: any) {
      set({ authError: e.message, authLoading: false });
    }
  },

  logout() {
    storage.remove('token');
    storage.remove('user');
    set({ token: null, user: null });
  },
});
