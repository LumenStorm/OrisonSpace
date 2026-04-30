const PREFIX = 'orison_';

export const storage = {
  get<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      if (raw === null) return fallback;
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  },

  getString(key: string, fallback: string): string {
    try {
      return localStorage.getItem(PREFIX + key) ?? fallback;
    } catch {
      return fallback;
    }
  },

  set(key: string, value: unknown): void {
    try {
      localStorage.setItem(PREFIX + key, typeof value === 'string' ? value : JSON.stringify(value));
    } catch {
      // Ignore storage write failures so renderer boot can continue.
    }
  },

  remove(key: string): void {
    try {
      localStorage.removeItem(PREFIX + key);
    } catch {
      // Ignore storage delete failures so renderer boot can continue.
    }
  },
};
