# Platform Observations

Platform Observations provide the canonical representation of facts detected,
retrieved, entered, or calculated by Luxe Haven capabilities.

## Architectural boundary

An observation records what is known. It does not decide what the fact means.

```text
Observation
    ↓ interpreted into
Evidence
    ↓ evaluated through
Scoring
    ↓ supports
Decision
```

Examples:

```text
Projected cap rate = 5.8%                 Observation
Cap rate is below the investment target  Evidence
Investment quality score = 54             Scoring
Pass                                      Decision
```

## Domain model

```text
Observation<TValue>
├── ObservationId
├── ObservationType
├── ObservationSubject
├── ObservationSource
├── ObservationUnit
├── observedAt
├── recordedAt
├── value
└── metadata
```

## Feature-owned vocabulary

Observation types remain feature-owned strings.

Examples:

```ts
type InvestmentObservationType =
  | "cap-rate"
  | "cash-on-cash-return"
  | "debt-service-coverage-ratio";

type RevenueObservationType =
  | "gap-night-count"
  | "weekday-occupancy"
  | "uncaptured-payment";
```

The platform owns the structure, validation, identity, and time semantics.

## Explicit exclusions

PF-003.1 does not model:

- evidence direction;
- evidence strength;
- confidence;
- positive or caution interpretation;
- scores;
- decisions;
- recommendations.

Those belong to other platform capabilities.
