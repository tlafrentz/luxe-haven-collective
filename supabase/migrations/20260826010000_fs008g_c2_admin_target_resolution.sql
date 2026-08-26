-- FS-008G-C2: authenticated Admin-safe, target-scoped activation resolution.
-- The release remains safe-disabled and this migration creates no cohort.
begin;

create or replace function public.resolve_furnishing_activation_control(p_target text,p_target_id text,p_tenant_id text default null) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare target_uuid uuid; release record; workspace record; capability record;
begin
 if auth.uid() is null or not public.is_admin() then return jsonb_build_object('status','forbidden'); end if;
 if p_target not in('global','workspace','cohort','capability') then return jsonb_build_object('status','not_found'); end if;
 if p_target='global' then
  begin target_uuid:=p_target_id::uuid; exception when others then return jsonb_build_object('status','not_found'); end;
  select * into release from public.furnishing_activation_releases where id=target_uuid and milestone='FS-008A';
  if not found then return jsonb_build_object('status','not_found'); end if;
  return jsonb_build_object('status','found','target',p_target,'targetId',release.id,'state',release.global_state,'version',release.optimistic_version);
 end if;
 if p_target in('workspace','cohort') then
  if p_tenant_id is distinct from p_target_id then return jsonb_build_object('status','forbidden'); end if;
  begin target_uuid:=p_target_id::uuid; exception when others then return jsonb_build_object('status','not_found'); end;
 else
  if p_tenant_id is null then return jsonb_build_object('status','forbidden'); end if;
  begin target_uuid:=p_tenant_id::uuid; exception when others then return jsonb_build_object('status','not_found'); end;
 end if;
 if not exists(select 1 from public.owners where id=target_uuid) then return jsonb_build_object('status','not_found'); end if;
 if not exists(select 1 from public.ps001d_verification_tenants where tenant_id=target_uuid and designation='PS001D_VERIFICATION_ONLY_NON_CUSTOMER' and status='approved' and revoked_at is null and expires_at>now()) then return jsonb_build_object('status','forbidden'); end if;
 select * into release from public.furnishing_activation_releases where milestone='FS-008A';
 if p_target in('workspace','cohort') then
  select * into workspace from public.furnishing_activation_workspaces where release_id=release.id and workspace_id=target_uuid;
  if not found then return jsonb_build_object('status','found','target',p_target,'targetId',p_target_id,'tenantId',p_target_id,'state','disabled','version',0); end if;
  return jsonb_build_object('status','found','target',p_target,'targetId',p_target_id,'tenantId',p_target_id,'state',case when workspace.enabled then 'internal' else 'disabled' end,'version',workspace.optimistic_version);
 end if;
 if p_target_id not in('catalog_viewing','design_workspace','budgeting','procurement_readiness') then return jsonb_build_object('status','not_found'); end if;
 if not exists(select 1 from public.furnishing_activation_workspaces where release_id=release.id and workspace_id=target_uuid and cohort='internal' and revoked_at is null) then return jsonb_build_object('status','forbidden'); end if;
 select * into capability from public.furnishing_activation_capabilities where release_id=release.id and capability=p_target_id;
 if not found then return jsonb_build_object('status','found','target',p_target,'targetId',p_target_id,'tenantId',p_tenant_id,'state','disabled','version',0); end if;
 return jsonb_build_object('status','found','target',p_target,'targetId',p_target_id,'tenantId',p_tenant_id,'state',case when capability.enabled then 'internal' else 'disabled' end,'version',capability.optimistic_version);
end $$;

revoke all on function public.resolve_furnishing_activation_control(text,text,text) from public,anon;
grant execute on function public.resolve_furnishing_activation_control(text,text,text) to authenticated;

-- Preserve the atomic command while tightening first-write eligibility to the
-- same canonical controlled-tenant designation used by the read boundary.
create or replace function public.apply_furnishing_activation_control_c2(p_before jsonb,p_after jsonb,p_audit jsonb,p_fingerprint text) returns jsonb
language plpgsql security invoker set search_path=public,pg_temp as $$
declare target text:=p_after->>'target'; target_id text:=p_after->>'targetId'; tenant_id text:=p_after->>'tenantId'; controlled_tenant uuid;
begin
 if auth.uid() is null or not public.is_admin() then raise exception 'FURNISHING_ACTIVATION_ADMIN_REQUIRED' using errcode='42501'; end if;
 if target in('workspace','cohort') then
  if tenant_id is distinct from target_id then raise exception 'FURNISHING_ACTIVATION_FORBIDDEN' using errcode='42501'; end if;
  begin controlled_tenant:=target_id::uuid; exception when invalid_text_representation then raise exception 'FURNISHING_ACTIVATION_NOT_FOUND'; end;
 elsif target='capability' then
  if tenant_id is null then raise exception 'FURNISHING_ACTIVATION_FORBIDDEN' using errcode='42501'; end if;
  begin controlled_tenant:=tenant_id::uuid; exception when invalid_text_representation then raise exception 'FURNISHING_ACTIVATION_NOT_FOUND'; end;
 end if;
 if controlled_tenant is not null then
  if not exists(select 1 from public.owners where id=controlled_tenant) then raise exception 'FURNISHING_ACTIVATION_NOT_FOUND'; end if;
  if not exists(select 1 from public.ps001d_verification_tenants where tenant_id=controlled_tenant and designation='PS001D_VERIFICATION_ONLY_NON_CUSTOMER' and status='approved' and revoked_at is null and expires_at>now()) then raise exception 'FURNISHING_ACTIVATION_FORBIDDEN' using errcode='42501'; end if;
 end if;
 return public.apply_furnishing_activation_control(p_before,p_after,p_audit,p_fingerprint);
end $$;
revoke all on function public.apply_furnishing_activation_control_c2(jsonb,jsonb,jsonb,text) from public,anon;
grant execute on function public.apply_furnishing_activation_control_c2(jsonb,jsonb,jsonb,text) to authenticated;

commit;
