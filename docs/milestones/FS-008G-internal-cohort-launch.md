# FS-008G Internal Cohort Launch — Guided Production Runbook

Status: `READY_FOR_HUMAN_PROFILE_CONFIRMATION`. No launch correlation exists and no activation mutation has occurred.

## Frozen correction deployment

- Candidate: `dd4fd999c0ccccbff8a71752b3ef0ade40360c39`
- Deployment: `dpl_Exx2zFBcnHK88rR4itBhdo9Gkd2S`
- Immutable URL: `https://luxe-haven-collective-mtl1j4xr6-luxe-haven-collective.vercel.app`
- Production origin: `https://luxehavencollective.co`
- Supabase: `jumdtoraygqaraditnie`; migration ceiling `20260825053000`
- Controlled workspace/tenant: `4abe0850-6ad7-40a0-89bb-b1fb5e6afe82`, designation `PS001D_VERIFICATION_ONLY_NON_CUSTOMER`
- Rollback deployment: `dpl_BBonyFgEBqfUvJkTk4v6dYHfTcJ2`

## Human-held profiles

Do not export cookies, tokens, credentials, browser storage, or session links.

| Profile | Non-secret label | Login | First destination | Expected display |
| --- | --- | --- | --- | --- |
| A | Controlled Administrator | `/login` | `/admin/furnishing/activation` | Admin Furnishing controls; release `disabled`; kill switch `engaged`; policy `fs008a-v1` |
| B | Controlled Owner/Customer | `/login` | `/dashboard/furnishing/projects` | Controlled workspace only; no unrelated customer or workspace data |

Todd must confirm: `PROFILE_A_AUTHENTICATED_ISOLATED` and `PROFILE_B_AUTHENTICATED_ISOLATED`. Development then reruns read-only identity, deployment, migration, configuration, resource, and log preflight and creates one fresh FS-008G correlation and manifest. Do not click an activation control before Development says `FS008G_MUTATION_WINDOW_OPEN`.

## Guided action checklist

Development records UTC timestamps, safe screen result, generated record IDs, audit IDs, and a screenshot after each numbered step. Todd pauses after each submit until Development replies `RECONCILED`.

1. Admin opens `/admin/furnishing/activation`. Confirm `disabled`, `engaged`, and zero enabled controls. Enter the run reason supplied by Development.
2. Click **Create/grant controlled cohort**, confirm the dialog, and wait for **control updated**. Development reconciles one internal cohort row and one audit.
3. Click **Enable controlled workspace**, confirm, and wait for **control updated**. Development verifies only workspace `4abe…afe82` is enabled.
4. Enable, one at a time, **catalog_viewing**, **design_workspace**, **budgeting**, and **procurement_readiness**. Development reconciles each version and audit. Do not enable any other capability.
5. Click **Restore workspace kill switch**, confirm, and reconcile.
6. Click **Set global state: internal**, confirm, and reconcile. Public and unrelated workspace probes must remain denied.
7. Click **Lift global kill switch** last. Development immediately checks isolation, public denial, zero external effects, and logs. Any mismatch invokes the stop instruction below.
8. Admin opens `/admin/furnishing/products/import`, selects the preserved `Catalog Review (1).xlsx`, and follows the visible upload/review action. Confirm the safe result reports 110 Catalog Review rows and no blanket approval. Development records the import and row ledger.
9. Admin uses `/admin/furnishing/products`, `/admin/furnishing/packages`, and their visible create/detail controls to build the correlation-named two-room FS-DESIGN fixture supplied at run time. Attempt incomplete approval first; then complete the fixture and use the visible package approval reason control. Development reconciles products, preferred/alternate offers, TV/mount compatibility, delivery, durable and initial-setup treatments, readiness, replay, and audit.
10. Owner opens `/dashboard/furnishing/projects`, selects the controlled FS-DESIGN project, chooses the internal package and room products, uses one approved alternate, reviews budget, and submits. On the project detail page click **Save immutable catalog snapshot** once. Refresh; do not click again until Development confirms exact replay expectations. Development reconciles normalized items, canonical rooms, totals, lineage, and hash.
11. Admin opens `/admin/furnishing/projects/<project-id>/procurement` and clicks **Start procurement**. The server selects snapshot-native lineage; there is no source-type selector. Development reconciles the snapshot ID, version, hash, baseline, lines, and audit before continuing.
12. Admin follows the visible Procurement tabs in order: **Budget** → **Items** → **Batches** → **Orders** → **Receiving** → **Activity**. Use only Development-supplied synthetic values and external reference `FS008G-TEST-<correlation-suffix>`. Never contact a retailer.
13. Owner opens `/dashboard/furnishing/projects/<project-id>/procurement`. Confirm safe progress and budget status are visible, no Admin reason/audit/provider/internal reconciliation fields appear, and no mutation control is offered.
14. Admin performs the kill-switch drill at `/admin/furnishing/activation`: click **Engage global kill switch** and reconcile denied mutations plus policy-compliant historical reads. Restore internal-only state only after Development gives `DRILL_RESTORE_AUTHORIZED`.
15. Development performs governed cleanup/archival of synthetic transaction records, reconciles retained internal resources, and begins the T+0/T+4h/T+24h observation schedule.

## Stop and kill-switch instruction

On any unexpected public eligibility, cross-tenant visibility, unauthorized mutation, duplicate resource, retailer/provider traffic, notification, payment, installation effect, lineage loss, budget inconsistency, or unexplained error:

1. Todd stops all business clicks immediately.
2. In Profile A open `/admin/furnishing/activation`, enter reason `FS-008G immediate safety stop`, click **Engage global kill switch**, and confirm once.
3. Todd reports the displayed result and UTC time only—no session data.
4. Development confirms the authoritative kill-switch audit, disables capabilities, revokes the controlled workspace/cohort through the governed controls, reconciles the manifest, and evaluates application rollback.

The emergency control is safe to use without waiting for Development when a listed stop condition is observed.
