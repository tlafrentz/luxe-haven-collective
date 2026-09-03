begin;

create or replace function public.provision_fs008g_c8_controlled_tenant(
  p_workspace_id uuid,
  p_admin_id uuid,
  p_owner_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=public,auth,pg_temp
as $$
declare
  workspace_row public.owners%rowtype;
  existing_tenant public.ps001d_verification_tenants%rowtype;
  relationship constant jsonb := '{"automation":false,"catalog":false,"customer":false,"payment":false,"provider":false,"publication":false}'::jsonb;
begin
  if auth.role()<>'service_role' then
    raise exception 'FS008G_FIXTURE_SERVICE_ROLE_REQUIRED' using errcode='42501';
  end if;
  if p_workspace_id is null or p_admin_id is null or p_owner_id is null then
    raise exception 'FS008G_FIXTURE_IDENTITY_INVALID' using errcode='42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    'fs008g-controlled-tenant:'||p_workspace_id::text,0
  ));
  select * into workspace_row
  from public.owners
  where id=p_workspace_id
  for update;
  if not found
    or workspace_row.profile_id<>p_owner_id
    or workspace_row.company_name not like 'FS008G C8 %'
    or not exists(
      select 1 from public.profiles owner_profile
      join auth.users owner_identity on owner_identity.id=owner_profile.id
      where owner_profile.id=p_owner_id
        and owner_profile.role='owner'
        and owner_profile.email like 'fs008g-c8-owner-%@example.invalid'
        and owner_identity.deleted_at is null
        and (owner_identity.banned_until is null or owner_identity.banned_until<=now())
    )
  then
    raise exception 'FS008G_FIXTURE_IDENTITY_INVALID' using errcode='42501';
  end if;

  if not exists(
    select 1
    from public.profiles admin_profile
    join auth.users admin_identity on admin_identity.id=admin_profile.id
    where admin_profile.id=p_admin_id
      and admin_profile.role='admin'
      and admin_identity.deleted_at is null
      and (admin_identity.banned_until is null or admin_identity.banned_until<=now())
  ) then
    raise exception 'FS008G_PLATFORM_ADMIN_REQUIRED' using errcode='42501';
  end if;

  if exists(select 1 from public.customer_accounts where tenant_id=p_workspace_id)
    or exists(select 1 from public.integration_connections where workspace_id=p_workspace_id)
  then
    raise exception 'FS008G_FIXTURE_SCOPE_INVALID';
  end if;

  select * into existing_tenant
  from public.ps001d_verification_tenants
  where tenant_id=p_workspace_id
  for update;
  if found then
    if existing_tenant.designation<>'PS001D_VERIFICATION_ONLY_NON_CUSTOMER'
      or existing_tenant.status<>'approved'
      or existing_tenant.approved_by<>p_admin_id
      or existing_tenant.relationship_attestation<>relationship
    then
      raise exception 'FS008G_FIXTURE_PROVISIONING_CONFLICT';
    end if;
    return jsonb_build_object(
      'status','already_provisioned',
      'workspaceId',p_workspace_id,
      'administratorId',p_admin_id,
      'externalEffects',false
    );
  end if;

  insert into public.ps001d_verification_tenants(
    tenant_id,designation,status,approved_by,expires_at,relationship_attestation
  ) values(
    p_workspace_id,'PS001D_VERIFICATION_ONLY_NON_CUSTOMER','approved',
    p_admin_id,now()+interval '24 hours',relationship
  );
  return jsonb_build_object(
    'status','provisioned',
    'workspaceId',p_workspace_id,
    'administratorId',p_admin_id,
    'externalEffects',false
  );
end $$;

revoke all on function public.provision_fs008g_c8_controlled_tenant(uuid,uuid,uuid)
  from public,anon,authenticated;
grant execute on function public.provision_fs008g_c8_controlled_tenant(uuid,uuid,uuid)
  to service_role;

do $$
declare
  definition text;
  corrected text;
  prior_predicate constant text :=
    'and a.email like ''fs008g-c8-admin-%@example.invalid''';
  canonical_predicate constant text :=
    'and a.role=''admin'' and exists(select 1 from auth.users admin_identity where admin_identity.id=a.id and admin_identity.deleted_at is null and (admin_identity.banned_until is null or admin_identity.banned_until<=now()))';
begin
  select pg_get_functiondef(
    'public.cleanup_fs008g_c8_controlled_tenant(uuid,uuid,uuid,uuid,uuid)'::regprocedure
  ) into definition;
  if definition is null or strpos(definition,prior_predicate)=0 then
    raise exception 'FS008G_CLEANUP_ADMIN_POLICY_SOURCE_DRIFT';
  end if;
  corrected:=replace(definition,prior_predicate,canonical_predicate);
  if corrected=definition then
    raise exception 'FS008G_CLEANUP_ADMIN_POLICY_NOT_CORRECTED';
  end if;
  execute corrected;
end $$;

revoke all on function public.cleanup_fs008g_c8_controlled_tenant(uuid,uuid,uuid,uuid,uuid)
  from public,anon,authenticated;
grant execute on function public.cleanup_fs008g_c8_controlled_tenant(uuid,uuid,uuid,uuid,uuid)
  to service_role;

commit;
