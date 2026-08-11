# AU-001 production readiness

Status: AU-001F.1 preparation and AU-001F.2 hosted database rehearsal completed; dormant application artifact deployed; rollout blocked. This document is not a production approval.

## Inert production baseline

AU code-only deployment completed successfully at commit `c35919f5` through Vercel deployment `dpl_7B9vvS6Jc5uQEvji7Q3tcaZim8uP`. The artifact is production-present but inert. `AUTOMATION_GLOBAL_KILL_SWITCH` and `AUTOMATION_WORKSPACE_KILL_SWITCH` are enabled, all AU enablement flags are absent or false, and no AU schema, scheduling, processing, cohorts, templates, or command authority were activated.

Production smoke evidence recorded at deployment:

- public homepage, login, and health endpoint returned HTTP 200;
- the authenticated Automation workspace remained behind the existing authentication boundary;
- the Automation report export returned `AUTOMATION_EXPORT_FAILED` with “Automation exports are disabled”;
- no AU migration command was executed.

Preserve this deployment as the inert production baseline. The next production change must wait for acceptable hosted Supabase migration, RLS, compatibility, and recovery rehearsal evidence.

## Release candidate inventory

| Slice                           | Commit                             | Local evidence                                                                      | Promotion state                                |
| ------------------------------- | ---------------------------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------- |
| AU-001A Foundation              | `2c4e0b93`                         | domain, lifecycle, authorization, repository, migration/RLS tests                   | blocked pending migrated-environment rehearsal |
| AU-001B Triggers and Scheduling | `bd2e1c99`                         | occurrence, replay, DST, lease, scheduler tests                                     | blocked pending full-chain database rehearsal  |
| AU-001C Governed Execution      | `f6d90fa9`, hardened by `0ee433f5` | approval, pre-dispatch authority, idempotency, uncertain outcome, recovery tests    | owning adapters not production-configured      |
| AU-001D Experience              | `6e8fbf92`                         | projections, flags, routes, responsive/accessibility component tests                | disabled by default                            |
| AU-001E Operations              | `8ecd6d42`                         | health, compatibility, reconciliation, reports, exports, HPM contribution, runbooks | disabled by default                            |
| AU-001F Rollout                 | `3320632a`, prerequisite verification `c35919f5` | release policy, manifest, cohort, risk, autonomy, halt tests; inert production artifact | migration and enablement blocked                |

## Readiness matrix

| Gate                       | Requirement                                                                | Status                                            | Evidence                                                                                  | Owner / next action                                                                        |
| -------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| HPM approval               | HPM-001F stabilization and final approval                                  | **Blocked**                                       | `docs/releases/hpm-platform-v1-readiness.md` explicitly records external evidence pending | HPM release owner completes production-equivalent rehearsal, stabilization, and signatures |
| AU traceability            | AU-001A–E committed and mapped                                             | Passed locally                                    | commit inventory above; architecture records under `docs/Architecture`                    | Automation release owner verifies immutable RC after F commit                              |
| Full regression            | Tests, lint, typecheck, build, migration lint                              | Passed locally after hosted rehearsal              | 3,605 Vitest tests; lint, typecheck, production build, and migration lint passed            | Engineering reruns against the immutable release candidate                                  |
| Migration rehearsal        | Four AU migrations in production-equivalent database                       | Passed in isolated hosted Supabase                 | `docs/releases/au-001f2-hosted-rehearsal.md`; full chain 26.43s, no-op replay 2.59s         | Database owner retains legacy-baseline caveat in production plan                            |
| PostgreSQL RLS             | Direct role/property/tenant/RPC/export matrix                              | Passed for AU foundation and trigger read boundary | hosted direct-role and authenticated GoTrue/PostgREST evidence in AU-001F.2 record          | Security completes command/approval/export matrix when adapters are available               |
| Application authorization  | Definition, trigger, approval, dispatch, reconcile, exports                | Passed for authenticated foundation repository     | production repository queried using hosted authenticated owner/admin/restricted actors      | Security verifies governed dispatch and reconcile after adapters exist                      |
| Service actors             | Least-privilege adapter grants and revocation                              | **Blocked**                                       | Execute draft-only adapter exists; production identity/configuration remains absent        | Integration owner configures Execute actor and executes grant/revocation denial tests       |
| Owning adapters            | HPM, Execute, notifications, and every enabled command compatible          | Partial                                           | Execute draft-plan v1 supported locally; five mutation capabilities explicitly reject      | Verify Execute hosted boundary; unsupported adapters remain disabled                        |
| Autonomous-authority guard | Tier 2/3 disabled; approval cannot be inferred                             | Passed locally                                    | AU-001C and AU-001F release-policy tests                                                  | Security repeats end-to-end in staging                                                     |
| Flags and kill switches    | Independent, default off, server evaluated                                 | Passed locally and dormant hosted schema verified | release policy tests; hosted inactivity SQL; all production defaults false                 | Release owner configures values only after gates                                           |
| Accessibility              | WCAG automated and manual production surfaces                              | Partial                                           | semantic/component regressions exist                                                      | Accessibility owner completes keyboard, screen-reader, zoom/reflow testing                 |
| Observability              | Dashboards, alerts, delivery tests, on-call ownership                      | **Blocked**                                       | fail-closed readiness evaluator added; provider evidence still absent                      | Operations supplies dashboards, named owners, and verified alert receipt                    |
| Rollback                   | Flags, drain/quarantine, artifact rollback, prior-app/schema compatibility | Partial                                           | transactional failures and forward recovery passed; application rollback not yet rehearsed | Release + database owners perform timed artifact rollback and broader compatibility suite   |
| Smoke tests                | Safe internal fixtures across enabled classes                              | **Blocked**                                       | scenarios defined below; no approved environment run                                      | Release operator executes after disabled deployment approval                               |
| Stabilization              | Minimum seven consecutive days                                             | **Blocked**                                       | policy defined below; no cohort enabled                                                   | All release authorities approve entry and exit                                             |

Blocked items are prerequisites, not approved deferrals. They cannot be converted to passed from local tests alone.

## Immutable manifest inputs

- Release ID: `au001-v1`; manifest schema `au-release-manifest-v1`; policy `au001f-release-v1`.
- Release commit: the isolated AU-001F preparation commit once created; deployment/build IDs remain intentionally unset.
- Rollback code target: `8ecd6d428393dfb5c453e112545584d1498729da` until an immutable deployed-disabled artifact is approved.
- Migration checksums are recorded in `docs/releases/au-001-migration-inventory.md`.
- Required configuration names are recorded below; no values belong in the manifest.
- Evidence index: this file, `docs/releases/au-001f2-hosted-rehearsal.md`, the migration inventory, AU architecture records, `docs/runbooks/automation-operations.md`, and HPM readiness.
- No approver signature or production deployment identifier has been recorded.

## Configuration inventory

Feature flags and stops: `AUTOMATION_WORKSPACE_ENABLED`, `AUTOMATION_AUTHORING_ENABLED`, `AUTOMATION_TRIGGER_INTAKE_ENABLED`, `AUTOMATION_SCHEDULER_EVALUATION_ENABLED`, `AUTOMATION_MANUAL_TRIGGER_ENABLED`, `AUTOMATION_APPROVAL_INTERACTION_ENABLED`, `AUTOMATION_GOVERNED_DISPATCH_ENABLED`, `AUTOMATION_RETRY_PROCESSING_ENABLED`, `AUTOMATION_RECONCILIATION_WORKER_ENABLED`, `AUTOMATION_NOTIFICATION_PROCESSING_ENABLED`, `AUTOMATION_REPORTING_ENABLED`, `AUTOMATION_EXPORTS_ENABLED`, `AUTOMATION_TEMPLATE_CATALOG_ENABLED`, their scoped kill switches, and `AUTOMATION_GLOBAL_KILL_SWITCH`.

Cohort names: `AUTOMATION_COHORT_ENABLED`, `AUTOMATION_COHORT_TENANT_IDS`, `AUTOMATION_INTERNAL_COHORT_ENABLED`; production configuration must additionally bind explicit property, actor, definition, trigger-class, command, and expiry scope before mutation-capable enablement.

Contract names: `AUTOMATION_HPM_CONTRACT_VERSION`, `AUTOMATION_EXECUTE_CONTRACT_VERSION`, `AUTOMATION_DECIDE_CONTRACT_VERSION`, `AUTOMATION_OUTCOME_CONTRACT_VERSION`, `AUTOMATION_LEARNING_CONTRACT_VERSION`, `AUTOMATION_RECOMMENDATION_CONTRACT_VERSION`, `AUTOMATION_FURNISHING_CONTRACT_VERSION`. Missing or unsupported values keep the adapter disabled.

Capacity/threshold names must be environment configuration, including intake rate, maximum fan-out, schedule horizon, lease duration, concurrency, retry budget, command timeout, reconciliation age, report/export rate, queue warning/critical age, and alert evaluation windows.

## Initial risk inventory

- Tier 0: workspace projections, health, reports, deterministic exports, notification-intent preparation. Eligible only after read-only gate.
- Tier 1: no command is enabled until its owning adapter, reversibility, idempotency, authorization, and staging evidence are recorded in the immutable manifest.
- Tier 2: protected business commands remain disabled for AU-001 initial release.
- Tier 3: provider mutation and external communication remain disabled.

## Deployment and rollback plan

Deployment phases are separately approved events: freeze RC; backup/recovery point; migrations; schema/RLS/integrity verification; disabled code deployment; non-AU regression; internal read-only; shadow; bounded internal run creation; approved Tier 1; named pilot; stabilization; final release.

Rollback order is scope-first: disable cohort, stop trigger intake, stop new leases and dispatch, drain or quarantine queued/in-flight work, isolate adapters, then roll back the application artifact if required. Never delete AU history or assume an already-dispatched effect was undone. Unknown outcomes remain quarantined and use owning-capability reconciliation. Schema changes use reviewed forward recovery unless the rehearsal proves a rollback safe.

## Safe smoke scenarios

Use internal or synthetic properties only. Verify normal/DST schedule occurrences; duplicate/late/replayed events; threshold cooldown/re-arm; manual authorization; version changes; every approval disposition; safe owning command; concurrency conflict; retryable/terminal timeout; uncertainty quarantine; cancellation; partial result boundary; reconciliation; kill switch queued/in-flight behavior; HPM lineage; all eight reports/CSV; unauthorized tenant/property absence. Abort on any categorical halt signal.

## Stabilization policy

Recommended minimum: seven consecutive days for internal/named pilot scope exercising every enabled Tier 0/1 trigger and command class. Review dashboards at least twice daily. Immediate halt thresholds are any tenant/property leak, unauthorized or autonomous effect, duplicate business effect, broken lineage, inability to stop dispatch, unsafe unknown outcome, critical incompatibility, or monitoring blindness. Numeric thresholds must be approved before entry and cannot be relaxed during the window. Product, engineering, security, operations, and release owners must approve exit.

## Current conclusion

AU-001F.1 release preparation, the dormant code-only deployment, and the hosted migration/RLS portions of AU-001F.2 are complete. AU-001F.3–F.6 remain blocked, and AU-001F.2 still requires the timed application rollback and broader compatibility evidence identified above. Do not apply AU migrations to production, enable flags/cohorts, create a production release tag, or claim AU-001 complete until every blocked gate has direct environment evidence and HPM-001F final approval.
