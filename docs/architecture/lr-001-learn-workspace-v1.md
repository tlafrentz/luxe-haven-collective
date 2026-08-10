# LR-001 Learn Workspace v1

LR-001 extends the canonical Platform Learning capability. It keeps normalized signals, explainable patterns, candidates, and approved lesson versions distinct. It does not create recommendations or mutate operating policy.

## Boundaries

- EX-002 supplies versioned finalized, inconclusive, and not-measurable outcomes through `FinalizedOutcomeLearningSource`.
- LR-001 records an immutable `LearningSignal` for each source version. Reopened sources require explicit invalidation and reevaluation; historical signals are never rewritten.
- Deterministic policies propose confidence and evidence strength while accounting for contradictions, source amendments, data quality, property breadth, and prospective measurement.
- Human review remains mandatory before a lesson becomes approved organizational knowledge.
- LR-002 consumes only the `ApprovedLearning` boundary. Draft, rejected, needs-reevaluation, superseded, retired, and archived records are excluded from current guidance.

## Authorization

Learning records retain every applicable property ID. RLS requires access to the workspace and every property represented by the record. A broad lesson therefore cannot leak source details from a property the viewer cannot access.

The migration remains unapplied until application commands, repositories, composition, and non-production PostgreSQL RLS tests are complete.
