-- Sprint 4A: canonical authenticated workspace identity.
-- Application policy: workspace_id intentionally equals owners.id today.
-- Profile-owned operational projections continue to use owners.profile_id.

begin;

do $$
begin
  if exists (
    select profile_id
    from public.owners
    where profile_id is not null
    group by profile_id
    having count(*) > 1
  ) then
    raise exception
      'Workspace foundation requires one owner per profile; resolve duplicate owners before applying this migration';
  end if;
end;
$$;

create unique index if not exists owners_profile_id_unique
on public.owners (profile_id)
where profile_id is not null;

alter table public.owners enable row level security;

drop policy if exists "Workspace members read own owner" on public.owners;
create policy "Workspace members read own owner"
on public.owners for select
to authenticated
using (
  profile_id = auth.uid()
  or public.is_admin()
);

drop policy if exists "Workspace owners initialize own owner" on public.owners;
create policy "Workspace owners initialize own owner"
on public.owners for insert
to authenticated
with check (
  profile_id = auth.uid()
  and exists (
    select 1
    from public.profiles profile
    where profile.id = auth.uid()
      and profile.role in ('owner', 'admin')
  )
);

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

  return resolved_owner_id;
end;
$$;

comment on function public.initialize_workspace_owner() is
  'Idempotently resolves or creates the single owners.id for auth.uid(); workspace_id currently equals the returned owner id.';

revoke all on function public.initialize_workspace_owner() from public;
grant execute on function public.initialize_workspace_owner() to authenticated;

commit;
