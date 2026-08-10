-- AU-001C Governed Execution: orchestration facts and atomic worker claims.
-- Workers remain disabled by application feature flags; this migration dispatches no command.
begin;

create table public.automation_runs(
  id text primary key, workspace_id uuid not null, property_ids uuid[] not null default '{}', automation_id text not null,
  automation_definition_version_id text not null, automation_definition_version integer not null, run_request_id text not null,
  trigger_occurrence_id text not null, execution_plan_version text not null, initiating_actor_id text not null,
  service_actor_policy_id text not null, correlation_id text not null, causation_id text not null,
  status text not null check(status in('pending_policy_evaluation','awaiting_approval','approved','queued','running','succeeded','partially_succeeded','failed','timed_out','cancellation_requested','cancelled','reconciliation_required','reconciling','blocked','expired')),
  policy_decision_id text, created_at timestamptz not null, updated_at timestamptz not null, deadline_at timestamptz,
  version integer not null check(version>0), unique(workspace_id,id), unique(workspace_id,run_request_id),
  foreign key(workspace_id,run_request_id) references public.automation_run_requests(workspace_id,id) on delete restrict,
  foreign key(workspace_id,automation_id,automation_definition_version) references public.automation_definition_versions(workspace_id,automation_id,version) on delete restrict,
  foreign key(workspace_id,trigger_occurrence_id) references public.automation_trigger_occurrences(workspace_id,id) on delete restrict,
  check(deadline_at is null or deadline_at>created_at)
);
create table public.automation_run_steps(
  id text primary key, workspace_id uuid not null, run_id text not null, step_key text not null, owning_capability text not null,
  command_type text not null, command_contract_version text not null, dependencies text[] not null default '{}',
  status text not null check(status in('pending','awaiting_approval','ready','leased','dispatching','accepted','succeeded','failed_retryable','failed_terminal','timed_out','cancellation_requested','cancelled','skipped','reconciliation_required','reconciling','compensation_requested','compensated','compensation_failed')),
  deterministic_command_id text not null, idempotency_key text not null, expected_target_version integer,
  attempt_count integer not null default 0 check(attempt_count>=0), next_attempt_at timestamptz,
  lease_owner text, lease_acquired_at timestamptz, lease_expires_at timestamptz, lease_generation bigint not null default 0 check(lease_generation>=0),
  version integer not null check(version>0), unique(workspace_id,run_id,step_key), unique(workspace_id,deterministic_command_id), unique(workspace_id,idempotency_key), unique(workspace_id,id),
  foreign key(workspace_id,run_id) references public.automation_runs(workspace_id,id) on delete restrict,
  check((lease_owner is null and lease_acquired_at is null and lease_expires_at is null) or (lease_owner is not null and lease_acquired_at is not null and lease_expires_at>lease_acquired_at))
);
create table public.automation_execution_attempts(
  id text primary key, workspace_id uuid not null, run_id text not null, step_id text not null, attempt_number integer not null check(attempt_number>0),
  command_id text not null, idempotency_key text not null, classification text not null,
  owning_command_id text, safe_result_reference text, started_at timestamptz not null, completed_at timestamptz,
  unique(workspace_id,step_id,attempt_number), unique(workspace_id,id),
  foreign key(workspace_id,run_id) references public.automation_runs(workspace_id,id) on delete restrict,
  foreign key(workspace_id,step_id) references public.automation_run_steps(workspace_id,id) on delete restrict
);
create table public.automation_policy_decisions(
  id text primary key, workspace_id uuid not null, run_id text not null, disposition text not null check(disposition in('permitted_without_additional_approval','approval_required','prohibited','insufficient_context','policy_unavailable')),
  policy_version text not null, target_context_version text not null, matched_rules text[] not null default '{}', missing_facts text[] not null default '{}', safe_explanation text not null, evaluated_at timestamptz not null,
  unique(workspace_id,id), foreign key(workspace_id,run_id) references public.automation_runs(workspace_id,id) on delete restrict
);
create table public.automation_approval_requests(
  id text primary key, workspace_id uuid not null, run_id text not null, step_ids text[] not null default '{}', definition_version_id text not null,
  command_fingerprint text not null, target_context_version text not null, policy_version text not null,
  status text not null check(status in('pending','approved','rejected','deferred','revision_requested','revoked','expired','invalidated')),
  requested_at timestamptz not null, expires_at timestamptz not null, decided_by text, decided_at timestamptz, reason text, version integer not null check(version>0),
  unique(workspace_id,id), foreign key(workspace_id,run_id) references public.automation_runs(workspace_id,id) on delete restrict,
  check(expires_at>requested_at), check((decided_at is null and decided_by is null) or (decided_at is not null and decided_by is not null))
);
create table public.automation_approval_dispositions(
  id text primary key, workspace_id uuid not null, approval_id text not null, disposition text not null, actor_id text not null,
  reason text, occurred_at timestamptz not null, approval_version integer not null check(approval_version>0), correlation_id text not null,
  unique(workspace_id,id), unique(workspace_id,approval_id,approval_version), foreign key(workspace_id,approval_id) references public.automation_approval_requests(workspace_id,id) on delete restrict
);
create table public.automation_reconciliations(
  id text primary key, workspace_id uuid not null, run_id text not null, step_id text not null, command_id text not null, idempotency_key text not null,
  status text not null check(status in('pending','leased','confirmed_succeeded','confirmed_failed','confirmed_not_accepted','still_pending','unknown_escalated','exhausted')),
  attempt_count integer not null default 0 check(attempt_count>=0), lease_owner text, lease_expires_at timestamptz,
  safe_result_reference text, created_at timestamptz not null, updated_at timestamptz not null, version integer not null check(version>0),
  unique(workspace_id,step_id,command_id), unique(workspace_id,id), foreign key(workspace_id,run_id) references public.automation_runs(workspace_id,id) on delete restrict,
  foreign key(workspace_id,step_id) references public.automation_run_steps(workspace_id,id) on delete restrict
);
create table public.automation_execution_activity(
  id text primary key, workspace_id uuid not null, run_id text not null, step_id text, event_type text not null, actor_id text not null,
  occurred_at timestamptz not null, correlation_id text not null, causation_id text not null, aggregate_version integer not null check(aggregate_version>0), safe_metadata jsonb not null default '{}',
  unique(workspace_id,id), foreign key(workspace_id,run_id) references public.automation_runs(workspace_id,id) on delete restrict,
  foreign key(workspace_id,step_id) references public.automation_run_steps(workspace_id,id) on delete restrict
);

create index automation_runs_queue_idx on public.automation_runs(workspace_id,status,updated_at);
create index automation_runs_property_idx on public.automation_runs using gin(property_ids);
create index automation_steps_queue_idx on public.automation_run_steps(workspace_id,status,next_attempt_at,lease_expires_at);
create index automation_attempts_history_idx on public.automation_execution_attempts(workspace_id,run_id,started_at);
create index automation_approvals_queue_idx on public.automation_approval_requests(workspace_id,status,expires_at);
create index automation_reconciliation_queue_idx on public.automation_reconciliations(workspace_id,status,updated_at);
create index automation_execution_activity_idx on public.automation_execution_activity(workspace_id,run_id,occurred_at);

alter table public.automation_runs enable row level security;
alter table public.automation_run_steps enable row level security;
alter table public.automation_execution_attempts enable row level security;
alter table public.automation_policy_decisions enable row level security;
alter table public.automation_approval_requests enable row level security;
alter table public.automation_approval_dispositions enable row level security;
alter table public.automation_reconciliations enable row level security;
alter table public.automation_execution_activity enable row level security;

create policy "Members inspect authorized automation runs" on public.automation_runs for select to authenticated using(public.can_access_automation_properties(workspace_id,property_ids));
create policy "Members inspect authorized automation steps" on public.automation_run_steps for select to authenticated using(exists(select 1 from public.automation_runs r where r.workspace_id=automation_run_steps.workspace_id and r.id=run_id and public.can_access_automation_properties(r.workspace_id,r.property_ids)));
create policy "Members inspect authorized automation attempts" on public.automation_execution_attempts for select to authenticated using(exists(select 1 from public.automation_runs r where r.workspace_id=automation_execution_attempts.workspace_id and r.id=run_id and public.can_access_automation_properties(r.workspace_id,r.property_ids)));
create policy "Members inspect authorized automation policy" on public.automation_policy_decisions for select to authenticated using(exists(select 1 from public.automation_runs r where r.workspace_id=automation_policy_decisions.workspace_id and r.id=run_id and public.can_access_automation_properties(r.workspace_id,r.property_ids)));
create policy "Members inspect authorized automation approvals" on public.automation_approval_requests for select to authenticated using(exists(select 1 from public.automation_runs r where r.workspace_id=automation_approval_requests.workspace_id and r.id=run_id and public.can_access_automation_properties(r.workspace_id,r.property_ids)));
create policy "Members inspect authorized approval dispositions" on public.automation_approval_dispositions for select to authenticated using(exists(select 1 from public.automation_approval_requests a join public.automation_runs r on r.workspace_id=a.workspace_id and r.id=a.run_id where a.workspace_id=automation_approval_dispositions.workspace_id and a.id=approval_id and public.can_access_automation_properties(r.workspace_id,r.property_ids)));
create policy "Members inspect authorized reconciliation" on public.automation_reconciliations for select to authenticated using(exists(select 1 from public.automation_runs r where r.workspace_id=automation_reconciliations.workspace_id and r.id=run_id and public.can_access_automation_properties(r.workspace_id,r.property_ids)));
create policy "Members inspect authorized execution activity" on public.automation_execution_activity for select to authenticated using(exists(select 1 from public.automation_runs r where r.workspace_id=automation_execution_activity.workspace_id and r.id=run_id and public.can_access_automation_properties(r.workspace_id,r.property_ids)));

grant select on public.automation_runs,public.automation_run_steps,public.automation_execution_attempts,public.automation_policy_decisions,public.automation_approval_requests,public.automation_approval_dispositions,public.automation_reconciliations,public.automation_execution_activity to authenticated;
grant all on public.automation_runs,public.automation_run_steps,public.automation_execution_attempts,public.automation_policy_decisions,public.automation_approval_requests,public.automation_approval_dispositions,public.automation_reconciliations,public.automation_execution_activity to service_role;

create trigger automation_attempts_append_only before update or delete on public.automation_execution_attempts for each row execute function public.prevent_automation_history_change();
create trigger automation_policy_append_only before update or delete on public.automation_policy_decisions for each row execute function public.prevent_automation_history_change();
create trigger automation_approval_dispositions_append_only before update or delete on public.automation_approval_dispositions for each row execute function public.prevent_automation_history_change();
create trigger automation_execution_activity_append_only before update or delete on public.automation_execution_activity for each row execute function public.prevent_automation_history_change();

alter table public.execute_notification_outbox drop constraint if exists execute_notification_outbox_entity_type_check;
alter table public.execute_notification_outbox add constraint execute_notification_outbox_entity_type_check check(entity_type in('plan','action','evidence','blocker','dependency','recurrence','escalation','measurement','learning-signal','pattern','lesson','recommendation-opportunity','recommendation','automation-definition','automation-run','automation-approval'));

create or replace function public.materialize_automation_run(p_run jsonb,p_steps jsonb,p_activity jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare run_row public.automation_runs;activity_row public.automation_execution_activity;existing public.automation_runs;
begin
 run_row:=jsonb_populate_record(null::public.automation_runs,p_run); activity_row:=jsonb_populate_record(null::public.automation_execution_activity,p_activity);
 if not exists(select 1 from public.automation_run_requests request where request.workspace_id=run_row.workspace_id and request.id=run_row.run_request_id and request.status='REQUESTED') then raise exception 'Run request ineligible' using errcode='23514'; end if;
 insert into public.automation_runs select run_row.* on conflict(workspace_id,run_request_id) do nothing;
 if not found then select * into existing from public.automation_runs where workspace_id=run_row.workspace_id and run_request_id=run_row.run_request_id; return jsonb_build_object('created',false,'run',to_jsonb(existing)); end if;
 if exists(select 1 from jsonb_populate_recordset(null::public.automation_run_steps,p_steps)s where s.workspace_id<>run_row.workspace_id or s.run_id<>run_row.id) then raise exception 'Run step lineage mismatch' using errcode='23514'; end if;
 insert into public.automation_run_steps select * from jsonb_populate_recordset(null::public.automation_run_steps,p_steps);
 insert into public.automation_execution_activity select activity_row.*;
 return jsonb_build_object('created',true,'run',to_jsonb(run_row));
end;$$;
revoke all on function public.materialize_automation_run(jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.materialize_automation_run(jsonb,jsonb,jsonb) to service_role;

create or replace function public.claim_automation_run_step(p_workspace_id uuid,p_step_id text,p_expected_version integer,p_worker_id text,p_now timestamptz,p_duration_ms bigint)
returns public.automation_run_steps language plpgsql security definer set search_path=public as $$
declare claimed public.automation_run_steps;
begin
 if p_duration_ms<1000 or p_duration_ms>300000 then raise exception 'Automation step claim duration invalid' using errcode='23514'; end if;
 update public.automation_run_steps set status='leased',lease_owner=p_worker_id,lease_acquired_at=p_now,lease_expires_at=p_now+(p_duration_ms*interval '1 millisecond'),lease_generation=lease_generation+1,version=version+1
 where workspace_id=p_workspace_id and id=p_step_id and version=p_expected_version and status='ready' and (lease_expires_at is null or lease_expires_at<=p_now) returning * into claimed;
 return claimed;
end;$$;
revoke all on function public.claim_automation_run_step(uuid,text,integer,text,timestamptz,bigint) from public,anon,authenticated;
grant execute on function public.claim_automation_run_step(uuid,text,integer,text,timestamptz,bigint) to service_role;

create or replace function public.apply_automation_run_policy(p_run jsonb,p_expected_version integer,p_decision jsonb,p_steps jsonb,p_approval jsonb,p_activity jsonb,p_notifications jsonb)
returns public.automation_runs language plpgsql security definer set search_path=public as $$
declare run_row public.automation_runs;decision_row public.automation_policy_decisions;approval_row public.automation_approval_requests; saved public.automation_runs; notice jsonb;
begin
 run_row:=jsonb_populate_record(null::public.automation_runs,p_run); decision_row:=jsonb_populate_record(null::public.automation_policy_decisions,p_decision);
 update public.automation_runs set status=run_row.status,policy_decision_id=decision_row.id,updated_at=run_row.updated_at,version=run_row.version where workspace_id=run_row.workspace_id and id=run_row.id and version=p_expected_version returning * into saved;
 if saved.id is null then raise exception 'Automation run version conflict' using errcode='40001'; end if;
 insert into public.automation_policy_decisions select decision_row.*;
 update public.automation_run_steps target set status=source.status,version=source.version from jsonb_populate_recordset(null::public.automation_run_steps,p_steps)source where target.workspace_id=source.workspace_id and target.id=source.id and target.version=source.version-1;
 if p_approval is not null then approval_row:=jsonb_populate_record(null::public.automation_approval_requests,p_approval); insert into public.automation_approval_requests select approval_row.*; end if;
 insert into public.automation_execution_activity select * from jsonb_populate_recordset(null::public.automation_execution_activity,p_activity);
 for notice in select * from jsonb_array_elements(coalesce(p_notifications,'[]'::jsonb)) loop insert into public.execute_notification_outbox(workspace_id,id,recipient_type,recipient_id,event_type,entity_type,entity_id,safe_template_variables,channel,delivery_status,idempotency_key,attempt_count,created_at) values(run_row.workspace_id::text,notice->>'id','user',notice->>'recipient_id',notice->>'event_type','automation-run',run_row.id,coalesce(notice->'safe_template_variables','{}'::jsonb),'in-app','pending',notice->>'idempotency_key',0,(notice->>'created_at')::timestamptz) on conflict(idempotency_key) do nothing; end loop;
 return saved;
end;$$;
revoke all on function public.apply_automation_run_policy(jsonb,integer,jsonb,jsonb,jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.apply_automation_run_policy(jsonb,integer,jsonb,jsonb,jsonb,jsonb,jsonb) to service_role;

create or replace function public.transition_automation_run(p_run jsonb,p_expected_version integer,p_steps jsonb,p_activity jsonb,p_notifications jsonb)
returns public.automation_runs language plpgsql security definer set search_path=public as $$
declare run_row public.automation_runs;saved public.automation_runs;notice jsonb;
begin
 run_row:=jsonb_populate_record(null::public.automation_runs,p_run);
 update public.automation_runs set status=run_row.status,updated_at=run_row.updated_at,version=run_row.version where workspace_id=run_row.workspace_id and id=run_row.id and version=p_expected_version returning * into saved;
 if saved.id is null then raise exception 'Automation run version conflict' using errcode='40001'; end if;
 update public.automation_run_steps target set status=source.status,version=source.version from jsonb_populate_recordset(null::public.automation_run_steps,coalesce(p_steps,'[]'::jsonb))source where target.workspace_id=source.workspace_id and target.id=source.id and target.version=source.version-1;
 insert into public.automation_execution_activity select * from jsonb_populate_recordset(null::public.automation_execution_activity,p_activity);
 for notice in select * from jsonb_array_elements(coalesce(p_notifications,'[]'::jsonb)) loop insert into public.execute_notification_outbox(workspace_id,id,recipient_type,recipient_id,event_type,entity_type,entity_id,safe_template_variables,channel,delivery_status,idempotency_key,attempt_count,created_at) values(run_row.workspace_id::text,notice->>'id','user',notice->>'recipient_id',notice->>'event_type','automation-run',run_row.id,coalesce(notice->'safe_template_variables','{}'::jsonb),'in-app','pending',notice->>'idempotency_key',0,(notice->>'created_at')::timestamptz) on conflict(idempotency_key) do nothing; end loop;
 return saved;
end;$$;
revoke all on function public.transition_automation_run(jsonb,integer,jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.transition_automation_run(jsonb,integer,jsonb,jsonb,jsonb) to service_role;

create or replace function public.record_automation_dispatch(p_run jsonb,p_step jsonb,p_expected_run_version integer,p_expected_step_version integer,p_attempt jsonb,p_activity jsonb,p_notifications jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare run_row public.automation_runs;step_row public.automation_run_steps;attempt_row public.automation_execution_attempts;saved_run public.automation_runs;saved_step public.automation_run_steps;notice jsonb;
begin
 run_row:=jsonb_populate_record(null::public.automation_runs,p_run);step_row:=jsonb_populate_record(null::public.automation_run_steps,p_step);attempt_row:=jsonb_populate_record(null::public.automation_execution_attempts,p_attempt);
 if run_row.workspace_id<>step_row.workspace_id or run_row.id<>step_row.run_id or attempt_row.step_id<>step_row.id then raise exception 'Dispatch lineage mismatch' using errcode='23514'; end if;
 update public.automation_runs set status=run_row.status,updated_at=run_row.updated_at,version=run_row.version where workspace_id=run_row.workspace_id and id=run_row.id and version in(p_expected_run_version,run_row.version) returning * into saved_run;
 update public.automation_run_steps set status=step_row.status,attempt_count=attempt_count+1,next_attempt_at=step_row.next_attempt_at,lease_owner=null,lease_acquired_at=null,lease_expires_at=null,version=step_row.version where workspace_id=step_row.workspace_id and id=step_row.id and version=p_expected_step_version returning * into saved_step;
 if saved_run.id is null or saved_step.id is null then raise exception 'Dispatch version conflict' using errcode='40001'; end if;
 insert into public.automation_execution_attempts select attempt_row.* on conflict(workspace_id,step_id,attempt_number) do nothing;
 insert into public.automation_execution_activity select * from jsonb_populate_recordset(null::public.automation_execution_activity,p_activity);
 for notice in select * from jsonb_array_elements(coalesce(p_notifications,'[]'::jsonb)) loop insert into public.execute_notification_outbox(workspace_id,id,recipient_type,recipient_id,event_type,entity_type,entity_id,safe_template_variables,channel,delivery_status,idempotency_key,attempt_count,created_at) values(run_row.workspace_id::text,notice->>'id','user',notice->>'recipient_id',notice->>'event_type','automation-run',run_row.id,coalesce(notice->'safe_template_variables','{}'::jsonb),'in-app','pending',notice->>'idempotency_key',0,(notice->>'created_at')::timestamptz) on conflict(idempotency_key) do nothing; end loop;
 return jsonb_build_object('run',to_jsonb(saved_run),'step',to_jsonb(saved_step));
end;$$;
revoke all on function public.record_automation_dispatch(jsonb,jsonb,integer,integer,jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.record_automation_dispatch(jsonb,jsonb,integer,integer,jsonb,jsonb,jsonb) to service_role;

create or replace function public.decide_automation_approval(p_approval jsonb,p_expected_approval_version integer,p_run jsonb,p_expected_run_version integer,p_steps jsonb,p_disposition_id text,p_activity jsonb,p_notifications jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare approval_row public.automation_approval_requests;run_row public.automation_runs;saved_approval public.automation_approval_requests;saved_run public.automation_runs;notice jsonb;
begin
 approval_row:=jsonb_populate_record(null::public.automation_approval_requests,p_approval);run_row:=jsonb_populate_record(null::public.automation_runs,p_run);
 if public.active_workspace_role(approval_row.workspace_id)not in('owner','administrator') or not public.can_access_automation_properties(approval_row.workspace_id,run_row.property_ids) then raise exception 'Approval authority denied' using errcode='42501'; end if;
 update public.automation_approval_requests set status=approval_row.status,decided_by=approval_row.decided_by,decided_at=approval_row.decided_at,reason=approval_row.reason,version=approval_row.version where workspace_id=approval_row.workspace_id and id=approval_row.id and status='pending' and expires_at>approval_row.decided_at and version=p_expected_approval_version returning * into saved_approval;
 update public.automation_runs set status=run_row.status,updated_at=run_row.updated_at,version=run_row.version where workspace_id=run_row.workspace_id and id=run_row.id and version=p_expected_run_version returning * into saved_run;
 if saved_approval.id is null or saved_run.id is null then raise exception 'Approval version conflict' using errcode='40001'; end if;
 insert into public.automation_approval_dispositions(id,workspace_id,approval_id,disposition,actor_id,reason,occurred_at,approval_version,correlation_id) values(p_disposition_id,approval_row.workspace_id,approval_row.id,approval_row.status,approval_row.decided_by,approval_row.reason,approval_row.decided_at,approval_row.version,run_row.correlation_id);
 update public.automation_run_steps target set status=source.status,version=source.version from jsonb_populate_recordset(null::public.automation_run_steps,p_steps)source where target.workspace_id=source.workspace_id and target.id=source.id and target.version=source.version-1;
 insert into public.automation_execution_activity select * from jsonb_populate_recordset(null::public.automation_execution_activity,p_activity);
 for notice in select * from jsonb_array_elements(coalesce(p_notifications,'[]'::jsonb)) loop insert into public.execute_notification_outbox(workspace_id,id,recipient_type,recipient_id,event_type,entity_type,entity_id,safe_template_variables,channel,delivery_status,idempotency_key,attempt_count,created_at) values(run_row.workspace_id::text,notice->>'id','user',notice->>'recipient_id',notice->>'event_type','automation-approval',approval_row.id,coalesce(notice->'safe_template_variables','{}'::jsonb),'in-app','pending',notice->>'idempotency_key',0,(notice->>'created_at')::timestamptz) on conflict(idempotency_key) do nothing; end loop;
 return jsonb_build_object('approval',to_jsonb(saved_approval),'run',to_jsonb(saved_run));
end;$$;
revoke all on function public.decide_automation_approval(jsonb,integer,jsonb,integer,jsonb,text,jsonb,jsonb) from public,anon;
grant execute on function public.decide_automation_approval(jsonb,integer,jsonb,integer,jsonb,text,jsonb,jsonb) to authenticated;

commit;
