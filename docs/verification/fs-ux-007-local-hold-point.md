# FS-UX-007 local hold point

Date: 2026-08-30
Starting candidate: `5d0063d904a0b78be89ad7d3cd213b21e90c273f`
Production activity: none
Production migration ceiling: unchanged at `20260829010000`

## Candidate and migration boundary

FS-UX-007 extends the canonical installation and procurement identities with evidence-based tracking. It introduces no retailer, carrier, payment, notification, return, or installer execution path.

- Migration: `20260830140000_fs_ux_007_delivery_installation_tracking.sql`
- Final SHA-256: `42e0821f97605be9292cfe010c684289d1a41731d9d891ea36642698c2c90c5a`
- Sequence: exact Production ceiling `20260829010000` → corrected FS-008G → FS-UX-002 → FS-UX-003 → FS-UX-004 → FS-UX-005 → FS-UX-006 → FS-UX-007.

## Routes delivered

- `/admin/furnishing/installations`
- `/admin/furnishing/installations/new`
- `/admin/furnishing/installations/:installationProjectId`
- `/admin/furnishing/installations/:installationProjectId/orders`
- `/admin/furnishing/installations/:installationProjectId/orders/:orderId`
- `/admin/furnishing/installations/:installationProjectId/shipments`
- `/admin/furnishing/installations/:installationProjectId/shipments/:shipmentId`
- `/admin/furnishing/installations/:installationProjectId/deliveries`
- `/admin/furnishing/installations/:installationProjectId/rooms`
- `/admin/furnishing/installations/:installationProjectId/rooms/:roomId`
- `/admin/furnishing/installations/:installationProjectId/exceptions`
- `/admin/furnishing/installations/:installationProjectId/inspection`
- `/admin/furnishing/installations/:installationProjectId/completion`

All routes use the shared Furnishing Studio shell and keep Installations active. Project creation remains visibly in `Awaiting order evidence`; no order or shipment is manufactured.

## Evidence and lifecycle contract

- Tracking lifecycle: Draft → Awaiting order evidence → In fulfillment → Delivery in progress → Installation in progress → Awaiting inspection → Complete → Archived, with blocking exceptions represented separately.
- An immutable planned baseline retains procurement, design, budget, room, selection, product, product-version, retailer, quantity, priority, assembly, and installation lineage.
- Governed order evidence distinguishes the external purchaser from recording and verification actors. Customer-reported evidence remains `reported_unverified`.
- Order allocations, split shipments, carrier-reported delivery, physical receipt, room allocation, installation, item/property inspection, and completion remain distinct.
- Exact quantity guards enforce shipped ≤ ordered, received ≤ ordered, installed ≤ received, and inspected/accepted completion ≤ installed.
- Completion requires every required planned line to be received, installed, inspected, and accepted, with no open blocking exception.
- Completion approval creates an immutable snapshot. A material correction appends original/corrected evidence, supersedes the current completion, archives the prior live inspection projection, requires reinspection, and creates a distinct approval snapshot. The original evidence and snapshot remain immutable and reproducible.
- Non-material corrections cannot change quantity, state, result, or completion truth.

## Database-executed lifecycle and negative proofs

The isolated lifecycle executes approved procurement snapshot → tracking project → controlled order evidence → allocation → split shipments → carrier delivery → physical receipt → room allocation → installation → inspections → completion → material correction → reinspection → reapproval.

Verified denials leave zero unintended mutation for missing evidence, replay/duplicate identities, shipment and receipt overages, installation overage or installation before receipt, uninspected completion, incomplete required quantities, open blocking exceptions, stale versions, anonymous access, direct immutable writes, authenticated cleanup, mismatched cleanup designation fields, customer/provider ownership, notifications, payments, retailer orders, non-controlled procurement, real installation activity, and real external FS-UX-007 evidence.

TV and mount completion remains governed as separate inventory/product selections through the frozen Room Package and Design Workspace lineage; the domain rule blocks a television completion when a required compatible mount is absent, incompatible, uninstalled, or subject to a blocking exception.

## Independent-session concurrency

Real independent PostgreSQL sessions prove:

- Receipt race: one canonical receipt wins; total receipt never exceeds the ordered allowance; the loser receives an actionable stale/quantity conflict and persists no partial receipt.
- Installation race: installed quantity never exceeds received quantity; one canonical event wins and the loser persists no duplicate evidence.
- Completion race: one immutable completion snapshot is created; replay resolves to that result; the approved tracking version matches final validation.
- Cleanup race: a concurrent dependency obtains the project guard lock before insertion. Cleanup then locks and archives the exact committed set, records the dependency in its manifest, and leaves no unarchived or partially archived controlled record. Evidence insertion after cleanup is blocked by the archived-project guard.
- Project mutation RPCs lock the installation project before subordinate quantity rows, providing a deterministic project-first acquisition order.

## Authorization execution matrix

The direct database matrix covers Platform Admin, Furnishing Admin, assigned delivery operator, assigned installer, assigned inspector, designer/contributor, customer/read-only viewer, wrong-workspace operator, suspended operator, anonymous, and service role.

- Admins retain governed operational and review authority.
- Delivery operators may record orders, shipments, delivery/receipt, room allocation, and bounded exception work but cannot install or approve completion.
- Assigned installers may perform assembly/installation work only.
- Assigned inspectors may inspect but cannot approve completion unless separately assigned reviewer authority.
- Designers, viewers/customer owners, wrong-workspace users, suspended users, and anonymous callers fail closed for mutations.
- Read access remains RLS-scoped to active workspace membership or Admin authority.
- Immutable evidence writes remain unavailable to authenticated and anonymous clients.
- Cleanup is executable only by `service_role`; Admin status does not grant cleanup.
- Recording actors remain separate from external purchaser, receiver, carrier, and installer descriptions.

## Controlled cleanup and replay

The service-only wrapper locks the designation, controlled project, installation project, and evidence rows. A project-row guard on every mutable FS-UX-007 evidence table prevents attachment after final validation. Cleanup rejects expired, revoked, candidate/run/correlation/workspace/creator mismatches, customer ownership, notification/payment/provider dependencies, real retailer/carrier/installer evidence, and non-controlled procurement or installation consequences.

For a successful controlled fixture, the manifest reconciles exact before/after counts for orders, allocations, deliveries, room allocations, installation events, exceptions, and inspections, while retaining corrections, completion snapshots, cleanup runs, and manifest evidence. Replay returns the original reconciliation and causes no additional mutation. Predecessor-only cleanup replay delegates safely to the frozen predecessor result.

## Full migration and proof results

- `FS008G_PRODUCTION_CEILING_SEQUENCE_PASS`
- `FS008G_IDENTITY_NEGATIVE_MATRIX_PASS`
- `FS_UX_003_DATABASE_MATRIX_PASS`
- `FS_UX_004_DATABASE_MATRIX_PASS`
- `FS_UX_005_DATABASE_MATRIX_PASS`
- `FS_UX_006_DATABASE_MATRIX_PASS`
- `FS_UX_007_DATABASE_MATRIX_PASS`
- `FS008G_CLEANUP_NEGATIVE_MATRIX_PASS`
- `FS_UX_007_CLEANUP_MATRIX_PASS`
- `FS_UX_007_RECEIPT_CONCURRENCY_PASS`
- `FS_UX_007_INSTALLATION_CONCURRENCY_PASS`
- `FS_UX_007_COMPLETION_CONCURRENCY_PASS`
- `FS_UX_007_AUTHORIZATION_MATRIX_PASS`
- `FS_UX_007_CLEANUP_CONCURRENCY_PASS`

The Production-derived seed retains 109 platform drafts, 220 import items, the existing import replay contract, and three frozen `legacy_ambiguous` packages. The migration creates zero workspace products, orders, shipments, receipts, installations, approvals, payments, notifications, or external effects.

## Local gates

- Focused implementation and migration tests: 13/13 across 2 files.
- Full suite: 4,624/4,624 across 845 files.
- Typecheck: passed.
- Full ESLint: passed with zero errors (9 pre-existing warnings).
- Migration lint: `lint: no findings`.
- Production build: passed; every canonical Installation route appears in the route manifest.
- `git diff --check`: passed.
- Integrated migration/lifecycle/negative/concurrency/cleanup sequence: passed.

The timing-sensitive AU-001B daylight-saving test timed out only during an intentionally parallel, resource-contended first gate attempt. It passed 10/10 in isolation and the subsequent uncontended full suite passed 4,624/4,624.

## Hold and rollout

No Production migration, deployment, activation, kill-switch change, retailer/carrier call, order, payment, notification, delivery scheduling, return execution, or installation effect occurred. Production remains unchanged at migration ceiling `20260829010000`.

Classification after commit and clean-tree verification: `FS-UX-007_LOCAL_IMPLEMENTATION_COMPLETE_PENDING_FINAL_PROGRAM_RECONCILIATION`.
