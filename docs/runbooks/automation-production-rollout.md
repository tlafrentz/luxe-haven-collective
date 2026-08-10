# Automation production rollout runbook

This runbook is executable only after HPM-001F final approval and the AU-001F readiness gates. Every phase needs a named release owner and recorded approval. Provider-specific commands belong in the environment evidence package, not this repository, and must never include secret values.

1. Freeze the release commit and manifest; reject a dirty worktree or mutable artifact.
2. Capture database recovery point, current migration list, flag/cohort state, integration health, queues, and non-AU health.
3. Rehearse and then apply only the four inventoried migrations after database approval.
4. Verify schema, constraints, indexes, grants, RLS, integrity, and application compatibility.
5. Deploy the immutable application artifact with every AU flag false and the global kill switch available.
6. Run non-AU regression and flag-off production smoke tests.
7. Enable internal read-only workspace and Tier 0 reporting; exercise scoped kill switches.
8. Enable shadow intake only if it cannot create approvals, dispatchable requests, or business effects.
9. Enable bounded internal run creation with dispatch disabled.
10. Enable only manifest-approved Tier 1 adapters for internal fixtures after approval.
11. Halt on any categorical signal. Disable affected intake/dispatch, quarantine uncertain work, preserve evidence, and reconcile through the owner.
12. Admit named pilots only after internal exit evidence and support confirmation.
13. Run the approved stabilization window; record workload, thresholds, incidents, evidence, and twice-daily reviews.
14. Obtain product, engineering, security, operations, and release signatures before release/tag creation.

Rollback separates cohort disablement, intake stop, dispatch stop/drain, adapter isolation, artifact rollback, configuration rollback, and schema forward recovery. It never deletes valid AU facts or claims external effects were reversed. Resume requires compatibility, integrity, authorization, telemetry, and kill-switch verification plus explicit approval.
