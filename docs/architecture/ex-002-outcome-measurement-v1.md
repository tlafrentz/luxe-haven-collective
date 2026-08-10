# EX-002 Outcome Measurement v1

EX-002 extends the existing canonical Learning outcome-measurement capability. It does not introduce a second outcome, evidence, or notification model.

## Ownership

- Execute owns the Action lifecycle and execution evidence.
- Learning owns measurement plans, immutable baseline/result snapshots, deterministic evaluation, reviews, and finalized outcomes.
- EX-002 links a Learning measurement-plan series to the exact Execute Action, Action Plan, Decision, and property context.
- `execute_notification_outbox` remains the notification boundary. `platform_action_activity` accepts measurement references so the Execute timeline can project the handoff without owning measurement history.

## Persistence strategy

The pre-existing `learning_measurement_*` and `learning_outcome_*` tables remain canonical. The EX-002 migration adds action lineage, product-facing lifecycle/classification fields, versioned target and baseline amendments, guardrails, exceptions, and property-aware authorization. Historical measurement rows remain valid.

The migration is forward-only and must not be applied to production until application commands and projections pass against a migrated non-production database, including property-scoped RLS tests.

## Policy boundary

Authoritative lifecycle, unit compatibility, window validation, guardrail enforcement, and outcome classification live in `src/platform/learning/domain`. React may display results but must not calculate them. Provider adapters return immutable observations through the existing measurement-source port.
