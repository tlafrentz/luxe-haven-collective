# IA-002A.2 implementation note

## Primitives created

The new persistence-independent boundary is `src/features/investment-opportunity/acquisition-pipeline/` and exports:

* Platform-kernel-backed `AcquisitionPipelineId`, `AcquisitionStageTransitionId`, and `AcquisitionCommandId` factories.
* Exhaustive stage values, definitions, categories, sequence metadata, initial/terminal predicates, and active-stage assertion.
* Frozen transition graph, transition classification, future-fact requirements, and transition assessment.
* Structured backward-transition reasons with normalized explanations.
* Canonical route support/mismatch policy using `InvestmentOpportunityRoute`.
* Validated actor references, pipeline versions, command contexts, activation lineage, exit reasons/outcomes, and reconsideration metadata.
* Frozen stage-to-`OpportunityStatus` synchronization mapping.
* Stable `AcquisitionDomainError` codes for primitive-boundary failures.

## Reused contracts

The implementation reuses `platform/kernel` `Identifier` semantics and imports `InvestmentOpportunityRoute`, `OpportunityAnalysisId`, and `OpportunityStatus` from the existing Opportunity domain. It does not introduce a local identifier framework, duplicate route union, persistence row, Supabase enum, or infrastructure dependency.

## Deliberate implementation choices

* IDs are prefixed and reconstructed only through explicit factories, keeping pipeline, transition, and command identities distinct.
* `appraisal-failed`, `financing-failed`, and `title-or-legal` are purchase-only exit reasons; `landlord-declined` is rental-arbitrage-only; inspection failure remains valid for either route.
* Exit values exclude terminal stages at the type boundary and also reject terminal stages at runtime for persisted/untyped input.
* Transition requirements describe future agreement/readiness facts without pretending those entities are executable in this milestone.
* The status mapping is exhaustive at compile time and frozen at runtime.

## Deferred concepts

The aggregate, stage-history entity, offers, contracts, contingencies, diligence, Action/Evidence references, repository, transaction boundary, authorization commands, migrations, and UI remain deferred to IA-002A.3 and later batches.

## Test inventory

`src/features/investment-opportunity/tests/acquisition-pipeline-domain.test.ts` covers identifier reconstruction, stage parsing/metadata, terminal predicates, transition edges and classifications, immutable policies, route compatibility, activation lineage, actor/version/context validation, exit semantics, and exhaustive status synchronization.

## Next step

IA-002A.3 should introduce the `AcquisitionPipeline` aggregate and apply these policies to activation, stage mutation, terminal outcomes, and cross-aggregate status synchronization without redefining any primitive.
