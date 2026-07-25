# Portfolio Composition QA Walkthrough

1. Open `/dashboard/portfolio/composition` as full-workspace and assigned users.
2. Verify no inaccessible property affects counts, shares, distributions, or
   concentration.
3. Reconcile property, market, type, model, revenue, and booking distributions.
4. Verify every concentration card names basis, leading share, threshold,
   evidence, confidence, and freshness.
5. Exercise previous-period, previous-year, and no-comparison states.
6. Verify new, removed, archived, and shifted history facts.
7. Verify no-property, one-property, assigned, stale/degraded,
   insufficient-evidence, missing booking-source, loading, and error states.
8. At mobile width verify sections stack. Confirm every visual distribution has
   a semantic table equivalent and all controls are keyboard accessible.
9. Confirm runtime logs contain no raw financial values or inaccessible names.
