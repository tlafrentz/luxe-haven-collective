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

| Migration                                                          | SHA-256                                                            |
| ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| `20260829020000_fs008g_c8a_catalog_package_governance.sql`         | `414df501890015be632f5a4fa3f8cbecfe151463b2c8d54775e3f0bac2b3baf0` |
| `20260829030000_fs008g_c8b_owner_selection_snapshot.sql`           | `a09eaa3fd01814fb662ab9b25d2bdc262eb7a6ccebfe1be91b5c2b7abbfd0f1d` |
| `20260829040000_fs008g_c8c_procurement_cleanup.sql`                | `1d629e75c3c51737b1a1fe63624fd94aa3ae8fd316bf5c82d68c30d0ad158c07` |
| `20260829050000_fs008g_c8d_workspace_native_import.sql`            | `c31923754dc89c423c34c0b9cf559811fe8fcbb07913ea7c0914972d0f39ba36` |
| `20260829051000_fs008g_c8d_requirement_review_state.sql`           | `7ebcb61396e1290e99d9f23da0cf15ee12b14b035c6668bfdb7ebbc725666137` |
| `20260830090000_fs_ux_002_catalog_lifecycle.sql`                   | `b3175e282cf8edf9b11377f96c2ea6e6c8352d28d60da24addaf2055c4200929` |
| `20260830100000_fs_ux_003_inventory_import_workflow.sql`           | `a269518d969c942a4fc6569c487fdb277a68f23fca339a6e40bcc024a3981e2b` |
| `20260830110000_fs_ux_004_room_packages.sql`                       | `97642e5991375feb234f6f1c08d11a936d492ef9f8d60d6bfcf8cdf53a181f25` |
| `20260830120000_fs_ux_005_design_workspaces_budgets.sql`           | `e5ab26ca8c12d9ee8b0bfc6b8f2e3ea875d703ae3de636a06f9ebe78b8bb2652` |
| `20260830130000_fs_ux_006_procurement_readiness.sql`               | `d99c32d38f1914397e8f8d850c47a1a040b2d62b186308ee2625ccf1c3d08dba` |
| `20260830140000_fs_ux_007_delivery_installation_tracking.sql`      | `42e0821f97605be9292cfe010c684289d1a41731d9d891ea36642698c2c90c5a` |
| `20260830150000_fs_ux_008_release_controls.sql`                    | `9eca483b7977c30e910074ae138e7c79287b882bb51081ac2c26efc60d62b75f` |
| `20260830151000_fs_ux_008_control_orchestration.sql`               | `f06aad6d71f31f3c76ea46c6c8b2d902a4509b5707b1310de492c7eb7fe7089a` |
| `20260830152000_fs_ux_009_controlled_fixture_service_grants.sql`   | `f048d1e0904aa323deec813401533994d1fbbb61cf562375ef03df47809cc74e` |
| `20260830153000_fs_ux_009_anonymous_catalog_verification.sql`      | `1212c828d34a8a8b9c1571fc8d513a44e2c3a90fe5e8d704535f8f4bba8a87b2` |
| `20260830154000_fs_ux_009_procurement_guard_verification.sql`      | `9540fd160518442633caae50ddc5f7763508480747ebb4f940ea6183afec0b40` |
| `20260830155000_fs_ux_009_release_permission_fixture_boundary.sql` | `9c2983158d119d937052ce794b0c96f548fa34cf3ef64f0fa8753e80db7aecea` |
| `20260830156000_fs_ux_009_release_control_read_boundary.sql`       | `c307b0a1ebbb810d9cfb4e8e1bb8a7229937e26962fae2db4ac72eca8ce65383` |

The two required FS-UX-008 digests match `docs/verification/fs-ux-008-local-hold-point.md`. No migration was edited. Migration lint passed with no findings. Applying, replaying, and comparing the sequence were blocked by the unavailable database runtime.

## Route and navigation inventory

The production build emitted the canonical dynamic routes and their governed descendants:

| Area              | Canonical route                      | Build result | Navigation parent |
| ----------------- | ------------------------------------ | ------------ | ----------------- |
| Overview          | `/admin/furnishing`                  | emitted      | Overview          |
| Catalog           | `/admin/furnishing/catalog`          | emitted      | Product Catalog   |
| Imports           | `/admin/furnishing/imports`          | emitted      | Imports           |
| Room Packages     | `/admin/furnishing/room-packages`    | emitted      | Room Packages     |
| Design Workspaces | `/admin/furnishing/workspaces`       | emitted      | Design Workspaces |
| Budgets           | `/admin/furnishing/budgets`          | emitted      | Budgets           |
| Procurement       | `/admin/furnishing/procurement`      | emitted      | Procurement       |
| Installations     | `/admin/furnishing/installations`    | emitted      | Installations     |
| Release Controls  | `/admin/furnishing/release-controls` | emitted      | Release Controls  |
| Settings          | `/admin/furnishing/settings`         | emitted      | Settings          |

Static navigation tests pass and verify canonical order, links, prefix ownership, legacy route parentage, focus restoration, dialog trapping, Escape behavior, visible focus styles, 44-pixel-equivalent targets, and canonical breadcrumbs. The build also emitted legacy `/admin/furnishing/activation`, `/admin/furnishing/installation`, `/admin/furnishing/products`, `/admin/furnishing/packages`, and `/admin/furnishing/projects` surfaces. Authenticated direct-load, refresh, redirects, filter/return preservation, and responsive browser behavior were not freshly exercised because the required controlled identities and database were unavailable.

## Contract reconciliation

Read-only inspection and the focused suite found no divergence requiring mutation:

- Domain states are sourced from the implemented database/server vocabulary; focused migration/domain tests cover catalog adoption, import replay and revision, package review, furnishing-only workspaces, immutable design/budget snapshots, inert procurement readiness, installation evidence, and governed release controls.
- Committed lineage contracts cover import row to revision, platform adoption, package versions, design/budget snapshots, procurement snapshots, installation evidence, and release-control audit events.
- Server actions are treated as directly reachable and perform server-side authorization; the repository uses server-only action boundaries and authoritative RPCs rather than UI visibility as authority.
- The Overview reads authoritative projections and reports partial projection failures independently.

These are code and static-test findings, not a substitute for the missing integrated database lifecycle.

## Authorization matrix

| Principal                                        | Static/focused coverage                      | Fresh database/browser result |
| ------------------------------------------------ | -------------------------------------------- | ----------------------------- |
| Workspace owner                                  | server and migration contracts pass          | blocked                       |
| Delegated operator                               | delegated release-control/RLS contracts pass | blocked                       |
| Reviewer/approver                                | review boundary contracts pass               | blocked                       |
| Wrong-workspace authenticated user               | fail-closed contracts pass                   | blocked                       |
| Authenticated user without furnishing permission | fail-closed contracts pass                   | blocked                       |
| Suspended/revoked user                           | suspension contracts pass                    | blocked                       |
| Platform administrator                           | explicit admin boundary contracts pass       | blocked                       |
| Anonymous user                                   | direct denial contracts pass                 | blocked                       |

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

| Gate                                                            | Result                                                                                |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Starting repository suite                                       | passed: 4,634/4,634 tests across 847 files                                            |
| FS-UX-focused suite                                             | passed: 267/267 tests across 55 files                                                 |
| Typecheck                                                       | passed                                                                                |
| Full ESLint                                                     | passed with zero errors and nine unchanged warnings                                   |
| Migration lint                                                  | passed: no findings                                                                   |
| Production build                                                | passed; 290 static pages generated and all canonical Furnishing Studio routes emitted |
| Route/navigation static contract                                | passed                                                                                |
| `git diff --check`                                              | passed                                                                                |
| Exact-ceiling migration sequence                                | blocked: local Docker/Postgres unavailable                                            |
| Clean-database migration sequence and schema equivalence        | blocked: local Docker/Postgres unavailable                                            |
| Public-boundary integrated lifecycle                            | blocked: controlled database/identities unavailable                                   |
| Fresh authorization/RLS matrix                                  | blocked: controlled database/identities unavailable                                   |
| Fresh independent-session concurrency suite                     | blocked: controlled database unavailable                                              |
| Fresh immutable-history and forced-audit-failure reconciliation | blocked: controlled database unavailable                                              |
| Desktop/mobile authenticated accessibility run                  | blocked: controlled application identities/database unavailable                       |
| Protected-baseline comparison                                   | blocked: local database unavailable before capture                                    |
| Ending clean-tree verification                                  | required after the evidence commit; no deployment-ready candidate is issued           |

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

| Gate                                                               | Continuation result                                                                     |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| Exact Production-ceiling forward sequence through `20260830152000` | passed                                                                                  |
| Production-derived 109-product/220-row/three-package assertions    | passed                                                                                  |
| Migration replay                                                   | passed: zero pending migrations                                                         |
| Two clean-database rebuilds                                        | passed                                                                                  |
| Normalized schema equivalence                                      | passed: both SHA-256 `7fc51cd970189a232748f3f0b8a0bc49ac9c2c17aeaf1bb8f1b57de0c3f4d346` |
| FS-UX-003–008 database lifecycle matrices                          | passed                                                                                  |
| Direct authorization and RLS matrices                              | passed                                                                                  |
| Independent-session concurrency and stale-state matrices           | passed                                                                                  |
| Release-control suspension precedence and recovery                 | passed                                                                                  |
| Forced audit-persistence rollback                                  | passed                                                                                  |
| Governed cleanup negative/concurrency matrices                     | passed                                                                                  |
| Controlled pre-lifecycle fixture cleanup retry                     | passed: `resources: 0`                                                                  |

PostgreSQL 17 emits a random `\\restrict`/`\\unrestrict` safety token in each text dump. Raw dumps differed only on those two non-schema lines. Removing only those tokens produced byte-identical 64,953-line schema dumps and the digest above.

### Resumed code gates

| Gate                               | Continuation result                                                               |
| ---------------------------------- | --------------------------------------------------------------------------------- |
| Complete repository suite          | passed: 4,638/4,638 across 848 files                                              |
| FS-UX-009 focused regression suite | passed: 4/4                                                                       |
| Typecheck                          | passed                                                                            |
| Full ESLint                        | passed with zero errors and the same nine warnings                                |
| Migration lint                     | passed: no findings                                                               |
| Production build                   | passed; 290 static pages generated and canonical Furnishing Studio routes emitted |
| `git diff --check`                 | passed                                                                            |

### Current bounded hold

The integrated authenticated browser lifecycle remains unproven. Authentication succeeded locally using synthetic local-only CAPTCHA configuration, but the browser run stopped at its first activation stage because `scripts/verification/verify-fs008g-c8-browser.ts` still expects the retired FS-008G controls and a `Required reason` field on `/admin/furnishing/activation`. FS-UX-008 intentionally redirects that legacy route to `/admin/furnishing/release-controls`, whose governed server-verification sequence is materially different. The database-authoritative FS-UX-008 lifecycle and concurrency proofs pass, but they do not substitute for the required current browser, accessibility, responsive-layout, and complete isolated end-to-end lifecycle pass.

The browser stop occurred before catalog import or any furnishing lifecycle mutation. The controlled fixture was cleaned to zero resources under retry. The final local database was rebuilt cleanly through `20260830152000`. No purchase, retailer order, shipment, payment, notification, carrier, installer, or irreversible provider effect occurred.

Current classification remains `FS-UX-009_PROGRAM_RECONCILIATION_BLOCKED_CLEAN`. No deployment candidate is issued. The required bounded next correction is a current FS-UX-009 browser lifecycle/accessibility harness aligned to the feature-frozen FS-UX-008 release-control routes and server-verification contracts; application behavior must not be changed merely to satisfy the obsolete FS-008G harness. Deployment recommendation remains **HOLD**.

## Continuation from the browser-harness hold

The same FS-UX-009 milestone resumed from evidence commit `35ab9df2268e2bd092fa21b9ba966907af622166`. The environmental stop and the obsolete-browser-harness stop above remain immutable chronology. The valid program-history corrections remain `fdc7ed44495ac310d26106e7722f3262901e7314` (controlled fixture service-role grants) and `d1d215765c810d3ddb9de171a4c39c11f84e98af` (dependency-safe controlled fixture cleanup).

### Resumed preflight and bounded browser correction

- Repository preflight: exact commit `35ab9df2268e2bd092fa21b9ba966907af622166`, clean working tree.
- Local Docker/Postgres: healthy; local API `http://127.0.0.1:54321`, local Postgres `127.0.0.1:54322`.
- Production ceiling remained `20260829010000`; Production was not connected to or changed.
- No migration was added, edited, or applied to Production. Previously recorded post-ceiling digests remain unchanged.
- The browser runbook and harness now use `/admin/furnishing/release-controls/workspaces/{workspaceId}`. `/admin/furnishing/activation` is tested separately as a compatibility redirect to `/admin/furnishing/release-controls`; no retired activation control is expected or restored.
- The revised harness sequences server-authoritative capability enablement and verification, workspace suspension/recovery, guarded rollback and re-verification, and global suspension/recovery. It also adds desktop/mobile overflow, landmark, heading, keyboard-focus, automated serious/critical accessibility, error feedback, destructive confirmation, context, and anonymous-denial checks.
- Controlled setup now records and restores the exact release baseline and grants only the two explicit recovery permissions that administrators do not receive implicitly. Cleanup was made retry-safe for partial identity removal and retains an immutable audit actor only while the ephemeral test database exists.

The accessibility preflight demonstrated and bounded two concrete defects before lifecycle mutation: nested `main` landmarks on the five Release Controls pages and insufficient contrast for the authenticated-shell identity subtitle. The smallest corrections use the admin shell as the single main landmark and change only that subtitle's color token. The focused release-control regression passed (5/5), and typecheck passed after these corrections.

### Precise third hold contract

The controlled browser lifecycle then enabled `catalog_viewing` through the canonical UI and invoked the server-authoritative verification action. The server persisted a failed verification and correctly prevented the next capability. The exact failed check was:

```text
capability-verification-v2
verification: failed
anonymous_denial: false
```

`fsux8_verify_capability_v2` computes `anonymous_denial` as `not has_table_privilege('anon','public.furnishing_products','INSERT')`. On the exact clean schema the `anon` role has a table-level grant while RLS remains the authoritative row-level denial boundary. The verification therefore reports failure without exercising the actual anonymous RLS operation. This is a concrete application/database contract defect in the server-authoritative verification, not a browser-harness mismatch. It requires a forward-only database correction and focused regression proof. This continuation expressly authorizes no database migration, so no correction or bypass was attempted.

The stop was atomic at the release-control stage. No import, product, package, project, design, budget, procurement, receipt, installation, completion, retailer, order, payment, notification, shipment, carrier, or other external effect was created. The only governed mutations were one capability enable audit event and its failed immutable server-verification evidence.

### Cleanup and final reconciliation

- Dependency-safe cleanup removed all active controlled resources and reported `resources: 0`; one soft-deleted actor was temporarily retained solely because immutable audit evidence references it.
- A final clean local database rebuild through `20260830152000` removed the ephemeral test database and restored the exact seeded protected baseline.
- Before that rebuild, direct reconciliation reported release baseline `disabled / global kill switch engaged / configuration invalid / version 1`, zero controlled workspace rows, zero capability rows, zero controlled owner rows, and zero payment, notification, or procurement-order effects.
- Production and all external systems remained unchanged.

Outstanding browser stages, fresh end-to-end authorization/concurrency/accessibility coverage beyond the stopped control stage, and the final full repository/lint/build gates were not relabeled as passing. They must be rerun after an authorized forward correction makes the authoritative verification test the real anonymous RLS boundary.

Post-stop bounded checks passed: 14/14 focused release-control tests, typecheck, full ESLint with the same nine warnings and zero errors, and `git diff --check`. The complete repository suite, Production build, and remaining final gates were intentionally not rerun after the authoritative lifecycle stop.

Current classification: `FS-UX-009_PROGRAM_RECONCILIATION_BLOCKED_CLEAN`.

Deployment recommendation: **HOLD**. No deployment candidate SHA, completion tag, Production migration, Production configuration change, or feature expansion is authorized from this result.

## Continuation from the anonymous-denial hold

The existing FS-UX-009 milestone resumed from evidence commit `81313840e844822fc7d60ced84431caaf4fcafe2`. All earlier environmental, browser-harness, and anonymous-verification blocked attempts above remain immutable program chronology.

### Authorized forward correction

- Added only forward migration `20260830153000_fs_ux_009_anonymous_catalog_verification.sql`; no existing migration was rewritten.
- Migration SHA-256: `1212c828d34a8a8b9c1571fc8d513a44e2c3a90fe5e8d704535f8f4bba8a87b2`.
- The server-owned verification now invokes the catalog-viewing `furnishing_products` SELECT boundary under database role `anon`, requires active row security, and classifies `expected_denial`, `identity_unestablished`, `boundary_inactive`, `probe_error`, and `unexpected_success` separately.
- Success is derived exclusively on the server. The immutable verification run, checks, result, and audit evidence retain workspace, capability/version, correlation, actor, timestamp, probe role/method/boundary, and verification-version context in the same transaction.
- The other three capability verifications and the zero furnishing/external-effect invariant are unchanged.
- Focused regression proves that granting table-level SELECT to `anon` cannot itself satisfy the check, while a temporary permissive anonymous RLS policy produces `unexpected_success`.

### Migration and focused verification results

| Gate                                                                                              | Result                                                                                  |
| ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Exact Production-ceiling forward sequence through `20260830153000`                                | passed                                                                                  |
| Forward migration replay                                                                          | passed: zero pending migrations                                                         |
| Two clean-database rebuilds                                                                       | passed                                                                                  |
| Normalized schema equivalence                                                                     | passed: both SHA-256 `dde8e92eca07622bc7695e8f8e42375ca735d819a59d910d3b2f50748f9f66f0` |
| Anonymous catalog RLS regression                                                                  | passed, including table-grant and permissive-policy negative controls                   |
| Existing database lifecycle, RLS, authorization, concurrency, stale-state, and atomicity matrices | passed in the exact-ceiling runner                                                      |
| Focused release-control tests                                                                     | passed: 9/9                                                                             |
| Typecheck                                                                                         | passed                                                                                  |
| Full ESLint                                                                                       | passed with zero errors and the same nine warnings                                      |
| Migration lint                                                                                    | passed: no findings                                                                     |
| `git diff --check`                                                                                | passed                                                                                  |

Production remained at ceiling `20260829010000` and was not connected to or changed.

### Earliest new authoritative hold

The canonical browser lifecycle restarted from a clean controlled baseline. The corrected `catalog_viewing` verification passed and persisted immutable evidence with role `anon`, method `rls_filtered`, status `expected_denial`, and boundary `furnishing_products_select_rls`. The catalog, design, and budgeting capability verifications also passed.

The run then stopped at `procurement_readiness`. Its authoritative verification persisted `failed` because `execution_fail_closed=false`: that check requires the global kill switch to be engaged, while the controlled catalog-through-procurement lifecycle requires the release to be active. The redesigned canonical Release Controls interface exposes no authorized transition that can satisfy that prerequisite and then continue the active lifecycle. The action envelope/UI also accepted the completed verification invocation even though its authoritative result was failed. Correcting either contract is outside the single authorized anonymous-denial migration and would require a separate bounded decision; no broader release-control change was attempted.

No catalog import or downstream furnishing lifecycle stage ran after this failure. No purchase, retailer order, shipment, payment, notification, carrier, installer, or other external effect occurred.

### Cleanup and disposition

Governed cleanup initially exposed a fixture dependency on the anonymous canary's identity claim. Dependency-safe cleanup removed that claim before its product, then completed with `resources: 0`. A final clean local database rebuild removed retained immutable test actors and restored the seeded protected baseline. Production and external systems remained unchanged.

Per the stop-at-earliest-authoritative-boundary rule, the remaining catalog-through-installation browser stages, responsive/accessibility pass, complete repository suite, Production build, and final certification gates were not run or relabeled as passing. Post-stop bounded checks are recorded above.

Current classification: `FS-UX-009_PROGRAM_RECONCILIATION_BLOCKED_CLEAN`.

Deployment recommendation: **HOLD**. This correction commit is program evidence, not a deployment candidate. No completion tag, Production migration, deployment, Production configuration change, or feature expansion is authorized.

## Continuation from the procurement-verification hold

The existing FS-UX-009 milestone resumed from correction/history commit `66be0304d6af3d411be1bb5131eeb37ef35e960f`. Every prior blocked attempt above remains immutable chronology.

### Authorized procurement verification correction

- Added only forward migration `20260830154000_fs_ux_009_procurement_guard_verification.sql`; no existing migration was rewritten.
- Migration SHA-256: `9540fd160518442633caae50ddc5f7763508480747ebb4f940ea6183afec0b40`.
- The server verifier now evaluates a deterministic invariant over the authoritative `assert_fs008g_procurement_mutation_enabled()` boundary and its procurement triggers. It does not toggle or otherwise change the shared release configuration.
- Verification passes while the real lifecycle is `internal`, valid, and has the global kill switch disengaged. A separate transactional integration test proves a real procurement baseline mutation is denied with `FURNISHING_ACTIVATION_DISABLED` while the global kill switch is engaged.
- Verification records only immutable run/check/audit evidence, derives success exclusively on the server, preserves existing global/workspace suspension precedence, and leaves procurement, order, payment, notification, installation, and external-effect counts unchanged.
- Forced audit insertion failure rolls back the verification run/checks and capability state. An independent-session proof serializes procurement verification before global suspension, commits exactly one evidence chain for each operation, and ends globally suspended.
- Static regression confirms the catalog, design, and budgeting verification branches remain present and that the correction accepts no client-supplied success result.

### Completed gates before the new stop

| Gate                                                                                                     | Result                                                                                  |
| -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Exact Production-ceiling sequence through `20260830154000`                                               | passed                                                                                  |
| FS-UX-003–008 database lifecycle matrices                                                                | passed                                                                                  |
| Authorization/RLS, stale-state, concurrency, cleanup, and atomicity matrices in the exact-ceiling runner | passed                                                                                  |
| All four authoritative capability verifications                                                          | passed                                                                                  |
| Procurement guard focused regression                                                                     | passed                                                                                  |
| Procurement verification/global-suspension independent-session proof                                     | passed                                                                                  |
| Two clean-database rebuilds                                                                              | passed                                                                                  |
| Normalized schema equivalence                                                                            | passed: both SHA-256 `1fd0cf795e58f7ebd98c43540c70420a9f5e78ee0528ef8e68b882a5ab3193e4` |
| Migration replay                                                                                         | passed: zero pending through `20260830154000`                                           |
| Focused release-control tests                                                                            | passed: 8/8                                                                             |
| Typecheck                                                                                                | passed                                                                                  |
| Full ESLint                                                                                              | passed with zero errors and the same nine warnings                                      |
| Migration lint                                                                                           | passed: no findings                                                                     |
| `git diff --check`                                                                                       | passed                                                                                  |

Production remained at ceiling `20260829010000` and was not connected to or changed.

### Earliest new authoritative hold

The canonical browser lifecycle restarted from a clean database and stopped during governed fixture provisioning, before browser launch. The service-role client was denied while inserting the two explicit controlled recovery permissions:

```text
CONTROLLED_RELEASE_RECOVERY_PERMISSIONS
42501: permission denied for table fsux8_release_permissions
```

Migration `20260830152000_fs_ux_009_controlled_fixture_service_grants.sql` grants controlled fixture access to customer accounts, memberships, and furnishing entitlements, but the clean schema grants no service-role INSERT privilege on `fsux8_release_permissions`. The fixture correctly avoids direct superuser mutation and therefore cannot establish the authorization context required for the canonical recovery/rollback lifecycle. This is a clean-schema authorization contract defect at the controlled public/service boundary, not a browser assertion or environmental failure. Correcting it would require another forward authorization change and is outside the single migration authorized for this continuation.

The stop occurred before capability enablement, catalog import, product adoption, package, design, budget, procurement, delivery, installation, browser accessibility, or responsive-layout stages. No furnishing lifecycle or external effect occurred.

### Cleanup and disposition

Provisioning had created two synthetic identities and two controlled workspace records before the permission denial. A clean local database rebuild removed all partial records and restored the protected baseline exactly: release `disabled`, global kill switch engaged, configuration invalid, optimistic version `1`, with zero controlled profiles, controlled workspaces, release permissions, verification runs, or release audit events.

Per the stop-at-earliest-authoritative-boundary rule, the remaining browser lifecycle, accessibility/responsive pass, full repository suite, Production build, and final certification gates were not run or relabeled as passing. Production and all external systems remain unchanged.

Current classification: `FS-UX-009_PROGRAM_RECONCILIATION_BLOCKED_CLEAN`.

Deployment recommendation: **HOLD**. The resulting correction/history commit is not a deployment candidate. No completion tag, Production migration, deployment, Production configuration change, or broader feature change is authorized.

## Continuation from the release-permission provisioning hold

The existing FS-UX-009 milestone resumed from correction/history commit `ffcd40f746145848766622a3105459525c57336a`. All earlier blocked attempts remain immutable chronology.

### Authorized trusted fixture correction

- No governed release-permission write RPC exists. `fsux8_has_release_permission` is a read predicate, while the controlled provisioner and cleanup explicitly use the trusted service-role client.
- Added only forward migration `20260830155000_fs_ux_009_release_permission_fixture_boundary.sql`; no existing migration was rewritten.
- Migration SHA-256: `9c2983158d119d937052ce794b0c96f548fa34cf3ef64f0fa8753e80db7aecea`.
- The migration revokes inherited privileges on `fsux8_release_permissions`, restores authenticated SELECT only, and grants service role only SELECT/INSERT/DELETE. Anonymous access remains absent and authenticated INSERT/UPDATE/DELETE/TRUNCATE/TRIGGER/REFERENCES access is absent.
- The complete provision/cleanup operation audit then exposed the trigger-created anonymous-canary identity claim as part of the same fixture dependency chain. The migration grants service role only SELECT/DELETE on `furnishing_product_identity_claims`; it grants no claim creation or update authority.
- Focused transactional proof executes service-role insertion and scoped cleanup, anonymous and authenticated denial, cross-workspace authenticated denial, missing-delete atomic rollback, and protected-permission preservation.
- A fresh full controlled provision-and-cleanup audit passed with `resources: 0` and no retained actor. Existing database lifecycle, authorization/RLS, concurrency, atomicity, and cleanup matrices exercise the actual governed operations for catalog, packages, design, budgets, procurement, installation, release controls, and audit evidence.
- The browser harness now supplies deterministic Cloudflare test-token behavior only in its local headless contexts and reloads the authoritative server projection after each successful control action. No application or Production authentication behavior changed.

### Completed gates before the new stop

| Gate                                                                                                  | Result                                                                                  |
| ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Exact Production-ceiling sequence through `20260830155000`                                            | passed                                                                                  |
| Complete provisioning and dependency-safe cleanup audit                                               | passed                                                                                  |
| Release-permission focused boundary and atomicity proof                                               | passed                                                                                  |
| FS-UX-003–008 lifecycle, authorization/RLS, concurrency, stale-state, cleanup, and atomicity matrices | passed                                                                                  |
| All four authoritative capability verifications                                                       | passed                                                                                  |
| Two clean-database rebuilds                                                                           | passed                                                                                  |
| Normalized schema equivalence                                                                         | passed: both SHA-256 `1fd0cf795e58f7ebd98c43540c70420a9f5e78ee0528ef8e68b882a5ab3193e4` |
| Migration replay                                                                                      | passed: zero pending through `20260830155000`                                           |
| Focused release-control tests                                                                         | passed: 9/9                                                                             |
| Typecheck                                                                                             | passed                                                                                  |
| Full ESLint                                                                                           | passed with zero errors and the same nine warnings                                      |
| Migration lint                                                                                        | passed: no findings                                                                     |
| `git diff --check`                                                                                    | passed                                                                                  |

Production remained at ceiling `20260829010000` and was not connected to or changed.

### Earliest new authoritative hold

The canonical browser lifecycle restarted from a fresh controlled baseline. The legacy activation redirect and canonical Release Controls route loaded, responsive/accessibility preflight passed, and the catalog capability was enabled. Its server-authoritative verification passed and persisted exactly one immutable run and audit evidence chain.

The next capability remained locked because the authenticated server/UI projection could not read `furnishing_activation_capabilities`. A direct request through the same authenticated Supabase boundary returned:

```text
42501: permission denied for table furnishing_activation_capabilities
```

The database row was authoritatively `catalog_viewing / enabled / verified / version 1`, but the page's failed table query silently fell back to `unverified`; therefore Design Workspace remained unavailable. RLS policies exist for authorized capability reads, but the table lacks the corresponding authenticated SELECT grant. This is a concrete application/RLS contract defect outside the authorized trusted fixture boundary, so no correction or bypass was attempted.

No catalog import, product adoption, package, design, budget, procurement, delivery, installation, purchase, retailer order, payment, notification, shipment, or external effect occurred.

### Cleanup and disposition

Dependency-safe cleanup completed with `resources: 0`; one actor was temporarily retained only by immutable release evidence. A final clean local database rebuild removed retained test actors and restored the exact protected baseline: release `disabled`, global kill switch engaged, configuration invalid, optimistic version `1`, with zero controlled profiles, workspaces, release permissions, verification runs, or audit rows.

Per the authoritative stop rule, the remaining browser lifecycle, responsive/accessibility stages, full repository suite, Production build, and final certification gates were not run or relabeled as passing. Production and external systems remain unchanged.

Current classification: `FS-UX-009_PROGRAM_RECONCILIATION_BLOCKED_CLEAN`.

Deployment recommendation: **HOLD**. The resulting correction/history commit is not a deployment candidate. No completion tag, Production migration, deployment, Production configuration change, or broader permission correction is authorized.

## Continuation from the Release Controls read hold

The existing FS-UX-009 milestone resumed from correction/history commit `b273c85a808950528d90b15ec5837dd109d578f8`. All prior blocked attempts above remain immutable chronology.

### Authorized authenticated read correction

- Added only forward migration `20260830156000_fs_ux_009_release_control_read_boundary.sql`; no existing migration was rewritten. Its SHA-256 is `c307b0a1ebbb810d9cfb4e8e1bb8a7229937e26962fae2db4ac72eca8ce65383`.
- The existing `resolve_furnishing_activation_control` RPC is the single intended Release Controls projection. It already returns only the capability state, optimistic version, and verification state required by the UI and binds capability resolution to the controlled workspace identifier.
- The migration revokes anonymous and authenticated direct table reads, revokes the RPC's default/public execution, and grants RPC execution only to authenticated and service-role contexts. Authenticated INSERT, UPDATE, and DELETE remain prohibited. Verification runs, checks, internal failures, actor details, and unrelated workspace configuration are not exposed.
- Both Release Controls pages now consume `verificationState` from the governed RPC and no longer query `furnishing_activation_capabilities` directly. Server-authoritative verification and mutation RPCs remain unchanged.
- The actual-operation matrix passed for platform admin/owner, workspace-scoped delegated operator, workspace-scoped reviewer, unauthorized authenticated, wrong-workspace, suspended, revoked, anonymous, and service-role contexts. It also proved verified/unverified/failed distinction, workspace-identifier forgery denial, direct table read and mutation denial, and that client-supplied state cannot alter the projection. Service role without a genuine actor context fails closed.

### Completed gates before the new stop

| Gate                                                                                                  | Result                                                                                                                 |
| ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Exact Production-ceiling sequence through `20260830156000`                                            | passed                                                                                                                 |
| FS-UX-003–008 lifecycle, authorization/RLS, concurrency, cleanup, stale-state, and atomicity matrices | passed                                                                                                                 |
| Release Controls authenticated read matrix                                                            | passed                                                                                                                 |
| All four authoritative capability verifications                                                       | passed                                                                                                                 |
| Two clean-database rebuilds                                                                           | passed                                                                                                                 |
| Normalized schema equivalence                                                                         | passed: both SHA-256 `15f7977adb2758aad72b120197f0ac0102c30f2f034880bd8715f0f743fecdb7`                                |
| Migration replay                                                                                      | passed: zero pending through `20260830156000`                                                                          |
| Focused release-control tests                                                                         | passed: 10/10                                                                                                          |
| Typecheck after the bounded correction                                                                | passed                                                                                                                 |
| Release Controls browser lifecycle                                                                    | passed: enablement, four server verifications, workspace suspension/recovery, rollback, re-enable, and re-verification |
| Release Controls desktop/mobile accessibility preflight                                               | passed                                                                                                                 |
| `git diff --check`                                                                                    | passed                                                                                                                 |

Production remained at ceiling `20260829010000` and was not connected to or changed.

### Earliest new authoritative hold

The canonical browser lifecycle restarted from a clean controlled baseline and completed Release Controls. It then entered the canonical Inventory Imports route and submitted the controlled source workbook through `startInventoryImportAction`. The authoritative parser failed before persistence with:

```text
IMPORT_HEADERS_INVALID
src/features/furnishing-studio/inventory-import.ts:190
```

The parser rejects the controlled XLSX when any worksheet header is blank or duplicated. No `furnishing_catalog_imports` row or catalog product was created. This is a concrete Inventory Imports application-contract defect at the earliest catalog lifecycle boundary, unrelated to the authorized Release Controls read correction. No parser, import, domain, or migration correction was attempted.

Because of this stop, product adoption, room packages, design workspaces, budgets, procurement, delivery/installation, downstream browser read queries, remaining responsive/accessibility coverage, full repository suite, full lint, migration lint, and Production build were not rerun or relabeled as passing.

### Cleanup and disposition

Governed cleanup completed with `resources: 0`. The protected release baseline is exactly `disabled / global kill switch engaged / configuration invalid / optimistic version 1`; controlled workspaces, release permissions, active capability rows, and imports are zero. Four synthetic profiles remain only because repeated Release Controls attempts produced immutable audit evidence; there is no active membership, workspace, permission, verification capability, lifecycle project, or external effect associated with them.

No order, payment, retailer request, shipment, notification, or other external effect occurred. Production and external systems remain unchanged.

Current classification: `FS-UX-009_PROGRAM_RECONCILIATION_BLOCKED_CLEAN`.

Deployment recommendation: **HOLD**. The resulting correction/history commit is not a deployment candidate. No completion tag, Production migration, deployment, Production configuration change, import-parser correction, or broader feature work is authorized.

## Continuation from the XLSX parser hold

The existing FS-UX-009 milestone resumed from `b098ccabdace58a23a7adf1d4b358b6514b9822e`. All prior blocked attempts above remain immutable chronology.

### Bounded corrections preserved

- `86394bdf` — `fix(fs-ux-009): reconcile XLSX source columns`. The XLSX parser now ignores wholly blank formatted columns, reports populated headerless columns by worksheet and address, preserves duplicate headers as stable source-column identities, requires explicit mapping for ambiguous duplicates, and retains physical worksheet row lineage through validation. CSV identity behavior is unchanged.
- `test(fs-ux-009): harden browser import harness` (the bounded harness commit immediately following `86394bdf`) uses the canonical worksheet and source-column identifiers, handles current CAPTCHA and Server Action hydration behavior, persists lifecycle identifiers, supports bounded stage resume, and follows the canonical platform-product adoption flow.

Neither commit is a deployment candidate.

Focused parser regression coverage passed 14/14, typecheck passed, and `git diff --check` passed. The controlled workbook selected `Catalog Review` at physical header row 4, validated 109 rows, identified one intentional `URL_INVALID` row, skipped that row through the governed UI, reconciled the catalog, and committed 109 platform drafts with zero blocking rows.

### Earliest new authoritative hold

The resumed catalog lifecycle stopped at the platform-product adoption projection. The governed adoption RPC succeeded atomically and created one workspace product with its `furnishing_product_adoptions` lineage row. The server-rendered platform detail nevertheless continued to offer `Add to workspace catalog` instead of projecting `Open existing workspace product`.

The exact service-role read used by `ProductDetail` failed with PostgreSQL `42501`:

```text
permission denied for table furnishing_product_adoptions
Hint: GRANT SELECT ON public.furnishing_product_adoptions TO service_role
```

This is a genuine trusted read-boundary defect. No permission or migration correction was attempted because the parser continuation does not authorize a database migration or broader privilege change. The adoption itself was complete and internally consistent; no requirement, room package, project, procurement, installation, order, payment, retailer, shipment, notification, or external effect was created.

The isolated local database was rebuilt through `20260830156000`. Final reconciliation is zero imports, products, adoptions, controlled designations, projects, and workspaces. The protected release baseline is restored exactly to `disabled / global kill switch engaged / configuration invalid / optimistic version 1`. Production was not connected to or changed.

Current classification: `FS-UX-009_PROGRAM_RECONCILIATION_BLOCKED_CLEAN`.

Deployment recommendation: **HOLD**. The required next action is a separately authorized, minimum trusted read-boundary correction for `furnishing_product_adoptions`, followed by resume at catalog adoption. No completed Release Controls, migration-equivalence, schema, or authorization proof needs replay unless its implementation or state changes.

## Simplified remaining-path continuation from `b96f14ee`

The bounded integration correction is commit `be793d82` (`fix(fs-ux-009): reconcile remaining lifecycle path`). It adds only forward migration `20260830161000_fs_ux_009_remaining_path_integration_fixes.sql` (SHA-256 `db970b7c90b7cbe682036820491540bf4d53d16081628601871c83cd558c5f48`). Production remained unchanged at `20260829010000`.

The migration replaces `save_furnishing_selection_delivery` with the same transactional contract using `ON CONFLICT ON CONSTRAINT furnishing_selection_delivery_allo_selection_id_property_id_key`. It also binds receipt and installation sources to the authoritative installation project and procurement baseline. The existing procurement delivery-plan and installation-inspection RPCs are now reachable through the canonical UI. No purchase, payment, retailer request, shipment, notification, or provider action was added.

Focused verification passed: 21/21 affected migration tests, the new remaining-path suite 3/3, typecheck, affected-file lint, migration lint with no findings, and `git diff --check`. The local migration applied transactionally. The canonical browser then passed plan generation, offer/quantity/delivery allocation, validation, owner submission, administrator approval, and advanced to immutable snapshot creation. The corrected allocation persisted exactly one selection/property allocation and the required plan command evidence.

### Authoritative stop

At immutable snapshot creation, the lifecycle failed closed with `FS008D_SNAPSHOT_UNAVAILABLE`; procurement then correctly rejected the missing snapshot with `PROCUREMENT_AUTHORITATIVE_SNAPSHOT_REQUIRED`. Database reconciliation established the cause: plan generation had accepted an archived controlled product still reachable through a retained package composition. The resulting approved selection had no eligible product version or selected offer, so it could not satisfy the immutable snapshot contract. This also proves the earlier controlled cleanup left a retained package dependency capable of influencing a later active lifecycle.

This is a genuine application/cleanup-boundary defect, not a selector or hydration failure. Downstream procurement, delivery, installation, expensive repository gates, and Production build were not run or relabeled as passing.

Governed cleanup returned the project to `archived` and its plan to `superseded`. The remaining mutable controlled allocation and prerequisite records were reconciled in dependency order; active controlled products, packages, allocations, memberships, entitlements, projects, procurement records, and installations are zero. Immutable plan-generation evidence and its referenced command contexts remain only under their retention contract. The protected package `99200000-0000-4000-8000-000000000010` remains approved at its original version. Release Controls are restored exactly to `disabled / global kill switch engaged / configuration invalid / optimistic version 1`, with zero workspace or capability rows. No external or Production effect occurred.

Current classification: `FS-UX-009_PROGRAM_RECONCILIATION_BLOCKED_CLEAN`.

Deployment recommendation: **HOLD**. A future bounded correction must prevent archived or otherwise ineligible package dependencies from entering an authoritative plan and must reconcile stale controlled package composition during cleanup before this continuation resumes at plan generation.

## Package-item eligibility continuation from `63852337`

The existing milestone resumed from `63852337eaf5221ee0304f63222f2ec2f425e146`. Prior Release Controls, import, adoption, and package-governance evidence remained unchanged and was not repeated.

Forward migration `20260830162000_fs_ux_009_package_plan_eligibility.sql` (SHA-256 `229485faf198e10318a5537e891b14d0307b49bf613b31bec5a2b04c9026d66d`) corrects both authorized eligibility boundaries. Owner package discovery now excludes approved packages whose required composition contains a non-current room-package version, invalid quantity rule, inactive or retired workspace product, missing approved product version, or missing usable governed offer. Atomic plan generation locks and revalidates the same records before invoking the existing transactional generator, reports `FURNISHING_PLAN_PACKAGE_ITEM_INELIGIBLE:<item-id>`, and binds created selections to the validated approved product version. Historical package, approval, and snapshot evidence is not rewritten, and no alternative is substituted implicitly.

Focused verification passed 13/13 across the new eligibility suite, atomic plan generation, and the existing selection/snapshot suite. Typecheck, migration lint, and the local migration apply also passed. Actual authenticated discovery returned only the fresh eligible controlled package. A transaction then archived its product between discovery and generation: generation failed with the item-specific eligibility error and created no plan, selection, project pointer/version update, command success, or audit evidence. Rolling the transaction back restored the eligible fixture.

The resumed browser journey passed plan generation, delivery allocation, plan validation, owner submission, administrator approval, and immutable snapshot creation. This confirms the eligibility correction repaired the previously blocked snapshot boundary.

### Earliest new authoritative hold

Procurement readiness then failed at its authoritative database boundary with:

```text
cannot insert a non-DEFAULT value into column "procurement_quantity"
```

The existing `create_or_replay_procurement_baseline` function attempts to insert into the generated `procurement_quantity` column. No baseline, procurement line, order, payment, shipment, retailer request, notification, installation, or provider effect was created. This is a separate application defect outside the authorized package-eligibility correction, so no procurement code or migration was changed and downstream browser stages and expensive final gates were not run.

Governed cleanup archived/reconciled the controlled project, plan, and immutable snapshot. Remaining synthetic prerequisites referenced by retained immutable evidence were moved to inactive states; controlled memberships and entitlements were removed. Final active-resource reconciliation is zero projects, plans, products, offers, property packages, room packages, procurement baselines, installations, orders, controlled memberships, controlled entitlements, release workspaces, and release capabilities. The protected package `99200000-0000-4000-8000-000000000010` remains approved at its original current version. Release Controls are restored exactly to `disabled / global kill switch engaged / configuration invalid / optimistic version 1`. Production and external systems remain unchanged.

Current classification: `FS-UX-009_PROGRAM_RECONCILIATION_BLOCKED_CLEAN`.

Deployment recommendation: **HOLD**. The required next bounded correction is limited to the generated-column insert in authoritative procurement baseline creation. No Production migration, deployment, tag, or broader lifecycle change is authorized by this record.
