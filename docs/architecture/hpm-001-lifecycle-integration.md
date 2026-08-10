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

## HPM-001B projection behavior

`createHpmLifecycleProjectionService` is the single read-only composition boundary. It resolves trusted property or portfolio scope before invoking source ports, isolates source failures, filters records defensively before counts and lineage, and returns either a complete, partial, or unavailable projection.

The lifecycle, lineage, health, freshness, stage-vocabulary, projection, and source policies carry independent versions. Projection and thread identifiers hash tenant-safe scope, source identity, checkpoints, and policy versions; they never contain addresses, guest data, or free text.

Lineage association uses explicit source relationships first. A shared visible correlation identifier may create a versioned inferred edge only when no explicit edge connects the record. Free-text or AI similarity is not used. Self-links, broken endpoints, cross-tenant links, and unauthorized cross-property links are omitted and reported only as safe visible-source gaps.

Health uses documented precedence: Blocked, At Risk, Awaiting Authority, Awaiting External Dependency, Awaiting Measurement, Incomplete Context, Stale, Attention Needed, Healthy, Not Applicable. It consumes normalized canonical signals without replacing source status, severity, confidence, scores, or outcome classification.

Freshness thresholds are capability-specific. Safe records remain available during delayed or stale states, but summaries and coverage no longer imply completeness. An unavailable or not-configured adapter returns no records. This is the honest production boundary for canonical LR-001 or LR-002 sources that are not yet deployable.

HPM-001B adds no persistence, migration, UI, attention ranking, valid-command routing, reports, activity, or notifications.
