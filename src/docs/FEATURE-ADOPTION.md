# PF-002.4 Feature Adoption

Goal: adopt the Platform Decisions model incrementally.

## Phase 1 (Investment Intelligence)

Keep the existing acquisition recommendation enum.

Wrap it in:

Decision<AcquisitionRecommendation>

Adopt:
- DecisionContext
- DecisionRationale
- DecisionBuilder

Do not change serialized APIs.

## Phase 2 (Revenue Intelligence)

Introduce DecisionBuilder around pricing decisions.

## Phase 3 (Executive Intelligence)

Return platform Decision objects from executive analyses.

## Adapter Pattern

Legacy DTO -> Platform Decision

Maintain compatibility until all consumers migrate.

## Completion

- One production feature uses Platform Decisions.
- Legacy adapters covered by tests.
- No behavioral regressions.
