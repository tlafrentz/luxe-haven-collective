# Guidebook Creation Assistant Foundation

Starting revision: `a711addb1c089a80190bdc3e5f8d30cac2e3bb8c`.

## Reused boundaries

| Concern | Existing canonical boundary | Assistant extension |
|---|---|---|
| Tenant and ownership | `owners`, workspace membership, property access | Every job, source, fact, attempt, artifact, work item, and event carries `workspace_id`; all reads also resolve the job property |
| Guidebook-only property | Canonical `properties` rows created by the existing Guidebook flow | Assistant accepts the same property IDs; it creates no assistant property type |
| Draft | `GuidebookDraft`, `SupabaseGuidebookDraftRepository`, `persist_guidebook_draft` | A validated structured proposal is converted to an ordinary draft and saved with optimistic revision enforcement |
| Builder | Shared Admin/Dashboard canonical Builder | Completed jobs link to the existing Admin Builder route; no assistant editor exists |
| Publishing | Existing review, approval, immutable publication, and public renderer | No assistant operation imports or calls publication commands |
| Templates | Published `guidebook_library_artifacts` and versions | Capability and generation recheck an exact approved/published template version |
| Components | Experience-component registry and Builder eligibility | Generation is restricted to exact eligible component-version mappings |
| Readiness | Existing Builder readiness | High-risk confirmation is an additional pre-generation gate; Builder readiness remains authoritative after handoff |
| Media | Existing guidebook media for draft/public output | Original source documents use a separate private bucket and never become public media implicitly |
| Entitlement | `guidebook.create` Commerce grants | Checked when capability is evaluated, when the job is created, and again by worker context |
| Audit | Guidebook activity/audit conventions | Safe lifecycle events contain IDs, states, counts, and correlations—not source or generated content |
| Background processing | Durable work queue, claim lease, retry pattern | `guidebook_creation_work_items` and a service-role-only `skip locked` claim RPC |

## Runtime controls

Customer navigation remains unchanged. The internal verification route is
`/admin/guidebooks/creation-assistant` and is not linked from normal navigation.
It fails closed unless the server-authoritative capability check passes.

Required runtime configuration:

- `GUIDEBOOK_CREATION_ENABLED=true`
- `GUIDEBOOK_CREATION_KILL_SWITCH` is not `true`
- `GUIDEBOOK_CREATION_INTERNAL_COHORT` contains the explicit actor or workspace ID
- production: `GUIDEBOOK_CREATION_PROVIDER_URL` and `GUIDEBOOK_CREATION_PROVIDER_KEY`
- controlled deterministic verification only: `GUIDEBOOK_CREATION_ADAPTER=deterministic`
- processor: `GUIDEBOOK_CREATION_SCHEDULER_SECRET` or the established `CRON_SECRET`

`GUIDEBOOK_CREATION_VERTICAL_SLICE_VERIFIED=true` is required before the
capability projection can report customer visibility. No customer component
currently consumes that projection, so Auto-create remains hidden regardless.

## Protected data limitation

There is no established protected, time-bounded Guidebook guest-secret binding
for door, gate, or Wi-Fi credentials. The assistant classifies those fields as
`secret`, stores no extracted value, and rejects confirmation with
`PROTECTED_GUEST_DATA_BOUNDARY_REQUIRED`. This is deliberate fail-closed
behavior; permanent secrets are not inserted into public guidebook content.

## Retention and cleanup

Original files remain unchanged in the private source bucket. The owning-domain
cleanup operation accepts one exact failed or cancelled job, deletes only the
recorded object paths for that workspace/job, marks those source rows deleted,
and records a safe `resources.cleaned` event. Completed-job source retention is
not shortened implicitly.
