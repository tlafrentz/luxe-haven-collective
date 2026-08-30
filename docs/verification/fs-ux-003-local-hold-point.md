# FS-UX-003 local hold point

Status: **LOCAL IMPLEMENTATION COMPLETE — PRODUCTION UNCHANGED**

Foundation: `5ce707e8c0ae12b3a37af82f3be4a03a98fed8a9`. FS-UX-003 adds only the forward migration `20260830100000_fs_ux_003_inventory_import_workflow.sql`; corrected predecessor migrations remain frozen.

## Delivered contract

- Canonical routes: `/admin/furnishing/imports`, `/new`, `/:importId`, and nested `/mapping`, `/validation`, `/reconciliation`, `/complete`, plus authorized `/:importId/report` CSV evidence.
- Legacy `/admin/furnishing/products/import` and detail URLs permanently redirect to the canonical workflow while preserving the workspace handoff.
- Lifecycle: uploaded/parsed → mapping required → validation blocked or ready to reconcile → ready to commit → committing → complete, complete with skips, or complete with warnings. Existing legacy statuses remain compatible.
- CSV and XLSX only. Limits: 25 MiB source, 20 worksheets, 25,000 rows, 200 columns, 20,000 characters per cell, 20 image URLs, and 50 retained issues per row. Sources use the private `furnishing-import-sources` bucket and unguessable organization/import/digest paths.
- CSV handles UTF-8 BOM, detected common delimiters, quotes, escaped quotes, embedded delimiters/newlines, and malformed quote/encoding rejection. XLSX enumerates visible/hidden sheets, requires explicit selection when multiple visible sheets exist, reads cached formula results without evaluation, and ignores drawings.
- Mapping is explicit and persisted. Header aliases propose mappings, every source column can be remapped or ignored, incompatible duplicate targets and missing governed identity fields are rejected, and confirmation increments mapping/validation versions.
- Validation vocabulary: valid, valid with warnings, blocking error, intentionally skipped, duplicate candidate, existing-product match, and ambiguous match. Original values, canonical values, corrections, row digests, issues, actor, and timestamps remain distinct.
- Reconciliation outcomes: create platform draft, update editable platform draft, propose a revision for approved platform product, link unchanged, skip, or unresolved. Unresolved and blocking included rows prevent commit.
- Atomic commit uses one service-only transaction and an import-scoped advisory/row lock. New products are always `scope=platform`, `workspace_id=null`, `status=draft`. Approved rows create proposed versions; no workspace product, adoption, approval, identity claim, package, budget, procurement, retailer, payment, notification, installation, or activation effect is created.
- Idempotency is evidence-backed. A repeated or waiting concurrent commit with the same command returns the stored outcome; a different command cannot recommit a terminal import. Stale product revisions abort the transaction.
- Outcome reports escape spreadsheet-formula prefixes, use safe filenames, contain row/outcome identities, and are authorized at download time.

## Compatibility and database evidence

The exact migration rehearsal begins at Production ceiling `20260829010000`, seeds the three existing imports, 220 import items, 109 linked platform drafts, and three legacy packages, then applies the corrected FS-008G sequence, FS-UX-002, and FS-UX-003. Assertions prove:

- all three imports and 220 items remain;
- all 109 products remain platform-scoped drafts;
- zero workspace products are manufactured;
- completed legacy import replay remains valid;
- legacy package classifications remain unchanged;
- authenticated and anonymous direct commit execution is denied;
- one atomic commit creates one platform draft, retains skipped outcome evidence, and replays without duplication;
- workspace identity claims and adoptions remain absent;
- two concurrent commits produce one effect and one durable evidence row.

## Verification commands

- Focused parser/migration tests: `src/features/furnishing-studio/inventory-import.test.ts`, `fs-ux-003-migration.test.ts`.
- Focused furnishing integration: `npx vitest run src/features/furnishing-studio ...`.
- Production-ceiling rehearsal: `scripts/verification/verify-fs008g-production-ceiling.sh`.
- Commit concurrency: `scripts/verification/verify-fs-ux-003-concurrency.sh`.

Migration SHA-256: `a269518d969c942a4fc6569c487fdb277a68f23fca339a6e40bcc024a3981e2b`.

No Production migration, deployment, storage write, activation change, or external effect is authorized or performed by this local program.

## Final local gates

- Focused parser and migration tests: 10/10 passed.
- Focused Furnishing Studio and integration tests: 182/182 passed.
- Full suite: 4,573/4,573 passed across 837 files.
- Production-ceiling migration/database matrix: passed.
- Concurrent commit matrix: passed.
- Typecheck: passed.
- Full lint: passed with zero errors (nine pre-existing warnings).
- Migration lint: passed with no findings.
- Production build: passed and emitted every canonical/legacy import route.
- `git diff --check`: passed.
