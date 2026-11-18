import { describe, expect, it } from "vitest";
import { SEED_HABITS, addHabit, completedOn, currentStreak, dateKey, dayParts, daysBack, longDay, parseHabits, removeHabit, restoreHabit, signalsIn, streakLabel, toggleCheck } from "@/lib/habits";

describe("dates", () => {
  it("formats the local calendar day", () => {
    expect(dateKey(new Date(2026, 0, 5))).toBe("2026-01-05");
  });

  it("lists the window oldest first, across a month boundary", () => {
    expect(daysBack(3, "2026-11-01")).toEqual(["2026-10-30", "2026-10-31", "2026-11-01"]);
    expect(daysBack(14, "2026-10-23")).toHaveLength(14);
  });

  it("handles a leap day", () => {
    expect(daysBack(2, "2028-03-01")).toEqual(["2028-02-29", "2028-03-01"]);
  });
});

describe("currentStreak", () => {
  const checks = { "2026-10-20": true, "2026-10-21": true, "2026-10-22": true };

  it("keeps yesterday's streak while today is still open", () => {
    expect(currentStreak(checks, "2026-10-23")).toBe(3);
  });

  it("counts today once it is checked", () => {
    expect(currentStreak({ ...checks, "2026-10-23": true }, "2026-10-23")).toBe(4);
  });

  it("is broken by a missed day", () => {
    expect(currentStreak(checks, "2026-10-24")).toBe(0);
    expect(currentStreak({ "2026-10-23": true, "2026-10-21": true }, "2026-10-23")).toBe(1);
  });
});

describe("lane edits", () => {
  it("toggles a day on and off without touching other lanes", () => {
    const on = toggleCheck(SEED_HABITS, "read", "2026-10-23");
    expect(on[1].checks).toEqual({ "2026-10-23": true });
    expect(on[0]).toBe(SEED_HABITS[0]);
    expect(toggleCheck(on, "read", "2026-10-23")[1].checks).toEqual({});
  });

  it("adds a trimmed lane and ignores a blank one", () => {
    expect(addHabit(SEED_HABITS, "  Water ", "w").at(-1)).toEqual({ id: "w", name: "Water", checks: {} });
    expect(addHabit(SEED_HABITS, "   ", "w")).toBe(SEED_HABITS);
  });

  it("removes by id", () => {
    expect(removeHabit(SEED_HABITS, "move").map((h) => h.id)).toEqual(["read", "focus"]);
  });

  it("counts today's completions and the signals in the window", () => {
    const habits = toggleCheck(toggleCheck(SEED_HABITS, "move", "2026-10-23"), "read", "2026-10-01");
    expect(completedOn(habits, "2026-10-23")).toBe(1);
    expect(signalsIn(habits, daysBack(14, "2026-10-23"))).toBe(1);
  });
});

describe("parseHabits", () => {
  it("returns null for nothing saved, bad JSON or a non-array", () => {
    expect(parseHabits(null)).toBeNull();
    expect(parseHabits("{")).toBeNull();
    expect(parseHabits('{"id":"x"}')).toBeNull();
  });

  it("drops bad lanes and ignores bad check keys instead of crashing", () => {
    const raw = JSON.stringify([
      { id: "a", name: "Ok", checks: { "2026-10-23": true, nope: true, "2026-10-22": "yes" } },
      { id: "b", name: "No checks" },
      { name: "No id" },
      7,
    ]);
    expect(parseHabits(raw)).toEqual([
      { id: "a", name: "Ok", checks: { "2026-10-23": true } },
      { id: "b", name: "No checks", checks: {} },
    ]);
  });
});

describe("App shell helpers", () => {
  const a = { id: "a", name: "A", checks: {} };
  const b = { id: "b", name: "B", checks: {} };

  it("restoreHabit puts a lane back before its neighbour, at the end without one, and never twice", () => {
    expect(restoreHabit([b], a, "b").map((h) => h.id)).toEqual(["a", "b"]);
    expect(restoreHabit([b], a, null).map((h) => h.id)).toEqual(["b", "a"]);
    expect(restoreHabit([b], a, "gone").map((h) => h.id)).toEqual(["b", "a"]);
    expect(restoreHabit([a, b], a, "b")).toHaveLength(2);
  });

  it("restoreHabit puts a last row back right after its old previous row, before rows added since", () => {
    const c = { id: "c", name: "C", checks: {} };
    expect(restoreHabit([a, c], b, null, "a").map((h) => h.id)).toEqual(["a", "b", "c"]);
    expect(restoreHabit([a, c], b, "gone", "a").map((h) => h.id)).toEqual(["a", "b", "c"]);
    expect(restoreHabit([c], b, null, "gone").map((h) => h.id)).toEqual(["c", "b"]);
  });

  it("restoreHabit puts a lone removed row back at its old index, before rows added since", () => {
    expect(restoreHabit([b], a, null, null, 0).map((h) => h.id)).toEqual(["a", "b"]);
    expect(restoreHabit([b], a, null, null, 5).map((h) => h.id)).toEqual(["b", "a"]);
  });

  it("longDay, dayParts and streakLabel", () => {
    expect(longDay("2026-11-14")).toBe("Saturday 14 November");
    expect(dayParts("2026-11-14")).toEqual({ weekday: "Sat", day: 14 });
    expect(streakLabel(0)).toBe("No streak yet");
    expect(streakLabel(3)).toBe("3-day streak");
  });
});
