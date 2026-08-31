# FS-UX-008 local hold point

Status: `FS-UX-008_LOCAL_IMPLEMENTATION_COMPLETE_PENDING_FINAL_PROGRAM_RECONCILIATION`

## Candidate boundary

- Starting candidate: `a32f48ed9ccc3fa48d1ddf3cf760a56d4ee2ccef`.
- Forward migration: `20260830150000_fs_ux_008_release_controls.sql`.
- Production remains unchanged at migration ceiling `20260829010000`.
- The migration is state-neutral: it enables no capability, creates no cohort, changes no release mode, and lifts no safety control.

## Delivered routes

- `/admin/furnishing/release-controls`
- `/admin/furnishing/release-controls/workspaces/:workspaceId`
- `/admin/furnishing/release-controls/workspaces/:workspaceId/capabilities/:capability`
- `/admin/furnishing/release-controls/history`
- `/admin/furnishing/release-controls/history/:eventId`
- `/admin/furnishing/activation` redirects to the canonical console.

The overview removes free-form workspace identity. Operators choose a row from the authoritative controlled-workspace projection. All pages require the internal Admin boundary; direct dynamic identifiers are resolved server-side and fail closed.

## Control contract

The policy sequence remains Catalog viewing → Design Workspace → Budgeting → Procurement readiness. Database enforcement requires every predecessor to be enabled and verified. Rollback is enforced in reverse order. Enablement resets verification evidence; verification is a separate, idempotent, immutable-audited transaction. Every mutation requires a 12–500 character plain-text reason, current version, correlation, and idempotency identity.

The console presents Internal, Protected, Suspended, and unavailable states in operator language. An engaged global safety control is represented as intentionally protected. Capability activation is explicitly non-executing. Delivery and Installation Tracking is not appended to FS-008A.

## Database proof

`scripts/verification/fs-ux-008-database-matrix.sql` executes the sequence guard, rejects out-of-order activation with zero mutation, records and replays verification idempotently, reconciles one immutable evidence event, blocks forward-order rollback, and restores the safe disabled capability baseline inside a rolled-back fixture transaction.

The full Production-ceiling harness applies the corrected FS-008G sequence followed by FS-UX-002 through FS-UX-008 and then executes the FS-UX-008 database matrix. The new trigger and verification function use fixed empty `search_path`; anonymous execution is revoked; authenticated invocation still requires `auth.uid()` and `is_admin()`. Authenticated direct writes to activation state and evidence remain revoked by the frozen foundation.

## Safety and external effects

Release controls update only canonical activation state and immutable activation evidence. They do not create products, imports, packages, Design Workspaces, budgets, procurement projects, orders, payments, notifications, delivery records, installation records, or completion evidence. Retailer and provider execution remain unavailable. Production activation and kill-switch state were not read or mutated during local implementation.

## Verification results

- Migration SHA-256: `9eca483b7977c30e910074ae138e7c79287b882bb51081ac2c26efc60d62b75f`.
- Focused Release Controls tests: 21/21 passed.
- Full suite: 4,630/4,630 passed across 846 files.
- Typecheck: passed.
- Full lint: passed with zero errors (nine unchanged repository warnings).
- Migration lint: passed with no findings.
- Production build: passed; all five canonical Release Controls routes were emitted.
- `git diff --check`: passed.
- Production-ceiling sequence: passed from `20260829010000` through corrected FS-008G and FS-UX-002–008; all prior database matrices and the FS-UX-008 transition matrix passed.
- Designated database lifecycle: out-of-order activation denial, ordered activation, distinct verification, idempotent replay, reverse rollback, immutable history, and safe-baseline restoration passed.

## Production stop conditions

No Production migration or deployment is authorized. Stop if the predecessor ceiling, candidate SHA, migration digest, policy, controlled designation, safety state, RLS/grants, or zero-external-effect boundary differs from this evidence. FS-UX-008 remains a local candidate pending final program reconciliation.
