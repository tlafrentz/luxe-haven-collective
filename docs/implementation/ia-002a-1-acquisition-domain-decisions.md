# IA-002A.1 implementation characterization

## Files inspected

* `src/features/investment-opportunity/domain/model.ts`
* `src/features/investment-opportunity/domain/investment-opportunity.ts`
* `src/features/investment-opportunity/domain/policies.ts`
* `src/features/investment-opportunity/application/save-workflow.ts`
* `src/features/investment-opportunity/application/services.ts`
* `src/features/investment-opportunity/application/ports/repository.ts`
* `src/features/investment-opportunity/infrastructure/persistence/`
* `src/features/investment-intelligence/application/run-investment-workspace-analysis.ts`
* `src/platform/actions/domain/action.ts`
* `src/platform/actions/domain/action-source.ts`
* `src/platform/actions/application/action-commands.ts`
* `src/platform/evidence/` and `src/platform/observations/`
* `src/lib/properties.ts`
* `src/app/actions/properties.ts`
* `src/platform/kernel/`

## Findings and discrepancies

1. Opportunity already has the canonical route union (`purchase` and `rental-arbitrage`), immutable analysis snapshots and lineage, activity, notes, archive/restore, and expected-version persistence. Its seven statuses are intentionally coarse; they do not cover negotiation, diligence, or closing preparation.
2. Opportunity status transitions are centrally assessed, but existing commands can currently change coarse status without knowing a pipeline. IA-002 must make pipeline authority explicit and reject contradictory direct status mutations after activation.
3. Action Center is a Platform aggregate (`PlatformAction`) with source references, assignment, schedule, status transitions, history, outcomes, and its own version. There is no acquisition-specific integration yet; the pipeline must reference Actions through public application/integration contracts.
4. Platform has both immutable `Evidence`/`EvidenceId` and `Observation`/provenance primitives. The pipeline should reference these rather than inventing feature evidence or copying provider payloads.
5. The current Property implementation is a Supabase CMS read helper plus admin-only create/update/archive actions. No customer-safe acquisition-close onboarding command was found. Closing therefore emits an onboarding intent rather than creating a Property.
6. No pipeline persistence, migration, route, or UI is introduced in IA-002A.1. The next milestone must reuse Platform identifiers, actor/date/version, activity, and idempotency patterns rather than create parallel infrastructure.

## Exact next work: IA-002A.2

Define the pipeline identifiers, aggregate props, stage and transition policy, activation eligibility result, discriminated route-specific offer terms, requirement status, exit reasons, and public application ports. Add domain tests for cardinality, terminal states, version checks, and the canonical stage-to-status mapping without introducing persistence yet.
