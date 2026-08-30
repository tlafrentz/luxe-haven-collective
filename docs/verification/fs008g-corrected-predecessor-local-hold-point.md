# FS-008G corrected predecessor local hold point

Status: **LOCAL VALIDATION IN PROGRESS — NO MIGRATION OR DEPLOYMENT AUTHORIZED**

Classification: `FS-UX-001/002_HELD_PENDING_CORRECTED_FS-008G_PREDECESSOR`.

## Migration-history decision

The shared-environment ledger establishes Production at `20260829010000`; migrations `20260829020000` through `20260829051000` have not reached any shared environment. Their contents are therefore corrected in place before first shared application, retaining chronological identities. Disposable local databases may be reset. Migration history in a shared environment must never be rewritten. Window A must stop at and independently certify `20260829051000`; only Window B may apply `20260830090000` and deploy FS-UX-001/002.

## Canonical catalog contract

Inventory import creates or replays a platform draft only: `scope=platform`, `workspace_id=null`, `status=draft`. Import ID/item, file digest, row identity, retailer/SKU, normalized identity, actor, correlation, version, and idempotency lineage are retained. The sole normal transition into a workspace catalog is the FS-UX adoption transaction, which creates a separate workspace draft with source product, revision/digest, import lineage, overrides, actor, correlation, and idempotency evidence. Platform products cannot be approved directly.

All active workspace-product entry points use `canonical_furnishing_product_identity` and `claim_furnishing_workspace_product_identity`. Claims cover workspace plus source platform product, normalized product identity, and normalized retailer/SKU/variant identities. Null components cannot bypass claims. A workspace-scoped advisory transaction lock serializes manual creation, adoption, offers, and revision activation. Retired claims remain reserved and require governed replacement/reactivation; they are not silently reusable. Workspace is part of every claim, while retailer and variant distinctions remain valid.

## Controlled cleanup contract

A service-role boundary creates an unbound, expiring designation before account, property, or project creation. Binding proves run, correlation, candidate, creator, workspace, creation time, controlled naming, account membership, and property lineage. A pre-existing project cannot be attached after the fact, and one designation cannot be reused.

Cleanup accepts designation, project, workspace, run, candidate, correlation, actor, and idempotency identity. It locks the designation, project, and enumerated dependencies in deterministic order and revalidates after acquiring mutation authority. Dependency inserts take a project key-share lock; therefore they either commit before final validation and block cleanup, or wait until cleanup archives the project and are rejected by the closed-project trigger. Customer/provider ownership, notification, payment, retailer order, procurement, installation, and non-controlled lifecycle dependencies fail closed with zero archival. Success archives only enumerated controlled rows, retains immutable evidence, stores exact per-table counts, revokes the designation, and returns the stored result on replay. Anonymous, authenticated, and Admin-direct execution are revoked; service role alone may execute designation, binding, and cleanup.

Evidence tables grant authenticated `SELECT` only, with RLS authoritative. Admin visibility is workspace-scoped where the evidence is workspace-scoped; non-Admin, wrong-workspace, and anonymous reads fail closed. Direct authenticated writes remain revoked.

## Production-derived legacy packages

Production read-only evidence supports the same disposition for each record: **ambiguous legacy record excluded from active lifecycle**.

| Package ID | Name | Evidence and disposition |
| --- | --- | --- |
| `4d162594-f9a7-45e9-881e-adba36cd7406` | Modern Apartment | Created `2026-08-03T04:12:41.159094Z`; workspace-null draft; no current version, versions, composition, project, or plan references. Creator is not represented in the legacy table. No authoritative workspace or platform-template provenance exists. |
| `c196e39c-5d10-4f9a-a8ea-48045da3fa10` | Mountain Cabin | Same production-derived conditions; no authoritative workspace mapping or reusable-template evidence. |
| `a7e0d9cd-3f94-4ccb-9be4-c218bd0a1a96` | Beach House | Same production-derived conditions; no authoritative workspace mapping or reusable-template evidence. |

The migration assigns `governance_scope=legacy_ambiguous`, leaves `workspace_id` null, freezes draft/current-version-null state, excludes these rows from active workspace lifecycle, and preserves Admin visibility for governed resolution. New ambiguous records are forbidden. No workspace is inferred.

## Local execution and stop conditions

The exact rehearsal starts at `20260829010000`, seeds the 109 platform-draft condition plus the three exact legacy packages, and applies `29020000 → 29030000 → 29040000 → 29050000 → 29051000 → 30090000`. It must prove all 109 remain platform drafts, zero workspace products are manufactured, import replay remains valid, grants/RLS are exact, cleanup is service-only, and adoption remains the sole platform-to-workspace transition.

Stop Window A for any duplicate/ambiguous identity, constraint violation, cleanup dependency, manifest mismatch, grant/RLS drift, inferred workspace, automatic adoption/approval/activation, or external effect. Window B remains blocked until Window A independently establishes and certifies ceiling `20260829051000`.

Corrected SHA-256 digests (recorded before first shared application):

- `20260829020000`: `414df501890015be632f5a4fa3f8cbecfe151463b2c8d54775e3f0bac2b3baf0`
- `20260829030000`: `a09eaa3fd01814fb662ab9b25d2bdc262eb7a6ccebfe1be91b5c2b7abbfd0f1d`
- `20260829040000`: `1d629e75c3c51737b1a1fe63624fd94aa3ae8fd316bf5c82d68c30d0ad158c07`
- `20260829050000`: `c31923754dc89c423c34c0b9cf559811fe8fcbb07913ea7c0914972d0f39ba36`
- `20260829051000`: `7ebcb61396e1290e99d9f23da0cf15ee12b14b035c6668bfdb7ebbc725666137`
- `20260830090000`: `b3175e282cf8edf9b11377f96c2ea6e6c8352d28d60da24addaf2055c4200929`

Final local results: focused migration tests 23/23; full suite 4,563/4,563; TypeScript, full ESLint, migration lint, Production build, and `git diff --check` pass. Database-executed Production-ceiling sequence, identity negative matrix, identity concurrency, cleanup negative matrix, and cleanup concurrency all pass.
