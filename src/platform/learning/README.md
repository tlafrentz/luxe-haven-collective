# Learning Platform (PF-014)

Learning is the canonical platform feedback capability. It evaluates immutable
Outcome history, with Intelligence when available, and produces explainable improvement proposals.
It never mutates source history, applies a proposal, updates a model, or changes
production behavior.

```text
Decisions → Actions → Automations → Outcomes → [Intelligence] → Learning
```

## Learning artifacts

A `LearningReport` represents one validated learning cycle and contains:

- `LearningInsight`: a successful, unsuccessful, calibration, or performance
  pattern learned from history
- `PolicyImprovement`: proposed configuration changes and expected impact for a
  named policy
- `ScoringImprovement`: proposed factor additions, removals, or weight changes
  for a named scoring model
- `ConfidenceCalibration`: estimated confidence, observed historical accuracy,
  recommended confidence, sample size, and calculated adjustment

Improvement and calibration artifacts always expose `proposalStatus:
"proposed"`. They provide no apply, adopt, activate, or mutation operation.
Adoption belongs to an explicit governance or application boundary.

Reports and artifacts are immutable. `LearningCollection` supports report
lookup, confidence filtering/grouping, artifact-kind filtering, causal trace
queries, and artifact-count aggregation without performing learning.

## Explainability and traceability

Every artifact must reference actual supporting Outcomes. Intelligence reports
are retained when an interpretation stage exists, but direct Outcome-derived
learning may leave that reference set empty. Every artifact must also provide
explicit assumptions, rationale, and canonical confidence. `LearningBuilder`
derives and deduplicates identifiers and merges the complete operational lineage
from the available sources. Learning policies do not supply duplicate trace
identifiers.

Report confidence may be assigned explicitly by a policy. Otherwise, the
builder conservatively inherits the least-confident artifact score. Empty
reports require explicit confidence.

## Policies and orchestration

Feature-owned `LearningPolicy` implementations define learning methodology,
including sample requirements, evaluation windows, confidence thresholds, and
proposal criteria. A policy receives `LearningRecordSet`, containing required
Intelligence and Outcomes plus optional Decision, Action, Automation, and
serialization-safe historical records.

Policies perform historical evaluation and return declarative proposed lessons
and improvements. `LearningBuilder` validates and constructs the artifacts; it
does not learn or calculate proposals.

`LearningExecutor` evaluates registered policies, invokes supported learning
strategies, constructs Reports, isolates strategy failures, and returns an
immutable `LearningSession` with execution statistics, diagnostics, and
metadata. Given identical history, policies, clocks, and identifier providers,
the orchestration is reproducible.

Machine-learning infrastructure, automatic model updates, autonomous policy
modification, feature optimization, dashboards, and UI are outside PF-014.

Import the public API from `@/platform/learning`.
