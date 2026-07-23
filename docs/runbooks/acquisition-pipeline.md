# Acquisition Pipeline Operations Runbook

## Startup and configuration

Validate `NEXT_PUBLIC_SUPABASE_URL`, an appropriate Supabase key, environment identity, and `ACQUISITION_MIGRATION_VERSION` before composing acquisition handlers. Do not place service-role keys in browser or application command payloads.

## Migration and health

Apply migrations in order, then run the guarded verification harness with an isolated project. The acquisition health probe should check database reachability, required RPC availability, migration metadata, and critical table access without scanning customer data.

## Replay and concurrency

A matching owner/command/fingerprint receipt replays the stored result and must not rerun domain behavior. A pipeline or opportunity version conflict requires reloading state and issuing a new command ID. Never retry a stale command with the old expected version.

## Hydration failures

Treat persistence mapping and aggregate-restore failures as data-integrity incidents. Do not repair rows in application code or silently retry them. Capture the internal correlation ID, isolate the pipeline, and use a forward migration or operator repair procedure.

## Event publication

State and receipts commit before external event publication. Publication failure does not roll back committed state; retry publication through the event delivery mechanism when available, never by replaying the acquisition command.

## Rollback and recovery

Use the migration repository’s forward-migration procedure. Verify schema objects and RLS after rollback/redeploy. Do not delete acquisition rows outside an explicitly scoped verification fixture.
