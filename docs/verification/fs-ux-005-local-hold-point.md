# FS-UX-005 local hold point

Date: 2026-08-30
Starting candidate: `ab29a090757e1f120109ca84da4bb03ef247e49c`
Production activity: none
Production migration ceiling: unchanged at `20260829010000`

## Candidate boundary

FS-UX-005 extends the canonical `furnishing_projects` aggregate as the user-facing Design Workspace. It does not create a parallel tenant workspace, property, package, cart, procurement project, order, payment, notification, or installation identity.

Forward migration:

- `20260830120000_fs_ux_005_design_workspaces_budgets.sql`
- SHA-256: `e5ab26ca8c12d9ee8b0bfc6b8f2e3ea875d703ae3de636a06f9ebe78b8bb2652`

## Delivered routes

- `/admin/furnishing/workspaces`
- `/admin/furnishing/workspaces/new`
- `/admin/furnishing/workspaces/:designWorkspaceId`
- `/admin/furnishing/workspaces/:designWorkspaceId/brief`
- `/admin/furnishing/workspaces/:designWorkspaceId/rooms`
- `/admin/furnishing/workspaces/:designWorkspaceId/rooms/:roomId`
- `/admin/furnishing/workspaces/:designWorkspaceId/selections`
- `/admin/furnishing/workspaces/:designWorkspaceId/review`
- `/admin/furnishing/workspaces/:designWorkspaceId/versions/:versionId`
- `/admin/furnishing/budgets`
- `/admin/furnishing/budgets/:budgetId`
- `/admin/furnishing/budgets/:budgetId/review`

The prior `/admin/furnishing/projects` routes remain compatible.

## Governance contract

- Design Workspace lifecycle: Draft → Designing → Internal review → Customer review (when required) → Approved → Archived, with Changes requested returning to Designing.
- Budget lifecycle is versioned and linked to a design version. Fixed minor units are used for product, delivery, tax, assembly, installation, disposal, design fee, discount, credit, contingency, total, and target values.
- Lightweight properties use the canonical `properties` identity and add only the `furnishing` capability with the canonical `studio` source. HPM is not enabled or backfilled.
- Approved Room Packages are referenced by immutable FS-UX-004 approval snapshot ID, version, and digest. Package source rows are never mutated.
- Measurements and private-media references are versioned. Mood-board customer-visible and internal fields remain separate.
- Selection lineage records approved product version, source package item, replaced selection, role, priority, placement guidance, price source, actor correlation, and optimistic version.
- Joint approval locks the project and current design/budget versions and writes one immutable snapshot containing property, design, budget, room, selection, measurement, and mood-board evidence.
- Customer approval evidence is a distinct review event; a required customer decision cannot be omitted by the final approval transaction.
- Procurement readiness writes only `fsux5_procurement_handoffs` with `prepared_only=true`. It does not write procurement, order, retailer, payment, notification, or installation tables.

## Budget and validation policy

- Mixed currencies fail closed unless a future governed conversion policy records rate, source, and timestamp.
- Persisted arithmetic uses fixed minor units; fractional selection quantities are rejected by the initial governed calculation contract.
- Price state vocabulary is Current, Stale, Changed, Unavailable, and Unknown.
- Variance is estimate minus target maximum, expressed in minor units and basis points.
- Capacity distinguishes blocking sleeping deficiency from dining/living warnings.
- Television and mount compatibility continues to use the FS-UX-004 separate-product contract inherited by package-derived selections.

## Authorization and security

- New tables have RLS enabled and expose authorized reads only through workspace membership or Admin policy.
- Direct authenticated writes to design versions, measurements, mood boards, review evidence, approval snapshots, handoffs, and activity are revoked.
- Security-definer functions have a fixed `search_path=public` and fail closed for anonymous or unauthorized workspace actors.
- The immutable snapshot trigger denies update and delete.
- Property/media data is not made public and no new public diagnostic or file endpoint was added.

## Database execution evidence

The disposable local database was reset to the exact Production ceiling and seeded with the Production-derived conditions (109 platform drafts, 220 import items, three legacy-ambiguous packages). The sequence applied in order:

`20260829010000 → corrected FS-008G → FS-UX-002 → FS-UX-003 → FS-UX-004 → FS-UX-005`

Results:

- `FS008G_PRODUCTION_CEILING_SEQUENCE_PASS`
- `FS008G_IDENTITY_NEGATIVE_MATRIX_PASS`
- `FS_UX_003_DATABASE_MATRIX_PASS`
- `FS_UX_004_DATABASE_MATRIX_PASS`
- `FS_UX_005_DATABASE_MATRIX_PASS`
- Furnishing-only property remained without HPM capability.
- Creation and approval replay returned existing outcomes.
- Stale approval was rejected.
- Approved snapshot mutation was rejected.
- Handoff replay was idempotent.
- Anonymous mutation was denied.
- Order, payment, and notification counts were unchanged.

## Local gates

- Furnishing-focused tests: 208/208 across 43 files.
- Full suite: 4,598/4,598 across 841 files.
- Typecheck: passed.
- Full lint: passed with 0 errors and 9 pre-existing warnings.
- Migration lint: `lint: no findings`.
- Production build: passed; all canonical Design Workspace and Budget routes are in the route manifest.
- `git diff --check`: passed.
- Migration-from-Production-ceiling: passed.

The first concurrent full-suite/build attempt caused the pre-existing automation DST test to exceed its five-second timeout. The exact test then passed 10/10 in isolation, and the full suite passed 4,598/4,598 when rerun without a competing build.

## Hold and rollout

No Production migration, deployment, activation, kill-switch change, procurement action, retailer call, payment, notification, or installation effect was performed. FS-UX-005 remains local and must enter final program reconciliation before any Production window.

Classification: `FS-UX-005_LOCAL_IMPLEMENTATION_COMPLETE_PENDING_FINAL_PROGRAM_RECONCILIATION`
