# Guidebook Creation Assistant Controlled Verification

The production candidate is the commit containing the provider integration,
deployed before any database or cohort change. Auto-create remains absent from
normal navigation throughout this verification.

## Locked provider candidate

- Boundary: direct OpenAI Responses API inside the deployed Node.js runtime
- Extraction model: `gpt-5-nano`
- Conflict analysis, generation, and regeneration model: `gpt-5-mini`
- Storage: provider response storage disabled
- Authentication: runtime-only `OPENAI_API_KEY` plus `OPENAI_PROJECT_ID`
- Source delivery: exact private objects are read through the owning storage
  repository and attached directly; no public or reusable signed URL is issued
- Telemetry: provider request ID and input/output/total token counts only

## Safe deployment order

1. Record the candidate commit and confirm a clean tree.
2. Deploy code with `GUIDEBOOK_CREATION_ENABLED` not `true`,
   `GUIDEBOOK_CREATION_KILL_SWITCH=true`, an empty internal cohort, and
   `GUIDEBOOK_CREATION_VERTICAL_SLICE_VERIFIED` not `true`.
3. Verify normal Admin and Dashboard navigation contain no Auto-create link.
4. Apply the migration through the established migration mechanism.
5. Verify schema, RLS, private storage, work claiming, retry classification,
   cancellation, exact cleanup, and rollback readiness.
6. Add one explicit administrator ID to the internal cohort and remove the kill
   switch only for the bounded verification window.
7. Execute one non-sensitive controlled journey and record only sanitized IDs,
   counts, timestamps, hashes, and screenshots.
8. Replay every idempotent command and prove no duplicate job, provider charge,
   guidebook, revision, or block.
9. Verify anonymous, wrong-tenant, unauthorized staff, and revoked access fail
   closed using ordinary clients.
10. Clean up through owning-domain operations, restore the kill switch, remove
    the cohort, and confirm no controlled resources remain.

## Evidence artifact

Record candidate commit, deployment ID and alias, migration versions, provider
model and request IDs, sanitized resource ledger, RLS/storage results,
idempotency counts, draft revision lineage, proof that published state did not
change, cleanup receipts, and final gate state. Never record source content,
prompts, responses, access details, credentials, or generated customer content.

No release tag or customer exposure is permitted until this artifact is
complete and reviewed.

## Resumable production operation

`/api/internal/guidebook-creation/controlled-journey` is deliberately unlinked.
It requires an authenticated administrator, the active `release_verifier`
identity with PV-009 capability, an active `guidebook_customer` controlled
identity, a matching customer-scoped standalone-property entitlement, and the
operation-specific runtime gates. Normal customer enablement, vertical-slice
enablement, and the public cohort must remain closed.

The initial command supplies only the verification run, controlled customer,
and controlled entitlement identifiers. Every later command supplies the exact
expected stage. A stale or repeated stage returns 409 before mutation. Each
invocation advances one durable stage; extraction, initial generation, and
section regeneration are separately queued and leased through the existing
Creation Assistant worker. The operation stores only sanitized identifiers,
stage names, revision numbers, hashes, usage, and audit outcomes in the existing
verification attempt and append-only resource ledger.

The automated reconciliation gate uses the request-level usage returned by the
Responses API. It requires one unique request ID and complete token, model,
latency, correlation, and locked-price cost metadata for exactly extraction,
initial generation, and section regeneration. Their sum must remain below $1.
Only the project-scoped `OPENAI_API_KEY` is used for inference; no organization
Admin credential is accepted by this runtime. The mutation-free `dry_run`
command fails closed if the project inference configuration or any controlled
prerequisite is missing. After cleanup, an organization owner separately
records manual evidence from the project-filtered OpenAI Usage Dashboard.
