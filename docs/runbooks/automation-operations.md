# Automation operations runbooks

Version: AU-001E v1

Default owner: Platform Operations

Incident decision owner: Head of Engineering

Security escalation owner: Security lead

Business-approval owner: Authorized workspace owner

Data/reconciliation owner: Automation operations lead

These runbooks permit only authenticated application commands. Direct table edits, blind business-command replay, manufactured approvals, cross-tenant inspection, and provider mutations are forbidden. Retain correlation IDs, command classifications, source versions, audit-event references, and recovery verification; never retain secrets or raw command payloads.

## 1. Queue backlog or stuck scheduler

- Detection: queue warning/critical threshold or scheduler health degradation.
- Impact: due work remains preserved but may be delayed.
- Prerequisites: confirm lease-acquisition flag and worker telemetry; select a tenant and time bound.
- Safe commands: refresh projection; dry-run bounded rebuild when projection state alone is stale.
- Forbidden: bulk retry or synthetic occurrences.
- Escalation: Platform Operations at warning; incident owner at critical.
- Recovery verification: queue age falls, processing rate resumes, no duplicate occurrence keys appear.

## 2. Expired lease recovery

- Detection: `expired-lease` reconciliation candidate.
- Prerequisites: confirm the lease heartbeat is expired and query the owning adapter for command status.
- Safe command: release the lease only when the owning result proves the command was not accepted.
- Forbidden: reclaim while a valid heartbeat exists or when the outcome is uncertain.
- Recovery verification: one versioned lease transition and one audit event; command identity remains unchanged.

## 3. Approval backlog

- Detection: approval service target warning or breach.
- Impact: governed work remains awaiting human authority.
- Safe action: notify an already-authorized approver through the outbox; investigate invalid or expired requests.
- Forbidden: auto-approval, authority substitution, or expiry extension without a canonical command.
- Recovery verification: dispositions retain actor, reason, version, and correlation lineage.

## 4. Command-adapter outage

- Detection: incompatibility, timeout rate, or open circuit.
- Safe action: quarantine only the affected adapter and preserve queued work.
- Forbidden: direct writes into the owning capability or payload coercion.
- Recovery verification: compatibility check passes, service actor remains authorized, idempotency and expected-version propagation are demonstrated before resume.

## 5. Unknown command outcome

- Detection: step status `reconciliation_required`.
- Safe command: reconcile by stable command and idempotency identity through the owning adapter.
- Forbidden: blind retry, cancellation assumed from a lost response, or manual success fabrication.
- Recovery verification: owning result reference and terminal/retry-safe classification are durably recorded.

## 6. Reconciliation conflict

- Detection: AU state conflicts with a confirmed owning result.
- Safe action: quarantine; compare immutable attempts and owning result; invoke the canonical reconciliation command with expected versions.
- Escalation: data/reconciliation owner, then incident owner for cross-scope impact.
- Recovery verification: compensating or reconciled event preserves both prior facts.

## 7. Notification outage or alert storm

- Detection: outbox failure rate or grouped escalation threshold.
- Safe action: stop delivery processing while preserving deduplicated intents; resume bounded delivery after recovery.
- Forbidden: bypassing preferences/authorization or regenerating intents without their stable key.
- Recovery verification: attempt counts advance once per claim and recipients remain authorized.

## 8. HPM or projection staleness

- Detection: HPM publication missing, projection/report freshness stale, or contract mismatch.
- Safe action: keep core AU execution isolated; refresh or bounded-rebuild projections after compatibility validation.
- Forbidden: recreating AU facts in HPM or assigning HPM attention/routing policy from AU.
- Recovery verification: source contract is compatible, published version is current, and prior history remains intact.

## 9. Kill-switch activation and recovery

- Detection: security risk, autonomous-authority defect, unsafe adapter, or uncontrolled fan-out.
- Authority: incident decision owner; security lead for security events.
- Safe action: stop new trigger intake, leases, or adapter dispatch at the smallest safe scope; preserve inspection and evidence.
- Forbidden: deleting queued or in-flight work.
- Recovery verification: authenticated smoke tests prove fail-closed behavior; explicit approval is recorded before flag recovery.

## 10. Tenant isolation or authorization concern

- Detection: unexpected count, export, cache, or command visibility.
- Safe action: activate the global kill switch for affected mutations, preserve evidence, and engage Security.
- Forbidden: further querying with broad/service credentials except the approved investigation procedure.
- Recovery verification: direct PostgreSQL RLS denial matrix, cache partition test, and affected export review pass.

## 11. Trigger storm or excessive fan-out

- Detection: intake-rate/fan-out threshold breach.
- Safe action: disable the affected trigger type or definition; retain deduplication facts and due-work evidence.
- Forbidden: deleting occurrence history or expanding worker capacity without confirming downstream safety.
- Recovery verification: occurrence identity remains unique and bounded backfill dry-run is reviewed.

## 12. Bounded rebuild and cancellation

- Prerequisites: tenant and UTC time range; optional property/definition/run bounds; dry-run count under policy limit.
- Safe command: create a leased, checkpointed, resumable rebuild through the application boundary.
- Cancellation: stop after the last durable checkpoint; never alter source facts.
- Forbidden: unbounded portfolio rebuild or overlapping active rebuilds.
- Recovery verification: source checksums remain stable, projection checksum reconciles, progress/audit evidence is retained.
