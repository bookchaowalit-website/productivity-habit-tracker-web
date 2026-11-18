// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Home from "@/app/page";
import { SEED_HABITS, STORAGE_KEY, dateKey, daysBack, habitStore } from "@/lib/habits";

// Mounted tests for habits on the App shell: Today ticks, the 14-day grid, composer, remove, undo and focus.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let host: HTMLDivElement;
const TODAY = dateKey(new Date());
const YESTERDAY = daysBack(2, TODAY)[0];
const $ = <T extends Element = HTMLElement>(selector: string, scope: ParentNode = host) => scope.querySelector(selector) as T | null;
const button = (text: string, scope: ParentNode = host) => [...scope.querySelectorAll("button")].find((b) => b.textContent?.trim().startsWith(text)) as HTMLButtonElement;
const rowNames = () => [...host.querySelectorAll(".as-row-habit h3")].map((h) => h.textContent);
const saved = () => JSON.parse(localStorage.getItem(STORAGE_KEY)!);
const press = (el: Element, detail = 0) => act(() => { el.dispatchEvent(new MouseEvent("click", { bubbles: true, detail })); });
function type(el: HTMLInputElement, value: string) {
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

beforeEach(() => {
  // The store keeps its last value in memory: reset it, then clear what that wrote.
  habitStore.update(() => SEED_HABITS);
  localStorage.clear();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() => root.render(<Home />));
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("today", () => {
  it("ticking a habit updates the summary card, the streak and storage; ticking all shows All done", () => {
    expect(host.textContent).toContain("0 of 3done today");
    act(() => { $<HTMLInputElement>('[aria-label="Done today: Move for 20 min"]')!.click(); });
    expect(host.textContent).toContain("1 of 3done today");
    expect(host.textContent).toContain("1-day streak");
    expect(saved()[0].checks[TODAY]).toBe(true);
    expect($('[role="progressbar"]')!.getAttribute("aria-valuenow")).toBe("33");
    for (const name of ["Read before bed", "One deep-work block"]) act(() => { $<HTMLInputElement>(`[aria-label="Done today: ${name}"]`)!.click(); });
    expect(host.textContent).toContain("All done");
    act(() => { $<HTMLInputElement>('[aria-label="Done today: Read before bed"]')!.click(); });
    expect(host.textContent).toContain("1 to go");
  });
});

describe("last 14 days", () => {
  it("shows 14 days per habit, marks today, and a tap on yesterday counts toward the streak", () => {
    press(button("Last 14 days", $(".as-side")!));
    expect($("h1")!.textContent).toBe("Last 14 days");
    const move = $(".as-habit")!;
    expect(move.querySelectorAll(".as-day")).toHaveLength(14);
    expect(move.querySelector('[data-today="true"]')!.getAttribute("aria-pressed")).toBe("false");
    const yesterday = [...move.querySelectorAll<HTMLButtonElement>(".as-day")].at(-2)!;
    press(yesterday);
    expect(yesterday.getAttribute("aria-pressed")).toBe("true");
    expect(saved()[0].checks[YESTERDAY]).toBe(true);
    expect(move.textContent).toContain("1-day streak · 1 of 14 days");
    expect(host.textContent).toContain("1 check-in across 3 habits");
    press(yesterday);
    expect(host.textContent).toContain("0 check-ins across 3 habits");
    expect(move.textContent).toContain("No streak yet");
  });
});

describe("composer", () => {
  it("opens focused, keeps Add disabled until named, adds at the end and returns focus; Cancel adds nothing", () => {
    press(button("New habit"));
    expect(document.activeElement).toBe($(".as-composer input"));
    expect(button("Add", $(".as-composer")!).disabled).toBe(true);
    type($<HTMLInputElement>(".as-composer input")!, "Drink water");
    press(button("Add", $(".as-composer")!));
    expect(rowNames().at(-1)).toBe("Drink water");
    expect(document.activeElement?.textContent).toContain("New habit");
    press(button("New habit"));
    type($<HTMLInputElement>(".as-composer input")!, "Never added");
    press(button("Cancel"));
    expect(rowNames()).not.toContain("Never added");
  });

  it("still adds when crypto.randomUUID is missing (plain HTTP, older browsers)", () => {
    vi.stubGlobal("crypto", {});
    press(button("New habit"));
    type($<HTMLInputElement>(".as-composer input")!, "Stretch");
    press(button("Add", $(".as-composer")!));
    expect(saved().at(-1).id).toMatch(/^habit-\d+-[a-z0-9]+$/);
  });
});

describe("remove and undo", () => {
  it("keyboard removal focuses Undo; Undo restores in place and focuses New habit; removing all shows the empty state", () => {
    press($('[aria-label="Remove Read before bed"]')!, 0);
    expect(rowNames()).toEqual(["Move for 20 min", "One deep-work block"]);
    expect(document.activeElement?.textContent).toBe("Undo");
    press(button("Undo"));
    expect(rowNames()).toEqual(["Move for 20 min", "Read before bed", "One deep-work block"]);
    expect(document.activeElement?.textContent).toContain("New habit");
    for (const name of ["Move for 20 min", "Read before bed", "One deep-work block"]) press($(`[aria-label="Remove ${name}"]`)!, 1);
    expect(host.textContent).toContain("No habits yet");
  });

  it("remove the last habit, add one, then Undo puts the removed habit back in its old place", () => {
    press($('[aria-label="Remove One deep-work block"]')!, 1);
    press(button("New habit"));
    type($<HTMLInputElement>(".as-composer input")!, "Drink water");
    press(button("Add", $(".as-composer")!));
    expect(rowNames()).toEqual(["Move for 20 min", "Read before bed", "Drink water"]);
    press(button("Undo"));
    expect(rowNames()).toEqual(["Move for 20 min", "Read before bed", "One deep-work block", "Drink water"]);
  });

  it("remove the only habit, add one, then Undo puts the removed habit back first", () => {
    for (const name of ["Move for 20 min", "Read before bed"]) press($(`[aria-label="Remove ${name}"]`)!, 1);
    act(() => { $(".as-toast")!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); });
    press($('[aria-label="Remove One deep-work block"]')!, 1);
    press(button("New habit"));
    type($<HTMLInputElement>(".as-composer input")!, "Drink water");
    press(button("Add", $(".as-composer")!));
    press(button("Undo"));
    expect(rowNames()).toEqual(["One deep-work block", "Drink water"]);
  });

  it("while the toast shows, the page reserves bottom space and scroll padding for it; closing releases it", () => {
    const space = () => document.documentElement.style.getPropertyValue("--as-toast-space");
    expect(space()).toBe("");
    press($('[aria-label="Remove Read before bed"]')!, 0);
    expect(space()).toMatch(/^\d+px$/);
    expect(parseInt(space(), 10)).toBeGreaterThanOrEqual(32);
    act(() => { $(".as-toast")!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); });
    expect(space()).toBe("");
  });

  it("Escape dismisses; the toast waits while focused and closes six seconds after focus leaves; with the composer open focus goes to it", () => {
    press($('[aria-label="Remove Read before bed"]')!, 0);
    act(() => { $(".as-toast")!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); });
    expect($(".as-toast")).toBeNull();
    vi.useFakeTimers();
    press($('[aria-label="Remove Move for 20 min"]')!, 0);
    act(() => { vi.advanceTimersByTime(7000); });
    expect($(".as-toast")).not.toBeNull();
    act(() => { button("New habit").focus(); });
    act(() => { vi.advanceTimersByTime(6000); });
    expect($(".as-toast")).toBeNull();
    press($('[aria-label="Remove One deep-work block"]')!, 0);
    press(button("New habit"));
    press(button("Undo"));
    expect(document.activeElement).toBe($(".as-composer input"));
  });

  it("removals inside the Undo window form one batch; Undo restores all, with their check-ins, in place", () => {
    act(() => { $<HTMLInputElement>('[aria-label="Done today: Read before bed"]')!.click(); });
    expect(saved().find((h: { name: string }) => h.name === "Read before bed").checks[TODAY]).toBeTruthy();
    const ticked = JSON.stringify(saved());
    vi.useFakeTimers();
    press($('[aria-label="Remove Read before bed"]')!, 0);
    act(() => { vi.advanceTimersByTime(4000); });
    press($('[aria-label="Remove Move for 20 min"]')!, 0);
    expect(rowNames()).toEqual(["One deep-work block"]);
    expect($(".as-toast span")!.textContent).toBe("Removed 2 habits");
    expect(host.querySelector('[role="status"]')!.textContent).toContain("Removed 2 habits");
    expect(button("Undo").getAttribute("aria-label")).toBe("Undo remove of 2 habits");
    // The second removal restarted the timer: 4 s + 4 s after the first, the toast is still open.
    act(() => { button("New habit").focus(); });
    act(() => { vi.advanceTimersByTime(4000); });
    expect($(".as-toast")).not.toBeNull();
    press(button("Undo"));
    expect(rowNames()).toEqual(["Move for 20 min", "Read before bed", "One deep-work block"]);
    expect(JSON.stringify(saved())).toBe(ticked);
    expect(host.querySelector('[role="status"]')!.textContent).toBe("Restored 2 habits.");
  });
});
