# Investment analysis experience hardening (II-009)

## Boundary

II-009 keeps underwriting, score, recommendation, confidence, risk, evidence, and threshold semantics in Investment Intelligence. Presentation consumes focused application projections for numeric policies, assumption guidance, preliminary metrics, readiness, fingerprints, and strategy transitions. It does not create an alternative analysis model.

## Numeric draft boundary

`InvestmentNumericInput` owns editable text, including blank and incomplete decimals. `normalizeNumericAssumptionDraft` commits only on blur or Enter and applies the field’s canonical precision and range policy. Workspace state therefore continues to contain normalized business numbers, while keystrokes such as an empty string, `.`, or `0.` are never coerced into zero or `NaN`. All analyzer numeric controls use text inputs with numeric or decimal input modes.

A deterministic assumption fingerprint contains only analysis-relevant normalized values. Committing a changed assumption invalidates the save token immediately and marks an existing result stale. The old report may remain visible as labeled reference material, but Opportunity saving requires a current result and token.

## Strategy transitions

Property identity and physical characteristics are the only fields preserved across strategies. Purchase-specific, rental-specific, and route-dependent operating drafts are reset to the destination defaults. Dirty drafts and existing results require an accessible confirmation dialog. Confirming clears result, token, error, alternatives, and incompatible reanalysis context; updates the URL; and initializes a clean route. The `strategy` query parameter is server-readable on refresh, and `popstate` applies the same clean transition for browser history.

Reanalysis remains route-fixed for saving a new version. Switching strategy intentionally removes the `opportunity` and `mode=reanalyze` context from the URL, so the next result can only be saved as a compatible new opportunity.

## Preliminary versus canonical analysis

`buildPreliminaryFinancialPreview` provides exactly seven responsive metrics with formula, input values, threshold explanation, rationale, source label, status text, and deterministic improvement direction. Thresholds live beside the canonical preview calculation, not in components. Rental terminology uses “NOI before lease” and “Return on initial cash”; purchase uses NOI and cash-on-cash return.

The preview never emits a recommendation, Investment Score, or confidence. The hierarchy is Assumptions → Preliminary Financial Preview → readiness → Run Full Investment Analysis → Full Investment Decision Analysis → Save Opportunity. A stale result is non-savable.

## Readiness and errors

`buildInvestmentAnalysisReadiness` separates preview and full-analysis capability and returns stable issues for missing groups or unavailable Market evidence. Server actions translate configuration and provider failures into operator-safe messages and preserve normalized assumptions. Execution is single-flight in the client, stale responses are ignored by request sequence, and failed execution never produces a save token or Opportunity analysis.

## Expense compatibility

The companion [expense decision](./investment-expense-assumptions.md) records why the existing blended model is clarified rather than silently expanded. No durable schema changed, so II-009 requires no migration and historical Opportunity snapshots remain byte-for-byte semantically stable.

## Validation source

The II-009 milestone specification and its original operator test report define the observed failures: leading zeroes, unclear startup and fee fields, unexplained statuses, ambiguous full-analysis state, route leakage, and the seven-card layout. The deterministic Fort Worth fixture captures only the supplied facts and does not invent missing property or financial values.
