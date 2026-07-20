# PM-008 HPM Orchestration Inventory

Status: canonical lifecycle projection implemented; Executive dashboard compatibility projection retained  
Scope: `src/features/hpm` and HPM product consumers  
Recorded: 2026-07-19

## Boundary decision

Hospitality Performance Management is the cross-capability operating model. It organizes canonical artifacts into a performance-improvement experience; it does not introduce another artifact lifecycle.

| HPM stage | Canonical artifacts |
| --- | --- |
| See | Observations and Outcomes |
| Understand | Evidence, Claims, Evaluations, and Intelligence |
| Decide | Recommendations and Decisions |
| Execute | Actions |
| Learn | measured Outcomes, retrospective Intelligence, and actual Learning |

`buildHpmLifecycleProjection` is the primary HPM read boundary.

## Existing inventory and classification

| Export or concept | Classification | PM-008 disposition |
| --- | --- | --- |
| `HPM_PILLARS` | HPM policy/experience vocabulary | Retained |
| pillar labels and questions | Experience model | Retained; not Platform domain |
| `HpmPillarScore` | Compatibility score projection | Existing UI shape retained |
| `HpmCompositeScore` | Compatibility score projection | Existing UI shape retained |
| health and measurement status unions | HPM projection vocabulary | Retained for presentation |
| score direction/change | HPM projection vocabulary | Retained for presentation |
| score contributors | HPM projection | Retained; behavior-free |
| `HpmPerformanceReport` | Compatibility projection | Deprecated Executive dashboard shape |
| `buildInitialHpmPerformance` | Misplaced feature reasoning / compatibility | Deprecated Revenue DTO scorer |
| `HpmCanonicalInputs` | HPM orchestration input | New canonical boundary |
| `HpmLifecycleProjection` | HPM projection | Canonical product read model |
| `HpmImprovementCycle` | HPM projection | Canonical lineage view, no lifecycle behavior |
| `HpmOperatingHealth` | HPM projection | Cross-capability health and momentum |
| `HpmScorePolicy` | HPM policy | Pillar weighting with Platform Scoring mechanics |
| marketing HPM flywheel/content | Experience/marketing model | Remains under `features/marketing/hpm` |

No HPM-owned Recommendation, Decision, Action, Outcome, Intelligence, or Learning entity exists. None is introduced by PM-008.

## Existing product semantics

The current HPM implementation has seven pillars:

- investment;
- financial;
- revenue;
- operations;
- guest experience;
- risk;
- growth.

PM-008 preserves these dimensions. It does not introduce speculative new dimensions merely because canonical scoring makes expansion possible.

The previous implementation calculates Revenue and Risk pillar scores directly from a `RevenueIntelligence` compatibility report. All other pillars are unavailable. This code remains temporarily because the Executive dashboard renders `HpmPerformanceReport`; it is deprecated and excluded from the canonical path.

## Canonical inputs

`HpmCanonicalInputs` consumes public Platform collections for:

- Observations;
- Evidence;
- Claims;
- Evaluations;
- Recommendations;
- Decisions;
- Actions;
- Outcomes;
- Intelligence;
- Learning.

It accepts optional canonical pillar Scores plus narrow Executive and Analytics projection summaries. These summaries are structural inputs, preventing feature dependency cycles and keeping Executive prioritization distinct.

The canonical path imports no Revenue, Market, Investment, Execution Engine, Executive, or Analytics DTO.

## Lifecycle projection

The HPM lifecycle stages hold Platform collections directly. They do not copy artifact status, implement transitions, or replace identity.

`learn.measuredOutcomes` contains terminal measured records. `learn.learning` contains only Platform Learning reports. The two are deliberately separate.

## HPM Score ownership

HPM owns:

- which existing pillars participate;
- pillar weights;
- aggregation policy;
- health interpretation bands;
- data coverage reporting.

Platform Scoring owns:

- `Score` representation;
- `Weight` validation;
- weighted contributions;
- `ScoreComponent` representation;
- `ScoreBreakdown` calculation and traceability.

`HpmScorePolicy` accepts canonical pillar Scores and produces a Platform `ScoreBreakdown`. Missing pillar scores reduce coverage rather than being invented or treated as zero. Default weights are equal across supplied pillars; optional HPM-owned weights can be configured.

The existing health bands are preserved:

- 90–100: excellent;
- 75–89: healthy;
- 60–74: watch;
- 40–59: needs attention;
- below 40: critical;
- no canonical scores: unavailable.

## Improvement cycles and lineage

HPM derives improvement cycles from Outcome lineage:

```text
Recommendation → Decision → Action → Outcome → Learning
```

Each cycle exposes the canonical Outcome, matching Actions, Recommendation and Decision references, matching Learning reports, and whether execution lineage is complete.

Cycle status is a projection:

- `decided`: lineage exists but execution/measurement has not progressed;
- `executing`: a linked Action is in progress;
- `measured`: a completed Outcome exists without Learning;
- `learned`: a Platform Learning artifact explicitly traces the Outcome.

Measurement is never labeled Learning.

## Health and momentum

Canonical HPM health projects:

- overall Platform Score and breakdown;
- canonical score coverage;
- unresolved Decision count;
- active Action count;
- Action completion percentage;
- successful and failed Outcome counts;
- realized metrics aggregated by metric identity without combining incompatible units;
- successful measured-cycle momentum;
- count of actual Learning artifacts;
- explicit data gaps.

These calculations synthesize canonical records. They do not re-run Revenue, Market, or Investment policies.

## Executive boundary

Executive Intelligence remains responsible for urgency, impact sequencing, attention ranking, and briefing. HPM accepts only the selected priority identifier and count needed for the operating projection. It does not import, invoke, or duplicate `ExecutiveAttentionPolicy`.

HPM provides the longitudinal improvement view; Executive provides the immediate focus view.

## Dependencies and consumers

| Capability or consumer | Existing relationship | Canonical relationship |
| --- | --- | --- |
| Revenue Intelligence | Imported by deprecated initial scorer | Platform artifacts and canonical Score only |
| Market Intelligence | No direct current dependency | Platform artifacts and canonical Score |
| Investment Intelligence | No direct current dependency | Platform artifacts and canonical Score |
| Executive Intelligence | Imports legacy HPM report/types for dashboard | Narrow projection summary may enter HPM; no canonical reverse DTO dependency |
| Analytics | Indirect through Revenue/Executive | Observations, Outcomes, and optional factual projection summary |
| Execution Engine | No direct HPM dependency | Platform Actions and Outcomes only |
| Executive dashboard | Renders compatibility HPM pillar report | Removal target after product UI adopts HPM lifecycle projection |
| HPM marketing page | Independent narrative content | Remains marketing-owned and unchanged |

There is currently no separate authenticated HPM operating-system screen. The Executive dashboard is the only production consumer of HPM health, and it remains behavior-compatible. New HPM product development must enter through `buildHpmLifecycleProjection`; it must not compose feature DTOs directly.

## Compatibility register

- `HpmPerformanceReport`, `HpmPillarScore`, `HpmCompositeScore`, and contributor DTOs: behavior-free Executive dashboard projection.
- `buildInitialHpmPerformance`: deprecated Revenue-specific compatibility scorer and the sole direct feature DTO dependency.
- Executive dashboard HPM pillar grid: current production consumer and removal target.
- HPM marketing content: presentation-owned, not compatibility code and not subject to Platform migration.

Compatibility APIs are preserved for current UI behavior but are unavailable as the canonical path for new development.

## Data gaps and confidence

The canonical projection reports missing Observations, Outcomes, Learning, and pillar Scores explicitly. It does not infer confidence from record count or rename Outcome notes as lessons learned. Capability confidence remains in Platform scoring and intelligence artifacts.

## Completion evidence

PM-008 validation covers five-stage organization, Platform score aggregation, complete improvement lineage, measurement-versus-Learning semantics, empty-state behavior, architecture lint, adoption reporting, lint, typecheck, full Vitest, production build, and diff validation.

PM-008 closes the migration sequence. The next architecture activity is the Platform v1 retrospective and factual product/technical status review, not another migration milestone.
