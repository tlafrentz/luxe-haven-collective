\set ON_ERROR_STOP on
-- PA-001 AUTH-005 concurrency proof, part 4/4: confirm exactly one of the
-- two concurrent revokes won, the workspace still has exactly one active
-- Workspace Owner, and no partial/duplicate state resulted.
do $$
declare owner1_state text; owner2_state text; active_owner_count int;
begin
  select state into owner1_state from public.role_assignments where id='e9010000-0000-4000-8000-000000000001';
  select state into owner2_state from public.role_assignments where id='e9010000-0000-4000-8000-000000000002';

  if not ((owner1_state='revoked' and owner2_state='active') or (owner1_state='active' and owner2_state='revoked')) then
    raise exception 'PA001_RACE_EXPECTED_EXACTLY_ONE_REVOKED: owner1=%, owner2=%', owner1_state, owner2_state;
  end if;

  select count(*) into active_owner_count from public.role_assignments ra join public.roles ro on ro.id=ra.role_id
  where ra.workspace_id='d9010000-0000-4000-8000-000000000001' and ro.canonical_name='workspace_owner' and ra.state='active';
  if active_owner_count<>1 then
    raise exception 'PA001_RACE_WORKSPACE_MUST_HAVE_EXACTLY_ONE_ACTIVE_OWNER: %', active_owner_count;
  end if;
end $$;

select 'PA001_LAST_OWNER_CONCURRENCY_PASS' as result;
