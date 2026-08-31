# FS-UX-006 local hold point

Date: 2026-08-30
Starting candidate: `7e15120c8a0cedb56c6b0d0a8f204eedc4d6ce80`
Production activity: none
Production migration ceiling: unchanged at `20260829010000`

## Candidate boundary

FS-UX-006 extends the canonical `furnishing_procurement_baselines` aggregate. A project may now be sourced from one immutable FS-UX-005 design approval and its compatible approved budget through `fsux5_procurement_handoffs`. No parallel procurement-project, cart, order, payment, notification, or installation identity was introduced.

Forward migration:

- `20260830130000_fs_ux_006_procurement_readiness.sql`
- SHA-256: `d99c32d38f1914397e8f8d850c47a1a040b2d62b186308ee2625ccf1c3d08dba`

Purchase authorization is explicitly deferred. Readiness approval retains the legacy aggregate in `under_review` rather than using `authorized`; `readiness_status=approved` is the non-executing milestone result.

## Delivered routes

- `/admin/furnishing/procurement`
- `/admin/furnishing/procurement/new`
- `/admin/furnishing/procurement/:procurementProjectId`
- `/admin/furnishing/procurement/:procurementProjectId/lines`
- `/admin/furnishing/procurement/:procurementProjectId/retailers`
- `/admin/furnishing/procurement/:procurementProjectId/exceptions`
- `/admin/furnishing/procurement/:procurementProjectId/budget`
- `/admin/furnishing/procurement/:procurementProjectId/review`
- `/admin/furnishing/procurement/:procurementProjectId/versions/:versionId`

Every route uses the shared Furnishing Studio shell and keeps Procurement active. Every primary view displays “No order has been placed” and the intentional unavailable ordering boundary.

## Readiness contract

- Lifecycle: Draft → Reconciling → Needs resolution / Ready for review → In review → Approved → Superseded / Archived, with Changes requested returning to reconciliation.
- Creation locks and validates the handoff, approved design snapshot, compatible approved budget, property, workspace, approved product versions, and actor.
- Each line retains source selection, room, product, approved product version, offer, retailer, SKU, variant, quantity, priority, required designation, baseline price, and immutable source evidence.
- One allocation per source selection reconciles planned quantity exactly. Version-scoped uniqueness permits revisions without duplicating a selection in one version.
- Retailer grouping is deterministic across product version, retailer, SKU/variant, currency, fulfillment, destination, required date, and source allocation.
- Explicit manual/governed price refresh appends evidence, preserves the prior price, recalculates variance, advances the optimistic version, and performs no provider request.
- Required unavailable, discontinued, unknown, or stale products block readiness. Missing retailer/SKU, quantity mismatch, incomplete delivery planning, excess variance, and any external order also block.
- Approval creates one immutable snapshot of the baseline, version, lines, allocations, retailer groups, validations, source snapshots, policy, reviewer, and correlation.
- A material revision copies editable projections with lineage, preserves the approved snapshot, reruns reconciliation, and requires approval again.

## Security and authorization

- All FS-UX-006 tables have RLS enabled. Authenticated reads require current workspace membership or Admin authority.
- Direct authenticated writes to versions, allocations, groups, price evidence, substitutions, validation, review, snapshots, and cleanup manifests are revoked.
- Mutations validate authentication, workspace role, reviewer authority where applicable, safety state, current state, and optimistic version in security-definer functions with fixed search paths.
- Anonymous access fails before handoff lookup. Cross-workspace product and handoff relationships fail at the authoritative boundary.
- Immutable readiness snapshots reject update and delete.
- Purchase/order execution functions are not introduced or granted.

## Controlled cleanup

The frozen service-only cleanup function is retained as `cleanup_fs008g_synthetic_project_pre_fsux6` and wrapped by a new service-only function. The wrapper:

- validates and locks the active designation and controlled project;
- locks readiness versions, allocations, retailer groups, and substitutions in deterministic project/version order;
- reruns the frozen dependency checks under lock;
- archives only mutable readiness projections;
- preserves price evidence, validation evidence, review evidence, readiness snapshots, predecessor audit events, and cleanup evidence;
- records exact FS-UX-006 per-table manifest counts;
- invokes the predecessor cleanup in the same transaction;
- rolls back all changes if either phase fails;
- returns the retained manifest on replay;
- remains unavailable to authenticated and anonymous roles.

The pre-existing dependency-lock triggers continue to prevent notification, payment, customer-account, and provider attachments during cleanup. Existing checks continue to reject retailer orders, procurement consequences, and installation dependencies.

## Migration compatibility

The migration corrects the remaining selection-priority constraint at the final planning boundary: the deprecated `required` priority is translated to `essential`; fulfillment requirement remains the separate boolean. No products, workspaces, adoptions, approvals, orders, payments, notifications, or installations are created by migration.

The disposable local rehearsal starts at exact Production ceiling `20260829010000`, seeds 109 platform drafts, 220 import items, and the three frozen legacy-ambiguous packages, then applies corrected FS-008G → FS-UX-002 → FS-UX-003 → FS-UX-004 → FS-UX-005 → FS-UX-006.

Verified database results:

- `FS008G_PRODUCTION_CEILING_SEQUENCE_PASS`
- `FS008G_IDENTITY_NEGATIVE_MATRIX_PASS`
- `FS_UX_003_DATABASE_MATRIX_PASS`
- `FS_UX_004_DATABASE_MATRIX_PASS`
- `FS_UX_005_DATABASE_MATRIX_PASS`
- `FS_UX_006_DATABASE_MATRIX_PASS`
- Creation, price refresh, review submission, and approval replay are idempotent.
- Stale mutation is rejected and approved snapshot mutation is rejected.
- Material revision retains predecessor lineage.
- Authenticated and anonymous cleanup execution are absent.
- Order, payment, notification, and installation counts remain unchanged.

## Hold and rollout

No Production migration, deployment, activation, kill-switch change, procurement execution, retailer call, payment, notification, delivery scheduling, or installation effect was performed. The current Production ceiling remains `20260829010000`.

FS-UX-006 remains local pending final program reconciliation.

## Local gates

- Focused procurement and migration tests: 13/13 across 2 files.
- Full suite: 4,611/4,611 across 843 files.
- Typecheck: passed.
- Full lint: passed with zero errors.
- Migration lint: `lint: no findings`.
- Production build: passed; every canonical Procurement Readiness route is present in the route manifest.
- `git diff --check`: passed.
- Migration-from-Production-ceiling sequence: passed.

Classification: `FS-UX-006_LOCAL_IMPLEMENTATION_COMPLETE_PENDING_FINAL_PROGRAM_RECONCILIATION`
