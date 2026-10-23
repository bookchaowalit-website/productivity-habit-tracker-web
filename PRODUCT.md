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

## Live URL and deploy state

- Live: https://habit-tracker.bookchaowalit.com (HTTP 200 on 2026-10-23).
- The Vercel project `bookchaowalit-habit-tracker-frontend` is deployed only by CLI. Its last production deploy is the CVE patch (2026-10-23, CLI, commit 9f8a1e4). Its Git link names the old repository `bookchaowalit/bookchaowalit-habit-tracker-frontend`, so a push to `main` does not deploy: the L2 work stays undeployed until the owner reconnects Vercel Git to this repository (owner action D9). `NEXT_PUBLIC_SENTRY_DSN` is already set on the Vercel project (Sentry project `productivity-habit-tracker-web`, org `personal-yu0`).

## Boundaries

- Browser-only apart from the stateless `/api/mcp` route.
