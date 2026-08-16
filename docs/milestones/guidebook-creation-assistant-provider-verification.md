# Guidebook Creation Assistant Provider Verification

Status: **BLOCKED — controlled provisioning passed; provider authentication failed closed**

Observed: 2026-08-15 (America/Chicago)

## Candidate identities

- Original runtime candidate: `fd87d0d3d15bfbc3251fd3c2aaa58499de0180db`
- Original deployment: `dpl_Fx1tvtCi4UU4HhgXM6JprwSp8mha`
- Migration-control head: `5c494307ace9e1b1ee5bee625525386d05be2435`
- Provider evidence: `29b04821e64bfadc2e80ff647c1abbeecba02984`
- Reconciliation commits: `1af4e57c514767082f10a1b91d93d4c80a7f258f`, `5c494307ace9e1b1ee5bee625525386d05be2435`
- Cleanup defect fix: `97ffb353`
- Capability wiring fix: `6c5d0ae8`
- Controlled property provisioning: `a0aa1509`
- Controlled customer projection fix: `dede01cb`
- Worker lease recovery: `986cbad2`
- Provisioning deployment: `dpl_5N1Kcm4Xe9Ukkj7W8TwKEmYWgfy1`
- Worker recovery deployment: `dpl_Fp8t5TJVB7wK5JKkXQuHuchRrVaJ`
- Restored-safety deployment: `dpl_69fMGD5s3QBs8qUJVQszpyWFBbsR`
- AI key authentication deployment: `dpl_5JDqdxkMQ4w3LEKUsbJoGniCHbEQ`
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

The bounded provisioning correction added
`20260815100000_controlled_guidebook_property_provisioning.sql`. During
controlled execution, an interrupted work lease exposed a recovery defect;
the forward-only
`20260815101000_recover_guidebook_creation_work_leases.sql` now permits only
expired `processing` leases to be reclaimed. Both versions were applied once.
No legacy migration was replayed and no customer schema or data was modified
outside the reviewed additions and the controlled resource lifecycle.

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

After the provisioning and lease-recovery changes, the full suite passed: 724
files and 3,919 tests. Typecheck and production build passed. Lint completed
with three unrelated existing warnings and no errors. Migration lint returned
no findings. The canonical alias returned HTTP 200, the retired worker secret
returned HTTP 401, and anonymous access to the unlinked Admin interface
redirected to authentication (HTTP 307).

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

## Controlled property provisioning result

An ordinary authenticated administrator provisioned exactly one canonical,
private Guidebook-only property for the controlled customer through
`provision_guidebook_property_for_customer`. The administrator remained the
actor and the customer remained the owner. The transaction created the normal
property, Guidebook capability, entitlement allocation, audit event, and
verification-ledger resource; it created no HPM capability.

- Property: `4791ee05-80d7-4e97-9c4c-b23547a5f860`
- Allocation: `5f3b9f62-ea35-483f-9534-83c68941438e`
- Verification run: `1e392590-75b7-4b7b-b50e-1bef029944d0`
- Replayed and concurrent identical commands returned the same property and
  allocation and consumed capacity once.
- Owning-customer ordinary-client reads returned the property; wrong-customer
  and anonymous reads returned none.
- No public listing, booking context, HPM workspace, or marketing projection
  was created.

Two controlled jobs exercised failure and recovery. The first used intentionally
minimal file signatures and proved unsupported provider input fails closed. The
second used valid PDF, DOCX, text, JPEG, PNG, and WebP files. Duplicate upload
completion returned the original source, unsupported executable content was
rejected, and the durable job resumed after leaving the setup process.

## Provider authentication blocker

The production adapter and locked model are configured, but Vercel AI Gateway
does not accept the available OIDC credential. A non-sensitive health request
returned HTTP 401 and explicitly required `AI_GATEWAY_API_KEY`. The approved
provider catalog check did not expose a Vercel AI Gateway credential resource
that could safely close this gap. No alternate model or provider was substituted.

Both extraction attempts therefore terminated safely before facts, confirmations,
artifacts, guidebooks, revisions, blocks, or public content were created. The
worker initially exposed a queue recovery defect when dependency construction
failed after claim; the corrective migration and runtime change now reclaim an
expired lease and transition configuration/provider failures through the durable
retry/terminal path.

The following production scenarios remain untested because extraction never
completed: fact/source review, missing and conflicting fact resolution,
high-risk confirmation, generation, section regeneration, stale rejection,
revision restoration, and generated-draft renderer verification.

### Production key re-verification

On 2026-08-15, Vercel reported one encrypted `AI_GATEWAY_API_KEY` attached to
Preview and Production in the same linked project. The unchanged verified
candidate `f636fd071299dc61a67a22a9c18f5af656bca390` was redeployed afterward as
`dpl_5JDqdxkMQ4w3LEKUsbJoGniCHbEQ`; its production build passed and the
canonical alias was updated.

The single sanitized Gateway probe still returned HTTP 401. Follow-up
diagnostics showed that `vercel env run -e production` did not materialize the
encrypted `AI_GATEWAY_API_KEY` into the verification process (`keyPresent` was
false), while an OIDC token was present. The probe therefore could not prove
the newly stored key itself. No second provider invocation was made, no worker
gate was opened, and no controlled resource was created.

Verified configuration facts:

- The encrypted key is registered on the linked Vercel project for Production.
- The deployment occurred after the key was added.
- The adapter targets `https://ai-gateway.vercel.sh/v1/responses` with a Bearer
  authorization header.
- The locked model remains `openai/gpt-5.4-mini-2026-03-17`.
- No second `AI_GATEWAY_API_KEY` entry is visible in project configuration.
- Team Gateway entitlement/credits and the actual encrypted key value are not
  observable through the available CLI boundary and remain to be confirmed.

Per the authentication gate, controlled execution stopped here. The Creation
Assistant remained disabled and kill-switched, cohorts remained empty, and no
prompt or response content was written to application logs.

### Deployed-runtime presence and single-request verification

On 2026-08-16, the CLI identity was confirmed against Vercel project
`prj_YTGVIQ11lGz57hEz4UJFX4hCnXPX`, owned by the Luxe Haven Collective team.
That same project owns the Production environment entry and canonical
deployment. An unlinked, server-only diagnostic protected by an ordinary
authenticated administrator session was deployed in
`dpl_FPA8x8rTG8U4aXV4V21jew7piozT`. It reported only
`{"keyPresent":true}`; it never returned or logged any characteristic of the
key.

Exactly one sanitized Gateway request was then sent from the deployed runtime:

- Gateway status: HTTP 403
- Configured model: `openai/gpt-5.4-mini-2026-03-17`
- Route: Vercel AI Gateway Responses API
- Correlation: `e3b71ed4-5fb5-448c-b23f-7224f4f45093`
- Provider request identifier: not returned
- Input/output/total tokens: none recorded
- Cost: none recorded; key budget remained $5 with $0 spend

The request contained only a request for a one-boolean JSON object. Neither its
prompt nor response content was emitted by the diagnostic or present in
application logs; logs contained only the authenticated GET and POST route
entries.

Gateway catalog reconciliation found the blocker: the configured dated model
identifier is absent from the team model catalog. The available low-cost model
is `openai/gpt-5.4-mini`. No routing rules exist. The key exists in the owning
team, has an active budget, and the deployed runtime can read it, but the
configured model route is not authorized/available. No second Gateway request
was sent.

Controlled execution stopped before workers, provisioning, uploads, extraction,
or generation. Changing the locked model identifier requires a separately
reviewed candidate correction; it was not performed during this authentication-
only verification.

After reconciliation, the diagnostic's POST operation was removed to prevent a
second provider invocation. Final deployment
`dpl_EgvaqPoeS2trWeSXeXxhHyhx4P3W` retains only the administrator-protected
presence check. Its focused tests, typecheck, and production build passed.

## Safety state and resource ledger

Sanitized production configuration after verification:

- `GUIDEBOOK_CREATION_ENABLED=false`
- `GUIDEBOOK_CREATION_KILL_SWITCH=true`
- `GUIDEBOOK_CREATION_VERTICAL_SLICE_VERIFIED=false`
- `GUIDEBOOK_CREATION_INTERNAL_COHORT` is empty
- Locked model remains `openai/gpt-5.4-mini-2026-03-17`

| Resource type                     | Created | Cleanup result              |
| --------------------------------- | ------: | --------------------------- |
| Controlled property contexts      |       1 | Deleted canonically         |
| Creation jobs and attempts        |       2 | Deleted canonically         |
| Private source objects            |      12 | Exact paths removed         |
| Facts and confirmations           |       0 | Not applicable              |
| Artifacts and queue records       |       2 | Deleted with owning jobs    |
| Provider attempts                 |       2 | Terminal; no usage recorded |
| Guidebooks, revisions, or blocks  |       0 | Not applicable              |
| Published or scheduled guidebooks |       0 | Confirmed zero              |

Creation resources were cleaned through `cleanupCreationResources` before the
property cleanup. An ordinary authenticated administrator then invoked
`cleanup_controlled_guidebook_property`. The allocation is `released` at
revision 2, the property/jobs/sources/storage-object counts are zero, and the
verification-ledger resource is `completed`. The temporary scheduler secret,
OIDC credential, and cohorts were removed. Enablement is false, both kill
switches are enabled, customer visibility remains false, and no controlled
source or guidebook is publicly accessible.

## Release decision

**NO-GO for controlled internal activation.** Controlled owning-domain property
provisioning, idempotency, isolation, and exact cleanup passed. The
upload-to-saved-draft journey remains incomplete solely at the production
provider-authentication boundary. Auto-create remains hidden and kill-switched,
the cohort is empty, and no release tag was created.

The next bounded unblock is to review and lock the available
`openai/gpt-5.4-mini` model identifier, update the provider candidate without
changing the Creation Assistant architecture, and repeat one sanitized
authentication request before provisioning any controlled resource.
