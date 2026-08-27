-- FS-008G: canonical authenticated authorization projection for one controlled
-- catalog mutation target. This migration changes no activation or catalog data.

begin;

create or replace function public.authorize_controlled_furnishing_catalog_mutation(
  p_workspace_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  release public.furnishing_activation_releases%rowtype;
  workspace public.furnishing_activation_workspaces%rowtype;
  capability public.furnishing_activation_capabilities%rowtype;
begin
  if actor_id is null or not public.is_admin() then
    raise exception 'FURNISHING_CATALOG_ADMIN_REQUIRED' using errcode='42501';
  end if;
  if not exists(
    select 1 from public.owners owner where owner.id=p_workspace_id
  ) then
    raise exception 'FURNISHING_CATALOG_TARGET_NOT_FOUND' using errcode='P0002';
  end if;
  if not exists(
    select 1 from public.ps001d_verification_tenants controlled
    where controlled.tenant_id=p_workspace_id
      and controlled.designation='PS001D_VERIFICATION_ONLY_NON_CUSTOMER'
      and controlled.status='approved'
      and controlled.revoked_at is null
      and controlled.expires_at>now()
  ) then
    raise exception 'FURNISHING_CATALOG_TARGET_FORBIDDEN' using errcode='42501';
  end if;

  select release_row.* into release
  from public.furnishing_activation_releases release_row
  where release_row.milestone='FS-008A';
  if not found
     or release.global_state<>'internal'
     or release.global_kill_switch
     or not release.configuration_valid then
    raise exception 'FURNISHING_ACTIVATION_DISABLED' using errcode='42501';
  end if;

  select workspace_row.* into workspace
  from public.furnishing_activation_workspaces workspace_row
  where workspace_row.release_id=release.id
    and workspace_row.workspace_id=p_workspace_id;
  if not found
     or not workspace.enabled
     or workspace.kill_switch
     or workspace.cohort<>'internal'
     or workspace.revoked_at is not null
     or (workspace.expires_at is not null and workspace.expires_at<=now()) then
    raise exception 'FURNISHING_ACTIVATION_DISABLED' using errcode='42501';
  end if;

  select capability_row.* into capability
  from public.furnishing_activation_capabilities capability_row
  where capability_row.release_id=release.id
    and capability_row.capability='catalog_viewing';
  if not found or not capability.enabled then
    raise exception 'FURNISHING_ACTIVATION_DISABLED' using errcode='42501';
  end if;

  return jsonb_build_object(
    'allowed',true,
    'workspaceId',p_workspace_id,
    'releaseId',release.id,
    'policyVersion',release.policy_version,
    'globalVersion',release.optimistic_version,
    'workspaceVersion',workspace.optimistic_version,
    'capabilityVersion',capability.optimistic_version
  );
end;
$$;

revoke all on function public.authorize_controlled_furnishing_catalog_mutation(uuid) from public, anon;
grant execute on function public.authorize_controlled_furnishing_catalog_mutation(uuid) to authenticated;

commit;
