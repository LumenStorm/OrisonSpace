import type { StateCreator } from 'zustand';
import type { UserInfo } from './types';
import { storage } from './storage';
import { loginRequest, registerRequest } from '../api/auth';
import { fetchAuthSession } from '../api/authSession';
import { SessionExpiredError } from '../api/session';

export type AuthStatus = 'checking' | 'authenticated' | 'anonymous' | 'error';

export type AuthSlice = {
  token: string | null;
  user: UserInfo | null;
  authStatus: AuthStatus;
  authError: string | null;
  authLoading: boolean;
  bootstrapAuth: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName?: string) => Promise<void>;
  logout: () => void;
};

function clearStoredSession() {
  storage.remove('token');
  storage.remove('user');
}

export const createAuthSlice: StateCreator<AuthSlice, [], [], AuthSlice> = (set, get) => ({
  token: storage.getString('token', '') || null,
  user: storage.get<UserInfo | null>('user', null),
  authStatus: storage.getString('token', '') ? 'checking' : 'anonymous',
  authError: null,
  authLoading: false,

  async bootstrapAuth() {
    const token = get().token;
    if (!token) {
      clearStoredSession();
      set({ user: null, authStatus: 'anonymous', authError: null });
      return;
    }

    set({ authStatus: 'checking', authError: null });
    try {
      const user = await fetchAuthSession(token);
      storage.set('user', user);
      set({ user, authStatus: 'authenticated', authError: null });
    } catch (e: unknown) {
      if (e instanceof SessionExpiredError) {
        clearStoredSession();
        set({ token: null, user: null, authStatus: 'anonymous', authError: null });
        return;
      }

      const message = e instanceof Error ? e.message : String(e);
      set({ user: null, authStatus: 'error', authError: message });
    }
  },

  async login(email, password) {
    set({ authLoading: true, authError: null });
    try {
      const data = await loginRequest(email, password);
      storage.set('token', data.accessToken);
      storage.set('user', data.user);
      set({
        token: data.accessToken,
        user: data.user,
        authStatus: 'authenticated',
        authLoading: false,
      });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      set({ authError: message, authLoading: false });
    }
  },

  async register(email, password, displayName) {
    set({ authLoading: true, authError: null });
    try {
      const data = await registerRequest(email, password, displayName);
      storage.set('token', data.accessToken);
      storage.set('user', data.user);
      set({
        token: data.accessToken,
        user: data.user,
        authStatus: 'authenticated',
        authLoading: false,
      });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      set({ authError: message, authLoading: false });
    }
  },

  logout() {
    clearStoredSession();
    set({ token: null, user: null, authStatus: 'anonymous', authError: null });
  },
});
