# FS-UX-008 local hold point

Status: `FS-UX-008_LOCAL_IMPLEMENTATION_COMPLETE_PENDING_FINAL_PROGRAM_RECONCILIATION`

## Candidate boundary

- Required starting point: `a32f48ed9ccc3fa48d1ddf3cf760a56d4ee2ccef`.
- Intermediate implementation commit: `98101b498d19c155ddaa77228f47cc588fc0feaa`.
- Original migration: `20260830150000_fs_ux_008_release_controls.sql` (`9eca483b7977c30e910074ae138e7c79287b882bb51081ac2c26efc60d62b75f`).
- Forward correction: `20260830151000_fs_ux_008_control_orchestration.sql` (`f06aad6d71f31f3c76ea46c6c8b2d902a4509b5707b1310de492c7eb7fe7089a`).
- The original migration is unchanged. The corrective digest is new because the intermediate commit lacked governed recovery, server verification, delegated RLS alignment, and serialized suspension precedence.
- Production remains unchanged at ceiling `20260829010000`.

## Routes and controls

Delivered routes are `/admin/furnishing/release-controls`, `/workspaces/:workspaceId`, `/workspaces/:workspaceId/capabilities/:capability`, `/history`, and `/history/:eventId`; the legacy activation URL redirects to the console. Arbitrary workspace entry is absent.

The sequence remains Catalog viewing → Design Workspace → Budgeting → Procurement readiness. Enabled steps default to View details or Verify. Capability detail exposes **Prepare rollback** only when authorized. The database enforces Procurement readiness → Budgeting → Design Workspace → Catalog viewing rollback, preserves evidence, and makes replay idempotent.

## Governed recovery

Workspace and global suspension create distinct immutable suspension/audit records. Recovery requires separately assigned recovery permission, current policy/version, an active suspension, meaningful reason, and risk resolution. Workspace recovery validates the cohort. Global recovery returns to protected Internal state with the global safety control engaged. Recovery enables no capability; capabilities require deliberate reverification. Missing suspension, stale version, unresolved risk, inactive cohort, unauthorized or anonymous actor, and conflicting global suspension fail with zero mutation. Replay returns the canonical result.

## Server verification

`fsux8_verify_capability_v2` accepts no client success assertion. It serializes on the control lock, validates actor/workspace/cohort/policy/version/suspension, runs capability checks, snapshots lifecycle/external-effect counts, and persists a run plus individual checks. Failed required checks cannot become verified.

- Catalog: governed read/denial boundaries and zero catalog mutation.
- Design Workspace: bounded projection and zero property/workspace/package application.
- Budgeting: fixed-minor-unit and snapshot compatibility with zero approval/payment/customer effect.
- Procurement readiness: readiness projection, fail-closed execution, and zero retailer/cart/order/payment/notification/delivery/installation effect.

The legacy client-directed verification RPC is revoked from authenticated callers.

## Authorization

Permissions separate view, control, verification, workspace/global suspension, workspace/global recovery, cohort control, and release-mode authority. Recovery is not inherited from Admin status. The direct matrix proves assigned operator access, ordinary Admin control, separate recovery authority, wrong-workspace, unassigned, suspended-assignment, and anonymous denial, plus immutable-evidence write denial. Projection RLS and the resolver use the same authority function.

## Database and concurrency proof

The lifecycle matrix executes ordered enable/verification for all capabilities, invalid order and rollback denials, reverse rollback, reenabling, workspace suspension/recovery, global suspension/recovery, replay, history reconciliation, and zero effects.

Independent PostgreSQL sessions prove global suspension versus enable, enable versus enable with one stale loser, workspace suspension versus verification, cohort expiration versus verification, and forced audit-persistence failure. Suspension/expiration wins its race, no partial transition or fabricated verification persists, and forced audit failure rolls state back atomically. Lock ordering uses one deterministic advisory transaction lock and projections are reread from the database.

## Local baseline

The lifecycle ends at Internal and Protected, active controlled cohort, global safety control engaged, capabilities requiring deliberate verification, external execution unavailable, exact audit reconciliation, and zero created lifecycle or external-effect rows.

## Final gates

- Focused tests: 25/25 across 3 files.
- Full suite: 4,634/4,634 across 847 files.
- Typecheck: passed.
- Full lint: passed with zero errors and nine unchanged warnings.
- Migration lint: passed with no findings.
- Production build: passed; all five routes emitted.
- `git diff --check`: passed.
- Migration sequence: passed from `20260829010000` through corrected FS-008G, FS-UX-002–007, `20260830150000`, and `20260830151000`.
- Lifecycle, direct authorization, concurrency, stale-state, and audit-atomicity matrices: passed.

## Stop conditions

No Production migration or deployment occurred. Stop if the ceiling, final candidate SHA, migration digests, policy, controlled designation, safety state, RLS/grants, or zero-effect boundary differs. Production activation, kill switches, furnishing records, procurement, retailer, payment, notification, delivery, and installation state remain unchanged.
