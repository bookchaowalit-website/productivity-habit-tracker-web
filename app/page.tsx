"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { WINDOW_DAYS, addHabit, completedOn, currentStreak, daysBack, habitStore, removeHabit, signalsIn, todayStore, toggleCheck } from "@/lib/habits";

export default function Home() {
  const today = useSyncExternalStore(todayStore.subscribe, todayStore.getSnapshot, todayStore.getServerSnapshot);
  const days = useMemo(() => (today ? daysBack(WINDOW_DAYS, today) : []), [today]);
  const habits = useSyncExternalStore(habitStore.subscribe, habitStore.getSnapshot, habitStore.getServerSnapshot);
  const [name, setName] = useState("");
  const completedToday = today ? completedOn(habits, today) : 0;
  const totalSignals = signalsIn(habits, days);
  function addLane() { const next = addHabit(habits, name, crypto.randomUUID()); if (next === habits) return; habitStore.update(() => next); setName(""); }
  function toggle(id: string, day: string) { habitStore.update((current) => toggleCheck(current, id, day)); }

  return <main className="patchbay-shell">
    <header className="patchbay-header"><div className="machine-mark" aria-hidden="true"><span /><span /><span /></div><div><p className="eyebrow">SOLO OPERATIONS / DAILY SIGNALS</p><h1>Keep the circuit alive.</h1><p className="lede">A 14-day patchbay for the small actions that keep a good day connected.</p></div><div className="status-readout"><span>LOCAL MEMORY</span><strong>ON</strong><span>no account · no sync</span></div></header>
    <div className="amber-line" />
    <section className="readouts" aria-label="Habit tracker summary"><div><span>LIVE LANES</span><strong>{String(habits.length).padStart(2, "0")}</strong></div><div><span>TODAY</span><strong>{completedToday}/{habits.length || 0}</strong></div><div><span>14-DAY SIGNALS</span><strong>{String(totalSignals).padStart(2, "0")}</strong></div><p>Tap a cell to close the circuit for that day.</p></section>
    <section className="console" aria-labelledby="lanes-heading"><div className="console-top"><div><span className="section-label">PATCH SCHEDULE / 14 DAYS</span><h2 id="lanes-heading">Your lanes</h2></div><div className="legend"><span className="legend-wire active" /> completed <span className="legend-wire" /> open</div></div>
      <div className="table-wrap"><table><thead><tr><th scope="col">Lane</th>{days.map((day, index) => <th scope="col" key={day}><span>{index === days.length - 1 ? "NOW" : day.slice(5)}</span></th>)}<th scope="col">Streak</th><th scope="col"><span className="sr-only">Remove</span></th></tr></thead><tbody>{habits.map((habit, row) => <tr key={habit.id}><th scope="row"><span className="lane-number">{String(row + 1).padStart(2, "0")}</span>{habit.name}</th>{days.map((day) => <td key={day}><button type="button" aria-label={`${habit.checks[day] ? "Unmark" : "Mark"} ${habit.name} on ${day}`} aria-pressed={Boolean(habit.checks[day])} className={`patch ${habit.checks[day] ? "patched" : ""}`} onClick={() => toggle(habit.id, day)}><span /></button></td>)}<td className="streak">{today ? currentStreak(habit.checks, today) : 0}<small>d</small></td><td><button className="remove" type="button" onClick={() => habitStore.update((current) => removeHabit(current, habit.id))} aria-label={`Remove ${habit.name}`}>×</button></td></tr>)}</tbody></table></div>
      {habits.length === 0 && <p className="empty">No lanes are patched. Add one below to restore the schedule.</p>}
      <div className="add-lane"><label htmlFor="new-habit">Open a new lane</label><input id="new-habit" value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") addLane(); }} placeholder="e.g. Drink water" /><button type="button" onClick={addLane}>Patch lane <span>+</span></button></div>
    </section>
    <footer className="patchbay-footer"><span>HABIT TRACKER / BUILD 02</span><span>Data stays on this device.</span></footer>
  </main>;
}
