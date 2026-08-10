# AU-001B — Triggers and Scheduling

Status: locally implemented; production activation prohibited pending HPM-001F approval and migrated-environment rehearsal.

## Boundary

AU-001B consumes immutable AU-001A definition versions and converts supported trigger inputs into either one durable, version-bound run request or one explainable non-run disposition. It does not construct, approve, enqueue, or dispatch an owning-capability command. AU-001C is the first slice permitted to claim a run request for governed execution.

Production composition is deliberately inert: no route, cron registration, event subscriber, browser timer, or worker invokes it. Explicit foundation and trigger flags plus a scheduler kill switch must all permit processing.

## Trigger and time policy

The versioned `au001-trigger.v1` vocabulary supports calendar, interval, domain-event, state-change, threshold, and manual triggers. Calendar schedules use IANA zones and retain the UTC instant, evaluated local slot, offset, adjustment, and `au001-time.v1` policy. A nonexistent spring-forward time advances to the first valid minute. An overlapping fall-back time uses the earlier offset by default and the later offset only when explicitly configured. One local slot key remains stable across worker restarts and time-zone database updates. A time-zone change requires a new immutable automation definition version.

Interval schedules are derived from a persisted UTC anchor and integer interval. Process-local start time never determines a slot.

## Identity, ordering, and replay

Occurrence identity is a deterministic encoding of tenant, automation, immutable definition version, trigger, trigger kind, source identity or schedule slot, target, and eligibility-policy version. Worker identity, detection time, and random IDs are excluded. The database uniquely constrains `(workspace_id, occurrence_key)` and `(workspace_id, occurrence_id)` for run requests. The atomic acceptance RPC inserts the occurrence, optional run request, and activity together. Replay returns the original occurrence/run request without appending activity.

Canonical events retain their source event identity, schema, tenant, source capability, aggregate/version reference, occurred/recorded times, correlation/causation lineage, and a bounded safe payload. Arrival order does not become source order. Late events receive an explicit classification; replays reuse the original occurrence identity.

## State, threshold, cooldown, and re-arm

State changes preserve previous/current source versions and reject non-monotonic versions. Initial state is not treated as a transition unless configured. Thresholds use typed units and explicit operators. Edge, level-with-cooldown, and one-shot behavior is deterministic. Durable evaluation-state persistence stores source version, armed state, last acceptance, and cooldown rather than relying on worker memory.

## Leases, checkpoints, and recovery

Scheduler ownership is a bounded database lease with an owner and generation. A non-expired lease cannot be replaced. Progress-aware heartbeats require the current generation, and an expired lease can be reclaimed with a higher generation. Checkpoint advancement requires the active lease generation and optimistic checkpoint version; a former owner cannot commit after lease loss. Recovery re-evaluates uncertain windows through stable occurrence identities before advancing.

## Misfires and backfill

Definitions bind `SKIP`, `FIRE_ONCE_NOW`, or `BACKFILL_BOUNDED`. Backfill requires an authorized actor, reason, bounded range/count, idempotency key, immutable definition version, and dry-run preview. Jobs are replayable and cancellable. Historical slot identity is preserved. No unbounded catch-up is permitted.

## Safety and degraded mode

Tenant/hour, automation fan-out, causation depth, cycle, payload, lateness, lease, and backfill bounds are explicit composition policy. When the kill switch or required source state prevents correctness, AU-001B withholds new requests and retains committed history. Health distinguishes paused, stale, delayed, degraded, failed, and unavailable states. Telemetry carries opaque identifiers, classifications, counts, and timing only—never source payloads, credentials, guest information, or operational secrets.

## Authorization and RLS

User operations use authenticated clients and server-side authorization. Scheduler operations require a least-privilege service actor and service-only lease/checkpoint RPCs. Every new public table enables RLS in its creating migration. Read policies extend AU-001A workspace/property authorization; restricted source details are not copied into projections. Occurrences, run requests, and activity are append-only. Normal user commands cannot write these tables directly.

## Persistence and forward recovery

Migration `20260810020000_au001b_triggers_scheduling.sql` is forward-only. A failed command is retried through its stable occurrence or job identity. Historical rows are never deleted to roll back the feature; operators disable trigger processing with flags or the scheduler kill switch, then apply a corrective migration.

The repository's complete clean migration chain still has a pre-existing blocker: `202607070002_database_security_hardening.sql` references `public.owners`, but no checked-in migration creates that table. AU-001B PostgreSQL/RLS verification therefore uses the checked-in canonical prerequisite harness. This does not authorize production migration until the full-chain defect and HPM-001F rollout gate are resolved.
