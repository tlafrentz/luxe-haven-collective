-- PS-001C: authorize Execute through the canonical active workspace membership boundary.
begin;

create or replace function public.can_access_platform_action_workspace(
  requested_workspace_id text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_memberships membership
    where membership.workspace_id::text = requested_workspace_id
      and membership.profile_id = auth.uid()
      and membership.status = 'active'
  ) or exists (
    select 1
    from public.platform_action_workspace_members membership
    where membership.workspace_id = requested_workspace_id
      and membership.user_id = auth.uid()
  ) or exists (
    select 1
    from public.profiles profile
    where profile.id = auth.uid()
      and profile.role = 'admin'
  );
$$;

revoke all on function public.can_access_platform_action_workspace(text) from public;
grant execute on function public.can_access_platform_action_workspace(text) to authenticated;

commit;
