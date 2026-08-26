# FS-008F — Controlled Production Verification

## Current status

`STOPPED_BEFORE_CLAIM` on correlation `a079ceaf-4791-4838-b214-23b13910e007`. This is a historical preflight attempt, not the final authoritative run. No scenario authorization, claim, activation change, catalog/import write, project/snapshot write, procurement write, or external effect occurred. `FS-008F-complete` was not created and FS-008G remains inactive.

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

## Pre-claim blockers

1. Controlled Admin, owner, operator, and suspended/viewer identity rows exist, but no ordinary authenticated Admin, owner, or wrong-tenant session material is available to this runner. Only service-role access is configured, and it is not an acceptable substitute for `auth.uid()` or customer projection verification. FS-008F prohibits manufacturing sessions, password resets, impersonation, mailbox work, or a new identity initiative.
2. The reusable PS-001D ledger allowlists only `auth_identity`, `workspace_membership`, `property`, `booking`, `guest_communication`, `report_request`, `guidebook`, and `furnishing_project`. It cannot ledger the required activation snapshot, import rows, package items, products, offers, snapshot items, procurement baseline/lines, batch memberships, order lines, receipts, exceptions, or budget records.
3. The governed PS-001D cleanup operations explicitly reject unknown resource types and clean only property, booking, and workspace-access fixtures. They cannot perform or reconcile the required FS-008F dependency-ordered cleanup or byte-for-byte activation restoration.
4. The existing claim is fixed to milestone `PS-001D`, correlation prefix `ps001d-`, a five-scenario authorization set including operator, and lacks the required immutable deployment URL, Vercel project, Supabase project, migration ceiling, contract version, and evidence-directory bindings.

Acquiring or consuming that claim would therefore misrepresent the FS-008F contract and create resources that cannot be governed or cleaned. Direct row manipulation is prohibited. The run stopped before claim acquisition as required.

## Explicit evidence-substitution amendment proposal

Amend FS-008F once, narrowly, as follows:

> Accept the completed read-only Production preflight, migration/activation/zero-state reconciliation, authoritative workbook hash, and existing FS-008A–E automated PostgreSQL lifecycle evidence in place of direct Production PV-01 through PV-11. Waive the fresh Production claim and synthetic resource mutation requirements for FS-008F only. Require a final read-only reconciliation showing the same zero state, retain this preflight package as the authoritative evidence, and prohibit creating any Production catalog, snapshot, procurement, order, receipt, budget, notification, provider, payment, or installation record. Ordinary-session customer projection and persona results remain explicitly automated evidence, not direct Production passes.

This amendment avoids a new verification framework, identity provisioning, and unsafe unledgered cleanup. Without explicit approval of this amendment, FS-008F remains incomplete and a future direct run requires a new bounded correction candidate/deployment that extends the existing claim/ledger/cleanup controls before a fresh correlation is created.
