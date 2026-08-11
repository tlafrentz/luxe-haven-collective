# AU-001F.2 hosted Supabase rehearsal

Status: hosted rehearsal completed on 2026-08-10; production unchanged; AU rollout and enablement remain blocked.

## Environment

- Supabase project: `LHC AU-001 Rehearsal` (`rvpkwepkkjglsyhekbvd`)
- Region: `us-west-2`
- PostgreSQL: 17
- Environment class: isolated non-production, synthetic data only
- Production project: not linked, queried, migrated, or otherwise changed
- Credentials: stored outside the repository; no credential values are part of this evidence

## Migration evidence

The exact checksum-locked AU inventory from `au-001-migration-inventory.md` was used without modification. The complete repository migration chain reached all four AU migrations and completed in 26.43 seconds. A second `supabase db push --include-all` was a no-op and completed in 2.59 seconds. Hosted migration history reports matching local and remote versions through `20260810040000`.

Two clean-baseline attempts failed before reaching AU and rolled back:

1. `202607070002_database_security_hardening.sql` expected the legacy `public.owners` table, which is not created by the repository's earliest migration chain. Failure detection and rollback completed in 2.98 seconds.
2. After restoring that production-baseline table in the isolated database, `20260724130000_guest_reservation_context.sql` expected legacy `properties.metadata`. Failure detection and rollback completed in 4.81 seconds.

For the rehearsal only, those two existing production-baseline objects were restored in the isolated project. The historical migrations were not edited, no replacement migration was introduced, and every AU checksum remained unchanged. This is a repository baseline portability issue that must remain visible in the production migration plan; it is not an AU migration failure.

## Verification results

| Verification | Result | Evidence |
| --- | --- | --- |
| AU migration checksums | Passed | SHA-256 values match the approved four-file inventory |
| Complete hosted migration chain | Passed after documented legacy-baseline restoration | 26.43 seconds; local and hosted histories align through `20260810040000` |
| Migration replay | Passed | no-op hosted push, 2.59 seconds |
| Direct PostgreSQL/RLS | Passed | `npm run test:automation:postgres` with `AU_REHEARSAL_DATABASE_URL` |
| Authenticated Supabase clients | Passed | `npm run test:automation:supabase` |
| Same-tenant owner/admin | Passed | definition and trigger visible |
| Cross-tenant denial | Passed | definition not visible |
| Cross-property denial | Passed | selected-property operator cannot see another property definition |
| Anonymous denial | Passed | no automation definition visible |
| Service-role boundary | Passed | authorized read succeeds; append-only activity update denied |
| Existing non-AU queries | Passed | profiles, owners, memberships, properties, and guidebooks queried through authenticated client |
| Dormant infrastructure | Passed | no enabled triggers, requests, runs, leases, checkpoints, automation cron jobs, or processor database triggers |

All fixtures use synthetic users, tenants, and properties. The SQL fixture is replayable and the application verification exercises GoTrue authentication, PostgREST RLS, and the production Supabase repository adapter.

## Recovery and compatibility

- Failed migration attempts were transactional and left no partial AU schema.
- Forward recovery from the documented missing-baseline failures succeeded once the isolated environment matched the production baseline.
- Reapplying the exact migration inventory produced a no-op rather than duplicate schema or activity.
- The AU migrations are additive except for the intentional notification-outbox entity-type constraint expansion.
- Existing authenticated non-AU read paths continued to work after the complete migration chain.
- No AU worker, scheduler, trigger intake, queue consumer, cohort, template, or dispatch path was activated.

Application artifact rollback was not performed against production. The hosted rehearsal proves schema compatibility for existing sampled read paths and forward recovery, but a timed application-artifact rollback and full non-AU end-to-end suite remain release gates.

## Commands

The rehearsal used:

```text
shasum -a 256 <four approved AU migration files>
supabase db push --db-url <isolated-hosted-url> --include-all
npm run test:automation:postgres
npm run test:automation:supabase
psql <isolated-hosted-url> -f supabase/tests/au001_hosted_inactivity.sql
supabase migration list --db-url <isolated-hosted-url>
```

Credential-bearing environment values were supplied only to the process and are intentionally omitted.

## Remaining release gates

This evidence completes the hosted migration, hosted authenticated RLS, migration replay, inactivity, and sampled compatibility portions of AU-001F.2. It does not approve AU-001F.3. HPM-001F approval, owning-capability adapters and service identities, provider observability and alert delivery, manual accessibility testing, a timed application rollback, broader non-AU end-to-end compatibility, and release-owner approvals remain blocked.

