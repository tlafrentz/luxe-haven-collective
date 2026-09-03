# FS-UX-010 — Simplified Furnishing Product Library: Production reconciliation

**Status:** Phases 1-4 delivered and certified in Production. Scope, decisions, and
verification evidence below.

## Scope delivered

Phases 1-4 of FS-UX-010: consolidated Product Library (no platform/workspace
vocabulary in the ordinary UI), horizontal Furnishing Studio navigation,
SSRF-safe add-by-link flow (URL validation, JSON-LD/Open Graph/heuristic
extraction, retailer detection), duplicate handling, governed platform-scope
create/archive RPCs, and a lightweight style-tag taxonomy. Phase 5 (this
document) covers deployment and the controlled Production journey only —
no further application changes were made as part of certification.

## Architecture decisions (see the approved implementation plan for full rationale)

- New add-by-link products are created with `scope='platform'`,
  `workspace_id=null` — the only scope gated by `is_admin()` alone, matching
  "no picker" and "no cloning" requirements without touching the
  `authorize_controlled_furnishing_catalog_mutation`/`ps001d_verification_tenants`
  boundary.
- The new `create_furnishing_library_product`/`archive_furnishing_library_product`
  RPCs deliberately do not call `assertFurnishingActivationMutationDisabled()`,
  following the precedent already set by every FS-UX-002 governed RPC
  (adopt/edit/approve/transition). Locked in by
  `src/app/actions/furnishing-library-guards.test.ts`.
- Duplicate identity is a generalization of the existing FS-UX-002
  `claim_furnishing_workspace_product_identity` mechanism (new
  `claim_furnishing_product_identity`, workspace function becomes a thin
  wrapper), not a parallel mechanism — extended to cover platform scope and a
  new `canonical_url` identity kind.
- A dedicated `archive_furnishing_library_product` RPC was added for
  platform scope rather than relaxing `transition_furnishing_product_review`'s
  existing `scope='workspace'` restriction, to avoid touching an
  already-certified function.

## Migration

- File: `supabase/migrations/20260902020000_fs_ux_010_product_library.sql`.
- Production migration ceiling before this work: `20260902014000` (matches
  the FS-UX-009 certification record exactly — confirmed via
  `supabase migration list` immediately before applying).
- Applied to the production project (`jumdtoraygqaraditnie`) via
  `supabase db push --linked --yes`, executed directly by the platform
  operator (Todd Lafrentz) per this session's safety boundary — the agent
  session's own attempt was blocked by the harness's auto-mode classifier,
  which does not permit direct production database writes regardless of
  in-conversation approval.
- Post-push `supabase migration list` confirmed the remote ceiling advanced
  to exactly `20260902020000` with no drift, and Postgres applies each
  migration file as a single transaction, so the ceiling match is direct
  evidence the entire file (including its DDL, RPCs, and taxonomy backfill)
  applied cleanly.

### Local verification before Production

- Full local Docker/Postgres reset (`supabase db reset --local`) replayed
  every migration from `0001` through `20260902020000` in order, confirming
  no dependency drift.
- `supabase/tests/fs_ux_010_product_library.sql` (a plain SQL fixture script,
  matching the existing `supabase/tests/*.sql` convention, run via
  `psql`/docker exec, rolled back at the end) exercised, against the full
  real migration chain: authorized create, idempotent replay, pre-check
  duplicate detection (same canonical URL, different idempotency key),
  variant distinction (different canonical URL), a forced exact-duplicate
  hard failure, missing-required-field rejection, archive + idempotent
  re-archive, unauthorized (non-admin) denial, and taxonomy-backfill
  idempotency (re-running the identical backfill insert logic a second time
  changes no row counts). All nine assertion blocks passed.
- This process caught and fixed two real defects before Production: an
  ambiguous PL/pgSQL variable name in `create_furnishing_library_product`,
  and an identity-collision bug where two products with no retailer/SKU set
  would hash identically on the `retailer_sku` identity kind and falsely
  block each other (fixed by only computing that identity claim when both
  `retailer_id` and `sku` are present).

## Deployment

- Commit `b4429499be16cc5b89a5626a863fdc57b9bb4a5f` (`feat(fs-ux-010): add
  simplified furnishing product library`) pushed to `origin/main`. This
  also brought the entire prior FS-UX-008/FS-UX-009 development history (44
  commits) onto `main` for the first time — `main` had not been kept in
  sync with what was actually deployed to Production; confirmed with Todd
  before pushing that Production had been deployed by another mechanism and
  that catching `main` up was intentional.
- Vercel's GitHub integration auto-deployed the push (per
  `.github/workflows/vercel-production-guard.yml`); the push itself was
  executed directly by Todd, for the same classifier-boundary reason as the
  migration push.
- Deployment `dpl_5S7TptLU9Hg1dzsym2bR8iyBtzj6` reached `Ready` and is
  aliased to `luxehavencollective.co`. Read-only smoke check: homepage
  returns `200`; `/admin/furnishing/products` redirects unauthenticated
  requests to Sign In (`200` after redirect, correct title), no server
  errors observed.

## Controlled Production journey

Executed via Todd's own authenticated browser session (Claude in Chrome,
Todd signed in directly — no credentials entered by the agent), 2026-09-03:

1. Opened `/admin/furnishing/products` — Product Library rendered with 24
   existing saved products, horizontal nav (Overview / Product Library /
   Room Packages / Furnishing Plans / Procurement / Installations), no
   platform/workspace picker anywhere in the ordinary view.
2. Clicked **Add product**, pasted a real, live retailer URL
   (`https://www.ikea.com/us/en/p/blahaj-soft-toy-shark-90373590/`).
3. Server-side SSRF-safe fetch + JSON-LD extraction succeeded against the
   live page: name ("BLÅHÅJ Soft toy - shark 39 ¼""), brand ("IKEA"), price
   ($29.99), SKU ("903.735.90"), availability ("In stock") were all
   correctly pre-filled from real extracted data.
4. Confirmed/completed required fields (product type: Decorative Objects;
   room: Living Room) and saved. Save succeeded immediately with a concise
   confirmation ("Product saved — It is ready to use in room packages and
   furnishing plans.") and returned a stable product id
   (`d03252a4-6c8e-4021-99b1-7d1f8c95adac`).
5. Product detail page showed classification, price/availability evidence
   with a "Last verified" timestamp, SKU, source ("Link Import"), and one
   audit activity entry ("Furnishing Library Product Created").
6. Searched the Product Library for "shark" — the new product was
   immediately discoverable, URL-persisted (`?q=shark`), no separate
   adoption step required.
7. Archived the product with a stated reason. Product detail immediately
   showed an "Archived" badge and a second audit activity entry
   ("Furnishing Library Product Archived") — the original "Created" entry
   remained, proving the record was preserved, not deleted.
8. Re-searched "shark" in the ordinary Product Library — 0 results, correct
   "No products match the current search or filters" empty state (not a
   "library is empty" message), confirming Production is reconciled back to
   its prior state (24 saved products) with the test record retained only
   as an archived historical row.

**Not re-verified live in Production** (already covered by the local SQL
fixture test against the real migration chain, and skipped live only
because the harness's classifier declined a further production write within
the same session): resubmitting the identical URL to observe the
"Open existing / Update existing / Save anyway" duplicate-choice UI live.
The underlying duplicate-detection RPC path is identical to what created
and archived the verified product above.

## External effects

Zero orders, payments, provider mutations, or notifications were created at
any point in this journey. No such surfaces (`furnishing_procurement_*`,
commerce/payment tables, notification dispatch) were touched by any action
taken. The create RPC's own audit metadata records `externalEffects: false`
on the activity row for this exact product.

## Production reconciliation

Final state: 24 saved products (unchanged from before the journey), the one
controlled test product retained as `status='archived'` with a full
create→archive audit trail, migration ceiling `20260902020000`, deployment
`dpl_5S7TptLU9Hg1dzsym2bR8iyBtzj6` `Ready` at `luxehavencollective.co`.
