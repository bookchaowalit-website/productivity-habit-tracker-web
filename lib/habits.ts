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

/** Longest habit name the composer and rename field accept. */
export const NAME_MAX = 60;

/** True when another habit (not `exceptId`) already has this name, ignoring case and outer spaces. */
export function hasHabitNamed(habits: Habit[], name: string, exceptId?: string): boolean {
  const clean = name.trim().toLocaleLowerCase();
  return habits.some((habit) => habit.id !== exceptId && habit.name.trim().toLocaleLowerCase() === clean);
}

/** Adds a lane; a blank or duplicate name changes nothing (same array back). */
export function addHabit(habits: Habit[], name: string, id: string): Habit[] {
  const clean = name.trim().slice(0, NAME_MAX);
  return clean && !hasHabitNamed(habits, clean) ? [...habits, { id, name: clean, checks: {} }] : habits;
}

/** Renames a lane and keeps its check-ins; a blank, duplicate or unchanged name changes nothing (same array back). */
export function renameHabit(habits: Habit[], id: string, name: string): Habit[] {
  const clean = name.trim().slice(0, NAME_MAX);
  const habit = habits.find((entry) => entry.id === id);
  if (!habit || !clean || clean === habit.name || hasHabitNamed(habits, clean, id)) return habits;
  return habits.map((entry) => (entry.id === id ? { ...entry, name: clean } : entry));
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

/** `name`, or `name (2)`, `name (3)` … : the first that no habit in the list uses yet (ignoring case). */
export function uniqueName(habits: Habit[], name: string): string {
  if (!hasHabitNamed(habits, name)) return name;
  for (let n = 2; ; n += 1) {
    const suffix = ` (${n})`;
    const candidate = `${name.slice(0, Math.max(1, NAME_MAX - suffix.length)).trimEnd()}${suffix}`;
    if (!hasHabitNamed(habits, candidate)) return candidate;
  }
}

/**
 * Put a removed lane back before its old neighbour (or at the end when the neighbour is gone); never twice. If a habit
 * with the same name was added meanwhile (another tab), the restored one keeps its history under "name (2)".
 */
export function restoreHabit(habits: Habit[], removed: Habit, beforeId: string | null, afterId: string | null = null, index?: number): Habit[] {
  if (habits.some((entry) => entry.id === removed.id)) return habits;
  const name = uniqueName(habits, removed.name);
  const habit = name === removed.name ? removed : { ...removed, name };
  // Before the old next row; else right after the old previous row (so rows added since stay after it); else at its
  // old index (a lone row comes back before rows added since); else at the end.
  const before = beforeId ? habits.findIndex((entry) => entry.id === beforeId) : -1;
  const after = before < 0 && afterId ? habits.findIndex((entry) => entry.id === afterId) : -1;
  const fallback = index === undefined ? habits.length : Math.min(Math.max(index, 0), habits.length);
  const at = before >= 0 ? before : after >= 0 ? after + 1 : fallback;
  return [...habits.slice(0, at), habit, ...habits.slice(at)];
}

/** "Saturday, 14 November" for a day key, in the visitor's own calendar. */
export function longDay(key: string): string {
  return fromKey(key).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
}

/** Short pieces for a day cell: weekday letter(s) and day of month. */
export function dayParts(key: string): { weekday: string; day: number } {
  const date = fromKey(key);
  return { weekday: date.toLocaleDateString("en-GB", { weekday: "short" }), day: date.getDate() };
}

export function streakLabel(days: number): string {
  return days === 0 ? "No streak yet" : `${days}-day streak`;
}
