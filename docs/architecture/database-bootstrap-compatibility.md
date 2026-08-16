# Database Bootstrap Compatibility

Applied migrations are immutable. Production received the original full
Supabase baseline before it was removed from the repository, including the
canonical `public.owners` aggregate and `properties.owner_id → owners.id`
relationship. The retained minimal `0001_initial_schema.sql` instead points
`properties.owner_id` at `profiles.id`, and the later empty timestamped
baseline does not repair that difference. Consequently a fresh chronological
bootstrap reached `20260707000200_database_security_hardening.sql` without an
`owners` table.

`20260707000150_restore_owner_workspace_bootstrap.sql` is a compatibility
migration placed immediately before the first migration that requires owners.
It does not rewrite either applied baseline. On an existing production-shaped
database it is an idempotent no-op. On a minimal fresh database it creates the
real owner aggregate, preserves existing property ownership by mapping profile
IDs to owner IDs, and replaces only the legacy profile foreign key with the
canonical owner foreign key. It does not create a dummy table or disable any
security policy; the following security-hardening and workspace migrations
continue to apply normally.

The same deleted baseline left the fresh bootstrap without server-role table
privileges used by existing workspace and Guidebook repositories.
`20260815091000_local_bootstrap_service_compatibility.sql` restores those
server-owned privileges after the canonical tables exist, including the
server-side Creation Assistant persistence boundary. It grants nothing to
anonymous or authenticated clients and does not weaken RLS.

## Canonical legacy identifiers

Six early migrations were originally committed and applied with 12-digit
versions. Supabase expects timestamp versions in `YYYYMMDDHHMMSS` form. Once
the valid `20260707000150` compatibility migration was added between them, the
CLI could no longer align the production and repository order even though the
stored migration names and parsed statement arrays were identical.

The repository therefore retains the SQL unchanged under canonical 14-digit
versions, with production ledger state reconciled through `supabase migration
repair`:

| Historical version | Canonical version |
| --- | --- |
| `202607070001` | `20260707000100` |
| `202607070002` | `20260707000200` |
| `202607070003` | `20260707000300` |
| `202607070004` | `20260707000400` |
| `202607090001` | `20260709000100` |
| `202607100002` | `20260710000200` |

This is identifier normalization, not SQL replacement. The pre-repair
production statement arrays exactly matched a fresh bootstrap for all six
migrations. Historical IDs were marked reverted and canonical IDs applied;
no migration SQL ran during that ledger-only operation.
