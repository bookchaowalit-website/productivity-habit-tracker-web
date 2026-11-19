# Habit Patchbay — Product truth

> Inferred from the code and copy (no user interview). Checked against the portfolio card claims review
> (`portfolio-site-web/docs/audits/CARD-CLAIMS-REVIEW-2026-10.md`, row `habit-tracker`) on 2026-10-23.

## What it is

A client-only 14-day habit grid: three starter lanes, add/remove lanes, tap a day to check it, with streaks. Everything is kept in this browser's localStorage.

## Who it is for

A portfolio visitor who wants to try a small daily habit grid.

## What works today

1. The grid shows the last 14 days ending today (the visitor's local date, filled in after the page loads so a static build date never shows).
2. Tap a cell to check or uncheck a day; Today and 14-day signals update. The streak counts consecutive checked days; an unchecked today does not break it until the day is over.
3. Add a lane (Enter or the button) or remove one. Lanes and checks survive a reload; a saved value of the wrong shape is ignored, bad lanes are dropped.
4. `/api/mcp` answers JSON-RPC with `get_starter_lanes` and `streak` (the page's streak rule on a list of days sent in the request); it never sees a visitor's habits, and unknown tools and methods get JSON-RPC errors.
5. Front-end and server errors go to Sentry (errors only, personal data stripped) when `NEXT_PUBLIC_SENTRY_DSN` is set.

## What does not work (and must not be claimed)

- No account, sync, reminders, history beyond the visible 14 days in the UI (older checks are kept but not shown), or charts.
- Data stays in one browser on one device; clearing site data deletes it.

## Known limits

- **Undo is the only way back after a remove, and it lasts 6 seconds.** Removals made within the window form one batch,
  and one Undo restores them all with their check-ins. The timer pauses while focus is inside the toast, but not while a
  mouse pointer rests on it, so a mouse or touch user who waits longer than 6 seconds loses the habit and its history.
  There is no trash or "recently removed" list: that would be a new feature, not a fix (decision 2026-11-18; the 6 s
  batch Undo is the App shell design).
- **Date rollover:** a tick on Today records the local date at the moment of the tap, and after midnight it flips that
  new day's saved state (not the state the not-yet-refreshed box shows). The rest of the screen (header,
  grid) moves to the new day on the next re-render or within a minute.
- **Two open tabs:** each write builds on the latest saved data, but a tab only redraws when the browser delivers the
  `storage` event, so for a moment a tab can show data another tab has already changed.
- **Names over 60 characters** (saved by an older version before the limit): Rename opens with the full name, and
  Save shortens a name still over 60 characters to 60 without saying so (Codex review 2026-11-19, P3, accepted).
- **Undo with clashing names in one batch:** if `Run (2)` and `Run` are removed together and another tab then adds
  `Run`, Undo restores `Run` as `Run (2)` first, so the habit that was `Run (2)` comes back as `Run (2) (2)`. Nothing
  is lost and each history stays with its habit; only the suffixes differ (Codex review 2026-11-19, P3, accepted).
- **Rename then switch views before typing:** the field still holds its focus request, so the form in the other view
  takes focus back from the view button and selects the name (Codex review 2026-11-19, P3, accepted).
- **Old over-long name whose first 60 characters match another habit:** Save stays enabled, but the shortened name
  is refused as a duplicate and the field shows no reason (Codex review 2026-11-19, P3, accepted).

## Live URL and deploy state

- Live: https://habit-tracker.bookchaowalit.com (HTTP 200 on 2026-10-23).
- The Vercel project `bookchaowalit-habit-tracker-frontend` is deployed only by CLI. Its last production deploy is the CVE patch (2026-10-23, CLI, commit 9f8a1e4). Its Git link names the old repository `bookchaowalit/bookchaowalit-habit-tracker-frontend`, so a push to `main` does not deploy: the L2 work stays undeployed until the owner reconnects Vercel Git to this repository (owner action D9). `NEXT_PUBLIC_SENTRY_DSN` is already set on the Vercel project (Sentry project `productivity-habit-tracker-web`, org `personal-yu0`).

## Boundaries

- Browser-only apart from the stateless `/api/mcp` route.
