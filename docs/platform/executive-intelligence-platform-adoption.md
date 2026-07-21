# Executive Intelligence Platform Architecture

Status: Platform V1 adoption complete  
Completed: 2026-07-20

## Current architecture

Executive Intelligence is a presentation-oriented consumer of the canonical Platform lifecycle. The production flow is:

```text
src/app/(portal)/dashboard/page.tsx
        ↓
getExecutiveIntelligenceView()
        ↓
getCurrentHpmLifecycleProjection()
        ↓
getCurrentHpmCanonicalInputs()
        ↓
buildHpmLifecycleProjection()
        ↓
Platform Observations, Evidence, Claims, Evaluations, Recommendations,
Decisions, Actions, Outcomes, Intelligence, Learning, and Scoring
```

The route performs one Executive query and passes `ExecutiveIntelligenceView` directly to `ExecutiveCommandCenter`. Components consume focused health, attention, decision, execution, outcome, data-quality, scope, and performance summaries. No compatibility report is constructed.

## Connected production sources

The canonical input assembler currently connects:

- Analytics metric projections converted to canonical Platform Observations;
- Revenue Intelligence detector output already converted to canonical Observations, Evidence, Claims, Evaluations, and Recommendations;
- factual Analytics scope, property labels, reporting dates, and performance metrics as Executive presentation context.

Canonical collections remain immutable and retain Platform identity and lineage. The assembler does not use marketing content, Action Center fixtures, flattened Execution Engine records, or synthetic pillar inputs.

## Provider availability

The following production providers remain deferred:

- Platform Decision persistence/query provider;
- Platform Action persistence/query provider;
- Platform Outcome persistence/query provider;
- canonical Intelligence and Learning providers;
- canonical HPM pillar-score providers;
- canonical portfolio-scope persistence.

Missing providers produce explicit `ExecutiveDataGap` entries. The UI renders unavailable states rather than authoritative zeroes. Missing pillar scores do not reduce health, completed work is not treated as measured impact, and recommendations are not inferred to be Decisions.

## Ownership boundaries

Platform owns lifecycle artifacts, identity, state, lineage, confidence, score primitives, and canonical collections. HPM owns lifecycle organization and pillar aggregation policy through `buildHpmLifecycleProjection()` and `HpmScorePolicy`.

Executive Intelligence owns:

- `ExecutiveAttentionPolicy` and deterministic attention ordering;
- concise health and lifecycle summaries;
- risk/opportunity grouping;
- data-quality explanation;
- presentation formatting and source-aware navigation;
- the `ExecutiveIntelligenceView` read model.

Executive Intelligence does not own Actions, Decisions, Outcomes, Evidence, score mechanics, confidence mechanics, or an alternate lifecycle.

## Executive read model

`ExecutiveIntelligenceView` contains cohesive projections:

- `ExecutiveHealthSummary` — canonical HPM score/status, distinct confidence, and pillar coverage;
- `ExecutiveAttentionSummary` — ranked risks, opportunities, and other attention items;
- `ExecutiveDecisionSummary` — canonical Decision counts and leading item;
- `ExecutiveExecutionSummary` — canonical Action lifecycle counts and leading item;
- `ExecutiveOutcomeSummary` — measured canonical Outcomes and validated Learning summary;
- `ExecutiveDataQualitySummary` — unavailable pillars, provider gaps, confidence, and scope limitations;
- Executive scope/performance presentation facts and briefing copy.

The view is behavior-free. Builders select and format canonical data but do not persist or transition lifecycle records.

## Source-aware navigation

Executive presentation code uses an explicit route map:

| Source | Destination |
| --- | --- |
| Canonical Action attention | `/dashboard/actions` |
| Investment-category attention | `/dashboard/investments` |
| Revenue, pricing, occupancy, distribution, or operations Recommendation | `/dashboard/insights` |
| Unsupported Intelligence, Outcome, Market, or generic source | No link |

Routes are never generated from display labels. Action Center is presented as a separate workspace and its fixture records are not represented as Executive production state.

## Removed migration architecture

Platform adoption removed:

- `ExecutiveIntelligenceReport` and the legacy Executive report aggregate;
- `ExecutivePriority` and its parallel status/action/impact model;
- legacy portfolio health, snapshot, change, risk, and brief DTOs;
- `getExecutiveIntelligence()` and legacy report builders;
- Revenue-specific `buildInitialHpmPerformance()` and `HpmPerformanceReport`;
- the temporary Executive-view-to-legacy-report mapper and dashboard adapter;
- the synthetic Executive projection health calculation and generated focus Decision;
- Execution Engine's `acceptExecutivePriority` reverse dependency and mapper;
- legacy Executive report, priority, and score factories.

Action Center test support now constructs canonical Platform Actions and no longer imports Execution Engine compatibility types.

## Enforced dependency direction

Repository architecture tests enforce:

```text
Presentation → Features → Platform
```

- Executive production code cannot import removed compatibility contracts, Action Center fixtures, or Execution Engine compatibility.
- Execution Engine and Action Center cannot import Executive Intelligence contracts.
- Action Center cannot import Execution Engine merely to obtain canonical state.
- Platform cannot import Executive, Revenue, Market, or Investment features.

## Deferred product work

Adoption completion does not implement lifecycle persistence, an event store, Platform V2, Action Center data migration, Market/Investment production integration, new HPM scoring, portfolio intelligence, or an Executive redesign. Those are future product milestones and do not require retaining migration code.

## Validation expectations

Changes to this architecture must keep focused Executive/HPM/architecture tests, the full Vitest suite, lint, typecheck, production build, and diff validation green. Public exports should expose only the current read models, query, builders, policy, and presentation components.
