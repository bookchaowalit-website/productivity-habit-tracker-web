"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { AppFoot, AppTop, ListButton, Pill, PlusIcon } from "@/components/app-shell";
import {
  NAME_MAX, WINDOW_DAYS, addHabit, completedOn, currentStreak, dayParts, daysBack, habitStore, hasHabitNamed, longDay, removeHabit,
  renameHabit, restoreHabit, signalsIn, streakLabel, todayStore, toggleCheck, type Habit,
} from "@/lib/habits";

type View = "Today" | "History";
type RemovedEntry = { habit: Habit; beforeId: string | null; afterId: string | null; index: number };
type RemovedBatch = { items: RemovedEntry[]; viaKeyboard: boolean };
const removedLabel = (items: RemovedEntry[]) => (items.length === 1 ? `Removed “${items[0].habit.name}”` : `Removed ${items.length} habits`);

// randomUUID only exists in secure contexts (HTTPS/localhost) and newer browsers.
function createId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `habit-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

const PencilIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4Z" /><path d="m13.5 6.5 4 4" /></svg>
);

/**
 * Inline rename: Enter or Save keeps the new name (check-ins stay), Escape or Cancel keeps the old one. The draft lives
 * in Home, so switching between Today and Last 14 days keeps what was typed; focus moves into the field only when
 * Rename was pressed, not when the other view shows the same form.
 */
function RenameForm({ habit, draft, problem, focusOnMount, onDraft, onSave, onCancel }: {
  habit: Habit; draft: string; problem: string | null; focusOnMount: boolean; onDraft: (value: string) => void; onSave: () => void; onCancel: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!focusOnMount) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [focusOnMount]);
  const hintId = `rename-hint-${habit.id}`;
  return (
    <form
      className="as-rename"
      aria-label={`Rename ${habit.name}`}
      onSubmit={(event) => { event.preventDefault(); if (!problem) onSave(); }}
      onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); onCancel(); } }}
    >
      <input ref={inputRef} value={draft} maxLength={NAME_MAX} onChange={(event) => onDraft(event.target.value)} aria-label={`New name for ${habit.name}`} aria-describedby={hintId} aria-invalid={problem ? true : undefined} autoComplete="off" />
      <div className="as-rename-actions">
        <button type="button" className="as-plain" onClick={onCancel}>Cancel</button>
        <button type="submit" className="as-button" disabled={problem !== null}>Save</button>
      </div>
      <span id={hintId} className="as-hint as-rename-hint">{problem ?? "Check-ins stay with the habit."}</span>
    </form>
  );
}

const XIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
);

export default function Home() {
  // "" on the server and in the static build: anything that depends on the visitor's today renders after hydration.
  const today = useSyncExternalStore(todayStore.subscribe, todayStore.getSnapshot, todayStore.getServerSnapshot);
  const habits = useSyncExternalStore(habitStore.subscribe, habitStore.getSnapshot, habitStore.getServerSnapshot);
  const days = useMemo(() => (today ? daysBack(WINDOW_DAYS, today) : []), [today]);
  // Format each day once per window, shared by every habit card (not 14 × habits calls per render).
  const dayLabels = useMemo(() => days.map((key) => ({ key, ...dayParts(key), long: longDay(key) })), [days]);
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
  // The habit being renamed, and the one whose Rename button gets focus back once the field closes.
  // The habit being renamed with its draft (kept across views) and whether its field should take focus. A refused
  // name is not remembered: the hint always comes from the latest saved list, which the refusing write just re-read.
  const [renaming, setRenaming] = useState<{ id: string; draft: string; focus: boolean } | null>(null);
  const refocusRename = useRef<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const newRef = useRef<HTMLButtonElement>(null);
  const undoRef = useRef<HTMLButtonElement>(null);
  const toastRef = useRef<HTMLDivElement>(null);
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
  useEffect(() => {
    if (renaming || !refocusRename.current) return;
    document.querySelector<HTMLButtonElement>(`[data-rename="${CSS.escape(refocusRename.current)}"]`)?.focus();
    refocusRename.current = null;
  }, [renaming, view]);
  // The toast closes 6 s after the latest removal (each removal restarts it), but never while it holds focus.
  useEffect(() => {
    if (!removed || toastFocused) return;
    const timer = window.setTimeout(() => { removedRef.current = null; setRemovedState(null); }, 6000);
    return () => window.clearTimeout(timer);
  }, [removed, toastFocused]);
  // While the toast shows, reserve its height (plus its 24px offset and a gap) at the bottom of the page and in
  // scroll-padding, so a control focused behind it (Shift+Tab from Undo) scrolls clear instead of staying hidden.
  const toastShown = removed !== null;
  useLayoutEffect(() => {
    const toast = toastRef.current;
    if (!toastShown || !toast) return;
    const rootStyle = document.documentElement.style;
    const reserve = () => rootStyle.setProperty("--as-toast-space", `${toast.offsetHeight + 32}px`);
    reserve();
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(reserve) : null;
    observer?.observe(toast);
    return () => { observer?.disconnect(); rootStyle.removeProperty("--as-toast-space"); };
  }, [toastShown]);

  function closeComposer() {
    setComposing(false);
    setName("");
  }
  function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (nameProblem(name) !== null) return;
    const id = createId();
    // Add on the latest saved list, so another tab's habits stay and a name it just added is not added twice. Close
    // and announce only when the habit really went in; otherwise keep the text and say why.
    let added = false;
    habitStore.update((current) => {
      const next = addHabit(current, name, id);
      added = next !== current;
      return next;
    });
    // Refused: the write re-read the latest list (another tab saved this name first), so the hint now says so.
    if (!added) return;
    setAnnouncement(`Added “${name.trim()}”.`);
    closeComposer();
  }
  // Today's checkbox passes the date read at the moment of the tap, not the render's `today`: a page left open past
  // midnight must record the new day (the re-render after the write then shows the new day everywhere).
  // `done` is the state the person chose from what the screen showed, so a tick another tab already saved is kept, not
  // flipped back off; the announcement reads what was actually saved.
  function setDone(habit: Habit, day: string, done: boolean) {
    let saved: boolean | null = null;
    habitStore.update((current) => {
      const latest = current.find((entry) => entry.id === habit.id);
      if (!latest) return current;
      saved = done;
      return Boolean(latest.checks[day]) === done ? current : toggleCheck(current, habit.id, day);
    });
    setAnnouncement(saved === null ? `“${habit.name}” was removed in another tab.` : `${habit.name}: ${saved ? "done" : "not done"} on ${longDay(day)}.`);
  }
  function remove(habit: Habit, viaKeyboard: boolean) {
    // Read the habit (with its latest check-ins) and its neighbour inside the same store update.
    let entry: RemovedEntry | undefined;
    habitStore.update((current) => {
      const index = current.findIndex((item) => item.id === habit.id);
      if (index < 0) return current;
      entry = { habit: current[index], beforeId: current[index + 1]?.id ?? null, afterId: current[index - 1]?.id ?? null, index };
      return removeHabit(current, habit.id);
    });
    if (!entry) return;
    const items = [...(removedRef.current?.items ?? []), entry];
    setRemoved({ items, viaKeyboard });
    setAnnouncement(`${removedLabel(items)}. Undo is available for a few seconds.`);
  }
  function closeRename(habit: Habit) {
    refocusRename.current = habit.id;
    setRenaming(null);
  }
  function saveRename(habit: Habit) {
    if (!renaming) return;
    const next = renaming.draft.trim();
    if (next === habit.name) return closeRename(habit);
    // Same rule as Add: close and announce only when the store took the new name.
    let renamed = false;
    habitStore.update((current) => {
      const result = renameHabit(current, habit.id, next);
      renamed = result !== current;
      return result;
    });
    if (!renamed) {
      setRenaming({ ...renaming, focus: false });
      return;
    }
    setAnnouncement(`Renamed “${habit.name}” to “${next}”.`);
    closeRename(habit);
  }
  /** Why a name cannot be used right now, or null. `exceptId` is the habit being renamed. */
  function nameProblem(value: string, exceptId?: string): string | null {
    const clean = value.trim();
    if (!clean) return exceptId ? "A name is required." : null;
    if (hasHabitNamed(habits, clean, exceptId)) return `You already track “${clean}”.`;
    // A habit waiting in the Undo toast still owns its name, so Undo can never bring back a second habit with it.
    const waiting = removed?.items.find(({ habit }) => habit.id !== exceptId && habit.name.trim().toLocaleLowerCase() === clean.toLocaleLowerCase());
    if (waiting) return `“${waiting.habit.name}” is waiting in Undo. Undo it or pick another name.`;
    return null;
  }
  function renameForm(habit: Habit) {
    if (!renaming || renaming.id !== habit.id) return null;
    return (
      <RenameForm
        habit={habit}
        draft={renaming.draft}
        problem={nameProblem(renaming.draft, habit.id)}
        focusOnMount={renaming.focus}
        onDraft={(draft) => setRenaming({ ...renaming, draft, focus: false })}
        onSave={() => saveRename(habit)}
        onCancel={() => closeRename(habit)}
      />
    );
  }
  function habitActions(habit: Habit) {
    return (
      <>
        <button type="button" className="as-plain as-icon as-edit" data-rename={habit.id} aria-label={`Rename ${habit.name}`} onClick={() => setRenaming({ id: habit.id, draft: habit.name, focus: true })}><PencilIcon /></button>
        <button type="button" className="as-plain as-icon" aria-label={`Remove ${habit.name}`} onClick={(event) => remove(habit, event.detail === 0)}><XIcon /></button>
      </>
    );
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
    // A name taken meanwhile (another tab) comes back as "name (2)", history kept; say so for a single restore.
    let restoredAs = items[0].habit.name;
    habitStore.update((current) => {
      const next = items.reduceRight((list, { habit, beforeId, afterId, index }) => restoreHabit(list, habit, beforeId, afterId, index), current);
      restoredAs = next.find((entry) => entry.id === items[0].habit.id)?.name ?? restoredAs;
      return next;
    });
    setAnnouncement(items.length === 1
      ? restoredAs === items[0].habit.name ? `Restored “${restoredAs}”.` : `Restored “${items[0].habit.name}” as “${restoredAs}” (the name was taken).`
      : `Restored ${items.length} habits.`);
    closeToast();
  }

  const trimmedName = name.trim();
  const addProblem = nameProblem(name);
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
            <ListButton label="Today" count={doneToday} countText={today ? `${doneToday}/${habits.length}` : `–/${habits.length}`} countLabel={today ? `${doneToday} of ${habits.length} done` : `${habits.length} habits`} current={view === "Today"} onSelect={() => setView("Today")} />
            <ListButton label="Last 14 days" count={checkIns} countLabel={`${checkIns} ${checkIns === 1 ? "check-in" : "check-ins"}`} current={view === "History"} onSelect={() => setView("History")} />
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
                <input ref={nameRef} value={name} maxLength={NAME_MAX} onChange={(event) => setName(event.target.value)} placeholder="Something small you can do every day" autoComplete="off" aria-describedby="habit-name-hint" aria-invalid={addProblem ? true : undefined} />
              </label>
              <div className="as-composer-foot">
                <span id="habit-name-hint" className="as-hint">{addProblem ?? `Tick it off on the days you do it. Up to ${NAME_MAX} characters.`}</span>
                <div className="as-composer-actions">
                  <button type="button" className="as-plain" onClick={closeComposer}>Cancel</button>
                  <button type="submit" className="as-button" disabled={!trimmedName || addProblem !== null}>Add</button>
                </div>
              </div>
            </form>
          ) : null}

          {habits.length === 0 ? (
            <div className="as-list as-empty"><strong>No habits yet</strong>Press New habit and pick one small thing to do daily.</div>
          ) : view === "Today" ? (
            <div className="as-run">
              {/* Before hydration there is no visitor "today": a same-size placeholder card keeps the list from jumping down. */}
              {!today ? (
                <div className="as-progress-card as-progress-pending" aria-hidden="true">
                  <div className="as-progress-text"><strong>– of {habits.length}</strong><span>done today</span></div>
                  <Pill tone="grey">Loading</Pill>
                  <div className="as-progress"><span style={{ width: "0%" }} /></div>
                </div>
              ) : (
                <div className="as-progress-card">
                  <div className="as-progress-text"><strong>{doneToday} of {habits.length}</strong><span>done today</span></div>
                  {doneToday === habits.length ? <Pill tone="green">All done</Pill> : <Pill tone="grey">{habits.length - doneToday} to go</Pill>}
                  <div className="as-progress" role="progressbar" aria-label="Done today" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} data-done={doneToday === habits.length ? "true" : undefined}>
                    <span style={{ width: `${percent}%` }} />
                  </div>
                </div>
              )}
              <ul className="as-list" aria-label="Today's habits">
                {habits.map((habit) => {
                  const done = Boolean(today && habit.checks[today]);
                  return (
                    <li className="as-row as-row-check as-row-habit" key={habit.id} data-renaming={renaming?.id === habit.id ? "true" : undefined}>
                      <label className="as-check">
                        <input type="checkbox" checked={done} disabled={!today} aria-label={`Done today: ${habit.name}`} onChange={(event) => setDone(habit, todayStore.getSnapshot(), event.currentTarget.checked)} />
                        <span aria-hidden="true" />
                      </label>
                      {renaming?.id === habit.id ? (
                        renameForm(habit)
                      ) : (
                        <>
                          <div>
                            <h3>{habit.name}</h3>
                            <p>{today ? streakLabel(currentStreak(habit.checks, today)) : "Streak loads in a moment"}</p>
                          </div>
                          {habitActions(habit)}
                        </>
                      )}
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
                    {renaming?.id === habit.id ? (
                      <>
                        <h2 id={`habit-${habit.id}`} className="as-sr">{habit.name}</h2>
                        {renameForm(habit)}
                      </>
                    ) : (
                      <>
                        <div>
                          <h2 id={`habit-${habit.id}`}>{habit.name}</h2>
                          <p>{today ? `${streakLabel(currentStreak(habit.checks, today))} · ${days.filter((day) => habit.checks[day]).length} of ${WINDOW_DAYS} days` : "Streak loads in a moment"}</p>
                        </div>
                        <div className="as-goal-actions">{habitActions(habit)}</div>
                      </>
                    )}
                  </div>
                  <ol className="as-days" aria-label={`${habit.name}, last ${WINDOW_DAYS} days`}>
                    {dayLabels.map(({ key: day, weekday, day: date, long }) => {
                      const done = Boolean(habit.checks[day]);
                      return (
                        <li key={day}>
                          <button type="button" className="as-day" aria-pressed={done} aria-label={`${habit.name}, ${long}${day === today ? ", today" : ""}`} data-today={day === today ? "true" : undefined} aria-current={day === today ? "date" : undefined} onClick={() => setDone(habit, day, !done)}>
                            <span>{day === today ? "Today" : weekday}</span>
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
          ref={toastRef}
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
