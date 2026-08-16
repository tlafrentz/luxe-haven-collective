# Guidebook Creation Assistant Controlled Verification

The production candidate is the commit containing the provider integration,
deployed before any database or cohort change. Auto-create remains absent from
normal navigation throughout this verification.

## Locked provider candidate

- Boundary: Vercel AI Gateway Responses API
- Model: `openai/gpt-5.4-mini-2026-03-17`
- Storage: provider response storage disabled
- Authentication: Vercel OIDC
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
