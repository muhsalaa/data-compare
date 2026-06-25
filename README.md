# Data Compare

A browser-first, data-agnostic dashboard for comparing multiple live HTTP data sources over time. No backend, no signup, no cloud dependency. Open source and self-contained.

Built for developers and technical operators who want to quickly compare numbers across APIs, see trends, and get alerted when something looks off — without reaching for a heavyweight observability platform.

## What it does

- **Create sessions** — one dashboard per thing you want to monitor.
- **Add HTTP sources** — poll any JSON API with query params, bearer tokens, or custom headers.
- **Map scalar fields** — extract numbers, booleans, or strings with JSON paths.
- **Derive metrics** — combine mapped fields with math expressions.
- **Visualize** — line charts, stat cards, and fetch history.
- **Set warning rules** — alert when an expression crosses a threshold.
- **Everything stays local** — data is stored in IndexedDB in the browser.

## Demo

Live deployment: https://data-compare.pages.dev

## Open source status

This project is open source for use and reference. I'm not accepting external contributions right now.

## Tech stack

- React 19 + TypeScript
- Vite
- TanStack Router
- shadcn/ui
- Tailwind CSS v4
- Dexie (IndexedDB)
- Recharts
- mathjs (safe expression evaluation)

## Project status

MVP. Core loop works end to end: create a session, add sources, map fields, start polling, and see charts update in real time.

## Notes

- **Browser-only** — polling runs in the active tab, so browser throttling still applies in background tabs.
- **Local storage** — session config and fetched history live in IndexedDB in the browser.
- **Sensitive config** — bearer tokens and custom headers are stored locally in IndexedDB for MVP. Treat the browser profile/device as sensitive.

## Quick start

```bash
# install dependencies
bun install

# start dev server
bun run dev

# run tests
npm test -- --run

# lint
npm run lint

# build
bun run build
```

## Deploy

Configured for Cloudflare Pages static hosting:

```bash
bun run deploy
```

This builds the app and deploys the `dist/` folder.

## Key design decisions

- **Browser-only** — no server required. Polling runs in the active tab using a leader lock so multiple tabs don't duplicate work.
- **Session-centric** — each session is an isolated dashboard with its own sources, metrics, charts, and rules.
- **Blocking over silent breakage** — unmapping a field is blocked if other metrics, charts, or warning rules still reference it.
- **Minimal chrome** — the UI prioritizes data density over decoration.

## Folder structure

```
src/
  components/        React components
    charts/          Chart rendering
    dashboard/       Dashboard panels (stats, history, warnings, chart builder)
    polling/         Global polling manager and leader lock
    session/         Session shell, session page, settings
    sources/         Source and field mapping forms
    ui/              shadcn/ui components
  db/                IndexedDB schema and helpers
  lib/               Domain logic: polling pipeline, formulas, stats, history, etc.
  routes/            TanStack Router routes
  hooks/             Shared React hooks
public/              Static assets
docs/                Project documentation
```

## Polling architecture

Polling is handled by a single global `PollingManager` mounted at the root of the app:

1. Watches all sessions with `status === 'active'`.
2. Acquires a cross-tab leader lock via `navigator.locks`.
3. Runs one independent poll loop per active session.
4. If leadership is lost, all loops stop. If another tab's leader closes, the next tab takes over automatically.
5. IndexedDB syncs session state across tabs automatically.

See `src/components/polling/polling-manager.tsx` and `src/lib/leader-lock.ts`.

## Testing

```bash
npm test -- --run
```

Tests cover:

- formula evaluation
- JSON path extraction
- source key rename dependency detection
- stats computation
- import/export
- history queries
- warning rule evaluation
- leader lock behavior
- global polling manager scheduling

## License

MIT
