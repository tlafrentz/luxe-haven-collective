-- FS-008G-C2: remove PL/pgSQL column/variable ambiguity from every governed
-- activation transition. No state or resource rows are changed by migration.
begin;
create or replace function public.apply_furnishing_activation_control(p_before jsonb,p_after jsonb,p_audit jsonb,p_fingerprint text) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare
 a uuid:=auth.uid(); target text:=p_after->>'target'; target_id text:=p_after->>'targetId'; command text:=p_audit->>'command'; desired text:=p_after->>'state'; expected bigint:=(p_before->>'version')::bigint; command_reason text:=left(trim(p_audit->>'reason'),500); correlation text:=left(trim(p_audit->>'correlationId'),120); command_key text:=left(trim(p_audit->>'idempotencyKey'),200); release record; workspace record; capability record; result jsonb;
begin
 if a is null or not public.is_admin() then raise exception 'FURNISHING_ACTIVATION_ADMIN_REQUIRED' using errcode='42501'; end if;
 if target not in('global','workspace','cohort','capability') or desired not in('disabled','internal','paused') or length(command_reason)=0 or length(correlation)=0 or length(command_key)<8 then raise exception 'FURNISHING_ACTIVATION_COMMAND_INVALID'; end if;
 select e.safe_metadata->'result' into result from public.furnishing_activation_audit_events e where e.idempotency_key=command_key for update;
 if found then if (select e.safe_metadata->>'fingerprint' from public.furnishing_activation_audit_events e where e.idempotency_key=command_key)=p_fingerprint then return result; end if; raise exception 'FURNISHING_ACTIVATION_IDEMPOTENCY_CONFLICT'; end if;
 select r.* into release from public.furnishing_activation_releases r where r.milestone='FS-008A' for update;
 if not found then raise exception 'FURNISHING_ACTIVATION_RELEASE_MISSING'; end if;
 if target='global' then
  if release.id::text<>target_id or release.optimistic_version<>expected then raise exception 'FURNISHING_ACTIVATION_VERSION_CONFLICT'; end if;
  if command='global-state' then
   if desired='internal' and (not exists(select 1 from public.furnishing_activation_workspaces w where w.release_id=release.id and w.enabled and not w.kill_switch and w.cohort='internal' and w.revoked_at is null) or exists(select 1 from unnest(array['catalog_viewing','design_workspace','budgeting','procurement_readiness']) required(capability) where not exists(select 1 from public.furnishing_activation_capabilities c where c.release_id=release.id and c.capability=required.capability and c.enabled))) then raise exception 'FURNISHING_ACTIVATION_SEQUENCE_REQUIRED'; end if;
   update public.furnishing_activation_releases r set global_state=desired,configuration_valid=(desired='internal'),optimistic_version=r.optimistic_version+1,reason=command_reason,updated_at=now() where r.id=release.id;
  elsif command='global-kill-switch' then
   if desired='internal' and (release.global_state<>'internal' or not release.configuration_valid) then raise exception 'FURNISHING_ACTIVATION_SEQUENCE_REQUIRED'; end if;
   update public.furnishing_activation_releases r set global_kill_switch=(desired='disabled'),optimistic_version=r.optimistic_version+1,reason=command_reason,updated_at=now() where r.id=release.id;
  else raise exception 'FURNISHING_ACTIVATION_COMMAND_INVALID'; end if;
 elsif target in('workspace','cohort') then
  begin perform target_id::uuid; exception when others then raise exception 'FURNISHING_ACTIVATION_TARGET_INVALID'; end;
  if not exists(select 1 from public.workspace_memberships m where m.workspace_id=target_id::uuid and m.status='active') then raise exception 'FURNISHING_ACTIVATION_TARGET_INVALID'; end if;
  select w.* into workspace from public.furnishing_activation_workspaces w where w.release_id=release.id and w.workspace_id=target_id::uuid for update;
  if not found then
   if command<>'cohort-grant' or expected<>0 or desired<>'internal' then raise exception 'FURNISHING_ACTIVATION_SEQUENCE_REQUIRED'; end if;
   insert into public.furnishing_activation_workspaces(release_id,workspace_id,enabled,kill_switch,cohort,effective_from,approved_by,reason,optimistic_version) values(release.id,target_id::uuid,false,true,'internal',now(),a,command_reason,1) returning * into workspace;
  else
   if workspace.optimistic_version<>expected then raise exception 'FURNISHING_ACTIVATION_VERSION_CONFLICT'; end if;
   if command='workspace-state' then update public.furnishing_activation_workspaces w set enabled=(desired='internal'),optimistic_version=w.optimistic_version+1,reason=command_reason,updated_at=now() where w.id=workspace.id;
   elsif command='workspace-kill-switch' then update public.furnishing_activation_workspaces w set kill_switch=(desired='disabled'),optimistic_version=w.optimistic_version+1,reason=command_reason,updated_at=now() where w.id=workspace.id;
   elsif command='cohort-expiration' then update public.furnishing_activation_workspaces w set expires_at=now(),enabled=false,kill_switch=true,optimistic_version=w.optimistic_version+1,reason=command_reason,updated_at=now() where w.id=workspace.id;
   elsif command='cohort-revoke' then update public.furnishing_activation_workspaces w set revoked_at=now(),enabled=false,kill_switch=true,optimistic_version=w.optimistic_version+1,reason=command_reason,updated_at=now() where w.id=workspace.id;
   elsif command='cohort-grant' then update public.furnishing_activation_workspaces w set cohort='internal',expires_at=null,revoked_at=null,optimistic_version=w.optimistic_version+1,reason=command_reason,updated_at=now() where w.id=workspace.id;
   else raise exception 'FURNISHING_ACTIVATION_COMMAND_INVALID'; end if;
  end if;
 else
  if target_id not in('catalog_viewing','design_workspace','budgeting','procurement_readiness') or command<>'capability-state' then raise exception 'FURNISHING_ACTIVATION_CAPABILITY_PROHIBITED'; end if;
  if not exists(select 1 from public.furnishing_activation_workspaces w where w.release_id=release.id and w.workspace_id=(p_after->>'tenantId')::uuid and w.cohort='internal' and w.revoked_at is null) then raise exception 'FURNISHING_ACTIVATION_SEQUENCE_REQUIRED'; end if;
  select c.* into capability from public.furnishing_activation_capabilities c where c.release_id=release.id and c.capability=target_id for update;
  if not found then if expected<>0 then raise exception 'FURNISHING_ACTIVATION_VERSION_CONFLICT'; end if; insert into public.furnishing_activation_capabilities(release_id,capability,enabled,optimistic_version) values(release.id,target_id,desired='internal',1);
  else if capability.optimistic_version<>expected then raise exception 'FURNISHING_ACTIVATION_VERSION_CONFLICT'; end if; update public.furnishing_activation_capabilities c set enabled=(desired='internal'),optimistic_version=c.optimistic_version+1,updated_at=now() where c.id=capability.id; end if;
 end if;
 result:=jsonb_build_object('status','accepted','record',p_after,'audit',p_audit);
 insert into public.furnishing_activation_audit_events(release_id,workspace_id,actor_id,actor_role,event_type,reason_code,correlation_id,policy_version,before_state,after_state,idempotency_key,safe_metadata) values(release.id,case when target in('workspace','cohort') then target_id::uuid end,a,'admin',command,command_reason,correlation,'fs008a-v1',p_before,p_after,command_key,jsonb_build_object('fingerprint',p_fingerprint,'result',result));
 return result;
end $$;
revoke all on function public.apply_furnishing_activation_control(jsonb,jsonb,jsonb,text) from public,anon;
grant execute on function public.apply_furnishing_activation_control(jsonb,jsonb,jsonb,text) to authenticated;

-- Keep the Admin page on the same target-scoped boundary while returning the
-- complete governed workspace snapshot needed for subsequent controls.
create or replace function public.resolve_furnishing_activation_control(p_target text,p_target_id text,p_tenant_id text default null) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare target_uuid uuid; release record; workspace record; capability record;
begin
 if auth.uid() is null or not public.is_admin() then return jsonb_build_object('status','forbidden'); end if;
 if p_target not in('global','workspace','cohort','capability') then return jsonb_build_object('status','not_found'); end if;
 if p_target='global' then
  begin target_uuid:=p_target_id::uuid; exception when others then return jsonb_build_object('status','not_found'); end;
  select r.* into release from public.furnishing_activation_releases r where r.id=target_uuid and r.milestone='FS-008A';
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
 if not exists(select 1 from public.owners o where o.id=target_uuid) then return jsonb_build_object('status','not_found'); end if;
 if not exists(select 1 from public.ps001d_verification_tenants v where v.tenant_id=target_uuid and v.designation='PS001D_VERIFICATION_ONLY_NON_CUSTOMER' and v.status='approved' and v.revoked_at is null and v.expires_at>now()) then return jsonb_build_object('status','forbidden'); end if;
 select r.* into release from public.furnishing_activation_releases r where r.milestone='FS-008A';
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
