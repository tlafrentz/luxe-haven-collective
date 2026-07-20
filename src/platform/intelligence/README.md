# Intelligence Platform (PF-013)

Intelligence is the canonical platform capability for turning immutable
Outcomes and historical lifecycle records into explainable analytical
artifacts. It sits after Outcomes and never mutates its source records.

```text
Observations → Evidence → Claims → Evaluations → Recommendations → Decisions
                                                                    ↓
Actions → Workflows → Automations → Outcomes → Intelligence
```

The package provides analytical contracts and validated artifacts. It does not
embed hospitality logic, automatic execution, machine learning, policy
optimization, recommendations, dashboards, or visualization.

## Analytical artifacts

An `IntelligenceReport` is an immutable body of intelligence for a validated
reporting period. It can contain:

- `Insight`: an explainable conclusion and measured business impact
- `Trend`: an ordered, measurable change with at least two historical points
- `Opportunity`: a measurable improvement with expected impact
- `Forecast`: a future prediction, projection horizon, assumptions, and
  supporting intelligence
- `Anomaly`: expected and actual values, optional deviation, and a required
  detection explanation

All artifacts have identity, title, summary, canonical confidence, supporting
Outcomes, causal lineage, assumptions, and rationale. Metrics and impacts are
platform-agnostic finite numbers. Predictions and anomaly values use the
platform's serialization-safe observation values.

`IntelligenceCollection` stores Reports and supports immutable lookup,
confidence filtering/grouping, artifact-kind filtering, causal trace queries,
and artifact-count aggregation. Collections contain no analytical behavior.

## Explainability and confidence

Policies reference the actual supporting Outcome objects. `IntelligenceBuilder`
derives and deduplicates Outcome IDs and their complete lifecycle lineage rather
than accepting duplicated identifiers from analytical code. Every artifact must
have supporting Outcomes, supporting Actions, supporting Decisions, and a
non-empty rationale. Forecasts additionally require explicit assumptions.

Policies assign artifact confidence using the platform scoring capability. A
policy may explicitly assign report confidence. When it does not, the builder
uses the least-confident artifact score, providing conservative and reproducible
confidence propagation. Empty reports must receive explicit confidence.

## Policies and orchestration

`IntelligenceRecordSet` exposes Outcomes and optional canonical Observation,
Evidence, Claim, Evaluation, Recommendation, Decision, Action, Workflow, and
Automation history collections, plus serialization-safe historical series.

Feature-owned `IntelligencePolicy` implementations decide whether they support
a record set and perform the actual trend detection, anomaly detection,
forecasting, opportunity recognition, and insight generation. Policies return
declarative results. `IntelligenceBuilder` validates and constructs artifacts;
it never analyzes source data.

`IntelligenceExecutor` evaluates each registered policy, invokes its analytical
engine, builds Reports, isolates policy failures, and returns an immutable
`IntelligenceSession` with statistics, diagnostics, and metadata. Given the same
records, policies, clocks, and identifier providers, orchestration is
deterministic and reproducible.

Import the public API from `@/platform/intelligence`.
