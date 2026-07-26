# FI-001B Financial Overview Walkthrough

## Automated gate

```sh
npm run typecheck
npm run lint
npm test
npm run build
git diff --check
```

Confirm the build route manifest contains `/dashboard/financial`.

## Product walkthrough

1. Open Financial Intelligence as Owner, Administrator, Operator, Contributor,
   and Viewer; confirm scope and fields reflect each capability.
2. Confirm suspended, removed, anonymous, other-Workspace, and unassigned-property
   requests load no financial facts.
3. Exercise this month, last month, quarter to date, year to date, trailing 12
   months, custom, previous period, previous year, Budget, Forecast, and no
   comparison.
4. Confirm basis, currency, scope, property count, period, comparison, evaluated
   time, confidence, and freshness remain visible.
5. Reconcile revenue and operating expenses to FI-001A; verify capex and debt
   principal do not reduce NOI.
6. Remove expenses and confirm expense, NOI, and margin become unavailable—not
   zero, revenue, or 100%.
7. Remove cash and confirm liquidity is unavailable and never inferred from NOI.
8. Confirm sourced negative cash movement can coexist with positive NOI.
9. Verify zero comparison values display a new/absolute change, not an extreme
   percentage.
10. Confirm no more than five material changes and that reclassification/data
    changes are not described as economic causes.
11. Verify authorized property contributions reconcile without leaking excluded
    ranks or totals.
12. Verify unavailable obligations and plans use intentional empty states.
13. Confirm Decisions and Actions link to canonical Platform records and keep
    proposed, approved, committed, and spent distinct.
14. Test keyboard labels, semantic headings, status without color, reduced
    motion, screen-reader currency/qualification, one-column mobile flow, and no
    horizontal primary-content overflow.
15. Trigger permission, currency, basis, unavailable, and unexpected errors and
    inspect typed messages and sanitized logs.
16. Remove temporary data and confirm runtime logs contain no unresolved
    Financial Overview errors.
