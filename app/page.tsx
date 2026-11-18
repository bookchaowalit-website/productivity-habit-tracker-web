"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { AppFoot, AppTop, ListButton, Pill, PlusIcon } from "@/components/app-shell";
import {
  WINDOW_DAYS, addHabit, completedOn, currentStreak, dayParts, daysBack, habitStore, longDay, removeHabit, restoreHabit, signalsIn,
  streakLabel, todayStore, toggleCheck, type Habit,
} from "@/lib/habits";

type View = "Today" | "History";
type RemovedEntry = { habit: Habit; beforeId: string | null };
type RemovedBatch = { items: RemovedEntry[]; viaKeyboard: boolean };
const removedLabel = (items: RemovedEntry[]) => (items.length === 1 ? `Removed “${items[0].habit.name}”` : `Removed ${items.length} habits`);

// randomUUID only exists in secure contexts (HTTPS/localhost) and newer browsers.
function createId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `habit-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

const XIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
);

export default function Home() {
  // "" on the server and in the static build: anything that depends on the visitor's today renders after hydration.
  const today = useSyncExternalStore(todayStore.subscribe, todayStore.getSnapshot, todayStore.getServerSnapshot);
  const habits = useSyncExternalStore(habitStore.subscribe, habitStore.getSnapshot, habitStore.getServerSnapshot);
  const days = useMemo(() => (today ? daysBack(WINDOW_DAYS, today) : []), [today]);
  const [view, setView] = useState<View>("Today");
  const [composing, setComposing] = useState(false);
  const [name, setName] = useState("");
  // Every removal still inside the Undo window: one Undo puts them all back where they were.
  const [removed, setRemovedState] = useState<RemovedBatch | null>(null);
  // The latest batch, so two removals before a re-render still both land in it.
  const removedRef = useRef<RemovedBatch | null>(null);
  const setRemoved = (batch: RemovedBatch | null) => { removedRef.current = batch; setRemovedState(batch); };
  const [toastFocused, setToastFocused] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const nameRef = useRef<HTMLInputElement>(null);
  const newRef = useRef<HTMLButtonElement>(null);
  const undoRef = useRef<HTMLButtonElement>(null);
  const wasComposing = useRef(false);

  const doneToday = today ? completedOn(habits, today) : 0;
  const percent = habits.length ? Math.round((doneToday / habits.length) * 100) : 0;
  const checkIns = signalsIn(habits, days);

  useEffect(() => {
    if (composing) nameRef.current?.focus();
    else if (wasComposing.current) newRef.current?.focus();
    wasComposing.current = composing;
  }, [composing]);
  useEffect(() => { if (removed?.viaKeyboard) undoRef.current?.focus(); }, [removed]);
  // The toast closes 6 s after the latest removal (each removal restarts it), but never while it holds focus.
  useEffect(() => {
    if (!removed || toastFocused) return;
    const timer = window.setTimeout(() => { removedRef.current = null; setRemovedState(null); }, 6000);
    return () => window.clearTimeout(timer);
  }, [removed, toastFocused]);

  function closeComposer() {
    setComposing(false);
    setName("");
  }
  function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = addHabit(habits, name, createId());
    if (next === habits) return;
    habitStore.update(() => next);
    setAnnouncement(`Added “${name.trim()}”.`);
    closeComposer();
  }
  function toggle(habit: Habit, day: string) {
    const wasDone = Boolean(habit.checks[day]);
    habitStore.update((current) => toggleCheck(current, habit.id, day));
    setAnnouncement(`${habit.name}: ${wasDone ? "not done" : "done"} on ${longDay(day)}.`);
  }
  function remove(habit: Habit, viaKeyboard: boolean) {
    // Read the habit (with its latest check-ins) and its neighbour inside the same store update.
    let entry: RemovedEntry | undefined;
    habitStore.update((current) => {
      const index = current.findIndex((item) => item.id === habit.id);
      if (index < 0) return current;
      entry = { habit: current[index], beforeId: current[index + 1]?.id ?? null };
      return removeHabit(current, habit.id);
    });
    if (!entry) return;
    const items = [...(removedRef.current?.items ?? []), entry];
    setRemoved({ items, viaKeyboard });
    setAnnouncement(`${removedLabel(items)}. Undo is available for a few seconds.`);
  }
  function closeToast() {
    setRemoved(null);
    setToastFocused(false);
    (newRef.current ?? nameRef.current)?.focus();
  }
  function undo() {
    const items = removedRef.current?.items;
    if (!items?.length) return;
    // Latest removal first, so each habit goes back before the row that followed it at the time.
    habitStore.update((current) => items.reduceRight((list, { habit, beforeId }) => restoreHabit(list, habit, beforeId), current));
    setAnnouncement(items.length === 1 ? `Restored “${items[0].habit.name}”.` : `Restored ${items.length} habits.`);
    closeToast();
  }

  const heading = view === "Today" ? "Today" : "Last 14 days";
  const summary = !today
    ? `${habits.length} ${habits.length === 1 ? "habit" : "habits"}`
    : view === "Today"
      ? longDay(today)
      : `${checkIns} ${checkIns === 1 ? "check-in" : "check-ins"} across ${habits.length} ${habits.length === 1 ? "habit" : "habits"}`;

  return (
    <div className="as">
      <a className="as-skip" href="#main">Skip to content</a>
      <AppTop name="Habits" tagline="Small daily things, one tick at a time" />

      <div className="as-body">
        <aside className="as-side" aria-label="Views">
          <h2>Views</h2>
          <ul className="as-lists">
            <ListButton label="Today" count={doneToday} current={view === "Today"} onSelect={() => setView("Today")} />
            <ListButton label="Last 14 days" count={checkIns} current={view === "History"} onSelect={() => setView("History")} />
          </ul>
        </aside>

        <main id="main" className="as-main">
          <div className="as-head">
            <div>
              <h1>{heading}</h1>
              <p>{summary}</p>
            </div>
            <div className="as-tools">
              {composing ? null : <button ref={newRef} type="button" className="as-button" onClick={() => setComposing(true)}><PlusIcon />New habit</button>}
            </div>
          </div>

          {composing ? (
            <form className="as-composer" onSubmit={add} aria-label="New habit">
              <label className="as-field">Habit
                <input ref={nameRef} value={name} onChange={(event) => setName(event.target.value)} placeholder="Something small you can do every day" autoComplete="off" />
              </label>
              <div className="as-composer-foot">
                <span className="as-hint">Tick it off on the days you do it.</span>
                <div className="as-composer-actions">
                  <button type="button" className="as-plain" onClick={closeComposer}>Cancel</button>
                  <button type="submit" className="as-button" disabled={!name.trim()}>Add</button>
                </div>
              </div>
            </form>
          ) : null}

          {habits.length === 0 ? (
            <div className="as-list as-empty"><strong>No habits yet</strong>Press New habit and pick one small thing to do daily.</div>
          ) : view === "Today" ? (
            <div className="as-run">
              {today ? (
                <div className="as-progress-card">
                  <div className="as-progress-text"><strong>{doneToday} of {habits.length}</strong><span>done today</span></div>
                  {doneToday === habits.length ? <Pill tone="green">All done</Pill> : <Pill tone="grey">{habits.length - doneToday} to go</Pill>}
                  <div className="as-progress" role="progressbar" aria-label="Done today" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} data-done={doneToday === habits.length ? "true" : undefined}>
                    <span style={{ width: `${percent}%` }} />
                  </div>
                </div>
              ) : null}
              <ul className="as-list" aria-label="Today's habits">
                {habits.map((habit) => {
                  const done = Boolean(today && habit.checks[today]);
                  return (
                    <li className="as-row as-row-check as-row-habit" key={habit.id}>
                      <label className="as-check">
                        <input type="checkbox" checked={done} disabled={!today} aria-label={`Done today: ${habit.name}`} onChange={() => toggle(habit, today)} />
                        <span aria-hidden="true" />
                      </label>
                      <div>
                        <h3>{habit.name}</h3>
                        <p>{today ? streakLabel(currentStreak(habit.checks, today)) : " "}</p>
                      </div>
                      <button type="button" className="as-plain as-icon" aria-label={`Remove ${habit.name}`} onClick={(event) => remove(habit, event.detail === 0)}><XIcon /></button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : (
            <div className="as-goals">
              {habits.map((habit) => (
                <section className="as-goal as-habit" key={habit.id} aria-labelledby={`habit-${habit.id}`}>
                  <div className="as-goal-head">
                    <div>
                      <h2 id={`habit-${habit.id}`}>{habit.name}</h2>
                      <p>{today ? `${streakLabel(currentStreak(habit.checks, today))} · ${days.filter((day) => habit.checks[day]).length} of ${WINDOW_DAYS} days` : " "}</p>
                    </div>
                  </div>
                  <ol className="as-days" aria-label={`${habit.name}, last ${WINDOW_DAYS} days`}>
                    {days.map((day) => {
                      const { weekday, day: date } = dayParts(day);
                      const done = Boolean(habit.checks[day]);
                      return (
                        <li key={day}>
                          <button type="button" className="as-day" aria-pressed={done} aria-label={`${habit.name}, ${longDay(day)}`} data-today={day === today ? "true" : undefined} onClick={() => toggle(habit, day)}>
                            <span>{weekday}</span>
                            <strong>{date}</strong>
                          </button>
                        </li>
                      );
                    })}
                  </ol>
                </section>
              ))}
            </div>
          )}

          <p className="as-note">Saved in this browser only. No account, no sync. A streak keeps going until a whole day passes without a tick.</p>
        </main>
      </div>

      <p className="as-sr" role="status" aria-live="polite">{announcement}</p>
      {removed ? (
        <div
          className="as-toast"
          role="group"
          aria-label="Undo remove"
          onFocus={() => setToastFocused(true)}
          onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setToastFocused(false); }}
          onKeyDown={(event) => { if (event.key === "Escape") closeToast(); }}
        >
          <span>{removedLabel(removed.items)}</span>
          <button ref={undoRef} type="button" className="as-plain" onClick={undo} aria-label={removed.items.length === 1 ? "Undo remove" : `Undo remove of ${removed.items.length} habits`}>Undo</button>
        </div>
      ) : null}

      <AppFoot source="https://github.com/bookchaowalit-website/productivity-habit-tracker-web" />
    </div>
  );
}
