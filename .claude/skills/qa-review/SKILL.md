---
name: qa-review
description: Sweeps live pages and dialogs in Luxe Haven Collective for QA issues — broken content, dead links/buttons, form and dialog bugs, color-contrast/accessibility problems, and inefficient or redundant API calls — then writes a findings report to docs/qa/. Use this whenever the user asks for a QA pass, a quality review, to "check the app for issues," to verify a page/area/dialog actually works end to end, to audit accessibility or contrast, or to look for wasted/duplicate/slow API calls — even if they only name one area (e.g. "QA the dashboard" or "check the offers flow") rather than the whole app. Trigger on requests like "sweep the admin area for bugs," "make sure the new guidebook editor doesn't have broken links," or "look for inefficient API calls on the reports pages." This is broader than design-review (which does a deep design-system/token audit of one page or component) — reach for qa-review when the ask spans multiple screens or explicitly includes functional/content/network concerns, not just visual polish.
---

# QA Review

This sweeps real, running pages of Luxe Haven Collective — not a code read-through — and reports what's actually broken, confusing, inaccessible, or wasteful when a user hits it. It reuses two things that already exist in this repo rather than reinventing them:

- **[run-luxe-haven-collective](../run-luxe-haven-collective/SKILL.md)** for starting the dev server and the general pattern of driving it with this session's Browser pane tools (`mcp__Claude_Browser__*`) — read that skill first if you haven't already.
- **[design-review](../design-review/SKILL.md)**'s checklist (token consistency, dark mode, focus states, component reuse) for the design-system-conformance parts of a single page. If a QA sweep turns up a page that looks badly off-system, it's fine to note it here and suggest the user run `/design-review` on that specific page afterward for a deeper token-level audit — don't try to replicate that whole checklist for every one of 200+ routes.

What this skill adds that neither of those cover: walking *every* screen in a scope (not just one flagged page), following links and opening dialogs to catch functional breakage, and inspecting network activity for redundant or wasteful calls.

## Step 1: Work out the scope

Default to whatever the user actually asked for — a named area ("QA the dashboard"), a feature ("check the offers flow"), or recently changed code (if they say something like "QA what I just built," scope to `git diff` against `origin/main`). Only do a full sweep of all ~224 routes when the user explicitly asks for the whole app — it's slow and expensive, so don't default to it just because scope was ambiguous. If scope really is unclear, ask.

If the user wants a full sweep, it's better run as several separate invocations of this skill (one per area — marketing, dashboard, admin, portal, auth) than as one giant pass — each produces its own report, and a stalled or interrupted run only costs you one area, not the whole thing.

## Step 2: Discover the actual routes in scope

Route folders change as the app grows, so don't work from memory or a stale list — discover them fresh:

```bash
node .claude/skills/qa-review/scripts/discover-routes.mjs --area=marketing
node .claude/skills/qa-review/scripts/discover-routes.mjs --grep=offers
node .claude/skills/qa-review/scripts/discover-routes.mjs --changed
node .claude/skills/qa-review/scripts/discover-routes.mjs             # everything, only for an explicit full sweep
```

Add `--json` to any of these for machine-readable output. Each route is tagged `admin-only`, `auth-required`, or neither (cross-checked live against `src/lib/auth/roles.ts`, not hardcoded), and `dynamic:<param>` if it needs a sample ID/slug — for those, grab a real value the same way you would for manual testing (e.g. the `mesa-downtown-retreat` slug used in the run skill, or an ID visible in an admin list page) rather than guessing one.

`--changed` diffs `src/app` against `origin/main`; if that fails (no such ref, or nothing changed there) it warns and falls back to the full inventory rather than silently returning nothing — don't mistake that fallback for "everything changed."

This script only finds **pages** (`page.tsx` files) — it cannot find dialogs, since in this codebase dialogs (`role="dialog"`, `<Dialog>`/`<Modal>`/`<Sheet>` components) live in `src/features/*` and `src/components/*` and get imported into pages, not colocated with the route. There's no reliable static way to enumerate them. Finding dialogs is Step 4's job — you find them by actually clicking around.

## Step 3: Handle auth

Routes tagged `auth-required` or `admin-only` need a real signed-in session. `.env.local` points at a real Supabase project with no known test accounts, so never guess credentials or register a throwaway account against it.

- **User supplied credentials this session** — sign in once via `/login` (email field, password field, "Sign in" button — get live `ref`s with `read_page` rather than assuming coordinates) and keep reviewing in that same tab/session.
- **No credentials** — skip every `auth-required`/`admin-only` route, but don't skip silently: list them under "Routes skipped" in the report with the reason, so the user knows those areas weren't covered. You can still verify the auth *boundary* itself without credentials (that hitting a protected route redirects to `/login?next=<path>`), which is a legitimate, useful check on its own.

## Step 4: Walk each route and look for issues

For each route in scope, load it fresh (a hard navigate, not just a client transition) and work through:

**Content.** Read the actual copy like a user would — typos, placeholder/lorem-ipsum text that shipped by accident, stale or contradictory numbers, broken image references, terminology that shifts between pages for the same concept.

**Functionality.** Click the primary actions and follow the links — don't just confirm the page renders. Try every button, tab, and menu that looks like it opens a dialog, drawer, or sheet; open it, check it renders sensibly, and close it (Escape / cancel / X) to confirm that works too. Submit-type actions are the one place to hold back: don't submit forms with fabricated data or trigger anything that reads as destructive/irreversible against real data (the same boundary design-review uses) — note what you *would* test and move on rather than guessing your way past it.

**Accessibility / contrast.** Check text-vs-background contrast, visible focus states on interactive elements, and icon-only controls without an accessible label. `javascript_tool` can pull computed `color`/`background-color` for a specific element if a contrast issue looks borderline rather than obvious.

**Technical.** `read_console_messages` with `onlyErrors: true` after each load — a page that renders fine but throws in the console is still a bug. `preview_logs` on the dev server catches server-side errors that never reach the browser console at all (this is how the reports-routing crash surfaced during the run-skill work — the page silently 500'd while the browser just showed a stale prior page).

**Network efficiency.** See Step 5 — it's involved enough to break out separately.

Batch related routes together in your head as you go (e.g. all five report categories, or the offer detail + its sub-tabs) rather than treating each as fully independent — cross-page issues (the same broken pattern repeated, or the same slow endpoint hit from five different pages) are often more important to call out than any single-page nit, and you'll only spot them by comparing notes across a batch.

## Step 5: Network efficiency

Call `read_network_requests` right after each page load. Two different things are visible here and they need different handling:

- **Dev-server noise** — `_next/static/*`, HMR/Turbopack chunks, font/image assets, `304 Not Modified` revalidations. This is not what you're checking; filter it out mentally (or with `urlPattern`) rather than flagging it.
- **Real data calls** — requests to `/api/*`, Supabase, or other third-party endpoints. Look for: the *same* URL requested more than once on a single fresh load (a real duplication bug, not caused by React refresh), failed (`FAILED`/4xx/5xx) requests, and anything that looks like it's fetching far more than the page displays.

Know the limits of what network capture can see: most pages in this app fetch data server-side in React Server Components or Server Actions (this is a Next.js App Router app using `@tanstack/react-query` only in some client areas) — that traffic **never appears in the browser network tab at all**. So for most routes, "is the API call efficient" is a source-reading question, not a network-capture question: open the page's server component and whatever it calls in `src/app/actions/*.ts` (or the relevant `src/features/*` data layer), and look for sequential `await`s that could be `Promise.all`, a loop issuing one query per item instead of a single batched query, or the same data being fetched twice by two different components on the same page. Cite the specific file:line when you flag this kind of issue — "looks inefficient" isn't actionable, "these three awaits at `src/app/actions/reporting.ts:42-44` are sequential but independent" is.

One artifact to watch for: `read_network_requests` can still show a stray `FAILED: net::ERR_CONNECTION_REFUSED` entry left over from a previous dev-server session in the same browser tab. If a failed request's timing doesn't line up with the page you just loaded, it's probably that — don't report it as a bug in the current page.

## Step 6: Write the report

Write findings to `docs/qa/<YYYY-MM-DD>-<scope-slug>.md` (e.g. `docs/qa/2026-08-03-marketing.md`), creating `docs/qa/` if it doesn't exist. Use this structure:

```markdown
# QA Review — <scope> — <YYYY-MM-DD>

## Scope
- Routes reviewed: <N> (from `discover-routes.mjs --area=...`)
- Routes skipped: <N> — see below
- Commit reviewed: <git rev-parse --short HEAD>

## Summary
Critical: <n> · High: <n> · Medium: <n> · Low: <n>

## Findings

### <route>
**[<Critical|High|Medium|Low>] [<Content|Functionality|Accessibility|Technical|Network>]** <one-line title>
- What: <what's actually wrong>
- Evidence: <console error text / network detail / what you clicked and what happened>
- Why it matters: <concrete user or technical impact, not just "looks off">
- Suggested fix: <file:line if you traced it, or the concrete next step>

<repeat per finding, grouped under the route it was found on>

## Cross-page patterns
<Anything that showed up more than once — a repeated bug, a slow endpoint hit from multiple pages, an inconsistent pattern>

## Routes skipped
- <route> — <reason, e.g. "auth-required, no credentials provided">
```

Order findings within each route by severity, most severe first. Skip anything you're not actually confident about rather than padding the list — same reasoning as design-review: a report full of nitpicks trains people to stop reading it. This skill is report-only — don't apply fixes. If the user wants something fixed after reading the report, that's a separate follow-up.

## Gotchas

- **`chromium-cli` is not installed in this environment.** Drive everything through the Browser pane tools, same as the run skill.
- **The dialog-hint idea doesn't work here.** An earlier version of `discover-routes.mjs` tried to flag pages with a nearby dialog by grepping sibling files in the route folder; it never matched anything because dialogs live in `src/features/*`/`src/components/*`, imported into pages rather than colocated with them. Don't rebuild that — dialogs have to be found live, per Step 4.
- **Nav label text can mislead you about the actual path** — e.g. the header's "Properties" link goes to `/stays`, not `/properties`. Use `read_page` to get real `href`s rather than assuming a label matches a route.
