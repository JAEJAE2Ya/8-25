export interface StorageAdapter {
  get<T>(key: string, fallback: T): T;
  set<T>(key: string, value: T): void;
  remove(key: string): void;
}

export const browserStorage: StorageAdapter = {
  get<T>(key: string, fallback: T) {
    if (typeof window === "undefined") return fallback;
    try {
      const value = window.localStorage.getItem(key);
      return value ? JSON.parse(value) as T : fallback;
    } catch {
      return fallback;
    }
  },
  set<T>(key: string, value: T) {
    if (typeof window !== "undefined") window.localStorage.setItem(key, JSON.stringify(value));
  },
  remove(key: string) {
    if (typeof window !== "undefined") window.localStorage.removeItem(key);
  },
};
