# HPM-001 lifecycle integration

## Boundary

HPM is an application/read-model integration layer. It reads authorization-filtered projections through explicit source ports and routes available commands to the application service that owns the canonical record. It does not own or directly mutate observations, intelligence, decisions, plans, actions, measurements, lessons, or recommendations.

## HPM-001A source inventory

| HPM source port | Canonical responsibility | HPM stage |
| --- | --- | --- |
| observations | Operational and financial observations, snapshots, metrics, signals, and data quality | See |
| intelligence | Findings, risks, opportunities, and explanations | Understand |
| decisions | Decision questions, alternatives, authority, rationale, and resolution | Decide |
| execute | Plans, actions, ownership, dependencies, evidence, blockers, and completion | Execute |
| outcomes | EX-002 measurement plans, actual results, classifications, confidence, and data quality | Learn |
| learning | LR-001 signals, patterns, candidates, approved lessons, applicability, and reevaluation | Learn |
| recommendations | LR-002 opportunities, reviews, handoffs, implementation state, and results | Recommend |

Identity, property/portfolio authorization, activity, notifications, time, and telemetry are shared platform boundaries used by the HPM composition layer; they are not lifecycle stages.

## Dependency rule

`HPM UI → HPM projection/application service → source port → owning capability query`

Mutations follow a separate route:

`HPM command link → owning capability application command → canonical aggregate/repository`

The source-port contract intentionally exposes only `project`. Adding a write method to a source adapter is an architecture violation. Expected versions and correlation IDs are retained in projected next-command descriptors and must be forwarded to the owning service in HPM-001C.

## Versioning and degradation

Projection and presentation policies are independently versioned. Each source reports its contract version, policy version, source version, freshness, and last successful as-of time. Unsupported, unavailable, or stale sources produce compatibility or freshness state; they do not cause HPM to fabricate records or complete counts.

HPM-001A introduces no persistence or migration. Later slices should prefer on-demand projections. Any derived persistence must be rebuildable, authorization-partitioned, forward-only, and protected by RLS.
