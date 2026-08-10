# Platform/HPM v1 rollout runbook

This runbook governs rollout after an immutable candidate and explicit production authority exist. Deployment and enablement are separate operations.

## Safe sequence

1. Freeze the candidate; record commit, build, migration checksums, source contracts, policies, runtime names, rollback target, owners, and approvals in the manifest.
2. Confirm backup/recovery readiness and capture baseline SLIs without customer content.
3. Rehearse the exact migration set against representative non-production data. Rerun after any migration change.
4. Run integrity and PostgreSQL RLS matrices. Stop on any unexplained difference or inference leak.
5. Deploy compatible code with every HPM release feature disabled.
6. Run flag-off production smoke tests and critical non-HPM regressions.
7. Enable only the internal cohort after approval. Observe the declared window and thresholds.
8. Advance named-test, limited, broad, and general-availability cohorts one at a time. No automation may advance a cohort.
9. Enter stabilization only with approved evidence; restart or extend after material fixes, threshold breaches, rollback, or cohort change as policy requires.
10. Create the release record and tag only after final approval.

## Immediate halt

Halt expansion for suspected tenant/property leakage, unauthorized or autonomous mutation, data loss, history corruption, incorrect lineage, missing RLS, incompatible required source, failed migration verification, SLI breach, report reconciliation failure, ineffective kill switch, or unavailable support ownership.

Preserve safe evidence and correlation IDs. The incident commander chooses feature disablement, traffic rollback, application rollback, job suspension, forward recovery, or—only with explicit incident authority—database restore.

## Disablement and rollback

- Activate the relevant server kill switch and verify dependent flags resolve off.
- Remove affected tenant cohort membership using expected-state and idempotency controls.
- Suspend release jobs without deleting accepted or completed history.
- Invalidate only affected tenant/release cache keys.
- Roll application code to the recorded compatible target; do not contract additive schema.
- Verify source-owned writes and immutable activity remain intact.
- Replay interrupted work idempotently and check for duplicate commands, exports, jobs, activity, or notifications.
- Restore dashboards and alerts before resumption.

Database restore is never the default application rollback. Reconcile post-backup source-owned writes if a restore receives explicit incident authorization.

## Smoke-test safety

Use dedicated internal tenants and authorized non-sensitive records. Prefer read-only command simulation. Never invent or change customer decisions, actions, lessons, recommendations, provider state, assignments, or external communications. Use stable idempotency and correlation keys and archive only explicitly disposable artifacts.

Required checks cover authentication, role/flag visibility, shared context, overview, lifecycle list/detail, lineage, attention, valid commands, capability-owned dispatch or simulation, conflict recovery, reports, CSV/print exports, degraded states, operational health, kill switches, and existing critical journeys.

## Release evidence record

For each phase record environment, release/build, migration state, flags/cohort, timestamps, approver, safe coverage aggregates, baseline comparison, classified failures, freshness/job health, security/integrity signals, smoke results, incidents, and decision (`Advance`, `Hold`, `Disable`, `Roll Back`, or `Complete`). Never store secrets, customer identifiers, addresses, free text, evidence, provider responses, or export content.
