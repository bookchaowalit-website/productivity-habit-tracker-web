# Habit Patchbay

A 14-day habit grid kept in this browser: three starter lanes, add or remove lanes, tap days to check them and watch the streak.

Live: https://habit-tracker.bookchaowalit.com (deployed by Vercel CLI; it can lag `main`, see `PRODUCT.md`).

## What it does not do

- No account, sync, reminders or charts. Data stays in this browser.

## Run

```bash
npm ci
npm run dev
```

## Checks

```bash
npm test           # Vitest: date window, streak and lane rules, saved-data parsing, local store, MCP route, home page render, Sentry scrubbing
npm run lint
npm run typecheck
npm run build
```

CI (`.github/workflows/ci.yml`) runs the shared Node workflow (with a line-coverage gate) and the shared security
scan on every push and PR to `main`.

## Code map

- `lib/habits.ts`: dates (`daysBack`), `currentStreak`, lane edits, saved-data parsing, the localStorage store and a hydration-safe today store.
- `lib/local-store.ts`: small localStorage store for `useSyncExternalStore` (hydration-safe, works when storage is blocked).
- `app/api/mcp/route.ts`: stateless JSON-RPC endpoint with `get_starter_lanes` and `streak`.
- `lib/sentry.ts` + `instrumentation*.ts`: error reporting to Sentry, errors only, personal data stripped; off when `NEXT_PUBLIC_SENTRY_DSN` is unset.
- `app/more-projects/page.tsx`: shared portfolio link page (copied per repository, not a package).
