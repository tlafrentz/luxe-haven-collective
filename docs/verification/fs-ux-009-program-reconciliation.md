# FS-UX-009 program reconciliation

Classification: `FS-UX-009_PROGRAM_RECONCILIATION_BLOCKED_CLEAN`

## Candidate boundary

- Required and observed starting commit: `afe0f7f1c482157b26c0ddde7e67533d3df5face`.
- Starting branch: `fs008g-c8-finalization`.
- Starting working tree: clean (`git status --short --branch` reported only the branch header).
- Final deployment-ready candidate: not issued. This run did not satisfy the integrated database and browser certification gates.
- Intermediate correction commits: none. No FS-UX-001–008 reconciliation defect was demonstrated by the runnable gates.
- Production migration ceiling: `20260829010000`.
- Production state: unchanged. No Production connection, migration, configuration change, release tag, deployment, or external action was attempted.
- Local database state: unavailable before mutation. The configured Docker endpoint `.colima/default/docker.sock` did not exist, so no controlled database fixture was created and no local database mutation occurred.

## Precise hold contract and atomic state

The required exact-ceiling and clean-database integration proof could not start because the local Docker/Postgres runtime was unavailable:

```text
failed to connect to the docker API at unix:///Users/toddl/.colima/default/docker.sock:
connect: no such file or directory
```

This blocks fresh authoritative proof of the complete public-boundary lifecycle, authenticated-session/RLS matrix, independent-session concurrency, audit-failure rollback, migration replay and deterministic schema equivalence, controlled cleanup, and protected-baseline comparison. The failure occurred before fixture capture or mutation. There was no downstream, external, or partial database effect to reconcile. The required bounded correction is environmental: provide the repository's local Supabase Docker/Postgres runtime at the expected endpoint, then rerun FS-UX-009 from this starting candidate. No product-code correction is justified by this result.

## Migration inventory and digests

The complete committed forward inventory after the Production ceiling was read without modification. SHA-256 digests are:

| Migration | SHA-256 |
| --- | --- |
| `20260829020000_fs008g_c8a_catalog_package_governance.sql` | `414df501890015be632f5a4fa3f8cbecfe151463b2c8d54775e3f0bac2b3baf0` |
| `20260829030000_fs008g_c8b_owner_selection_snapshot.sql` | `a09eaa3fd01814fb662ab9b25d2bdc262eb7a6ccebfe1be91b5c2b7abbfd0f1d` |
| `20260829040000_fs008g_c8c_procurement_cleanup.sql` | `1d629e75c3c51737b1a1fe63624fd94aa3ae8fd316bf5c82d68c30d0ad158c07` |
| `20260829050000_fs008g_c8d_workspace_native_import.sql` | `c31923754dc89c423c34c0b9cf559811fe8fcbb07913ea7c0914972d0f39ba36` |
| `20260829051000_fs008g_c8d_requirement_review_state.sql` | `7ebcb61396e1290e99d9f23da0cf15ee12b14b035c6668bfdb7ebbc725666137` |
| `20260830090000_fs_ux_002_catalog_lifecycle.sql` | `b3175e282cf8edf9b11377f96c2ea6e6c8352d28d60da24addaf2055c4200929` |
| `20260830100000_fs_ux_003_inventory_import_workflow.sql` | `a269518d969c942a4fc6569c487fdb277a68f23fca339a6e40bcc024a3981e2b` |
| `20260830110000_fs_ux_004_room_packages.sql` | `97642e5991375feb234f6f1c08d11a936d492ef9f8d60d6bfcf8cdf53a181f25` |
| `20260830120000_fs_ux_005_design_workspaces_budgets.sql` | `e5ab26ca8c12d9ee8b0bfc6b8f2e3ea875d703ae3de636a06f9ebe78b8bb2652` |
| `20260830130000_fs_ux_006_procurement_readiness.sql` | `d99c32d38f1914397e8f8d850c47a1a040b2d62b186308ee2625ccf1c3d08dba` |
| `20260830140000_fs_ux_007_delivery_installation_tracking.sql` | `42e0821f97605be9292cfe010c684289d1a41731d9d891ea36642698c2c90c5a` |
| `20260830150000_fs_ux_008_release_controls.sql` | `9eca483b7977c30e910074ae138e7c79287b882bb51081ac2c26efc60d62b75f` |
| `20260830151000_fs_ux_008_control_orchestration.sql` | `f06aad6d71f31f3c76ea46c6c8b2d902a4509b5707b1310de492c7eb7fe7089a` |

The two required FS-UX-008 digests match `docs/verification/fs-ux-008-local-hold-point.md`. No migration was edited. Migration lint passed with no findings. Applying, replaying, and comparing the sequence were blocked by the unavailable database runtime.

## Route and navigation inventory

The production build emitted the canonical dynamic routes and their governed descendants:

| Area | Canonical route | Build result | Navigation parent |
| --- | --- | --- | --- |
| Overview | `/admin/furnishing` | emitted | Overview |
| Catalog | `/admin/furnishing/catalog` | emitted | Product Catalog |
| Imports | `/admin/furnishing/imports` | emitted | Imports |
| Room Packages | `/admin/furnishing/room-packages` | emitted | Room Packages |
| Design Workspaces | `/admin/furnishing/workspaces` | emitted | Design Workspaces |
| Budgets | `/admin/furnishing/budgets` | emitted | Budgets |
| Procurement | `/admin/furnishing/procurement` | emitted | Procurement |
| Installations | `/admin/furnishing/installations` | emitted | Installations |
| Release Controls | `/admin/furnishing/release-controls` | emitted | Release Controls |
| Settings | `/admin/furnishing/settings` | emitted | Settings |

Static navigation tests pass and verify canonical order, links, prefix ownership, legacy route parentage, focus restoration, dialog trapping, Escape behavior, visible focus styles, 44-pixel-equivalent targets, and canonical breadcrumbs. The build also emitted legacy `/admin/furnishing/activation`, `/admin/furnishing/installation`, `/admin/furnishing/products`, `/admin/furnishing/packages`, and `/admin/furnishing/projects` surfaces. Authenticated direct-load, refresh, redirects, filter/return preservation, and responsive browser behavior were not freshly exercised because the required controlled identities and database were unavailable.

## Contract reconciliation

Read-only inspection and the focused suite found no divergence requiring mutation:

- Domain states are sourced from the implemented database/server vocabulary; focused migration/domain tests cover catalog adoption, import replay and revision, package review, furnishing-only workspaces, immutable design/budget snapshots, inert procurement readiness, installation evidence, and governed release controls.
- Committed lineage contracts cover import row to revision, platform adoption, package versions, design/budget snapshots, procurement snapshots, installation evidence, and release-control audit events.
- Server actions are treated as directly reachable and perform server-side authorization; the repository uses server-only action boundaries and authoritative RPCs rather than UI visibility as authority.
- The Overview reads authoritative projections and reports partial projection failures independently.

These are code and static-test findings, not a substitute for the missing integrated database lifecycle.

## Authorization matrix

| Principal | Static/focused coverage | Fresh database/browser result |
| --- | --- | --- |
| Workspace owner | server and migration contracts pass | blocked |
| Delegated operator | delegated release-control/RLS contracts pass | blocked |
| Reviewer/approver | review boundary contracts pass | blocked |
| Wrong-workspace authenticated user | fail-closed contracts pass | blocked |
| Authenticated user without furnishing permission | fail-closed contracts pass | blocked |
| Suspended/revoked user | suspension contracts pass | blocked |
| Platform administrator | explicit admin boundary contracts pass | blocked |
| Anonymous user | direct denial contracts pass | blocked |

The FS-UX-007 and FS-UX-008 predecessor records report database-executed matrices at their own candidates. FS-UX-009 does not relabel those historical results as a fresh integrated run.

## Lifecycle, concurrency, atomicity, and release controls

No new controlled lifecycle was started. Consequently no synthetic product, import, package, design workspace, budget, procurement baseline, receipt, installation event, completion snapshot, capability transition, suspension, recovery, rollback, notification, payment, shipment, retailer order, or external provider effect was created.

Focused tests passed for the individual lifecycle contracts. Historical predecessor evidence reports import/package concurrency, installation receipt/completion concurrency, cleanup concurrency, release-control suspension precedence, stale-state rejection, immutable history, and audit-persistence rollback. Fresh FS-UX-009 independent-session execution and cross-milestone reconciliation remain blocked.

## Cleanup and protected baseline

- Starting protected records and controlled fixture counts: not captured because the database was unavailable before mutation.
- Synthetic FS-UX-009 records created: zero.
- Cleanup required: none.
- Cleanup attempted: no.
- External effects: zero; no external integration was invoked.
- Production baseline: unchanged by this local run.
- Local protected-baseline equality: cannot be asserted without the unavailable database.

The atomic reconciliation state is therefore clean and bounded: repository unchanged except for this evidence document, no database was reached, and no lifecycle or external effect began.

## Validation results

| Gate | Result |
| --- | --- |
| Starting repository suite | passed: 4,634/4,634 tests across 847 files |
| FS-UX-focused suite | passed: 267/267 tests across 55 files |
| Typecheck | passed |
| Full ESLint | passed with zero errors and nine unchanged warnings |
| Migration lint | passed: no findings |
| Production build | passed; 290 static pages generated and all canonical Furnishing Studio routes emitted |
| Route/navigation static contract | passed |
| `git diff --check` | passed |
| Exact-ceiling migration sequence | blocked: local Docker/Postgres unavailable |
| Clean-database migration sequence and schema equivalence | blocked: local Docker/Postgres unavailable |
| Public-boundary integrated lifecycle | blocked: controlled database/identities unavailable |
| Fresh authorization/RLS matrix | blocked: controlled database/identities unavailable |
| Fresh independent-session concurrency suite | blocked: controlled database unavailable |
| Fresh immutable-history and forced-audit-failure reconciliation | blocked: controlled database unavailable |
| Desktop/mobile authenticated accessibility run | blocked: controlled application identities/database unavailable |
| Protected-baseline comparison | blocked: local database unavailable before capture |
| Ending clean-tree verification | required after the evidence commit; no deployment-ready candidate is issued |

The unchanged warnings are the same nine enumerated by ESLint and the FS-UX-008 record: one each in `generate-end-to-end-audit.mjs`, `verify-fs008g-c8-browser.ts`, `furnishing-navigation.tsx`, `project-workspace-v1.tsx`, `supabase-ca001b-lifecycle.ts`, `furnishing-delivery-envelope.ts`, and `standard-report-administration.ts`, plus two in `furnishing-property-resolution.test.ts`.

## Residual risks and disposition

The material residual risk is absence of new integrated runtime evidence, not a known code defect. Static and predecessor evidence cannot prove that the complete current candidate migrates deterministically and operates end to end under real RLS, concurrent sessions, controlled cleanup, and browser interaction. Certification must remain on hold until those gates run from the exact Production ceiling against two clean local databases and the protected baseline is restored exactly.

Deployment recommendation: **HOLD**. Do not deploy, tag, migrate Production, change Production configuration, or activate capabilities from this result. Resume with the expected local Supabase Docker/Postgres runtime available and restart at the pre-mutation baseline-capture stage.

## Continuation from the environmental hold

The existing FS-UX-009 milestone resumed from evidence commit `e7bb5e4e3fece3854458bf956d9b399b52bba9c4` after the local Colima endpoint became healthy. The original blocked attempt above remains the immutable record of the pre-execution stop; this continuation does not replace it.

### Resumed environment and bounded corrections

- Repository preflight: `e7bb5e4e3fece3854458bf956d9b399b52bba9c4`, clean tree.
- Docker context and endpoint: `colima`, `unix:///Users/toddl/.colima/default/docker.sock`.
- Docker engine: `29.5.2`; local Supabase Postgres and supporting containers healthy.
- Production ceiling reconfirmed as `20260829010000`; Production was not connected to or changed.
- All previously recorded post-ceiling digests remained unchanged.
- `fdc7ed44495ac310d26106e7722f3262901e7314` adds forward-only migration `20260830152000_fs_ux_009_controlled_fixture_service_grants.sql` after a clean database demonstrated that the guarded local lifecycle provisioner could not create its controlled customer fixture because `service_role` lacked DML on `customer_accounts`, `customer_account_memberships`, and `commercial_entitlements`.
- `d1d215765c810d3ddb9de171a4c39c11f84e98af` corrects dependency-safe controlled fixture cleanup after retries demonstrated style-system and unbound-designation foreign-key blockers.
- New migration SHA-256: `f048d1e0904aa323deec813401533994d1fbbb61cf562375ef03df47809cc74e`.
- No existing migration was edited.

Both defects occurred in controlled test setup/cleanup. The first stopped before a customer account, property, furnishing project, or lifecycle artifact existed. The second occurred while reconciling the pre-lifecycle fixture. No external or Production effect occurred.

### Resumed database results

| Gate | Continuation result |
| --- | --- |
| Exact Production-ceiling forward sequence through `20260830152000` | passed |
| Production-derived 109-product/220-row/three-package assertions | passed |
| Migration replay | passed: zero pending migrations |
| Two clean-database rebuilds | passed |
| Normalized schema equivalence | passed: both SHA-256 `7fc51cd970189a232748f3f0b8a0bc49ac9c2c17aeaf1bb8f1b57de0c3f4d346` |
| FS-UX-003–008 database lifecycle matrices | passed |
| Direct authorization and RLS matrices | passed |
| Independent-session concurrency and stale-state matrices | passed |
| Release-control suspension precedence and recovery | passed |
| Forced audit-persistence rollback | passed |
| Governed cleanup negative/concurrency matrices | passed |
| Controlled pre-lifecycle fixture cleanup retry | passed: `resources: 0` |

PostgreSQL 17 emits a random `\\restrict`/`\\unrestrict` safety token in each text dump. Raw dumps differed only on those two non-schema lines. Removing only those tokens produced byte-identical 64,953-line schema dumps and the digest above.

### Resumed code gates

| Gate | Continuation result |
| --- | --- |
| Complete repository suite | passed: 4,638/4,638 across 848 files |
| FS-UX-009 focused regression suite | passed: 4/4 |
| Typecheck | passed |
| Full ESLint | passed with zero errors and the same nine warnings |
| Migration lint | passed: no findings |
| Production build | passed; 290 static pages generated and canonical Furnishing Studio routes emitted |
| `git diff --check` | passed |

### Current bounded hold

The integrated authenticated browser lifecycle remains unproven. Authentication succeeded locally using synthetic local-only CAPTCHA configuration, but the browser run stopped at its first activation stage because `scripts/verification/verify-fs008g-c8-browser.ts` still expects the retired FS-008G controls and a `Required reason` field on `/admin/furnishing/activation`. FS-UX-008 intentionally redirects that legacy route to `/admin/furnishing/release-controls`, whose governed server-verification sequence is materially different. The database-authoritative FS-UX-008 lifecycle and concurrency proofs pass, but they do not substitute for the required current browser, accessibility, responsive-layout, and complete isolated end-to-end lifecycle pass.

The browser stop occurred before catalog import or any furnishing lifecycle mutation. The controlled fixture was cleaned to zero resources under retry. The final local database was rebuilt cleanly through `20260830152000`. No purchase, retailer order, shipment, payment, notification, carrier, installer, or irreversible provider effect occurred.

Current classification remains `FS-UX-009_PROGRAM_RECONCILIATION_BLOCKED_CLEAN`. No deployment candidate is issued. The required bounded next correction is a current FS-UX-009 browser lifecycle/accessibility harness aligned to the feature-frozen FS-UX-008 release-control routes and server-verification contracts; application behavior must not be changed merely to satisfy the obsolete FS-008G harness. Deployment recommendation remains **HOLD**.
