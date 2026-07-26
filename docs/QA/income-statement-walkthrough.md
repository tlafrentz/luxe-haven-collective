# FI-001C Income Statement Walkthrough

## Automated validation

```sh
npm run typecheck
npm run lint
npm test
npm run build
git diff --check
```

Confirm the route manifest contains `/dashboard/financial/profitability`.

## Product validation

1. Reconcile Workspace revenue, Cost of Revenue, Operating Expense, Gross Profit
   where modeled, NOI, and margins to FI-001A.
2. Confirm capital expense, debt principal, owner distributions, and cash
   movement do not affect NOI.
3. Remove Cost of Revenue classification and confirm Gross Profit and Gross
   Margin are omitted.
4. Lower expense coverage below 80% and confirm expenses, NOI, and margins become
   unavailable rather than zero or 100%.
5. Confirm every uncategorized expense remains visible.
6. Reconcile Property totals to Workspace/Portfolio totals and market/model
   dimensions to authorized properties.
7. Test current month, quarter to date, year to date, custom, previous period,
   previous year, and no comparison.
8. Confirm near-zero baselines show absolute or unavailable variance rather than
   extreme percentages.
9. Verify rankings say Highest NOI, Highest Margin, Largest Revenue, Largest
   Expense, Largest Improvement, and Largest Decline—never best or worst.
10. Verify Owner and Administrator detail, Operator/Contributor/Viewer permitted
    summaries, assigned-property filtering, and denial for suspended, removed,
    other-Workspace, or anonymous principals.
11. Confirm restricted category details are absent from markup, accessibility
    output, totals, ranks, and cache scopes.
12. Test empty, partial, stale/degraded, permission-limited, currency, accounting
    basis, unavailable, and unexpected states.
13. Validate semantic headings, labels, keyboard controls, readable negative
    values, qualification announcements, reduced motion, one-column mobile flow,
    and no horizontal primary-content overflow.
14. Remove temporary data and review sanitized runtime logs for unresolved Income
    Statement or Profitability errors.
