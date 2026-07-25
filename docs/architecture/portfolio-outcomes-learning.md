# Portfolio Outcomes & Learning Architecture

```text
Approved Platform Decision
  -> Canonical Outcome measurement plan
  -> Canonical Decision Outcome assessment
  -> Immutable Portfolio outcome review
  -> Versioned Portfolio learning record
  -> Future recommendation calibration input
```

PI-001G adapts canonical `DecisionOutcomeAssessment` objects. It does not
recalculate metric variance or mutate the Outcome aggregate. Portfolio-facing
reviews add assumption validation, retrospective narrative, and future guidance.

Review persistence is insert-only. A later assessment produces a new review ID
and assessment version. Learning records likewise append evidence-derived
versions rather than rewriting historical knowledge.

Execution readiness is resolved through canonical Platform Action decision
lineage. Authorization is resolved before decisions, reviews, or learning enter
the read projection.

