# FI-001A Financial Domain Walkthrough

## Automated checks

Run:

```sh
npm run typecheck
npm run lint
npm test
npm run build
git diff --check
```

The test suite covers currency precision and mismatch, period validation,
transaction immutability, ledger aggregation, measurement separation, snapshot
construction, evidence completeness, confidence and freshness propagation,
Workspace/Property scope, authorization-before-read, repository failure, cache
dimensions/invalidation, observability, and architecture boundaries.

## Manual verification

1. Build one Workspace identity with reporting currency, fiscal year, timezone,
   standards, and accounting method.
2. Add extensible revenue, expense, asset, liability, equity, and reserve
   accounts.
3. Post traced revenue and expense transactions for a current explicit period.
4. Request a Workspace snapshot and reconcile totals to posted ledger entries.
5. Request Portfolio and Property scope and confirm the same read-model shape.
6. Confirm measured, projected, forecast, and estimated values remain separate.
7. Remove expense evidence and confirm an explicit gap and reduced confidence.
8. Age synchronization beyond 72 hours and confirm stale freshness.
9. Verify Viewer receives summary only, Operator may request detail, and
   Administrator/Owner may request planning/administration capability.
10. Verify anonymous, cross-Workspace, and unassigned-property requests load no
    financial facts.
11. Confirm no presentation route directly references financial repositories.
12. Remove all temporary transactions and review runtime logs for unresolved
    Financial Domain or Read Model errors.
