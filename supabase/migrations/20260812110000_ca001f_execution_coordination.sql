-- CA-001F candidate/run coordination. Product and commercial state remain owned upstream.
alter table public.production_release_candidates add column locked_by uuid references public.profiles(id);
alter table public.production_release_candidates add column lock_correlation_id text;

create function public.create_ca001f_verification_run(p_candidate_id uuid,p_actor_id uuid,p_reviewer_id uuid,p_correlation_id text,p_instances jsonb)
returns public.production_verification_runs language plpgsql security definer set search_path='' as $$
declare v_role text;v_reviewer_exists boolean;v_run public.production_verification_runs;
begin
 select role into v_role from public.profiles where id=p_actor_id;
 if coalesce(v_role,'')not in('admin','administrator')then raise exception'RUN_CREATION_NOT_AUTHORIZED';end if;
 if p_actor_id=p_reviewer_id then raise exception'REVIEWER_SEPARATION_REQUIRED';end if;
 select exists(select 1 from public.controlled_verification_identities where opaque_auth_subject_reference=p_reviewer_id::text and identity_type_code='release_reviewer' and status='active' and(expires_at is null or expires_at>now()))into v_reviewer_exists;
 if not v_reviewer_exists then raise exception'REVIEWER_NOT_AUTHORIZED';end if;
 select * into v_run from public.production_verification_runs where release_candidate_id=p_candidate_id and plan_code='CA001_PRODUCTION_RELEASE'and plan_version=1 and status in('draft','ready','running','paused','blocked','awaiting_review');
 if found then return v_run;end if;
 insert into public.production_verification_runs(release_candidate_id,plan_code,plan_version,environment_code,status,initiated_by,reviewed_by,correlation_id)values(p_candidate_id,'CA001_PRODUCTION_RELEASE',1,'production','draft',p_actor_id,p_reviewer_id,p_correlation_id)returning*into v_run;
 insert into public.production_verification_instances(verification_run_id,scenario_code,scenario_version,status,expected_outcome_code)
 select v_run.id,x.scenario_code,x.scenario_version,'pending',x.expected_outcome_code from jsonb_to_recordset(p_instances)as x(scenario_code text,scenario_version integer,expected_outcome_code text);
 insert into public.production_verification_audit_events(verification_run_id,actor_id,event_type,outcome_code,correlation_id)values(v_run.id,p_actor_id,'production_verification_run_created','CREATED',p_correlation_id);
 return v_run;
end$$;
revoke all on function public.create_ca001f_verification_run(uuid,uuid,uuid,text,jsonb)from public,anon,authenticated;
