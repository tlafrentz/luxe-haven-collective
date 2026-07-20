# Luxe Haven Platform Evidence

Platform Evidence provides the canonical representation of what one or more
observations mean in relation to a proposition.

## Architectural boundary

```text
Observation
    records a fact

Evidence
    interprets what one or more facts mean

Claim
    states the proposition being evaluated

Scoring
    measures the claim

Decision
    reaches a conclusion
```

PF-004.1 owns only the canonical Evidence domain.

It intentionally does not model:

- confidence;
- claims;
- scores;
- recommendations;
- decisions;
- feature-specific evidence policies;
- evidence collections;
- evidence builders.

## Domain model

```text
Evidence
├── EvidenceId
├── EvidenceType
├── ObservationSubject
├── title
├── explanation
├── EvidenceDirection
├── EvidenceStrength
├── EvidenceSource
├── observationIds[]
├── createdAt
└── metadata
```

## Direction

Direction is proposition-relative:

- `supporting`
- `opposing`
- `neutral`
- `mixed`

Evidence is not inherently positive or negative. It either supports, opposes,
does not materially affect, or has mixed implications for a proposition.

## Strength

Strength describes how materially evidence affects a proposition:

- `weak`
- `moderate`
- `strong`
- `decisive`

Strength is not confidence. Confidence belongs to Platform Scoring.

## Traceability

Every evidence item must reference at least one canonical platform observation.

```text
Decision
    ↓
Claim
    ↓
Evidence
    ↓
Observation
```

An interpretation without an observation reference is not canonical platform
evidence.

## Feature-owned vocabulary

Evidence types remain feature-owned strings.

```ts
type InvestmentEvidenceType =
  | "investment.financial.cap-rate-below-target"
  | "investment.market.demand-outpaces-supply"
  | "investment.revenue.assumptions-supported";
```

The platform owns structure, validation, identity, immutability, and
traceability.

## Dependency direction

```text
Kernel
  ↑
Observations
  ↑
Evidence
```

Evidence may depend on Observations. Observations must never depend on Evidence.
