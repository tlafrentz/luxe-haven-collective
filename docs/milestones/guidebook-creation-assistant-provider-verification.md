# Guidebook Creation Assistant Provider Verification

Status: **BLOCKED — foundation deployed; controlled execution not started**

Observed: 2026-08-15 (America/Chicago)

## Candidate identities

- Original runtime candidate: `fd87d0d3d15bfbc3251fd3c2aaa58499de0180db`
- Original deployment: `dpl_Fx1tvtCi4UU4HhgXM6JprwSp8mha`
- Migration-control head: `5c494307ace9e1b1ee5bee625525386d05be2435`
- Provider evidence: `29b04821e64bfadc2e80ff647c1abbeecba02984`
- Reconciliation commits: `1af4e57c514767082f10a1b91d93d4c80a7f258f`, `5c494307ace9e1b1ee5bee625525386d05be2435`
- Cleanup defect fix: `97ffb353`
- Capability wiring fix: `6c5d0ae8`
- Corrective deployment: `dpl_2X8gMyRXX3JDTigRMRqzXQFGFW6n`
- Canonical alias: `https://luxehavencollective.co` (HTTP 200)

The corrective deployments were permitted only after deployed verification
revealed real runtime defects. The original candidate and deployment remain
recorded separately rather than being relabeled.

## Migration result

The final SQL was inspected before application.

- `20260815090000_guidebook_creation_assistant_foundation.sql` adds only the
  eight Creation Assistant tables, their constraints and indexes, RLS and
  read policies, the private source bucket policy, service-role grants, and
  the bounded work-claim function.
- `20260815091000_local_bootstrap_service_compatibility.sql` is grant-only in
  hosted production and does not change rows or schema shape.
- Neither migration enables Auto-create, creates a cohort, invokes a provider,
  queues work, publishes a guidebook, or contains destructive DDL/DML.

Both migrations were applied in chronological order through `supabase db
push --linked`. The remote ledger records each version exactly once. The
follow-up production dry-run is empty.

A schema-only before/after comparison showed only the intended Creation
Assistant objects. No unrelated public or storage object was added, removed,
or recreated. The CLI emitted a local post-apply catalog-cache warning caused
by a missing temporary certificate; the authoritative remote ledger, schema
dump, PostgREST checks, and empty dry-run all confirmed successful application.

## Deployed foundation verification

- All eight tables exist with zero rows:
  `guidebook_creation_jobs`, `guidebook_creation_attempts`,
  `guidebook_creation_sources`, `guidebook_creation_facts`,
  `guidebook_creation_confirmations`, `guidebook_creation_artifacts`,
  `guidebook_creation_events`, and `guidebook_creation_work_items`.
- All eight tables have RLS enabled and the scoped authenticated read policies
  from the reviewed migration.
- The expected six supporting indexes and the service-role-only work claim
  function are present.
- Bucket `guidebook-creation-sources` is private, capped at 25 MiB, and allows
  only PDF, DOCX, plain text, JPEG, PNG, and WebP.
- Anonymous table reads return no Creation Assistant records.
- The internal route remains unlinked and unauthenticated access redirects to
  the established login boundary (HTTP 307).
- Auto-create remains absent from normal Admin and Dashboard navigation.

Focused Creation Assistant tests passed (23), typecheck passed, lint passed,
the corrective production builds passed, migration lint reported no findings,
and the final production migration dry-run is empty.

## Runtime defects found and corrected

1. Completed generated jobs could not enter owning-domain cleanup. The cleanup
   boundary now permits terminal failed, cancelled, and completed jobs;
   archives only draft assistant-created guidebooks through
   `archive_guidebook_canonical`; rejects non-draft guidebooks; removes exact
   private source paths; and retains tombstones and audit lineage.
2. Approved-template reads used an ambiguous PostgREST relationship and failed
   with `PGRST201`. Both the capability gate and internal page now select the
   canonical `guidebook_library_versions_artifact_id_fkey` relationship
   explicitly. A live read resolves five approved templates.
3. Creation entitlement readiness read the legacy commerce grant table. It now
   reads active, effective `guidebook.create` grants from canonical
   `commercial_entitlements` and evaluates customer-account, workspace, and
   property scope explicitly.

## Controlled execution blocker

The canonical commerce boundary contains eight active administrative
`guidebook.create` grants, but none has an owning production property context.
The established administrative grant operation provisions an isolated tenant,
customer account, membership, and expiring canonical entitlements. It does not
provision a property. The normal onboarding product operation requires an
already authorized property reference and therefore cannot close this gap.

No service-role property insert was used. That would bypass the required
owning-domain creation and cleanup boundaries. Controlled execution must remain
blocked until a bounded, auditable controlled-property provisioning and cleanup
operation exists or an already provisioned controlled property is supplied
through the established product-context workflow.

Because the context gate failed before activation, these scenarios remain
untested in production: upload format matrix, extraction, review statuses,
high-risk confirmation, generation, resume, regeneration, stale rejection,
restoration, provider timeout/retry, replay idempotency, signed-source tenant
isolation with real objects, revoked access with real jobs, and completed-job
cleanup.

## Safety state and resource ledger

Sanitized production configuration after verification:

- `GUIDEBOOK_CREATION_ENABLED=false`
- `GUIDEBOOK_CREATION_KILL_SWITCH=true`
- `GUIDEBOOK_CREATION_VERTICAL_SLICE_VERIFIED=false`
- `GUIDEBOOK_CREATION_INTERNAL_COHORT` is empty
- Locked model remains `openai/gpt-5.4-mini-2026-03-17`

| Resource type                     | Created | Cleanup result     |
| --------------------------------- | ------: | ------------------ |
| Controlled property contexts      |       0 | Not applicable     |
| Creation jobs and attempts        |       0 | Not applicable     |
| Private source objects            |       0 | Not applicable     |
| Facts and confirmations           |       0 | Not applicable     |
| Artifacts and queue records       |       0 | Not applicable     |
| Provider calls or charges         |       0 | Reconciled to zero |
| Guidebooks, revisions, or blocks  |       0 | Not applicable     |
| Published or scheduled guidebooks |       0 | Confirmed zero     |

No temporary gate change was made, so no restoration mutation was required.
No controlled source or guidebook is publicly accessible.

## Release decision

**NO-GO for controlled internal activation.** The deployed foundation and
migration state pass, but the upload-to-saved-draft journey did not achieve
production coverage. Auto-create remains hidden and kill-switched, the cohort
remains empty, and no release tag was created.

The next bounded unblock is an owning-domain controlled-property context
provisioning and cleanup boundary. After that boundary is reviewed and
deployed, this controlled verification can resume without direct database
inserts or customer data.
