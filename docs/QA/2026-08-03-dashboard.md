# QA Review — dashboard — 2026-08-03

## Scope
- Routes reviewed (live): 0 of 114 (`node .claude/skills/qa-review/scripts/discover-routes.mjs --area=dashboard`) — all require a signed-in session
- Static/source-level findings: 2 (see below — found without needing to log in)
- Commit reviewed: fd002c0c

## Summary
Critical: 0 · High: 0 · Medium: 1 · Low: 0 · Note: 1

No live content/functionality findings — no credentials were available to sign in, so no dashboard screen was actually rendered or clicked through. The two items below were found by reading the route inventory and source, not by visiting the pages. Re-run with real dashboard-user credentials for an actual screen-by-screen review — that's most of the value in this area, and this pass couldn't do it.

## Findings

### `/dashboard/insights`, `/dashboard/financial`, `/dashboard/portfolio`, `/dashboard/understand`, `/dashboard/observe`
**[Medium] [Technical]** Five index pages exist as real files but are permanently unreachable — shadowed by config-level redirects
- What: `next.config.ts:5-10` defines redirects for these five exact paths (e.g. `/dashboard/insights` → `/dashboard/observe/revenue`). Next.js applies `redirects()` before filesystem routing, so a request to any of these five paths never reaches its own page component — yet all five still have a real `page.tsx` (`src/app/(dashboard)/dashboard/insights/page.tsx`, `.../financial/page.tsx`, `.../portfolio/page.tsx`, `.../understand/page.tsx`, `.../observe/page.tsx`) that will never render in production.
- Why it matters: this is the same shape of bug as the routing conflict fixed earlier in `.claude/skills/run-luxe-haven-collective/SKILL.md`'s gotchas (orphaned route code from a superseded navigation structure) — not a crash this time, just dead code that can mislead whoever edits it next into thinking it's live. It also means those five files are dark: any bug fixed or feature added there literally cannot be seen by a user.
- Suggested fix: delete the five shadowed `page.tsx` files (their content is presumably superseded by the redirect targets), or remove the redirects if the pages are actually meant to be reachable again.

### `/dashboard/learn/*` vs. `/dashboard/learning/*`
**[Note, not a confirmed finding]** Two similarly-named, overlapping sub-areas exist side by side
- What: `/dashboard/learn` (experiments, improvement, lessons, outcomes — 7 routes) and `/dashboard/learning` (candidates, gaps, health, lessons, reviews, timeline, workspace — 10 routes) both exist, both have recent commits (`fab6802f`, `085a7bd2`), and both have a `lessons/[lessonId]`-shaped route plus a review/outcome concept (`learn/outcomes/[reviewId]` vs. `learning/reviews/[reviewId]`).
- Why this is a note and not a finding: unlike the `reports/[category]` case fixed earlier today, these aren't in the same route-tree position and don't conflict — they could genuinely be two distinct, intentional features (e.g. personal learning content vs. a platform-wide learning/decision-intelligence system) rather than duplicates. Without logging in to see what each actually renders, this can't be confirmed either way.
- Suggested next step: worth a quick look with real credentials to confirm these are intentionally distinct, since the naming is close enough to be confusing either way.

## Routes skipped
All 114 dashboard routes require a signed-in session (`auth-required`). Grouped by sub-area (full list via `discover-routes.mjs --area=dashboard`):
access (1), actions (2), billing (1), communications (3), execute (3), financial (8), guidebooks (9), insights (1, unreachable — see above), investments (17), learn (7), learning (10), observe (6, one path unreachable), portfolio (9, one path unreachable), reports (11), settings (1), understand (14, one path unreachable), workspace (10).

To review this area, supply real dashboard-user credentials and re-run this skill scoped to `--area=dashboard` (likely worth splitting into a few sub-passes given the size — e.g. `--grep=investments`, `--grep=financial`).
