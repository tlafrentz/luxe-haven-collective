-- FS-UX-008: verified capability orchestration over the canonical FS-008A state.
-- This migration changes no release, cohort, kill-switch, or capability value.
begin;

alter table public.furnishing_activation_capabilities
  add column if not exists verification_state text not null default 'unverified',
  add column if not exists verified_at timestamptz,
  add column if not exists verified_by uuid references public.profiles(id),
  add column if not exists verification_event_id uuid references public.furnishing_activation_audit_events(id);
alter table public.furnishing_activation_capabilities drop constraint if exists furnishing_activation_capabilities_verification_state_check;
alter table public.furnishing_activation_capabilities add constraint furnishing_activation_capabilities_verification_state_check check(verification_state in ('unverified','verified','failed'));

create or replace function public.fsux8_capability_sequence_guard() returns trigger
language plpgsql security definer set search_path='' as $$
declare ordered text[]:=array['catalog_viewing','design_workspace','budgeting','procurement_readiness']; position integer; predecessor text; dependent text;
begin
 if new.capability<>all(ordered) then return new; end if;
 position:=array_position(ordered,new.capability);
 if new.enabled and (tg_op='INSERT' or not old.enabled) then
  if not exists(select 1 from public.furnishing_activation_workspaces w where w.release_id=new.release_id and w.enabled and not w.kill_switch and w.cohort='internal' and w.revoked_at is null and (w.expires_at is null or w.expires_at>now())) then raise exception 'FURNISHING_RELEASE_WORKSPACE_NOT_CONTROLLED'; end if;
  if position>1 then predecessor:=ordered[position-1]; if not exists(select 1 from public.furnishing_activation_capabilities c where c.release_id=new.release_id and c.capability=predecessor and c.enabled and c.verification_state='verified') then raise exception 'FURNISHING_RELEASE_PREREQUISITE_INCOMPLETE'; end if; end if;
  new.verification_state:='unverified'; new.verified_at:=null; new.verified_by:=null; new.verification_event_id:=null;
 elsif tg_op='UPDATE' and not new.enabled and old.enabled then
  foreach dependent in array ordered[position+1:array_length(ordered,1)] loop if exists(select 1 from public.furnishing_activation_capabilities c where c.release_id=new.release_id and c.capability=dependent and c.enabled) then raise exception 'FURNISHING_RELEASE_DEPENDENT_ACTIVE'; end if; end loop;
  new.verification_state:='unverified'; new.verified_at:=null; new.verified_by:=null; new.verification_event_id:=null;
 end if;
 return new;
end $$;
drop trigger if exists fsux8_capability_sequence_guard on public.furnishing_activation_capabilities;
create trigger fsux8_capability_sequence_guard before insert or update of enabled on public.furnishing_activation_capabilities for each row execute function public.fsux8_capability_sequence_guard();

create or replace function public.verify_furnishing_release_capability(p_workspace_id uuid,p_capability text,p_expected_version bigint,p_reason text,p_correlation_id text,p_idempotency_key text,p_success boolean default true) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); release record; workspace record; capability record; prior text; event_id uuid; result jsonb;
begin
 if actor is null or not public.is_admin() then raise exception 'FURNISHING_RELEASE_AUTHORIZATION_DENIED'; end if;
 if length(trim(coalesce(p_reason,'')))<12 or length(p_reason)>500 then raise exception 'FURNISHING_RELEASE_REASON_INVALID'; end if;
 select safe_metadata->'result' into result from public.furnishing_activation_audit_events where idempotency_key=p_idempotency_key for update;
 if found then return result; end if;
 select * into release from public.furnishing_activation_releases where milestone='FS-008A' order by updated_at desc limit 1 for update;
 select * into workspace from public.furnishing_activation_workspaces where release_id=release.id and workspace_id=p_workspace_id for update;
 if not found or not workspace.enabled or workspace.kill_switch or workspace.cohort<>'internal' or workspace.revoked_at is not null or (workspace.expires_at is not null and workspace.expires_at<=now()) then raise exception 'FURNISHING_RELEASE_WORKSPACE_NOT_CONTROLLED'; end if;
 select c.* into capability from public.furnishing_activation_capabilities c where c.release_id=release.id and c.capability=p_capability for update;
 if not found or not capability.enabled then raise exception 'FURNISHING_RELEASE_CAPABILITY_NOT_ENABLED'; end if;
 if capability.optimistic_version<>p_expected_version then raise exception 'FURNISHING_RELEASE_VERSION_STALE'; end if;
 prior:=capability.verification_state;
 insert into public.furnishing_activation_audit_events(release_id,workspace_id,actor_id,actor_role,event_type,reason_code,correlation_id,policy_version,before_state,after_state,idempotency_key,safe_metadata)
 values(release.id,p_workspace_id,actor,'admin','capability-verification',trim(p_reason),p_correlation_id,release.policy_version,jsonb_build_object('capability',p_capability,'verification',prior,'version',capability.optimistic_version),jsonb_build_object('capability',p_capability,'verification',case when p_success then 'verified' else 'failed' end,'version',capability.optimistic_version),p_idempotency_key,'{}') returning id into event_id;
 update public.furnishing_activation_capabilities set verification_state=case when p_success then 'verified' else 'failed' end,verified_at=now(),verified_by=actor,verification_event_id=event_id where id=capability.id;
 result:=jsonb_build_object('status','accepted','eventId',event_id,'capability',p_capability,'verification',case when p_success then 'verified' else 'failed' end,'version',capability.optimistic_version);
 update public.furnishing_activation_audit_events set safe_metadata=jsonb_build_object('result',result,'zeroExternalEffects',true) where id=event_id;
 return result;
end $$;

revoke all on function public.fsux8_capability_sequence_guard(),public.verify_furnishing_release_capability(uuid,text,bigint,text,text,text,boolean) from public,anon;
revoke execute on function public.fsux8_capability_sequence_guard() from authenticated;
grant execute on function public.verify_furnishing_release_capability(uuid,text,bigint,text,text,text,boolean) to authenticated;
commit;
