# Investment Decision Analysis

`/dashboard/investments/new` is the canonical PC-001A workflow for Purchase and Rental Arbitrage underwriting.

The experience resolves a property, consumes bounded Market evidence, captures route-specific assumptions, and generates one inspectable decision containing financial performance, comparables, risks, score, recommendation, evidence, scenarios, and calculation lineage. Purchase and Rental Arbitrage share navigation and presentation, but retain separate domain models and metrics.

The workflow never presents an unexplained “buy” instruction. Recommendation, confidence, evidence limitations, component scores and weights, risks, mitigations, and next actions remain visible. A current result can be saved as an Opportunity without recalculation; the save token preserves the exact calculation lineage.

Presentation states include setup, readiness, analysis in progress, no result, stale assumptions, typed failure, partial/degraded evidence, and current result. Provider failure preserves entered assumptions.
