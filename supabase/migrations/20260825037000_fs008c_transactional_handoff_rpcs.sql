-- FS-008C-C1C: authenticated transactional handoff/session/recovery primitives.
create or replace function public.create_or_replay_furnishing_onboarding_handoff(p_entitlement_id uuid,p_idempotency_key text,p_correlation_id text) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare e record; h record; begin if auth.uid() is null then raise exception 'UNAUTHORIZED'; end if; select * into e from commercial_entitlements where id=p_entitlement_id and status='active' for update; if not found then raise exception 'ENTITLEMENT_UNAVAILABLE'; end if; if not exists(select 1 from customer_account_memberships m where m.customer_account_id=e.customer_account_id and m.tenant_id=e.tenant_id and m.profile_id=auth.uid() and m.status='active') and not public.is_admin() then raise exception 'UNAUTHORIZED'; end if; select * into h from furnishing_onboarding_handoffs where entitlement_id=e.id for update; if found then return jsonb_build_object('status','replayed','id',h.id,'state',h.state,'version',h.version); end if; if e.offer_code not in('FS-CONSULT','FS-DESIGN') then raise exception 'OFFER_UNSUPPORTED'; end if; insert into furnishing_onboarding_handoffs(tenant_id,workspace_id,customer_id,entitlement_id,offer_code,offer_version,idempotency_key,correlation_id,state) values(e.tenant_id,e.tenant_id,auth.uid(),e.id,e.offer_code,e.offer_version,p_idempotency_key,p_correlation_id,'pending') returning * into h; return jsonb_build_object('status','created','id',h.id,'state',h.state,'version',h.version); end $$;
create or replace function public.start_or_resume_furnishing_onboarding_session(p_handoff_id uuid,p_expected_version integer,p_idempotency_key text,p_correlation_id text) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$ declare h record; s record; begin if auth.uid() is null then raise exception 'UNAUTHORIZED'; end if; select * into h from furnishing_onboarding_handoffs where id=p_handoff_id and customer_id=auth.uid() for update; if not found then raise exception 'HANDOFF_UNAVAILABLE'; end if; if h.state not in('pending','available') then raise exception 'HANDOFF_NOT_RESUMABLE'; end if; select * into s from furnishing_onboarding_sessions where handoff_id=h.id for update; if found then return jsonb_build_object('status','replayed','id',s.id,'version',s.optimistic_version); end if; insert into furnishing_onboarding_sessions(customer_id,tenant_id,entitlement_id,handoff_id,offer_code,offer_version,schema_version,project_type,idempotency_key,correlation_id) values(auth.uid(),h.tenant_id,h.entitlement_id,h.id,h.offer_code,h.offer_version,1,case when h.offer_code='FS-CONSULT' then 'consultation' else 'design' end,p_idempotency_key,p_correlation_id) returning * into s; return jsonb_build_object('status','created','id',s.id,'version',s.optimistic_version); end $$;
revoke all on function public.create_or_replay_furnishing_onboarding_handoff(uuid,text,text),public.start_or_resume_furnishing_onboarding_session(uuid,integer,text,text) from public,anon; grant execute on function public.create_or_replay_furnishing_onboarding_handoff(uuid,text,text),public.start_or_resume_furnishing_onboarding_session(uuid,integer,text,text) to authenticated;

create or replace function public.activate_furnishing_onboarding_project(p_session_id uuid,p_snapshot_id uuid,p_expected_version integer,p_idempotency_key text,p_correlation_id text) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare s record; h record; e record; x record; p record; v_id uuid; v_status text; begin
 if auth.uid() is null then raise exception 'UNAUTHORIZED'; end if;
 select * into s from furnishing_onboarding_sessions where id=p_session_id for update;
 if not found or s.optimistic_version<>p_expected_version then raise exception 'SESSION_VERSION_CONFLICT'; end if;
 select * into h from furnishing_onboarding_handoffs where id=s.handoff_id for update;
 select * into e from commercial_entitlements where id=s.entitlement_id for update;
 select * into x from furnishing_onboarding_submission_snapshots where id=p_snapshot_id and session_id=s.id for update;
 if not found then raise exception 'SNAPSHOT_MISMATCH'; end if;
 if not exists(select 1 from customer_account_memberships m where m.profile_id=auth.uid() and m.tenant_id=s.tenant_id and m.status='active') and not public.is_admin() then raise exception 'UNAUTHORIZED'; end if;
 if s.status<>'submitted' or h.state not in('pending','available') or e.status<>'active' then raise exception 'ACTIVATION_UNAVAILABLE'; end if;
 if h.entitlement_id<>e.id or h.customer_id<>s.customer_id or h.tenant_id<>s.tenant_id or x.offer_code<>s.offer_code or x.offer_version<>s.offer_version then raise exception 'LINEAGE_MISMATCH'; end if;
 select * into p from furnishing_onboarding_projects where session_id=s.id for update;
 if found then return jsonb_build_object('status','replayed','project_id',p.id,'session_id',s.id); end if;
 v_status:=case when s.offer_code='FS-CONSULT' then 'consultation_intake_complete' else 'design_intake_complete' end;
 insert into furnishing_projects(workspace_id,property_id,name,status,phase,created_by,scope,budget,selections)
 values(s.tenant_id,(x.snapshot->>'propertyId')::uuid,case when s.offer_code='FS-CONSULT' then 'Furnishing Consultation' else 'Furnishing Design' end,'draft','setup',s.customer_id,'{}'::jsonb,'{}'::jsonb,'[]'::jsonb) returning id into v_id;
 insert into furnishing_onboarding_projects(tenant_id,customer_id,property_id,entitlement_id,handoff_id,session_id,snapshot_id,offer_code,offer_version,status)
 values(s.tenant_id,s.customer_id,(x.snapshot->>'propertyId')::uuid,e.id,h.id,s.id,x.id,s.offer_code,s.offer_version,v_status) returning id into p;
 update furnishing_onboarding_handoffs set state='consumed',project_id=p.id,version=version+1,consumed_at=now(),updated_at=now() where id=h.id;
 update furnishing_onboarding_sessions set status='activated',activated_at=now(),optimistic_version=optimistic_version+1,updated_at=now() where id=s.id;
 insert into furnishing_onboarding_audit(session_id,event_type,reason_code,correlation_id) values(s.id,'project_activated','activation_completed',p_correlation_id);
 return jsonb_build_object('status','activated','project_id',p.id,'session_id',s.id);
end $$;

create or replace function public.transition_furnishing_onboarding_recovery(p_handoff_id uuid,p_session_id uuid,p_to_state text,p_expected_handoff_version integer,p_expected_session_version integer,p_idempotency_key text,p_reason text,p_correlation_id text) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare h record; s record; ns text; begin
 if auth.uid() is null then raise exception 'UNAUTHORIZED'; end if;
 select * into h from furnishing_onboarding_handoffs where id=p_handoff_id for update;
 select * into s from furnishing_onboarding_sessions where id=p_session_id and handoff_id=p_handoff_id for update;
 if not found or h.version<>p_expected_handoff_version or s.optimistic_version<>p_expected_session_version then raise exception 'VERSION_CONFLICT'; end if;
 if not exists(select 1 from customer_account_memberships m where m.profile_id=auth.uid() and m.tenant_id=h.tenant_id and m.status='active') and not public.is_admin() then raise exception 'UNAUTHORIZED'; end if;
 if h.state='consumed' or h.state='terminated' then if h.state=p_to_state then return jsonb_build_object('status','replayed','state',h.state); else raise exception 'HANDOFF_IMMUTABLE'; end if; end if;
 if p_to_state not in('available','suspended','terminated') then raise exception 'RECOVERY_TRANSITION_INVALID'; end if;
 ns:=case when p_to_state='terminated' then 'canceled' when p_to_state='suspended' then 'blocked' else 'in_progress' end;
 update furnishing_onboarding_handoffs set state=p_to_state,version=version+1,updated_at=now(),terminated_at=case when p_to_state='terminated' then now() else terminated_at end where id=h.id;
 update furnishing_onboarding_sessions set status=ns,optimistic_version=optimistic_version+1,updated_at=now() where id=s.id;
 insert into furnishing_onboarding_audit(session_id,event_type,reason_code,correlation_id) values(s.id,'recovery_transition',left(p_reason,120),p_correlation_id);
 return jsonb_build_object('status','transitioned','state',p_to_state,'session_status',ns);
end $$;
revoke all on function public.activate_furnishing_onboarding_project(uuid,uuid,integer,text,text),public.transition_furnishing_onboarding_recovery(uuid,uuid,text,integer,integer,text,text,text) from public,anon;
grant execute on function public.activate_furnishing_onboarding_project(uuid,uuid,integer,text,text),public.transition_furnishing_onboarding_recovery(uuid,uuid,text,integer,integer,text,text,text) to authenticated;
