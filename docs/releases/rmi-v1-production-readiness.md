# RMI v1 Production Readiness Audit

Audit date: 2026-07-22. Scope: `/dashboard/investments` through canonical property resolution, Market analysis, Investment context composition, lifecycle execution, and client rendering.

| Area | Status | Finding |
| --- | --- | --- |
| Authentication | Ready | Owner/admin authorization occurs before validation, configuration, and provider construction. Server session identity supplies audit actor IDs. |
| Server isolation | Ready | RentCast clients, configuration, retry/cache controls, and credentials exist only in server action/infrastructure modules. |
| Request validation | Ready | Strict Zod schema bounds address strings, route combinations, monetary inputs, percentages, terms, empty comparable arrays, and unknown fields. The global 10 MB Server Action limit remains for existing image uploads; the workspace schema cannot carry files or unbounded collections. |
| Configuration | Ready | One typed boundary validates enablement, credential, URL, timeout, retry, cache TTL, and per-minute limits. |
| Timeouts/retries | Ready | Provider requests use AbortController timeouts. Only timeout, network, and availability failures retry, at most twice by configuration. |
| Rate limiting | Ready with limitation | Per-actor process-local rolling window protects accidental and basic repeated use. It is not distributed across Vercel instances. |
| Duplicate submissions | Ready with limitation | Exact in-flight requests coalesce within a server process; provider requests cache independently from Investment financing/ADR inputs. |
| Caching | Ready with limitation | Successful resolution/comparable provider results use immutable process-local TTL entries keyed by provider-neutral Market requests. Failures are not cached. |
| Concurrency | Ready | Independent actors/properties run concurrently; identical operations coalesce. No global lock exists. |
| Error safety | Ready | Typed safe responses omit stacks, provider payloads, secrets, and quota details. Client inputs and prior results remain intact. |
| Observability | Ready | Redacted JSON server events record start/completion/failure, safe fingerprint, route, duration, status, confidence, and comparable counts. |
| Operational health | Ready | Admin-only `/api/admin/integrations/market/health` reports enabled/configured state and process-local success/failure/cache/rate metrics without a live provider call. |
| Product analytics | Intentionally deferred | No approved third-party product analytics write boundary exists. Operational logs remain separate and privacy-minimal. |
| Persistence/audit history | Intentionally deferred | Analyses are session-scoped and immutable in memory. Refresh loses unsaved work; durable records require a designed repository/migration. |
| Response size | Non-blocking | Canonical artifacts are returned to preserve current decision/evidence UI and lineage. Provider raw payloads are absent; a narrower view model is deferred if measured payloads become material. |
| Accessibility | Ready | Inputs have labels, loading uses live status text, failures use alerts, alternatives are textual cards, and sources are stated in words rather than color alone. |
| Live provider verification | Blocking for promotion, not code | Automated fixtures and provider adapters pass. A controlled preview verification was not run because an authorized quota/deployment window was not supplied in this session. |
| Deployment | Needs operator confirmation | Configure Vercel Preview/Production variables, Node runtime, duration budget, monitoring, and credential access before promotion. |

No production synthetic Market fallback remains. Empty STR evidence stays explicitly unsupported with very-low confidence. Market failures do not create valid-looking reports.

## Release-candidate gate

- clean install: `npm ci` completed;
- lint and typecheck: passed;
- full Vitest: 247 files, 1,313 tests passed (final focused cache-key test included);
- production Next.js build: passed after network access was allowed for configured Google Fonts;
- architecture direction, tracked-secret, debug-statement, diff, and status checks: passed;
- live provider smoke verification: pending the authorized preview/quota window described above.
