# AU-001F.3 disabled production schema deployment

Status: completed successfully on 2026-08-11 UTC; infrastructure present and inert; AU activation remains prohibited.

## Deployment identity

- Git commit: `3ab17557396069202f405cfc93f4adcd6b662f1e`
- Vercel deployment: `dpl_GC3W4Dhvxc2ax7THdeUu9u7mz4P2`
- Production URL: `https://luxe-haven-collective-quck7224q-luxe-haven-collective.vercel.app`
- Production aliases verified: `luxehavencollective.co`, `www.luxehavencollective.co`, and `luxe-haven-collective.vercel.app`
- Deployment state: Ready
- Prior deployment: `dpl_7B9vvS6Jc5uQEvji7Q3tcaZim8uP`

## Preflight

- Production migration history ended at `20260809025000` with exactly four AU migrations pending.
- `public.owners` existed.
- `public.properties.metadata` existed.
- No production AU table existed before migration.
- Only `AUTOMATION_GLOBAL_KILL_SWITCH` and `AUTOMATION_WORKSPACE_KILL_SWITCH` were configured among AU variables.
- Both production kill switches were explicitly updated to `true` before deployment.
- No AU enablement, cohort, scheduler, processor, template, or dispatch environment variable existed.
- The migration dry run listed only the four approved AU scripts.

## Applied migration inventory

| Version | SHA-256 |
| --- | --- |
| `20260810010000` | `b552cc3430d63b620d862caf8dab386e0699795c19065dbb9460d497344f3f86` |
| `20260810020000` | `e48c248c0eb31fbd7e16a6e8c193aa666122ab2ea1f51221b43e285c1c4d2904` |
| `20260810030000` | `92cf2c1cf45d69221319af8ae6e5daba01a10e91f238d4bfb64e3994c554cdc7` |
| `20260810040000` | `af0db992eda5436372acb9325b58d1cd9443458aa1deac0658aa3c0ad359b5f3` |

The linked production push completed in 5.241 seconds. The Supabase CLI emitted the previously observed post-success pg-delta certificate-cache warning after all migrations were applied and recorded; migration history verification subsequently confirmed all four local and remote versions match.

No historical migration or unlisted script was applied.

## Immediate verification

| Check | Result |
| --- | --- |
| Production migration versions | Passed; all four AU versions match local history |
| AU schema | Passed; 19 tables present |
| RLS | Passed; 19 of 19 AU tables have RLS enabled |
| Policies and integrity controls | Passed; 23 RLS policies and 9 non-internal application/integrity triggers |
| Same-tenant owner/admin | Passed in rollback-only production transaction |
| Cross-tenant denial | Passed in rollback-only production transaction |
| Cross-property/incorrect-role denial | Passed in rollback-only production transaction |
| Anonymous denial | Passed fail-closed through table privilege denial |
| Service-role append-only protection | Passed; activity mutation denied |
| Synthetic production fixtures | None retained; verification transaction ended with `ROLLBACK` |
| Homepage | HTTP 200 |
| Login | HTTP 200 |
| Health | HTTP 200 |
| Dashboard, property, and admin routes | HTTP 307 to authenticated login boundary |
| AU workspace | HTTP 307 to authenticated login boundary; unavailable anonymously |
| AU report export | HTTP 404 with disabled failure response |
| Vercel errors | None observed for the deployment window |
| AU database activity | No unexpected active sessions |

## Inactivity proof

Production contains zero automation definitions, triggers, occurrences, backfill jobs, run requests, runs, run steps, attempts, leases, and scheduler checkpoints. The inactivity verifier also found:

- no enabled automation trigger;
- no automation cron job;
- no scheduler, queue, processor, or dispatch database trigger;
- no background processing evidence.

## Release boundary

This was infrastructure deployment, not AU activation. The following remain disabled:

- Automation Workspace access;
- trigger intake and scheduling;
- run-request creation and governed execution;
- Execute draft-plan command dispatch;
- templates and cohorts;
- all unsupported owning-capability adapters.

AU-001F.4 remains blocked by the least-privilege Execute identity, hosted command integration, dashboards, alert delivery, named operational owners, accessibility review, timed application recovery, broader authenticated journeys, and HPM-001F approval.

