-- Provide UUID-compatible authorization helpers for Workspace-owned capabilities.
-- Existing Platform Action persistence uses text workspace identifiers.

create or replace function public.can_access_platform_action_workspace(
  requested_workspace_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.can_access_platform_action_workspace(
    requested_workspace_id::text
  );
$$;

revoke all
on function public.can_access_platform_action_workspace(uuid)
from public;

grant execute
on function public.can_access_platform_action_workspace(uuid)
to authenticated;
