# FS-UX-004 local hold point

Date: 2026-08-30

Starting candidate: `744aca6d47b0c15cb87c690d4d2b5b48515bec5f`

Candidate: recorded after the coherent commit

Production activity: none

## Forward migration

- `20260830110000_fs_ux_004_room_packages.sql`
- SHA-256: `97642e5991375feb234f6f1c08d11a936d492ef9f8d60d6bfcf8cdf53a181f25`
- It follows frozen `20260830100000_fs_ux_003_inventory_import_workflow.sql`; no predecessor file changed.
- It creates no package, product, adoption, approval, procurement, payment, notification, retailer, or installation records during application.

## Delivered routes

- `/admin/furnishing/room-packages`
- `/admin/furnishing/room-packages/new`
- `/admin/furnishing/room-packages/:packageId`
- `/admin/furnishing/room-packages/:packageId/edit`
- `/admin/furnishing/room-packages/:packageId/validation`
- `/admin/furnishing/room-packages/:packageId/review`
- `/admin/furnishing/room-packages/:packageId/versions/:versionId`
- `/admin/furnishing/room-packages/legacy`

Existing `/admin/furnishing/packages` routes remain resolvable and the Furnishing Studio navigation maps both old and canonical prefixes to Room Packages.

## Governance contract

- Platform templates are platform-scoped and workspace-null. Workspace packages carry one authoritative workspace.
- Template adoption is transactional and idempotent. It retains template ID, approved version, digest, actor, correlation, inherited profile, product mapping, and overrides.
- Template products are never silently adopted. Unmapped products become explicit `Workspace catalog adoption or approved alternative required` blockers.
- Workspace composition accepts only approved products from the package workspace. Platform and cross-workspace products fail closed.
- Priorities are `essential`, `recommended`, and `optional`. `required` is rejected as a priority and fulfillment requirement is a separate boolean.
- Quantities are positive integers. Alternatives are independently governed and excluded from package totals.
- Budget evidence separates product, delivery, assembly, and installation assumptions. The declared inclusion basis is retained.
- Capacity policy blocks insufficient sleeping capacity and warns on insufficient dining, living-room, and towel capacity.
- Televisions and mounts are separate items. A missing or incompatible mount is blocking unless a retained no-mount reason applies.

## Lifecycle, snapshots, and concurrency

- Lifecycle: draft → in review → approved → retired, with changes requested returning the version to an editable state.
- Review submission reruns authoritative validation and atomically stores the composition hash and complete submission evidence with the state transition. An empty composition can never enter review.
- Approval stores an immutable snapshot tied to its validation run. Approved rooms/items and approval snapshots have mutation guards.
- Approved edits create a copied draft revision with stable copy lineage; the approved source remains unchanged. Alternatives copy without affecting totals.
- Package mutation and template adoption use deterministic advisory locks, current optimistic versions, and durable idempotency identities.
- The two-session race produced one winner, one `ROOM_PACKAGE_VERSION_STALE_OR_NOT_EDITABLE` loser, one active item, one version increment, and one activity event. Controlled fixture cleanup reconciled.

## Legacy disposition

The three Production-derived packages remain `legacy_ambiguous`, workspace-null, version-null, frozen, excluded from active indexes/queries, and visible only through the Admin legacy-governance view:

- `4d162594-f9a7-45e9-881e-adba36cd7406`
- `c196e39c-5d10-4f9a-a8ea-48045da3fa10`
- `a7e0d9cd-3f94-4ccb-9be4-c218bd0a1a96`

No workspace is inferred and no legacy record is edited, reviewed, approved, cloned, applied, or retired.

## Authorization and side-effect boundaries

- The current canonical Admin role is required by every mutation RPC and server action.
- Authentication is checked before command parsing. Anonymous and ordinary direct execution fail with `42501`.
- RLS restricts workspace evidence to active workspace members or Admin; platform evidence remains governed Admin-visible.
- Direct table writes are unavailable to authenticated and anonymous clients. Mutations occur only through fixed-`search_path` RPCs.
- No RPC writes to procurement, retailer/order, payment, notification, installation, activation, or kill-switch objects. Evidence records `externalEffects: false`.

## Verification results

- Focused package tests: 13/13.
- Database lifecycle/template/negative matrix: `FS_UX_004_DATABASE_MATRIX_PASS`.
- Real two-session concurrency: `FS_UX_004_CONCURRENCY_PASS`.
- Migration from exact Production ceiling `20260829010000`: pass through corrected FS-008G → FS-UX-002 → FS-UX-003 → FS-UX-004.
- Production-derived preservation: 3 imports, 220 import items, 109 platform drafts, zero migration-created workspace products, and 3 frozen legacy packages.
- Full test suite: 4,586/4,586 across 839 files.
- Typecheck: pass.
- Full lint: pass with zero errors and nine pre-existing warnings.
- Migration lint: pass with no findings.
- Production build: pass; all canonical Room Package routes emitted as dynamic routes.
- `git diff --check`: pass.

## Production state

Production was not queried or mutated by this local milestone. The accepted Production baseline remains migration ceiling `20260829010000`, furnishing state internal, and global kill switch engaged. No migration or deployment is authorized by this report.

Final local classification after commit: `FS-UX-004_LOCAL_IMPLEMENTATION_COMPLETE_PENDING_FINAL_PROGRAM_RECONCILIATION`.
