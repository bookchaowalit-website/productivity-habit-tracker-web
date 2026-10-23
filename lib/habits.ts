// Habit patchbay: dates, streaks, lane edits and the browser-local store. Pure apart from the two stores at the end.
import { browserStorage, createLocalStore } from "@/lib/local-store";

export type Habit = { id: string; name: string; checks: Record<string, boolean> };

export const STORAGE_KEY = "habit-tracker-v2";
export const WINDOW_DAYS = 14;
export const SEED_HABITS: Habit[] = [
  { id: "move", name: "Move for 20 min", checks: {} },
  { id: "read", name: "Read before bed", checks: {} },
  { id: "focus", name: "One deep-work block", checks: {} },
];

/** Local calendar day as YYYY-MM-DD. */
export function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function fromKey(key: string): Date {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function shift(key: string, days: number): string {
  const date = fromKey(key);
  date.setDate(date.getDate() + days);
  return dateKey(date);
}

/** The last `count` days ending today, oldest first. */
export function daysBack(count: number, today: string): string[] {
  return Array.from({ length: count }, (_, index) => shift(today, index - count + 1));
}

/**
 * Consecutive checked days ending today. An unchecked today does not break the streak yet: the day is not over,
 * so counting starts from yesterday.
 */
export function currentStreak(checks: Record<string, boolean>, today: string): number {
  let day = checks[today] ? today : shift(today, -1);
  let total = 0;
  while (checks[day] && total < 3650) {
    total += 1;
    day = shift(day, -1);
  }
  return total;
}

export function completedOn(habits: Habit[], day: string): number {
  return habits.filter((habit) => habit.checks[day]).length;
}

export function signalsIn(habits: Habit[], days: string[]): number {
  return habits.reduce((total, habit) => total + days.filter((day) => habit.checks[day]).length, 0);
}

export function toggleCheck(habits: Habit[], id: string, day: string): Habit[] {
  return habits.map((habit) => {
    if (habit.id !== id) return habit;
    const checks = { ...habit.checks };
    if (checks[day]) delete checks[day];
    else checks[day] = true;
    return { ...habit, checks };
  });
}

/** Adds a lane; a blank name changes nothing (same array back). */
export function addHabit(habits: Habit[], name: string, id: string): Habit[] {
  const clean = name.trim();
  return clean ? [...habits, { id, name: clean, checks: {} }] : habits;
}

export function removeHabit(habits: Habit[], id: string): Habit[] {
  return habits.filter((habit) => habit.id !== id);
}

const KEY = /^\d{4}-\d{2}-\d{2}$/;

function toHabit(value: unknown): Habit | null {
  if (typeof value !== "object" || value === null) return null;
  const entry = value as Record<string, unknown>;
  if (typeof entry.id !== "string" || typeof entry.name !== "string") return null;
  const checks: Record<string, boolean> = {};
  if (typeof entry.checks === "object" && entry.checks !== null) {
    for (const [day, done] of Object.entries(entry.checks)) if (KEY.test(day) && done === true) checks[day] = true;
  }
  return { id: entry.id, name: entry.name, checks };
}

/** Saved lanes, or null when nothing usable is saved; bad lanes are dropped and bad check keys ignored. */
export function parseHabits(raw: string | null): Habit[] | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? value.map(toHabit).filter((habit): habit is Habit => habit !== null) : null;
  } catch {
    return null;
  }
}

export const habitStore = createLocalStore<Habit[]>({
  key: STORAGE_KEY,
  fallback: SEED_HABITS,
  parse: parseHabits,
  serialize: (habits) => JSON.stringify(habits),
  getStorage: browserStorage,
});

/**
 * Today's key for useSyncExternalStore. The server (and the static build) has no "today" for the visitor, so its
 * snapshot is "" and the grid renders after hydration, avoiding a build-date vs visit-date mismatch.
 */
export const todayStore = {
  getSnapshot: () => dateKey(new Date()),
  getServerSnapshot: () => "",
  subscribe: (listener: () => void) => {
    const timer = setInterval(listener, 60_000);
    return () => clearInterval(timer);
  },
};
