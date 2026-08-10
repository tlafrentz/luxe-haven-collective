-- AU-001C hardening: durable approval binding, concurrency groups, and lease recovery.
begin;

alter table public.automation_runs add column approval_id text;
alter table public.automation_runs add foreign key(workspace_id,approval_id) references public.automation_approval_requests(workspace_id,id) on delete restrict;
alter table public.automation_run_steps add column concurrency_group text;
create index automation_steps_concurrency_group_idx on public.automation_run_steps(workspace_id,concurrency_group,status) where concurrency_group is not null;

create or replace function public.apply_automation_run_policy(p_run jsonb,p_expected_version integer,p_decision jsonb,p_steps jsonb,p_approval jsonb,p_activity jsonb,p_notifications jsonb)
returns public.automation_runs language plpgsql security definer set search_path=public as $$
declare run_row public.automation_runs;decision_row public.automation_policy_decisions;approval_row public.automation_approval_requests;saved public.automation_runs;notice jsonb;
begin
 run_row:=jsonb_populate_record(null::public.automation_runs,p_run);decision_row:=jsonb_populate_record(null::public.automation_policy_decisions,p_decision);
 if p_approval is not null then approval_row:=jsonb_populate_record(null::public.automation_approval_requests,p_approval); if run_row.approval_id<>approval_row.id then raise exception 'Approval binding mismatch' using errcode='23514'; end if; end if;
 if p_approval is not null then insert into public.automation_approval_requests select approval_row.*; end if;
 update public.automation_runs set status=run_row.status,policy_decision_id=decision_row.id,approval_id=run_row.approval_id,updated_at=run_row.updated_at,version=run_row.version where workspace_id=run_row.workspace_id and id=run_row.id and version=p_expected_version returning * into saved;
 if saved.id is null then raise exception 'Automation run version conflict' using errcode='40001'; end if;
 insert into public.automation_policy_decisions select decision_row.*;
 update public.automation_run_steps target set status=source.status,version=source.version from jsonb_populate_recordset(null::public.automation_run_steps,p_steps)source where target.workspace_id=source.workspace_id and target.id=source.id and target.version=source.version-1;
 insert into public.automation_execution_activity select * from jsonb_populate_recordset(null::public.automation_execution_activity,p_activity);
 for notice in select * from jsonb_array_elements(coalesce(p_notifications,'[]'::jsonb)) loop insert into public.execute_notification_outbox(workspace_id,id,recipient_type,recipient_id,event_type,entity_type,entity_id,safe_template_variables,channel,delivery_status,idempotency_key,attempt_count,created_at) values(run_row.workspace_id::text,notice->>'id','user',notice->>'recipient_id',notice->>'event_type','automation-run',run_row.id,coalesce(notice->'safe_template_variables','{}'::jsonb),'in-app','pending',notice->>'idempotency_key',0,(notice->>'created_at')::timestamptz) on conflict(idempotency_key) do nothing; end loop;
 return saved;
end;$$;

create or replace function public.claim_automation_run_step(p_workspace_id uuid,p_step_id text,p_expected_version integer,p_worker_id text,p_now timestamptz,p_duration_ms bigint)
returns public.automation_run_steps language plpgsql security definer set search_path=public as $$
declare candidate public.automation_run_steps;claimed public.automation_run_steps;
begin
 if p_duration_ms<1000 or p_duration_ms>300000 then raise exception 'Automation step claim duration invalid' using errcode='23514'; end if;
 select * into candidate from public.automation_run_steps where workspace_id=p_workspace_id and id=p_step_id and version=p_expected_version and status='ready' for update;
 if candidate.id is null then return null; end if;
 if candidate.concurrency_group is not null then
  perform pg_advisory_xact_lock(hashtextextended(p_workspace_id::text||':'||candidate.concurrency_group,0));
  if exists(select 1 from public.automation_run_steps active where active.workspace_id=p_workspace_id and active.id<>candidate.id and active.concurrency_group=candidate.concurrency_group and active.status in('leased','dispatching','accepted') and (active.lease_expires_at is null or active.lease_expires_at>p_now)) then return null; end if;
 end if;
 update public.automation_run_steps set status='leased',lease_owner=p_worker_id,lease_acquired_at=p_now,lease_expires_at=p_now+(p_duration_ms*interval '1 millisecond'),lease_generation=lease_generation+1,version=version+1 where workspace_id=p_workspace_id and id=p_step_id and version=p_expected_version returning * into claimed;
 return claimed;
end;$$;

create or replace function public.heartbeat_automation_run_step(p_workspace_id uuid,p_step_id text,p_worker_id text,p_lease_generation bigint,p_expected_version integer,p_now timestamptz,p_duration_ms bigint)
returns public.automation_run_steps language plpgsql security definer set search_path=public as $$
declare saved public.automation_run_steps;
begin
 if p_duration_ms<1000 or p_duration_ms>300000 then raise exception 'Automation heartbeat duration invalid' using errcode='23514'; end if;
 update public.automation_run_steps set lease_expires_at=p_now+(p_duration_ms*interval '1 millisecond'),version=version+1 where workspace_id=p_workspace_id and id=p_step_id and lease_owner=p_worker_id and lease_generation=p_lease_generation and lease_expires_at>p_now and version=p_expected_version and status in('leased','dispatching') returning * into saved;
 if saved.id is null then raise exception 'Automation step lease lost' using errcode='40001'; end if; return saved;
end;$$;
revoke all on function public.heartbeat_automation_run_step(uuid,text,text,bigint,integer,timestamptz,bigint) from public,anon,authenticated;
grant execute on function public.heartbeat_automation_run_step(uuid,text,text,bigint,integer,timestamptz,bigint) to service_role;

create or replace function public.reclaim_expired_automation_run_step(p_workspace_id uuid,p_step_id text,p_expected_version integer,p_now timestamptz,p_outcome_checked boolean)
returns public.automation_run_steps language plpgsql security definer set search_path=public as $$
declare saved public.automation_run_steps;
begin
 if not p_outcome_checked then raise exception 'Owning command outcome must be checked before reclaim' using errcode='23514'; end if;
 update public.automation_run_steps set status='reconciliation_required',lease_owner=null,lease_acquired_at=null,lease_expires_at=null,version=version+1 where workspace_id=p_workspace_id and id=p_step_id and version=p_expected_version and status in('leased','dispatching','accepted') and lease_expires_at<=p_now returning * into saved;
 if saved.id is null then raise exception 'Automation step cannot be reclaimed' using errcode='40001'; end if; return saved;
end;$$;
revoke all on function public.reclaim_expired_automation_run_step(uuid,text,integer,timestamptz,boolean) from public,anon,authenticated;
grant execute on function public.reclaim_expired_automation_run_step(uuid,text,integer,timestamptz,boolean) to service_role;

create or replace function public.mark_automation_step_dispatching(p_step jsonb,p_expected_version integer,p_now timestamptz,p_activity jsonb)
returns public.automation_run_steps language plpgsql security definer set search_path=public as $$
declare step_row public.automation_run_steps;saved public.automation_run_steps;
begin
 step_row:=jsonb_populate_record(null::public.automation_run_steps,p_step);
 update public.automation_run_steps set status='dispatching',version=step_row.version where workspace_id=step_row.workspace_id and id=step_row.id and status='leased' and version=p_expected_version and lease_owner=step_row.lease_owner and lease_generation=step_row.lease_generation and lease_expires_at>p_now returning * into saved;
 if saved.id is null then raise exception 'Automation dispatch lease lost' using errcode='40001'; end if;
 insert into public.automation_execution_activity select * from jsonb_populate_record(null::public.automation_execution_activity,p_activity);
 return saved;
end;$$;
revoke all on function public.mark_automation_step_dispatching(jsonb,integer,timestamptz,jsonb) from public,anon,authenticated;
grant execute on function public.mark_automation_step_dispatching(jsonb,integer,timestamptz,jsonb) to service_role;

-- Retry scheduling is part of the same optimistic transition as the step status.
create or replace function public.transition_automation_run(p_run jsonb,p_expected_version integer,p_steps jsonb,p_activity jsonb,p_notifications jsonb)
returns public.automation_runs language plpgsql security definer set search_path=public as $$
declare run_row public.automation_runs;saved public.automation_runs;notice jsonb;
begin
 run_row:=jsonb_populate_record(null::public.automation_runs,p_run);
 update public.automation_runs set status=run_row.status,updated_at=run_row.updated_at,version=run_row.version where workspace_id=run_row.workspace_id and id=run_row.id and version=p_expected_version returning * into saved;
 if saved.id is null then raise exception 'Automation run version conflict' using errcode='40001'; end if;
 update public.automation_run_steps target set status=source.status,next_attempt_at=source.next_attempt_at,lease_owner=source.lease_owner,lease_acquired_at=source.lease_acquired_at,lease_expires_at=source.lease_expires_at,lease_generation=source.lease_generation,version=source.version from jsonb_populate_recordset(null::public.automation_run_steps,coalesce(p_steps,'[]'::jsonb))source where target.workspace_id=source.workspace_id and target.id=source.id and target.version=source.version-1;
 insert into public.automation_execution_activity select * from jsonb_populate_recordset(null::public.automation_execution_activity,p_activity);
 for notice in select * from jsonb_array_elements(coalesce(p_notifications,'[]'::jsonb)) loop insert into public.execute_notification_outbox(workspace_id,id,recipient_type,recipient_id,event_type,entity_type,entity_id,safe_template_variables,channel,delivery_status,idempotency_key,attempt_count,created_at) values(run_row.workspace_id::text,notice->>'id','user',notice->>'recipient_id',notice->>'event_type','automation-run',run_row.id,coalesce(notice->'safe_template_variables','{}'::jsonb),'in-app','pending',notice->>'idempotency_key',0,(notice->>'created_at')::timestamptz) on conflict(idempotency_key) do nothing; end loop;
 return saved;
end;$$;

-- A dispatch result must consume exactly the run and durable dispatch versions it observed.
create or replace function public.record_automation_dispatch(p_run jsonb,p_step jsonb,p_expected_run_version integer,p_expected_step_version integer,p_attempt jsonb,p_activity jsonb,p_notifications jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare run_row public.automation_runs;step_row public.automation_run_steps;attempt_row public.automation_execution_attempts;saved_run public.automation_runs;saved_step public.automation_run_steps;notice jsonb;
begin
 run_row:=jsonb_populate_record(null::public.automation_runs,p_run);step_row:=jsonb_populate_record(null::public.automation_run_steps,p_step);attempt_row:=jsonb_populate_record(null::public.automation_execution_attempts,p_attempt);
 if run_row.workspace_id<>step_row.workspace_id or run_row.id<>step_row.run_id or attempt_row.step_id<>step_row.id then raise exception 'Dispatch lineage mismatch' using errcode='23514'; end if;
 update public.automation_runs set status=run_row.status,updated_at=run_row.updated_at,version=run_row.version where workspace_id=run_row.workspace_id and id=run_row.id and version=p_expected_run_version returning * into saved_run;
 update public.automation_run_steps set status=step_row.status,attempt_count=attempt_count+1,next_attempt_at=step_row.next_attempt_at,lease_owner=null,lease_acquired_at=null,lease_expires_at=null,version=step_row.version where workspace_id=step_row.workspace_id and id=step_row.id and version=p_expected_step_version returning * into saved_step;
 if saved_run.id is null or saved_step.id is null then raise exception 'Dispatch version conflict' using errcode='40001'; end if;
 insert into public.automation_execution_attempts select attempt_row.* on conflict(workspace_id,step_id,attempt_number) do nothing;
 insert into public.automation_execution_activity select * from jsonb_populate_recordset(null::public.automation_execution_activity,p_activity);
 for notice in select * from jsonb_array_elements(coalesce(p_notifications,'[]'::jsonb)) loop insert into public.execute_notification_outbox(workspace_id,id,recipient_type,recipient_id,event_type,entity_type,entity_id,safe_template_variables,channel,delivery_status,idempotency_key,attempt_count,created_at) values(run_row.workspace_id::text,notice->>'id','user',notice->>'recipient_id',notice->>'event_type','automation-run',run_row.id,coalesce(notice->'safe_template_variables','{}'::jsonb),'in-app','pending',notice->>'idempotency_key',0,(notice->>'created_at')::timestamptz) on conflict(idempotency_key) do nothing; end loop;
 return jsonb_build_object('run',to_jsonb(saved_run),'step',to_jsonb(saved_step));
end;$$;

commit;
