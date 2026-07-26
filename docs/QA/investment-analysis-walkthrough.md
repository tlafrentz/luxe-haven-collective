# Investment Analysis Walkthrough

Validate both Purchase and Rental Arbitrage from `/dashboard/investments/new`.

1. Confirm the route selector preserves only compatible assumptions.
2. Enter a complete property address and required assumptions.
3. Verify readiness prevents an incomplete submission.
4. Run analysis and confirm Property, Market, Revenue, Expenses, Financing or Lease, Performance, Comparables, Risks, Score, Recommendation, Evidence, scenarios, and failure points.
5. Confirm component scores expose values, weights, and explanations totaling 100%.
6. Confirm evidence limitations, confidence, freshness, and run lineage are visible.
7. Change an assumption and verify the existing result is labeled stale and cannot be saved.
8. Re-run and save the exact result as a new or existing Opportunity.
9. Exercise provider, ambiguous-property, partial-evidence, keyboard, screen-reader, tablet, and mobile states.
10. Run typecheck, lint, relevant tests, full tests, production build, route validation, and `git diff --check`.
