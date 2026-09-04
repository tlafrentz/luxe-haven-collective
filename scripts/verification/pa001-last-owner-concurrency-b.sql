-- PA-001 AUTH-005 concurrency proof, part 3/4 (session B). No sleep: this
-- arrives while session A is holding the workspace-scoped advisory lock and
-- must block until A commits (having revoked Owner1). Once unblocked, this
-- call sees only one active owner remaining (Owner2, itself) and must be
-- refused with PA_ASSIGNMENT_LAST_OWNER_PROTECTED -- deliberately NOT using
-- ON_ERROR_STOP here since that failure is the expected, correct outcome.
select set_config('request.jwt.claim.sub','c9010000-0000-4000-8000-000000000003',false);
select public.revoke_role_assignment('{"assignment_id":"e9010000-0000-4000-8000-000000000002","expected_version":1,"reason":"race test revoke owner2","idempotency_key":"pa001-race-revoke-owner2"}'::jsonb);
