# Luxe Haven Platform Evaluations

Platform Evaluations defines the canonical structured judgment of a Claim.

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

## Evaluation responsibility

An Evaluation answers:

> How does the available Evidence relate to this Claim, and how confident are
> we in that judgment?

An Evaluation owns:

- the evaluated Claim identity;
- a feature-owned evaluation type;
- a canonical disposition;
- a concise summary;
- canonical platform confidence;
- source provenance;
- evaluation time;
- optional metadata.

An Evaluation does not own:

- the Claim statement;
- Evidence interpretation or strength;
- a recommended action;
- priority or ownership;
- a final business Decision.

## Canonical model

```text
Evaluation
├── id
├── type
├── claimId
├── disposition
├── summary
├── confidence
├── source
├── evaluatedAt
└── metadata
```

## Canonical dispositions

```text
SUPPORTED
OPPOSED
MIXED
INSUFFICIENT
```

These describe the relationship between Evidence and a Claim.

They do not mean:

- buy;
- wait;
- pass;
- raise price;
- schedule cleaner;
- approve;
- reject.

Those are Recommendation or Decision concepts.

## Confidence

Evaluations reuse the existing canonical Scoring capability:

```text
ConfidenceAssessment
├── ConfidenceScore
├── ConfidenceLevel
└── rationale
```

This avoids introducing a competing confidence model.

## Feature-owned vocabulary

The platform owns Evaluation structure. Features own Evaluation types.

Examples:

```text
investment.acquisition-return
revenue.weekday-demand
operations.turnover-risk
portfolio.performance-health
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
  ↑
Evaluations
```
