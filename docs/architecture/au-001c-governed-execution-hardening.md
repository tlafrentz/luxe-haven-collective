# AU-001C governed execution hardening

AU-001C is a fail-closed application boundary for governed automation commands. It does not register a scheduler, worker, trigger subscriber, route, or production dispatch loop.

## Closed hardening controls

- Approval facts are durably bound to a run and fingerprint the immutable execution plan. Dispatch rejects missing, expired, revoked, context-changed, policy-changed, or plan-changed approvals.
- The current definition version, active state, kill switch, planned command, and exact canonical payload are revalidated immediately before dispatch.
- The service actor must be active and hold a least-privilege grant for the owning capability, command, tenant, and property scope. The owning capability performs a second authorization and validation check.
- A step becomes `dispatching` in PostgreSQL before external transport is invoked. Failure to commit that state prevents the external call.
- Deterministic command and idempotency identities are preserved across attempts and uncertain outcomes are quarantined for reconciliation.
- Transactional advisory locks serialize configured concurrency groups. Leases have bounded duration, generation fencing, heartbeat, and outcome-checked expiry recovery.
- Retry delays and budgets are deterministic and bounded. Retry scheduling persists atomically with the status transition.
- Cancellation is explicit, reasoned, and provider-neutral. Dispatched or uncertain work cannot be reported as cancelled without owning-capability confirmation.
- Activity and notification intents are transactionally persisted; external notification delivery is outside the mutation transaction.
- PostgreSQL RLS verifies owner visibility and denies restricted-property, cross-tenant, and anonymous access. Execution activity remains append-only.

## Failure behavior

Repository, policy, authorization, command-contract, and durable-dispatch failures return safe classifications and do not expose provider or database details. A transport outcome that cannot be proven is never retried as a new logical command; it enters reconciliation with its original command identity.

## Rollout boundary

The AU-001A through AU-001C migrations remain local and unapplied to production. AU-001 production composition and enablement remain blocked by the HPM-001F stabilization approval and the later AU-001D through AU-001F rollout gates.
