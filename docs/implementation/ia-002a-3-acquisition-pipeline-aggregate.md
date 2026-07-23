# IA-002A.3 implementation note

## Delivered

`AcquisitionPipeline` is now an independent mutable aggregate root under `src/features/investment-opportunity/acquisition-pipeline/domain/acquisition-pipeline.ts`. It owns an immutable opportunity/route reference, one activation lineage record, current stage, append-only stage history, append-only activity, and an independent `AcquisitionPipelineVersion`.

Activation starts exactly one pipeline at `pursuit`, creates version 1, records activation history/activity, and exposes the deterministic `shortlisted` Opportunity synchronization projection. Stage transitions validate IA-002A.2 policy, require structured reasons for backward movement, and increment version. Exit requires an `AcquisitionExit`; `closed-acquired` is reachable only through `closeAcquisition` from `closing-preparation`. Both terminal states reject further mutation.

The aggregate returns synchronization intent and never mutates `InvestmentOpportunity` directly. `AcquisitionPipelineRepository` is a persistence-agnostic port; `InMemoryAcquisitionPipelineRepository` supports future application-service tests with owner/opportunity cardinality and expected-version checks.

## Boundary confirmation

No offers, contracts, requirements, Action Center references, Evidence references, Supabase code, migrations, server actions, routes, or UI were introduced. The aggregate imports only Platform/Opportunity contracts and IA-002A.2 domain primitives. No event framework was introduced because the current Platform conventions do not expose a feature-neutral event bus; immutable activity/history are returned from the aggregate for the later integration boundary.

## Tests and next step

`acquisition-pipeline-aggregate.test.ts` covers activation, every approved progression path, invalid transitions, stale versions, backward reasons, exit from each active stage, terminal close/exit behavior, synchronization, immutability boundaries, and repository round-trips. IA-002A.4 can now add application activation/transition commands and atomic Opportunity synchronization without redefining aggregate behavior.
