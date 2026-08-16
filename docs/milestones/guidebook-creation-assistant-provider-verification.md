# Guidebook Creation Assistant Provider Verification

Status: **BLOCKED — production gates remain closed**

Observed: 2026-08-15 (America/Chicago)

## Locked candidate and deployment

- Candidate commit: `fd87d0d3d15bfbc3251fd3c2aaa58499de0180db`
- Commit: `feat(guidebook): integrate creation assistant provider`
- Provider: Vercel AI Gateway Responses API
- Locked model: `openai/gpt-5.4-mini-2026-03-17`
- Deployment: `dpl_Fx1tvtCi4UU4HhgXM6JprwSp8mha`
- Deployment state: Ready
- Canonical alias: `https://luxehavencollective.co`
- Canonical alias check: HTTP 200
- Unauthenticated internal Admin route check: HTTP 307 to the established
  authentication boundary

The deployed environment explicitly sets the Creation Assistant disabled,
sets its kill switch, leaves vertical-slice verification false, and has no
internal cohort variable. The adapter and locked model are configured, but the
provider factory cannot instantiate while the kill switch is set. No normal
Admin or Dashboard navigation entry was added.

## Local verification evidence

- Focused Creation Assistant and processor tests: 18 passed
- Full test suite: 721 files and 3,904 tests passed
- Lint: passed
- Typecheck: passed
- Production build: passed locally and in the production deployment
- Migration lint: no findings
- Diff checks: passed before candidate commit

One unrelated automation daylight-saving test timed out while the full suite
and production build ran concurrently. It passed in isolation, and the full
suite then passed without concurrent build load.

## Migration result and blocker

No Creation Assistant schema migration was applied.

The linked production history contains six legacy applied version identifiers
(`202607070001`, `202607070002`, `202607070003`, `202607070004`,
`202607090001`, and `202607100002`) that the current Supabase CLI reports as
not matching the repository files, even though the visible version strings are
the same. Consequently `supabase db push --linked --dry-run` refuses to plan
the two pending Creation Assistant migrations.

Before recording the bootstrap compatibility version, a schema-only production
export confirmed that `public.owners` exists and that
`properties.owner_id` references `public.owners(id) on delete set null`.
`20260707000150_restore_owner_workspace_bootstrap.sql` is therefore a verified
production no-op and was recorded as applied in migration history. The dry-run
still failed on the six older legacy identifiers. Their applied history was not
rewritten, and no SQL was applied outside the migration mechanism.

This blocker was subsequently resolved by the evidence-backed reconciliation
recorded in `production-migration-history-reconciliation.md`. Guidebook
verification was not resumed as part of that ledger-only milestone. The
post-repair dry-run identifies only `20260815090000` and `20260815091000` as
pending.

## Controlled resource ledger

| Resource type | Created | Cleanup result |
| --- | ---: | --- |
| Creation jobs | 0 | Not applicable |
| Private source objects | 0 | Not applicable |
| Extracted facts or confirmations | 0 | Not applicable |
| Provider calls or charges | 0 | Not applicable |
| Guidebooks, revisions, or blocks | 0 | Not applicable |
| Published guidebooks | 0 | Not applicable |

Because the schema gate failed, no cohort was enabled and no controlled journey
was started. Tenant, storage, queue, idempotency, regeneration, restoration,
deployed cleanup, and deployed provider behavior remain unverified. No rollback
of customer data is required because none was created or changed.

## Release decision

**NO-GO for controlled internal activation.** Auto-create remains hidden and
kill-switched. No release tag was created. Production verification can resume
only after the migration dry-run is clean, the migrations are applied through
the governed mechanism, and the remaining controlled journey is completed and
cleaned up.
