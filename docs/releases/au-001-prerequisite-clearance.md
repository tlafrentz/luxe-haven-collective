# AU-001 prerequisite clearance

Status: hosted migration/RLS rehearsal completed; production rollout remains blocked.

This record distinguishes implementation from environment configuration and verification. It does not approve a migration, deployment, cohort, or production feature flag.

Dormant deployment baseline: commit `c35919f5`, Vercel deployment `dpl_7B9vvS6Jc5uQEvji7Q3tcaZim8uP`. Application code is production-present with the global and workspace kill switches enabled. No AU database migration or capability enablement occurred.

## Verified locally

- AU-001A through AU-001E are present at the commits recorded in `au-001-production-readiness.md`.
- The composed AU-001A/B/C PostgreSQL suite passes in a disposable PostgreSQL 17 instance via `npm run test:automation:postgres`.
- The suite directly exercises tenant, property, role, and anonymous RLS denial; trigger replay idempotency; scheduler lease fencing; governed-run materialization; step claiming and heartbeat; expired-lease reclamation; and uncertain-outcome reconciliation.
- The release transition policy requires both HPM-001F final approval and the independent AU readiness-gate result. HPM approval alone cannot unlock production promotion.
- The hosted rehearsal uses the isolated Supabase project `rvpkwepkkjglsyhekbvd`; the repository's production-linked project was not changed. Evidence is recorded in `au-001f2-hosted-rehearsal.md`.

## Owning-capability adapter inventory

The governed-execution composition accepts provider-neutral `AutomationCommandPort` implementations, but no production command adapter implementation exists for the following six owning capabilities:

| Adapter | Classification | Evidence / required next action |
| --- | --- | --- |
| Execute | Not implemented | Implement a least-privilege production adapter for explicitly approved Execute command versions and verify authorization, idempotency, and reconciliation. |
| Decide | Not implemented | Implement only approved Decide command contracts; recommendation or automation state must never imply decision approval. |
| Outcome Measurement (EX-002) | Not implemented | Implement approved measurement command contracts without duplicating EX-002 policy. |
| Learning (LR-001) | Not implemented | Implement approved learning command contracts; draft or reevaluation-required learning must remain ineligible. |
| Recommendations (LR-002) | Not implemented | Implement approved recommendation command contracts without autonomous acceptance or downstream activation. |
| Furnishing | Not implemented | Implement approved furnishing command contracts while preserving FS ownership, financial authority, and immutable procurement history. |

The HPM lifecycle read contribution, notification-outbox boundary, and service-actor contracts exist, but they do not substitute for these command adapters. Therefore “unconfigured adapters” is not currently a configuration-only issue.

## Remaining prerequisites

| Prerequisite | Current state | Required evidence |
| --- | --- | --- |
| HPM-001F final approval | Blocked | Authenticated lifecycle/lineage, attention/routing, reporting/export, authorization, kill-switch, rollback/forward-recovery, telemetry, alerting, stabilization, and signed approval evidence. |
| Production-equivalent Supabase environment | Passed for migration/RLS rehearsal | Isolated project `rvpkwepkkjglsyhekbvd`; full migration chain 26.43s; no-op replay 2.59s; documented legacy-baseline prerequisites. |
| Hosted PostgreSQL RLS | Passed for foundation and trigger read boundary | Direct and authenticated owner/admin access, cross-tenant denial, cross-property denial, anonymous denial, and append-only service-role denial. Governed command matrices wait for adapters. |
| Owning adapters | Blocked | Implemented adapters, explicit supported versions, least-privilege identities, denial tests, compatibility evidence, and reconciliation behavior. |
| Observability | Blocked | Provider dashboards, approved numeric thresholds, alert routes, delivery tests, named primary/backup owners, and monitoring-blindness halt verification. |
| Rollback / forward recovery | Partial | Transactional migration failure and forward recovery passed; timed artifact rollback, drain/quarantine, and adapter isolation remain blocked. |
| Accessibility | Partial | Manual keyboard, screen-reader, zoom, reflow, focus, and mobile verification on production surfaces. |

## Safety boundary

Do not apply AU migrations to production, deploy AU as a production release, enable an AU cohort, enable command dispatch, or mark AU-001 complete until every independent readiness gate passes. A linked project reference, locally passing SQL, or HPM approval by itself is insufficient authorization.
