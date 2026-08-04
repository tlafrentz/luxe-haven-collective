---
name: run-luxe-haven-collective
description: Build, run, and drive Luxe Haven Collective (the Next.js hospitality platform). Use when asked to start the app, run its dev server, take a screenshot of a page, verify a UI change actually renders, or interact with the running app (marketing site, auth, dashboard, admin).
---

Luxe Haven Collective is a Next.js App Router web app. There is no
custom driver script — drive it with this session's Browser pane
tools (`mcp__Claude_Browser__*`): start the dev server with
`preview_start`, then `navigate` / `computer` / `read_page` /
`read_console_messages` against the tab it opens. All paths below are
relative to the repo root.

## Prerequisites

Nothing to install beyond what's already in the repo: `node_modules/`
and `.env.local` (real Supabase + integration credentials) are already
present in a working checkout. Verified versions in this environment:

```bash
node --version   # v24.18.0
npm --version    # 11.16.0
```

If `node_modules/` is missing:

```bash
npm install
```

## Run (agent path)

A launch config already exists at `.claude/launch.json` (name `dev`,
`npm run dev`, port 3000). Use the Browser pane tools directly — do
not run the dev server with Bash, and do not reach for `chromium-cli`
or Playwright; they are not installed in this environment.

```
mcp__Claude_Browser__preview_start { name: "dev" }
```

This starts `next dev` (Turbopack) and opens a tab (commonly `tabId:
"seed"`) at `http://localhost:3000`. Then drive it:

```
mcp__Claude_Browser__navigate     { url: "http://localhost:3000/stays", tabId }
mcp__Claude_Browser__read_page    { tabId, filter: "interactive" }   # get hrefs/refs
mcp__Claude_Browser__computer     { action: "screenshot", tabId }
mcp__Claude_Browser__read_console_messages { tabId, onlyErrors: true }
mcp__Claude_Browser__preview_logs { serverId }                        # server-side errors
```

Verified end-to-end this session: `/` (marketing home) → `/stays`
(listing) → `/stays/mesa-downtown-retreat` (a real published listing,
detail page renders price/booking card) → `/dashboard` (unauthenticated,
correctly redirects to `/login` via middleware). No console errors on
any of these. Screenshots confirmed all four rendered correctly.

Stop the server when done:

```
mcp__Claude_Browser__preview_stop { serverId }
```

If you instead need a raw port check without the Browser pane:

```bash
lsof -ti:3000 -sTCP:LISTEN | xargs -r kill   # free the port before relaunching
```

## Run (human path)

```bash
npm run dev   # → http://localhost:3000, Ctrl-C to stop
```

## Auth

`/login`, `/register` exist but there are no known test credentials —
`.env.local` points at a real Supabase project, so don't create
accounts or guess logins against it. For anything behind
`isProtectedRoute` (`/dashboard`, `/properties`, `/bookings`,
`/messages`, `/reports`, `/guidebooks`, `/admin` — see
[src/lib/auth/roles.ts](../../../src/lib/auth/roles.ts)), the
verifiable behavior without credentials is the middleware redirect to
`/login?next=<path>`, which is what this session confirmed. If the
user provides real credentials, sign in at `/login` via `computer`
`type`/`click` (React controlled inputs — use `computer`'s `type`
action or `form_input`, not `javascript_tool` eval, or React's
`onChange` won't fire).

## Test

```bash
npx vitest run                 # full suite
npx vitest run tests/architecture/reports-navigation-boundary.test.ts   # single file, ~330ms
npm run typecheck              # tsc --noEmit
```

## Gotchas

- **`next dev` fails at boot with `Error: You cannot use different
  slug names for the same dynamic path ('category' !== 'reportId')`.**
  Caused by two sibling folders at the same route depth using
  different dynamic-segment names —
  `src/app/(dashboard)/dashboard/reports/[category]/` vs.
  `src/app/(dashboard)/dashboard/reports/[reportId]/`. This session
  found `[category]/[reportId]/page.tsx` to be orphaned (unreferenced
  outside itself, unreachable — the five report categories are literal
  folders like `reports/executive/`, not a `[category]` segment) and
  removed it; the dev server boots cleanly with it gone. If this
  reappears (e.g. after a `git checkout` of an older commit), delete
  that directory again. Confirmed with `git rm`-equivalent: the
  `reports-navigation-boundary` and `report-registry` tests don't
  reference that file and still pass after removal.
- **After editing route files, a stale error can persist** even once
  the conflicting file is gone, if the old `next dev` process is still
  running — the fatal route-manifest error is cached for the process
  lifetime. Kill the port and delete `.next/` before relaunching:
  `lsof -ti:3000 -sTCP:LISTEN | xargs -r kill && rm -rf .next`.
- **Nav label vs. route mismatch** — the header's "Properties" link
  goes to `/stays`, not `/properties` (`/properties` is the
  authenticated portal route and requires login). Don't assume label
  text matches the path.
- **`chromium-cli` is not installed in this environment.** Use the
  Browser pane MCP tools (`mcp__Claude_Browser__*`) instead — they are
  the verified, working driver for this project.

## Troubleshooting

- **`preview_start` throws `Failed to start server: ... 'category' !==
  'reportId'`**: see the routing-conflict gotcha above — remove
  `src/app/(dashboard)/dashboard/reports/[category]/`.
- **Navigating to a route seems to silently land back on `/` with no
  error**: check `read_console_messages` / `preview_logs` first — this
  was actually an Internal Server Error (the routing conflict above),
  not a client redirect. `get_page_text` showing "Internal Server
  Error" is the real signal; the tab title can lag behind.
