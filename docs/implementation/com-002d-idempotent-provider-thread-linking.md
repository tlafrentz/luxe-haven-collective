# COM-002D — Idempotent provider-thread linking

## Canonical identity

`guest_conversation_provider_threads.id` is arbitrary global record identity. New records use
`provider-thread-<uuid>`; callers may supply an ID only for compatibility and replay verification.
It is not provider identity.

Provider identity is workspace-scoped:

`(workspace_id, provider, thread_id) -> conversation_id`

The existing table constraint `unique(workspace_id, provider, thread_id)` is canonical. Hospitable
thread identifiers may therefore occur in different workspaces. No migration of immutable rows or
constraint change is required.

## Failure investigation

The production failure originated in `sync-reservations.ts`. It generated the deterministic primary
key `provider-thread-${conversationId}-${externalReservationId}`, then called PostgREST `upsert` with
`onConflict: "workspace_id,provider,thread_id"`. A replay could collide on
`guest_conversation_provider_threads_pkey`, which was not the selected conflict target. The caller
did not read and compare an existing row first. Other paths used random IDs plus `ON CONFLICT DO
NOTHING`, while manual review used a race-prone select followed by insert.

## Persistence and replay semantics

`link_guest_conversation_provider_thread` is the single service-role database operation. It:

1. validates provider identity and verifies the conversation belongs to the requested workspace;
2. attempts an append-only insert with a UUID record ID;
3. after any conflict, reads the canonical provider-identity row;
4. returns `created` or `reused` when its conversation is equivalent;
5. raises `PROVIDER_THREAD_CONVERSATION_CONFLICT` instead of reassigning a link.

An explicitly supplied primary key collision is a replay only when record identity, provider
identity, workspace, and conversation are all equivalent. Unknown persistence errors map to
`PROVIDER_THREAD_LINK_FAILED`; raw PostgreSQL messages and constraint names are not presented to
operators.

The unrestricted conflict/no-op plus canonical read is concurrency safe under PostgreSQL unique
index enforcement: simultaneous equivalent calls leave one row and both return successfully.
There is no `DO UPDATE`, update, delete, trigger disablement, or historical repair.

## Ingestion ordering

Reservation sync, historical hydration, message webhooks, and manual review association all invoke
the canonical application service. Consequently webhook-first, hydration-first, and
reservation-first sequences create once and reuse afterward. Provider message persistence continues
through the existing `ingest_guest_provider_message` RPC, so content, chronology, and provider
message deduplication are unchanged.

Reservation sync results expose `providerThreadsCreated`, `providerThreadsReused`, and
`providerThreadConflicts`; persisted sync metadata uses equivalent snake-case fields. Replays do not
increment failures.

## Production verification

Before deployment, inspect existing rows, constraints, and indexes:

```sql
select id, conversation_id, workspace_id, provider, thread_id,
       reservation_reference
from public.guest_conversation_provider_threads
order by last_observed_at desc;

select constraint_name, constraint_type
from information_schema.table_constraints
where table_schema='public'
  and table_name='guest_conversation_provider_threads';

select indexname, indexdef
from pg_indexes
where schemaname='public'
  and tablename='guest_conversation_provider_threads';

select t.tgname, t.tgenabled
from pg_trigger t
join pg_class c on c.oid=t.tgrelid
where c.relname='guest_conversation_provider_threads'
  and t.tgname='guest_provider_threads_append_only';
```

Run the two-reservation fixture twice. The second run must report two provider-thread reuses, zero
provider-thread conflicts/failures, proceed to historical message requests, and retain exactly one
row per `(workspace_id, provider, thread_id)`. Exercise two simultaneous RPC calls for one identity;
both must return `created` or `reused`, with one stored row. Then attempt the same provider identity
for another conversation and verify `PROVIDER_THREAD_CONVERSATION_CONFLICT` is returned without an
update or delete.
