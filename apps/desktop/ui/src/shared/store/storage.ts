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
    return localStorage.getItem(PREFIX + key) ?? fallback;
  },

  set(key: string, value: unknown): void {
    localStorage.setItem(PREFIX + key, typeof value === 'string' ? value : JSON.stringify(value));
  },

  remove(key: string): void {
    localStorage.removeItem(PREFIX + key);
  },
};
