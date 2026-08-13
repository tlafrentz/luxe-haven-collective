# End-to-end remediation plan

Release is **NO-GO** until the completeness gate is rerun with controlled identities and non-mutating Stripe test fixtures.

1. Establish a disposable, production-shaped test environment with the eleven required roles, two tenants, seeded entitlement variants, revocation/expiry fixtures, and sanitized test content. Do not use production customer data.
2. Reconcile and independently attest all 18 approved Stripe price mappings in test and live modes. Keep publication blocked until tax registration, exact currency/amount/cadence, product/price active state, and webhook endpoints are verified.
3. Add a browser harness that enumerates the machine-readable route manifest, records console/network failures, captures failure screenshots, and covers desktop (1440×900) and mobile (390×844). Parameterize storage states by role.
4. Implement controlled commerce contract journeys for HPM monthly/annual and Growth properties; guidebook base/additional/hosting renewal; furnishing consultation/design approval/credit/add-ons; and Investment single/pack concurrent consumption. Use provider test clocks and test mode only.
5. Run hosted RLS/storage tests independently of UI hiding, including anonymous, wrong-tenant, revoked membership, revoked entitlement, cleaner, owner, and admin cases.
6. Close the Market-to-Investment and Guidebook parity gaps, then execute validation/error/success/retry/duplicate/stale/refresh/provider-unavailable states.
7. Run authenticated link crawl, accessibility/keyboard/contrast checks, metadata/canonical/sitemap/robots review, visual overflow/layout-shift checks, and dependency advisories.
8. Rerun all checks and require zero unknown items. Recalculate the manifest totals; only then reconsider GO status.

Exit criteria: 100% discovered route and control coverage, every required role/workflow/state/viewport evidenced, no P0/P1 findings, accepted disposition for P2/P3 findings, all 18 prices attested, and deferred offers proven unavailable and unpublished.
