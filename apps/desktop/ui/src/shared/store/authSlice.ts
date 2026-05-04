import type { StateCreator } from 'zustand';
import type { UserInfo } from './types';
import { storage } from './storage';
import { loginRequest, registerRequest } from '../api/auth';

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
      const data = await loginRequest(email, password);
      storage.set('token', data.accessToken);
      storage.set('user', data.user);
      set({ token: data.accessToken, user: data.user, authLoading: false });
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
      set({ token: data.accessToken, user: data.user, authLoading: false });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      set({ authError: message, authLoading: false });
    }
  },

  logout() {
    storage.remove('token');
    storage.remove('user');
    set({ token: null, user: null });
  },
});
