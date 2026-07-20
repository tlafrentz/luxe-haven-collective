# Luxe Haven Platform v1

Status: **Approved and frozen for migration**  
Effective date: **2026-07-19**  
Baseline: the public package entry points under `src/platform/*/index.ts`  
Audit: [Platform Migration Audit](./migration-audit.md)

> **Migration begins here.**

Platform v1 is the canonical foundation for all new platform-facing feature
work. Existing feature models may remain behind compatibility adapters during
migration, but they must converge toward these packages and dependency rules.

“Frozen” means the ownership boundaries, dependency direction, canonical
artifacts, and public entry points are approved. It does not prohibit additive,
backward-compatible fixes. Breaking changes require an explicit Platform v2 or
an approved versioned amendment.

## Approved packages

The following packages comprise Platform v1:

| Package | Approved responsibility |
|---|---|
| `@/platform/kernel` | Identity, entity/value-object foundations, Results, and platform errors |
| `@/platform/scoring` | Scores, scales, weights, breakdowns, thresholds, and confidence |
| `@/platform/execution` | Executor contracts, sessions, status, progress, statistics, diagnostics, and options |
| `@/platform/observations` | Immutable facts, subjects, sources, provenance, units, values, collections, builders, and providers |
| `@/platform/evidence` | Immutable interpretations of Observations, direction, strength, sources, references, and collections |
| `@/platform/claims` | Immutable propositions, status, source, evidence references, and collections |
| `@/platform/evaluations` | Structured judgments of Claims, evidence influence, confidence, policies, orchestration, and sessions |
| `@/platform/recommendations` | Proposed responses, priority, policies, builders, collections, orchestration, and sessions |
| `@/platform/decisions` | Committed choices, modes, rationale, options, policies, complete lineage, orchestration, and sessions |
| `@/platform/actions` | Units of work, lifecycle, ownership, outcomes, policies, collections, orchestration, and sessions |
| `@/platform/workflows` | Reusable process definitions, ordered/dependent Action steps, workflow state/history, orchestration, and sessions |
| `@/platform/automations` | Event-driven initiation, declarative rules/conditions, governance, retries, concurrency, history, and sessions |
| `@/platform/outcomes` | Immutable execution truth, status, success, timing, metrics, payloads, lineage, policies, and sessions |
| `@/platform/intelligence` | Explainable Insights, Trends, Opportunities, Forecasts, Anomalies, reports, policies, and sessions |
| `@/platform/learning` | Explainable lessons and proposal-only policy, scoring, and confidence improvements |

No other directory is a Platform v1 package. In particular, nothing under
`src/features`, `src/app`, `src/components`, `src/lib`, or `src/types` is part of
the Platform public API.

## Approved APIs

### Public API rule

The approved API of each package is exactly the set of exports reachable from:

```text
@/platform/<package>
```

These root `index.ts` files are the stable package boundaries. Consumers must
not deep-import internal files such as:

```ts
// Not approved
import { Action } from "@/platform/actions/domain/action";

// Approved
import { Action } from "@/platform/actions";
```

Domain and application folders are organizational details unless exported by
the package root. Tests may use relative imports to exercise internals, but
production consumers may not treat those paths as stable APIs.

### Approved API families

Every lifecycle package exposes the applicable members of this pattern:

```text
Canonical artifact/entity
Identifier and creation function
Immutable collection
Builder
Policy contract
Immutable policy registry
Executor/orchestrator
Immutable session
Input/result/context contracts
Status, type, priority, or mode vocabulary owned by that package
```

The approved primary artifacts are:

| Package | Primary public artifacts |
|---|---|
| Kernel | `Identifier`, `Entity`, `EntityWithProps`, `ValueObject`, `Result`, `PlatformError` |
| Scoring | `Score`, `ScoreScale`, `Weight`, `WeightedScore`, `ScoreComponent`, `ScoreBreakdown`, `ConfidenceScore`, `ConfidenceLevel`, `ConfidenceAssessment` |
| Execution | `Executor`, `ExecutionSession`, `ExecutionStatus`, `ExecutionProgress`, `ExecutionStatistics`, `ExecutionDiagnostics`, `ExecutionOptions` |
| Observations | `Observation`, `ObservationCollection`, `ObservationBuilder`, `ObservationCollectionBuilder`, `ObservationProvider` |
| Evidence | `Evidence`, `EvidenceCollection`, `EvidenceReference`, `EvidenceSource`, `EvidenceDirection`, `EvidenceStrength` |
| Claims | `Claim`, `ClaimCollection`, `ClaimEvidenceReference`, `ClaimSource`, `ClaimStatus` |
| Evaluations | `Evaluation`, `EvaluationCollection`, `EvaluationBuilder`, `EvaluationPolicy`, `EvaluationPolicyRegistry`, `EvaluationOrchestrator`, `EvaluationSession` |
| Recommendations | `Recommendation`, `RecommendationCollection`, `RecommendationBuilder`, `RecommendationPolicy`, `RecommendationPolicyRegistry`, `RecommendationExecutor`, `RecommendationSession` |
| Decisions | `Decision`, `DecisionCollection`, `DecisionBuilder`, `DecisionPolicy`, `DecisionPolicyRegistry`, `DecisionExecutor`, `DecisionSession`, `DecisionMode` |
| Actions | `Action`, `ActionCollection`, `ActionBuilder`, `ActionPolicy`, `ActionPolicyRegistry`, `ActionExecutor`, `ActionSession` |
| Workflows | `Workflow`, `WorkflowDefinition`, `WorkflowStep`, `WorkflowCollection`, `WorkflowBuilder`, `WorkflowRegistry`, `WorkflowExecutor`, `WorkflowSession` |
| Automations | `AutomationRule`, `AutomationTrigger`, `AutomationCondition`, `AutomationExecution`, `AutomationHistory`, `AutomationCollection`, `AutomationBuilder`, `AutomationPolicy`, `AutomationPolicyRegistry`, `AutomationExecutor`, `AutomationSession` |
| Outcomes | `Outcome`, `OutcomeCollection`, `OutcomeBuilder`, `OutcomePolicy`, `OutcomePolicyRegistry`, `OutcomeExecutor`, `OutcomeSession` |
| Intelligence | `IntelligenceReport`, `Insight`, `Trend`, `Opportunity`, `Forecast`, `Anomaly`, `IntelligenceCollection`, `IntelligenceBuilder`, `IntelligencePolicy`, `IntelligencePolicyRegistry`, `IntelligenceExecutor`, `IntelligenceSession` |
| Learning | `LearningReport`, `LearningInsight`, `PolicyImprovement`, `ScoringImprovement`, `ConfidenceCalibration`, `LearningCollection`, `LearningBuilder`, `LearningPolicy`, `LearningPolicyRegistry`, `LearningExecutor`, `LearningSession` |

This table is a readable summary, not a substitute for the root exports. Public
types, identifiers, constants, helper functions, and input contracts exported
by each root are also approved.

## Approved lifecycle

The canonical Platform v1 lifecycle is:

```text
Observation
    ↓
Evidence
    ↓
Claim
    ↓
Evaluation
    ↓
Recommendation
    ↓
Decision
    ↓
Action
    ↓
Workflow
    ↓
Automation
    ↓
Outcome
    ↓
Intelligence
    ↓
Learning
```

Supporting capabilities apply across the lifecycle:

```text
Kernel      identity, immutability, errors, results
Scoring     score and confidence semantics
Execution   orchestration sessions and diagnostics
```

Each stage has one canonical meaning:

| Stage | Canonical question |
|---|---|
| Observation | What fact was recorded? |
| Evidence | What does that fact mean relative to a proposition? |
| Claim | What proposition is being evaluated? |
| Evaluation | How does the Evidence relate to the Claim? |
| Recommendation | What should happen next? |
| Decision | What course of action is committed? |
| Action | What unit of work exists? |
| Workflow | How should the work be organized? |
| Automation | Can eligible work begin without human intervention? |
| Outcome | What actually happened? |
| Intelligence | What does the history mean? |
| Learning | How should the platform improve? |

## Approved dependency rules

### Repository direction

The only approved high-level direction is:

```text
Platform foundations
        ↑
Platform lifecycle packages
        ↑
Feature domain/application policies and adapters
        ↑
Application routes, UI, and infrastructure composition
```

More explicitly:

```text
platform  → platform      allowed when following the approved lifecycle
features  → platform      allowed and preferred
app/UI    → features      allowed
app/UI    → platform      allowed for direct composition/read models

platform  → features      forbidden
platform  → app/UI        forbidden
domain    → presentation  forbidden
application → presentation forbidden
```

### Lifecycle direction

A downstream lifecycle package may depend on upstream canonical artifacts.
An upstream package must never depend on a downstream interpretation or result.

Examples:

```text
Evidence may depend on Observations.
Observations must not depend on Evidence.

Decisions may depend on Recommendations.
Recommendations must not depend on Decisions.

Outcomes may depend on execution artifacts.
Actions and Workflows must not depend on Outcomes.

Learning may depend on Intelligence and Outcomes.
Intelligence and Outcomes must not depend on Learning.
```

Kernel is dependency-safe for every Platform package. Scoring and Execution are
supporting capabilities and may be consumed where their contracts apply; they
must not acquire feature or presentation dependencies.

### Feature ownership

Features own:

- business vocabulary and categories;
- thresholds and analytical methodology;
- Platform policy implementations;
- provider and persistence adapters;
- mapping into and out of canonical artifacts;
- read models, formatting, and UI;
- hospitality-specific calculations and invariants.

Platform owns:

- canonical artifact structure and identity;
- immutable lifecycle semantics;
- traceability and lineage requirements;
- generic scoring, confidence, execution, and diagnostic contracts;
- builders, collections, registries, orchestration, and sessions;
- platform-wide validation and governance boundaries.

Feature-specific concepts may appear in Platform only through approved
extension points such as feature-owned type strings, metadata, policy results,
and serialization-safe payloads. Hospitality assumptions must not be added to
canonical Platform entities.

### Compatibility and migration

- Compatibility types live at feature boundaries, never as a second Platform
  model.
- A compatibility DTO may reshape identity, dates, or metadata for an existing
  consumer, but new domain behavior must be added to the canonical artifact.
- Feature adapters must preserve canonical lineage and must not fabricate
  upstream or downstream ancestry.
- Existing behavior remains supported until its consumers migrate and its
  compatibility tests can be intentionally removed.
- No migration may introduce a second independently evolving entity for an
  approved Platform concept.

## Approved principles

### 1. One canonical model per platform concept

Observation, Evidence, Claim, Evaluation, Recommendation, Decision, Action,
Workflow, Automation, Outcome, Intelligence, and Learning each have one
canonical Platform representation.

### 2. Features provide policy; Platform provides structure

Business reasoning remains feature-owned. Platform validates, records,
orchestrates, and preserves the artifacts produced by that reasoning.

### 3. Immutable history

Canonical artifacts and collections are immutable. Later lifecycle stages
reference earlier artifacts; they do not rewrite them.

### 4. Complete applicable traceability

Every artifact preserves the causal lineage available at its lifecycle stage.
Adapters and policies may add valid upstream references but may never invent
nonexistent ancestry.

### 5. Explainability over black boxes

Confidence requires rationale. Intelligence and Learning require supporting
records, assumptions, confidence, and rationale. Policy results must be
auditable and reproducible.

### 6. Orchestration is not business reasoning

Executors coordinate builders and policies. Builders validate and normalize.
Neither invents feature-specific conclusions.

### 7. Automation does not decide

Automation may initiate eligible Decision-backed work under registered
governance. It may not generate or bypass business Decisions.

### 8. Outcomes are execution truth

Analytics, reporting, Intelligence, and Learning consume canonical Outcomes
rather than inferring reality from mutable UI or feature state.

### 9. Learning proposes; governance adopts

Learning artifacts remain proposals. Platform v1 does not autonomously modify
production policy, scoring, confidence, or automation.

### 10. Additive migration

Migration proceeds through adapters and compatibility tests. Unrelated feature
flows and UI are not rewritten merely to demonstrate Platform adoption.

## Platform decision history

These Architecture Decision Records preserve the reasons behind the Platform
v1 boundaries. They are part of the freeze. Reversing one requires a versioned
amendment or Platform v2 according to the change-control rules below.

### ADR-001: Platform is domain-agnostic

**Decision:** Platform owns reusable lifecycle structure and must not contain
hospitality-, property-, dashboard-, provider-, or feature-specific behavior.

**Why:** A shared platform is valuable only when Investment, Revenue, Market,
Executive, Operations, and future capabilities can use the same contracts
without inheriting another feature's assumptions.

**Consequence:** Business vocabulary, thresholds, calculations, provider logic,
and presentation remain feature-owned. Platform accepts feature vocabulary only
through approved extension points such as type strings, policies, metadata, and
serialization-safe payloads.

### ADR-002: Canonical reasoning and execution lifecycle

**Decision:** Platform v1 uses one ordered lifecycle:

```text
Observation → Evidence → Claim → Evaluation → Recommendation → Decision
→ Action → Workflow → Automation → Outcome → Intelligence → Learning
```

**Why:** Each stage answers a distinct question. Separating facts,
interpretations, propositions, judgments, proposals, commitments, work,
execution, reality, analysis, and improvement prevents ambiguous entities and
preserves causal history.

**Consequence:** Features may project or combine stages for UI purposes, but
must not introduce a competing canonical lifecycle or use one status model to
represent several stages.

### ADR-003: Platform owns artifacts; features own policies

**Decision:** Platform owns identity, structure, validation, immutability,
lineage, collections, builders, registries, orchestration, and sessions.
Features own the policies and analytical methodology that produce artifacts.

**Why:** Centralizing business reasoning would make Platform feature-specific;
duplicating artifact structure would fragment the lifecycle. This division
provides reuse without erasing bounded-context expertise.

**Consequence:** Builders and executors do not invent business conclusions.
Feature policy implementations consume and produce canonical Platform
contracts.

### ADR-004: Lifecycle artifacts are immutable

**Decision:** Canonical artifacts, collections, execution records, histories,
reports, and sessions are immutable snapshots.

**Why:** Decisions, execution, Outcomes, Intelligence, and Learning require an
auditable record of what was known and concluded at a point in time. Mutation
would make later results impossible to reproduce or explain reliably.

**Consequence:** Change creates a new artifact, transition, history entry, or
downstream record. Later stages reference earlier stages and never rewrite
them.

### ADR-005: Explainability is mandatory

**Decision:** Confidence and conclusions must preserve supporting records,
lineage, assumptions where applicable, and rationale.

**Why:** Platform recommendations, automation, intelligence, and learning must
be auditable by operators and engineers. A result that cannot explain its
sources is not safe to govern or improve.

**Consequence:** Missing applicable lineage or rationale is a validation error,
not an optional documentation concern. Black-box analytical and learning
results are outside the approved Platform contract.

## Approved Platform Features

The following numbered Platform Features are approved in v1:

| PF | Capability | Approved package |
|---|---|---|
| PF-003 | Observations | `@/platform/observations` |
| PF-004 | Evidence | `@/platform/evidence` |
| PF-005 | Claims | `@/platform/claims` |
| PF-006 | Evaluations | `@/platform/evaluations` |
| PF-007 | Recommendations | `@/platform/recommendations` |
| PF-008 | Decisions | `@/platform/decisions` |
| PF-009 | Actions | `@/platform/actions` |
| PF-010 | Workflows | `@/platform/workflows` |
| PF-011 | Automation | `@/platform/automations` |
| PF-012 | Outcomes | `@/platform/outcomes` |
| PF-013 | Intelligence | `@/platform/intelligence` |
| PF-014 | Learning | `@/platform/learning` |

Kernel, Scoring, and Execution are approved Platform v1 foundations. Existing
repository documents do not encode a consistent final PF-001/PF-002 assignment,
so Platform v1 does not invent one retroactively. Their approval is by package
name and public API.

Sub-feature revisions documented in package READMEs—such as PF-004.x,
PF-005.x, and PF-006.x—are incorporated into their approved parent capability.

## Change control

After this freeze:

### Allowed without a new major platform version

- bug fixes that preserve public behavior;
- documentation and test improvements;
- additive exports consistent with an approved package responsibility;
- additive feature-owned vocabulary and policy implementations;
- compatibility adapters in features;
- performance improvements that preserve determinism and semantics.

### Requires an approved versioned amendment

- adding a new canonical artifact or lifecycle stage;
- changing package ownership or dependency direction;
- weakening immutability, traceability, explainability, or Decision provenance;
- changing lifecycle/status semantics incompatibly;
- moving feature-specific business logic into Platform;
- removing or renaming a public export;
- allowing Platform to depend on features or presentation code.

### Requires Platform v2

- breaking public APIs;
- replacing a canonical model;
- reordering the canonical lifecycle;
- changing the foundational principles above.

## Migration baseline

All migration work begins from these rules:

1. Inventory the feature concept and identify its canonical Platform owner.
2. Preserve feature-specific policy and calculations in the feature.
3. Add a feature adapter or Platform policy implementation.
4. Produce or consume the canonical artifact through the package root API.
5. Preserve existing consumers with explicit compatibility coverage.
6. Move domain behavior to the canonical model; do not enhance the legacy one.
7. Verify lineage, immutability, dependency direction, tests, typecheck, lint,
   and build.
8. Retire the compatibility type only when no consumer remains.

The current migration inventory and recommended sequencing are recorded in the
[Platform Migration Audit](./migration-audit.md).

## Migration success criteria

The Platform v1 migration is successful only when all of the following are
measurably true:

1. **No competing canonical concepts remain in features.** Feature modules may
   retain domain-specific entities and view DTOs, but they do not own parallel
   Observation, Evidence, Claim, Evaluation, Recommendation, Decision, Action,
   Workflow, Automation, Outcome, Intelligence, Learning, score, confidence, or
   execution models.
2. **All new feature work consumes Platform through package roots.** Production
   imports use `@/platform/<package>` and do not deep-import Platform internals.
3. **Feature-to-feature domain coupling is eliminated.** No feature imports
   another feature's domain model except through an explicitly documented,
   temporary compatibility adapter with migration coverage and an owner.
4. **Every Platform package has proportional test coverage.** Each package has
   public API architecture tests, domain/unit tests, and orchestration or
   integration tests where it exposes builders, policies, executors, or
   sessions.
5. **Dependency rules are enforced in CI.** Automated checks reject Platform →
   Feature, Platform → UI, domain → presentation, application → presentation,
   and unapproved Platform deep imports.
6. **Canonical lineage is preserved end to end.** Representative HPM flows can
   trace downstream artifacts back through every applicable upstream stage.
7. **Compatibility code has an explicit lifecycle.** Every remaining adapter or
   legacy DTO is documented, tested, assigned to a migration milestone, and not
   independently evolving.
8. **Repository validation remains green.** Lint, typecheck, architecture tests,
   relevant unit/integration tests, and the production build pass throughout
   migration.

Progress against these criteria should be tracked as engineering exit criteria,
not treated as architectural aspirations.

## Platform v1 complete when

Defining and freezing Platform v1 starts migration; it does not by itself
complete the Platform program. Platform v1 is considered complete when:

- [ ] The approved Platform packages and public APIs are implemented and pass
  their required tests.
- [ ] The feature migration program described in the Platform Migration Audit
  is complete.
- [ ] Competing canonical feature models and temporary compatibility models are
  removed, except explicitly approved long-lived presentation DTOs.
- [ ] CI-enforced architecture dependency tests pass with no waivers for the
  approved rules.
- [ ] Every public package API and ownership boundary is documented.
- [ ] Every HPM engine consumes canonical Platform artifacts at its lifecycle
  boundaries.
- [ ] End-to-end lineage, explainability, immutability, and reproducibility are
  demonstrated by integration tests.
- [ ] Product teams can add domain policies and adapters without adding new
  Platform primitives or changing canonical lifecycle semantics.

When every item is checked, foundational Platform work stops being a standing
program. Further work is driven by product needs, additive amendments, or an
explicit Platform v2 proposal.

---

# Migration begins here

New feature work must use Platform v1. Existing feature work migrates toward
Platform v1. Competing canonical models are frozen and may receive only the
minimum compatibility changes required to complete migration safely.
