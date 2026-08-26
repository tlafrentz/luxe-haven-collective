-- FS-008G-C2: resolve the singleton governed release through the same
-- authenticated Admin-safe boundary as workspace and capability targets.
-- This migration changes no activation state or resource rows.
begin;
create or replace function public.resolve_furnishing_activation_control(p_target text,p_target_id text,p_tenant_id text default null) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare target_uuid uuid; release record; workspace record; capability record;
begin
 if auth.uid() is null or not public.is_admin() then return jsonb_build_object('status','forbidden'); end if;
 if p_target not in('global','workspace','cohort','capability') then return jsonb_build_object('status','not_found'); end if;
 if p_target='global' then
  if p_target_id='global' then
   select r.* into release from public.furnishing_activation_releases r where r.milestone='FS-008A' order by r.updated_at desc limit 1;
  else
   begin target_uuid:=p_target_id::uuid; exception when others then return jsonb_build_object('status','not_found'); end;
   select r.* into release from public.furnishing_activation_releases r where r.id=target_uuid and r.milestone='FS-008A';
  end if;
  if not found then return jsonb_build_object('status','not_found'); end if;
  return jsonb_build_object('status','found','target',p_target,'targetId',release.id,'state',release.global_state,'version',release.optimistic_version,'releaseStatus',release.release_status,'globalKillSwitch',release.global_kill_switch,'configurationValid',release.configuration_valid,'policyVersion',release.policy_version);
 end if;
 if p_target in('workspace','cohort') then
  if p_tenant_id is distinct from p_target_id then return jsonb_build_object('status','forbidden'); end if;
  begin target_uuid:=p_target_id::uuid; exception when others then return jsonb_build_object('status','not_found'); end;
 else
  if p_tenant_id is null then return jsonb_build_object('status','forbidden'); end if;
  begin target_uuid:=p_tenant_id::uuid; exception when others then return jsonb_build_object('status','not_found'); end;
 end if;
 if not exists(select 1 from public.owners o where o.id=target_uuid) then return jsonb_build_object('status','not_found'); end if;
 if not exists(select 1 from public.ps001d_verification_tenants v where v.tenant_id=target_uuid and v.designation='PS001D_VERIFICATION_ONLY_NON_CUSTOMER' and v.status='approved' and v.revoked_at is null and v.expires_at>now()) then return jsonb_build_object('status','forbidden'); end if;
 select r.* into release from public.furnishing_activation_releases r where r.milestone='FS-008A' order by r.updated_at desc limit 1;
 if p_target in('workspace','cohort') then
  select w.* into workspace from public.furnishing_activation_workspaces w where w.release_id=release.id and w.workspace_id=target_uuid;
  if not found then return jsonb_build_object('status','found','target',p_target,'targetId',p_target_id,'tenantId',p_target_id,'state','disabled','version',0,'killSwitch',true,'cohort',null,'expiresAt',null,'revokedAt',null); end if;
  return jsonb_build_object('status','found','target',p_target,'targetId',p_target_id,'tenantId',p_target_id,'state',case when workspace.enabled then 'internal' else 'disabled' end,'version',workspace.optimistic_version,'killSwitch',workspace.kill_switch,'cohort',workspace.cohort,'expiresAt',workspace.expires_at,'revokedAt',workspace.revoked_at);
 end if;
 if p_target_id not in('catalog_viewing','design_workspace','budgeting','procurement_readiness') then return jsonb_build_object('status','not_found'); end if;
 if not exists(select 1 from public.furnishing_activation_workspaces w where w.release_id=release.id and w.workspace_id=target_uuid and w.cohort='internal' and w.revoked_at is null) then return jsonb_build_object('status','forbidden'); end if;
 select c.* into capability from public.furnishing_activation_capabilities c where c.release_id=release.id and c.capability=p_target_id;
 if not found then return jsonb_build_object('status','found','target',p_target,'targetId',p_target_id,'tenantId',p_tenant_id,'state','disabled','version',0); end if;
 return jsonb_build_object('status','found','target',p_target,'targetId',p_target_id,'tenantId',p_tenant_id,'state',case when capability.enabled then 'internal' else 'disabled' end,'version',capability.optimistic_version);
end $$;
revoke all on function public.resolve_furnishing_activation_control(text,text,text) from public,anon;
grant execute on function public.resolve_furnishing_activation_control(text,text,text) to authenticated;
commit;
