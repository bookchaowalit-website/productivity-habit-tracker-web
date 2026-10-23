import { describe, expect, it, vi } from "vitest";
import { createLocalStore, type StorageLike } from "@/lib/local-store";

function fakeStorage(initial: Record<string, string> = {}): StorageLike & { data: Record<string, string> } {
  const data = { ...initial };
  return { data, getItem: (key) => data[key] ?? null, setItem: (key, value) => void (data[key] = value) };
}

const parse = (raw: string | null) => {
  try {
    const value: unknown = JSON.parse(raw ?? "");
    return Array.isArray(value) && value.every((n) => typeof n === "number") ? (value as number[]) : null;
  } catch {
    return null;
  }
};

function store(storage: StorageLike | undefined) {
  return createLocalStore<number[]>({ key: "k", fallback: [0], parse, serialize: JSON.stringify, getStorage: () => storage });
}

describe("createLocalStore", () => {
  it("uses the fallback with no storage, empty storage or an unusable saved value", () => {
    expect(store(undefined).getSnapshot()).toEqual([0]);
    expect(store(fakeStorage()).getSnapshot()).toEqual([0]);
    expect(store(fakeStorage({ k: "{bad json" })).getSnapshot()).toEqual([0]);
    expect(store(fakeStorage({ k: '["x"]' })).getSnapshot()).toEqual([0]);
  });

  it("reads a saved value and returns the same reference while storage is unchanged", () => {
    const s = store(fakeStorage({ k: "[1,2]" }));
    const first = s.getSnapshot();
    expect(first).toEqual([1, 2]);
    expect(s.getSnapshot()).toBe(first);
    expect(s.getServerSnapshot()).toEqual([0]);
  });

  it("writes updates and notifies subscribers", () => {
    const storage = fakeStorage();
    const s = store(storage);
    const listener = vi.fn();
    const unsubscribe = s.subscribe(listener);
    s.update((value) => [...value, 5]);
    expect(storage.data.k).toBe("[0,5]");
    expect(s.getSnapshot()).toEqual([0, 5]);
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    s.update((value) => value);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("keeps working in memory when storage throws", () => {
    const broken: StorageLike = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("full");
      },
    };
    const s = store(broken);
    s.update((value) => [...value, 9]);
    expect(s.getSnapshot()).toEqual([0, 9]);
  });
});
