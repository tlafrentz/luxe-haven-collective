-- Bug fix: initialize_workspace_owner() created the owners row but never the
-- matching active workspace_memberships row, so any newly-bootstrapped owner
-- (e.g. via commerce account creation) could resolve an owner id yet fail
-- every real dashboard page, all of which require resolveWorkspaceAccessContext
-- to find an active membership. The original migration only backfilled
-- memberships for owners that already existed at that time.
begin;

create or replace function public.initialize_workspace_owner()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  authenticated_profile_id uuid := auth.uid();
  resolved_owner_id uuid;
begin
  if authenticated_profile_id is null then
    raise exception 'Workspace authentication is required'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.profiles profile
    where profile.id = authenticated_profile_id
      and profile.role in ('owner', 'admin')
  ) then
    raise exception 'Workspace administration requires owner or administrator access'
      using errcode = '42501';
  end if;

  insert into public.owners (profile_id)
  values (authenticated_profile_id)
  on conflict (profile_id) where profile_id is not null
  do update set profile_id = excluded.profile_id
  returning id into resolved_owner_id;

  insert into public.workspace_memberships (
    workspace_id, profile_id, role, status, property_access_mode, joined_at
  )
  values (resolved_owner_id, authenticated_profile_id, 'owner', 'active', 'all', now())
  on conflict (workspace_id, profile_id) do update
  set status = 'active',
      role = case when workspace_memberships.role = 'owner' then 'owner' else workspace_memberships.role end,
      property_access_mode = case when workspace_memberships.role = 'owner' then 'all' else workspace_memberships.property_access_mode end;

  return resolved_owner_id;
end;
$$;

comment on function public.initialize_workspace_owner() is
  'Idempotently resolves or creates the single owners.id for auth.uid() and its active owner membership; workspace_id currently equals the returned owner id.';

commit;
