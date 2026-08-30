# FS-UX-001/002 local completion and migration preflight

Status: **HELD PENDING CORRECTED FS-008G PREDECESSOR — DO NOT MIGRATE OR DEPLOY**

Authoritative predecessor correction runbook: `docs/verification/fs008g-corrected-predecessor-local-hold-point.md`.

Candidate classification: FS-UX-001 implemented pending combined production reconciliation; FS-UX-002 core and versioned edit implemented pending controlled production verification. Production and capability state were not accessed or changed.

## Completion decisions

- Versioned editing is implemented at `/admin/furnishing/catalog/:productId/edit`. Draft edits update the current draft under an expected revision and record a version snapshot. Approved edits create one proposed revision, preserve the approved row and snapshot, expose usage impact, and require a separate approval transaction before updating the live projection.
- Workspace mutations require authoritative server-issued command context. Platform mutations require the separate platform-admin boundary. Both paths validate the current revision and use idempotency identities.
- Usage impact covers room-package items, design workspaces, budgets, and procurement items. Historical references are displayed and are never rewritten by the edit or approval transaction.
- Bulk actions are explicitly deferred from FS-UX-002. No selection affordance, bulk action control, bulk endpoint, or implied active capability is exposed.

## Remaining-failure reconciliation

### FS-008G procurement-source assertion

- Exact test: `src/features/furnishing-studio/fs008g-c1-wiring.test.ts`, “keeps owner projection read-only and exposes one source-aware Admin control.”
- Exact old assertion: the customer branch must contain `[null, null, [], []] as const`.
- Committed pre-FS-UX baseline: `HEAD` contains the four-part tuple and matching assertion.
- Pre-FS-UX working-tree/FS-UX-001 candidate: `procurement-workspace.tsx` was already modified to a seven-part fail-closed tuple, `[null, null, null, null, [], [], []]`, while the assertion remained stale; the test failed.
- FS-UX-002 candidate: the catalog migration and product source/adoption contract do not touch this customer projection. The assertion now matches the existing seven-part tuple and passes.
- Classification: **PRE_EXISTING_UNCOMMITTED_REPRODUCED; stale static assertion corrected**. This is not a product-source or lineage behavior change.

### Full lint

- Exact failure: `scripts/verification/verify-fs008g-c8-browser.ts`, `generate` at the owner-project step violated `prefer-const`.
- The verification script was already modified before FS-UX-001 and is not part of the catalog transaction.
- Correction: mechanical `let` to `const`; verification behavior is unchanged.
- Classification: **PRE_EXISTING_UNCOMMITTED_REPRODUCED; mechanical correction applied**.

## Migration preflight for `20260830090000_fs_ux_002_catalog_lifecycle.sql`

- Local forward-only predecessor: `20260829051000_fs008g_c8d_requirement_review_state.sql`; FS-UX follows at `20260830090000` only after a separate FS-008G Window A certification.
- Exact Production ceiling: `20260829010000`. Production commit `87ea1f9dff01b64cdf99457b6764b2a6f8feb192` is internally consistent with that ceiling. No Production mutation occurred.
- Existing-row compatibility: the migration adds nullable/defaulted columns and new evidence tables. It does not rewrite product scope, workspace, lifecycle, approval, retirement, or activation state.
- Imported platform drafts remain valid (`scope=platform`, `workspace_id=null`, `status=draft`). Direct controlled approval remains workspace-only; adoption creates a distinct workspace draft.
- Duplicate analysis: the migration aborts before creating the active governed-identity index if duplicate active `(workspace_id, family_product_id)` rows exist. Those records must be listed for governed review; they are never silently merged.
- Ambiguous lineage: existing records are not backfilled or inferred. Missing/ambiguous lineage remains visible for governed review.
- Idempotency: adoption, draft edit, revision proposal, revision approval, review submission, approval, and retirement use unique command identities/replay handling. Migration application remains governed by the platform migration ledger and is forward-only.
- Transactionality: the whole migration and every governed RPC are transactional; failure cannot leave a partial product, lineage, review, or approval record.
- RLS/grants: evidence tables enable RLS; anonymous/public privileges and authenticated writes are revoked. Authenticated workspace evidence reads require controlled visibility. Security-definer functions revoke anonymous/public execution, require authenticated Admin authority, validate scope, and use fixed `search_path` values.
- Authorization checks still required in the controlled window: owner, other-owner, Admin, wrong-organization, and anonymous access against the deployed policy set. Local static tests are not production authorization evidence.
- Side-effect review: no automatic adoption, approval, retirement, activation, procurement, payment, notification, retailer-order, or installation statement exists. Activity metadata explicitly records `externalEffects=false`.
- Roll-forward recovery: do not roll back governed evidence. Correct any failed constraint/function in a later timestamped migration, retain the failed deployment evidence, rerun preflight, then retry. If duplicate or ambiguous rows block application, leave them unchanged, resolve through separately authorized governance, and apply forward.

## Controlled-window hold points

Before migration: capture candidate commit, deployment identity, exact production ceiling, duplicate/lineage query results, grants/function ownership, and current activation/kill-switch state. Stop on any mismatch.

After deployment: execute the combined FS-UX-001/002 route, scope, adoption, approval, versioned-edit, historical-usage, tenant-denial, mobile, and cleanup script described in the milestone acceptance plan. Preserve immutable evidence and return mutable counts and all capability state to baseline.
