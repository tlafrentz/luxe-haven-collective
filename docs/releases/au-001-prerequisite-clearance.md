# AU-001 prerequisite clearance

Status: local prerequisite work in progress; production rollout remains blocked.

This record distinguishes implementation from environment configuration and verification. It does not approve a migration, deployment, cohort, or production feature flag.

## Verified locally

- AU-001A through AU-001E are present at the commits recorded in `au-001-production-readiness.md`.
- The composed AU-001A/B/C PostgreSQL suite passes in a disposable PostgreSQL 17 instance via `npm run test:automation:postgres`.
- The suite directly exercises tenant, property, role, and anonymous RLS denial; trigger replay idempotency; scheduler lease fencing; governed-run materialization; step claiming and heartbeat; expired-lease reclamation; and uncertain-outcome reconciliation.
- The release transition policy requires both HPM-001F final approval and the independent AU readiness-gate result. HPM approval alone cannot unlock production promotion.
- The rehearsal is local and isolated. It does not use the repository's currently linked Supabase project and does not constitute production-equivalent hosted Supabase evidence.

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
| Production-equivalent Supabase environment | Blocked | Explicitly identified non-production project, approved credentials/configuration, full migration rehearsal, durations/locks/query evidence, rerun and recovery behavior. |
| Hosted PostgreSQL RLS | Blocked | Direct owner, cross-tenant, cross-property, admin-boundary, inactive-user, and anonymous tests in the production-equivalent database. |
| Owning adapters | Blocked | Implemented adapters, explicit supported versions, least-privilege identities, denial tests, compatibility evidence, and reconciliation behavior. |
| Observability | Blocked | Provider dashboards, approved numeric thresholds, alert routes, delivery tests, named primary/backup owners, and monitoring-blindness halt verification. |
| Rollback / forward recovery | Blocked | Timed disabled-deployment rehearsal covering intake stop, lease/dispatch stop, drain/quarantine, adapter isolation, artifact rollback, and schema forward recovery. |
| Accessibility | Partial | Manual keyboard, screen-reader, zoom, reflow, focus, and mobile verification on production surfaces. |

## Safety boundary

Do not apply AU migrations to production, deploy AU as a production release, enable an AU cohort, enable command dispatch, or mark AU-001 complete until every independent readiness gate passes. A linked project reference, locally passing SQL, or HPM approval by itself is insufficient authorization.
