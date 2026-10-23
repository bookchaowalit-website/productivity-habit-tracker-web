// A tiny localStorage-backed store for useSyncExternalStore (copied per repository, not a shared package).
// The server snapshot is the fallback value, so the first client render matches the server HTML and the saved
// value appears right after hydration. If storage is blocked or full, the value lasts for the visit only.

export type StorageLike = { getItem(key: string): string | null; setItem(key: string, value: string): void };

export function createLocalStore<T>(options: {
  key: string;
  fallback: T;
  parse: (raw: string | null) => T | null;
  serialize: (value: T) => string;
  getStorage: () => StorageLike | undefined;
}) {
  const { key, fallback, parse, serialize, getStorage } = options;
  let current: T = fallback;
  let lastRaw: string | null = null;
  const listeners = new Set<() => void>();

  function getSnapshot(): T {
    let raw: string | null;
    try {
      raw = getStorage()?.getItem(key) ?? null;
    } catch {
      return current;
    }
    if (raw === null || raw === lastRaw) return current;
    lastRaw = raw;
    current = parse(raw) ?? fallback;
    return current;
  }

  function update(change: (value: T) => T) {
    current = change(getSnapshot());
    try {
      const raw = serialize(current);
      getStorage()?.setItem(key, raw);
      lastRaw = raw;
    } catch {
      // Storage is full or blocked: keep the value in memory.
    }
    for (const listener of listeners) listener();
  }

  function subscribe(listener: () => void) {
    listeners.add(listener);
    if (typeof window !== "undefined") window.addEventListener("storage", listener);
    return () => {
      listeners.delete(listener);
      if (typeof window !== "undefined") window.removeEventListener("storage", listener);
    };
  }

  return { getSnapshot, getServerSnapshot: () => fallback, subscribe, update };
}

export function browserStorage(): StorageLike | undefined {
  return typeof window === "undefined" ? undefined : window.localStorage;
}
