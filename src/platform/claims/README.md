# Luxe Haven Platform Claims

Platform Claims defines the canonical propositions evaluated by Luxe Haven
intelligence capabilities.

## Reasoning pipeline

```text
Observation
    fact

↓

Evidence
    interpretation

↓

Claim
    proposition

↓

Evaluation
    structured judgment

↓

Recommendation
    suggested response

↓

Decision
    business conclusion
```

## Claim responsibility

A Claim answers:

> What proposition is the platform evaluating?

A Claim does not own:

- observations;
- evidence references;
- evidence strength or direction;
- explanations;
- confidence;
- scores;
- evaluations;
- recommendations;
- decisions;
- feature-specific thresholds.

## Canonical model

```text
Claim
├── id
├── type
├── subject
├── statement
├── status
├── source
├── createdAt
├── updatedAt
└── metadata
```

## Status semantics

PF-005.1 deliberately begins with a minimal lifecycle:

- `proposed` — formulated but not yet participating in active reasoning;
- `active` — currently participating in the reasoning process.

Status is not a truth value. Whether a Claim is supported, opposed, uncertain,
or resolved belongs to later platform capabilities.

## Feature-owned vocabulary

The platform owns the Claim structure. Features own Claim types.

Examples:

```text
investment.return.below-target
revenue.weekday-demand-underperforming
operations.turnover-risk-elevated
portfolio.performance-deteriorating
```

## Subject alignment

Claims reuse canonical `ObservationSubject`, preserving a common subject model
across Observations, Evidence, and Claims.

## Source alignment

`ClaimSource` identifies the capability and policy that formulated the Claim:

```text
ClaimSource
├── capability
├── name
└── version?
```

## Dependency direction

```text
Kernel
  ↑
Observations
  ↑
Evidence
  ↑
Claims
```

PF-005.1 does not yet depend directly on Evidence because evidence references
are introduced separately in PF-005.2.
