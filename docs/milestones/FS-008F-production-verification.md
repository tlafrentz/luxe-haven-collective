# FS-008F — Controlled Production Verification

## Final status

Completed under the amended read-only evidence-substitution contract on correlation `a079ceaf-4791-4838-b214-23b13910e007`. The correlation is permanently retired: Production contains zero authorizations and zero claims for it. No activation change, catalog/import write, project/snapshot write, procurement write, or external effect occurred. FS-008G remains inactive.

The explicit limitation is `DIRECT_PRODUCTION_FURNISHING_LIFECYCLE_NOT_EXECUTED`.

## Direct Production preflight passes

- Candidate `3f730ba9b0f0b3194733cb01a2b91fa8fef2f2c7` was deployed as Ready deployment `dpl_3gdDmWkaAxN78UeoLYyvbCAMKAcA` at its immutable URL in Vercel project `prj_YTGVIQ11lGz57hEz4UJFX4hCnXPX`.
- Apex and `www` aliases resolve to the deployment; three consecutive `/api/health` checks returned HTTP 200 with `ok: true`.
- Supabase project `jumdtoraygqaraditnie` reported migration parity through `20260825052000`.
- Rollback deployment `dpl_BBonyFgEBqfUvJkTk4v6dYHfTcJ2` remains Ready.
- Recent logs contained no FS-008F, Furnishing RPC, or schema error. Unrelated Plaid webhook traffic was observed and was not attributed to FS-008F.
- The designated tenant is approved as `PS001D_VERIFICATION_ONLY_NON_CUSTOMER`, has zero customer/provider relationships and zero Furnishing catalog, snapshot, or procurement resources.
- Production has zero active verification claims, unresolved ledger entries, controlled cohorts, or enabled Furnishing capabilities.
- FS-008A remains disabled with the global kill switch enabled and configuration invalid.
- The preserved workbook SHA-256 matches `ba849761b7c54060a8e6a7c656c57e03a33a234dfe4233c1fb17902e1e304823`.

## Reused automated evidence

The existing FS-008D integration test parses exactly 110 `Catalog Review` rows and verifies canonical server-calculated Extended Cost handling. Existing FS-008A–E suites cover responsive/accessibility behavior, detailed persona denial, replay, concurrency, rollback, tenant isolation, formula policy, and provider/effect suppression. None of this reused evidence is represented as direct FS-008F Production execution.

## Evidence boundary and explicit limitation

1. Controlled Admin, owner, operator, and suspended/viewer identity rows exist, but no ordinary authenticated Admin, owner, or wrong-tenant session material is available to this runner. Only service-role access is configured, and it is not an acceptable substitute for `auth.uid()` or customer projection verification. FS-008F prohibits manufacturing sessions, password resets, impersonation, mailbox work, or a new identity initiative.
2. The reusable PS-001D ledger allowlists only `auth_identity`, `workspace_membership`, `property`, `booking`, `guest_communication`, `report_request`, `guidebook`, and `furnishing_project`. It cannot ledger the required activation snapshot, import rows, package items, products, offers, snapshot items, procurement baseline/lines, batch memberships, order lines, receipts, exceptions, or budget records.
3. The governed PS-001D cleanup operations explicitly reject unknown resource types and clean only property, booking, and workspace-access fixtures. They cannot perform or reconcile the required FS-008F dependency-ordered cleanup or byte-for-byte activation restoration.
4. The existing claim is fixed to milestone `PS-001D`, correlation prefix `ps001d-`, a five-scenario authorization set including operator, and lacks the required immutable deployment URL, Vercel project, Supabase project, migration ceiling, contract version, and evidence-directory bindings.

The original mutation contract could not safely use the PS-001D controls. Acquiring that claim would have misrepresented FS-008F and created resources its ledger and cleanup could not govern. No replacement framework was built because the amended contract authorizes evidence substitution and requires zero Production resources. Direct row manipulation was not used.

The following were not directly exercised in Production and are not represented as Production passes:

- Authenticated Admin approval
- Authenticated owner catalog/snapshot flow
- Wrong-tenant authenticated denial
- Controlled catalog/package activation
- Production snapshot creation
- Production procurement baseline, batch, external-order, receipt, and budget lifecycle
- Governed cleanup of those resources

The scenario-by-scenario mapping is recorded in `docs/evidence/FS-008F/a079ceaf-4791-4838-b214-23b13910e007/scenario-matrix.json`. Each row distinguishes direct Production read-only evidence, automated/local verification, and behavior not directly executed.

## Final reconciliation

Production remains at migration ceiling `20260825052000`; FS-008A is disabled, its global kill switch is enabled, and active controlled cohorts and enabled Furnishing capabilities are both zero. Catalog import runs/rows, approved package versions, snapshots/items, procurement baselines/lines, batches/memberships, external orders/lines, receipts/lines, budget adjustments, furnishing notifications, provider calls since the FS-008E deployment, and installation projects are all zero. Apex and `www` health checks pass, anonymous procurement routes redirect safely, the deployed candidate and aliases remain Ready, and rollback deployment `dpl_BBonyFgEBqfUvJkTk4v6dYHfTcJ2` remains available.

## Reused engineering gates

There is no application-source drift from deployed candidate `3f730ba9b0f0b3194733cb01a2b91fa8fef2f2c7`; FS-008F adds documentation and evidence only. The candidate's recorded green gates are reused without being represented as new Production execution: focused FS-006/FS-008E tests (25), full automated suite (795 files and 4,370 tests), typecheck, lint with zero errors, Production build, migration lint, platform compliance and migration analyzer (341 tests), two clean local migration resets, bounded PostgreSQL lifecycle/grant rehearsal, `git diff --check`, and secret/scope review. FS-008F separately reran JSON parsing, Prettier documentation checks, referenced-evidence existence checks, secret review, and `git diff --check` on the closure package.

## FS-008G dependency

FS-008G must acknowledge `DIRECT_PRODUCTION_FURNISHING_LIFECYCLE_NOT_EXECUTED`. Its first activation must use one internal controlled cohort, be strictly bounded and reversible, receive close monitoring, prohibit automated retailer ordering, and retain immediate kill-switch and rollback readiness.
