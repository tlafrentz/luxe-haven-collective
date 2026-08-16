# Database Bootstrap Compatibility

Applied migrations are immutable. Production received the original full
Supabase baseline before it was removed from the repository, including the
canonical `public.owners` aggregate and `properties.owner_id → owners.id`
relationship. The retained minimal `0001_initial_schema.sql` instead points
`properties.owner_id` at `profiles.id`, and the later empty timestamped
baseline does not repair that difference. Consequently a fresh chronological
bootstrap reached `202607070002_database_security_hardening.sql` without an
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
