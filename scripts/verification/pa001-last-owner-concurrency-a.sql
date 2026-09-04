\set ON_ERROR_STOP on
-- PA-001 AUTH-005 concurrency proof, part 2/4 (session A). Pre-acquires the
-- exact workspace-scoped advisory lock revoke_role_assignment takes
-- internally, then sleeps while holding it -- forcing session B (which has
-- no sleep) to arrive and block on the same lock until this commits. Run
-- this and pa001-last-owner-concurrency-b.sql as two concurrent `psql`
-- processes (e.g. `... -a.sql & ... -b.sql &`).
begin;
select set_config('request.jwt.claim.sub','c9010000-0000-4000-8000-000000000003',false);
select pg_advisory_xact_lock(hashtextextended('pa-owner-guard:d9010000-0000-4000-8000-000000000001', 0));
select pg_sleep(2);
select public.revoke_role_assignment('{"assignment_id":"e9010000-0000-4000-8000-000000000001","expected_version":1,"reason":"race test revoke owner1","idempotency_key":"pa001-race-revoke-owner1"}'::jsonb);
commit;
