# Luxe Haven Platform Decisions

Decisions is the canonical platform capability for selecting a committed course
of action from one or more Recommendations.

```text
Observation → Evidence → Claim → Evaluation → Recommendation → Decision
```

Recommendations propose. Decisions commit. A Decision records the selected
Recommendations, why they were selected, the confidence and priority at that
moment, its explicit decision mode, metadata, timestamp, and the complete
reasoning lineage available on those Recommendations.

## Decision modes

- `automatic`
- `human-approved`
- `human-modified`
- `scheduled`
- `deferred`
- `rejected`

Feature-owned categories and outcomes remain supported. The platform mode
describes how the commitment was reached; it does not prescribe hospitality
business vocabulary.

## Ownership boundaries

The domain owns immutable Decisions and query-only collections. Policies own
selection rules, including approval, review, modification, deferral, and
conflict rejection. The builder validates and normalizes policy output. The
registry owns policy discovery. The executor owns orchestration and produces an
immutable session using Platform Execution status, statistics, and diagnostics.

Decisions do not execute tasks, trigger automation, send notifications, or own
UI behavior. Downstream workflow capabilities may consume Decisions but must
not alter their reasoning snapshots.

## Execution

```ts
const session = await new DecisionExecutor().execute({
  recommendations,
  registry,
});

const decisions = session.decisions;
```

Every applicable policy runs against the immutable Recommendation collection.
Unsupported policies are skipped. A policy may intentionally produce no
Decision. Policy failures are captured without preventing remaining policies
from running.

Selecting one Recommendation propagates its confidence and priority. Policies
combining multiple Recommendations must explicitly capture confidence; priority
defaults to the highest selected priority. Recommendation, Evaluation, Claim,
Evidence, and Observation identifiers are copied into the Decision so later
pipeline stages never need to reconstruct or mutate reasoning history.
