# AU-001F readiness inputs from AU-001E

Status: preparation only; production rollout prohibited until AU-001F approval.

- Release candidate: obtain from the isolated AU-001E commit after validation.
- Migration: none introduced by AU-001E.
- Required flags: workspace, operations, health, reporting, exports, internal cohort, global kill switch, trigger-type intake, scheduler leases, governed dispatch by adapter, notification processing, reconciliation worker.
- Required contract inventory: HPM `hpm-source-v1`; identity `workspace-access-v1`; notification `outbox-v1`; owning adapters declare explicit v1 compatibility.
- Halt conditions: tenant leakage, unauthorized mutation, autonomous authority, blind replay, broken lineage, required adapter incompatibility, kill-switch failure, unreconciled export, or missing operational owner.
- Smoke tests: healthy projection; isolated adapter degradation; approval breach; unknown outcome reconciliation; unsafe retry denial; expired lease recovery; trigger-to-owning-result lineage; HPM contribution; eight reports/CSV; scope exclusion; kill switch.
- Runbooks: `docs/runbooks/automation-operations.md`.
- Suggested stabilization inputs: queue depth/age, lease expiry, approval age, run/step outcomes, retries/timeouts, unknown outcomes, adapter circuits, notification failure rate, report freshness/latency.
