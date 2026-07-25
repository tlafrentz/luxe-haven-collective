# Portfolio Risk & Opportunities Walkthrough

Validate `/dashboard/portfolio/risk` with owner, assigned operator, restricted
contributor/viewer, suspended, cross-workspace, and anonymous sessions.

Confirm:

- risks and opportunities remain visually and semantically separate;
- every card exposes impact, confidence, horizon, evidence, and investigation links;
- priority ordering explains impact, confidence, urgency, scope, and evidence;
- PI-001D concentration evidence appears without conflicting calculations;
- inaccessible properties and financial fields cannot be inferred;
- stale data produces a degraded state while unaffected findings remain available;
- insufficient evidence suppresses unsupported opportunities;
- empty risk and opportunity states are intentional;
- keyboard order, headings, table caption, live updates, and mobile reading order work;
- investigation links navigate only to authorized bounded products.

Run lint, typecheck, relevant and full tests, production build, route validation,
`git diff --check`, an anonymous redirect smoke test, and runtime-log review.

