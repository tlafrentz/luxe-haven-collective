# AU-001 migration inventory

Status: checksum-locked inventory verified in isolated hosted Supabase; production application pending.

| Migration                                         | Slice and purpose                                                                         | SHA-256                                                            | Recovery posture                                                       |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| `20260810010000_au001a_automation_foundation.sql` | AU-001A definitions, immutable versions, lifecycle, RLS, audit/outbox integration         | `b552cc3430d63b620d862caf8dab386e0699795c19065dbb9460d497344f3f86` | additive; forward recovery; preserve definitions and versions          |
| `20260810020000_au001b_triggers_scheduling.sql`   | AU-001B trigger occurrences, requests, leases/checkpoints, idempotency, RLS               | `e48c248c0eb31fbd7e16a6e8c193aa666122ab2ea1f51221b43e285c1c4d2904` | additive; forward recovery; never delete occurrence identity           |
| `20260810030000_au001c_governed_execution.sql`    | AU-001C runs, steps, attempts, policy decisions, approvals, reconciliation, activity, RLS | `92cf2c1cf45d69221319af8ae6e5daba01a10e91f238d4bfb64e3994c554cdc7` | additive; forward recovery; preserve command/result history            |
| `20260810040000_au001c_execution_hardening.sql`   | AU-001C lease/reconciliation hardening and safe transition constraints                    | `af0db992eda5436372acb9325b58d1cd9443458aa1deac0658aa3c0ad359b5f3` | forward recovery; reconcile in-flight work before application rollback |

AU-001D–F introduce no migration.

Hosted rehearsal evidence: all four checksums matched and the complete chain was applied to isolated non-production Supabase project `rvpkwepkkjglsyhekbvd` on 2026-08-10. The chain completed in 26.43 seconds after the documented legacy production-baseline objects were restored; an idempotent no-op replay completed in 2.59 seconds. See `docs/releases/au-001f2-hosted-rehearsal.md`. Production remains unchanged.

## Rehearsal evidence required per migration

Record starting/ending migration versions, database snapshot identifier, representative tenant/property/row volume, transaction boundaries, duration, longest lock, availability, before/after row counts, constraints, indexes and query plans, triggers, grants, RLS policy matrix, verification queries, rerun behavior, injected-failure recovery, old-code/new-schema and new-code/old-schema compatibility, and named approver.

The repository documents additive intent but does not prove production lock time, remote applied state, RLS effectiveness, or rollback compatibility. Those remain blocked until measured in a production-equivalent non-production Supabase environment.
