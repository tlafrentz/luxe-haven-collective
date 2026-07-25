# Portfolio Property Comparison QA Walkthrough

1. Open `/dashboard/portfolio/properties` as Owner, Administrator, Operator,
   Contributor, and Viewer.
2. Verify assigned roles see only assigned property names, totals, shares,
   rankings, medians, and evidence.
3. Verify Contributor and Viewer markup contains no NOI, margin, cash-flow, or
   financial ranking order.
4. Exercise period, comparison, family, normalization, grouping, view, and sort.
5. Reconcile revenue, booking, available-night, workload, and change
   contributions.
6. Verify Improving, Stable, Declining, Mixed, New, and Insufficient Evidence.
7. Verify ties, no-eligible ranking, one-property, no-property, partial-period,
   stale/degraded, missing-financial, assigned, detail, loading, and error states.
8. At 375px confirm property cards replace the desktop table. At 1024px confirm
   semantic table headers, readable units, visible focus, and keyboard controls.
9. Confirm logs contain IDs/counts/policy context only, never financial values or
   inaccessible property names.
