-- AU-001B Triggers and Scheduling: durable trigger intake and run requests only.
-- This migration intentionally creates no command-dispatch queue or target executor.
begin;

create table public.automation_triggers(
  id text primary key,
  workspace_id uuid not null,
  automation_id text not null references public.automation_definitions(id) on delete restrict,
  automation_definition_version integer not null,
  kind text not null check(kind in('SCHEDULE_CALENDAR','SCHEDULE_INTERVAL','DOMAIN_EVENT','STATE_CHANGE','THRESHOLD','MANUAL')),
  schema_version text not null check(schema_version='au001-trigger.v1'),
  scope_type text not null check(scope_type in('property','selected-properties','portfolio','organization')),
  property_ids uuid[] not null default '{}',
  target_id text,
  enabled boolean not null,
  effective_from timestamptz not null,
  effective_until timestamptz,
  configuration jsonb not null,
  misfire_policy text not null check(misfire_policy in('SKIP','FIRE_ONCE_NOW','BACKFILL_BOUNDED')),
  backfill_maximum_count integer not null check(backfill_maximum_count between 1 and 500),
  backfill_maximum_age_ms bigint not null check(backfill_maximum_age_ms>0),
  deduplication_policy_version text not null check(deduplication_policy_version='au001-occurrence.v1'),
  eligibility_policy_version text not null check(eligibility_policy_version='au001-eligibility.v1'),
  created_by_profile_id uuid not null references public.profiles(id) on delete restrict,
  updated_by_profile_id uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  version integer not null check(version>0),
  unique(workspace_id,id),
  unique(workspace_id,automation_id,id),
  unique(workspace_id,automation_id,automation_definition_version,id),
  foreign key(workspace_id,automation_id,automation_definition_version)
    references public.automation_definition_versions(workspace_id,automation_id,version) on delete restrict,
  check(effective_until is null or effective_until>effective_from),
  check((scope_type='property' and cardinality(property_ids)=1) or (scope_type='selected-properties' and cardinality(property_ids)>0) or scope_type in('portfolio','organization'))
);

create table public.automation_trigger_occurrences(
  id text primary key,
  occurrence_key text not null,
  workspace_id uuid not null,
  automation_id text not null,
  automation_definition_version integer not null,
  trigger_id text not null,
  trigger_kind text not null check(trigger_kind in('SCHEDULE_CALENDAR','SCHEDULE_INTERVAL','DOMAIN_EVENT','STATE_CHANGE','THRESHOLD','MANUAL')),
  target_key text not null,
  occurred_at timestamptz not null,
  detected_at timestamptz not null,
  disposition text not null check(disposition in('DETECTED','VALIDATED','INELIGIBLE','DUPLICATE','DEFERRED','ACCEPTED','RUN_REQUEST_CREATED','MISSED','BACKFILLED','EXPIRED','FAILED_SAFE')),
  reason_code text not null,
  correlation_id text not null,
  causation_id text,
  source_identity text not null,
  safe_context jsonb not null default '{}',
  eligibility_policy_version text not null,
  backfilled boolean not null default false,
  version integer not null check(version>0),
  unique(workspace_id,occurrence_key),
  unique(workspace_id,id),
  foreign key(workspace_id,automation_id,automation_definition_version,trigger_id)
    references public.automation_triggers(workspace_id,automation_id,automation_definition_version,id) on delete restrict
);

create table public.automation_run_requests(
  id text primary key,
  idempotency_key text not null,
  workspace_id uuid not null,
  scope_type text not null check(scope_type in('property','selected-properties','portfolio','organization')),
  property_ids uuid[] not null default '{}',
  target_id text,
  automation_id text not null,
  automation_definition_version integer not null,
  trigger_id text not null,
  trigger_kind text not null check(trigger_kind in('SCHEDULE_CALENDAR','SCHEDULE_INTERVAL','DOMAIN_EVENT','STATE_CHANGE','THRESHOLD','MANUAL')),
  occurrence_id text not null,
  requested_at timestamptz not null,
  occurred_at timestamptz not null,
  eligibility_policy_version text not null,
  approval_classification text not null,
  correlation_id text not null,
  causation_id text,
  safe_trigger_context jsonb not null default '{}',
  status text not null check(status in('REQUESTED','WITHHELD','CANCELLED_BEFORE_DISPATCH')),
  version integer not null check(version>0),
  unique(workspace_id,idempotency_key),
  unique(workspace_id,occurrence_id),
  unique(workspace_id,id),
  foreign key(workspace_id,occurrence_id) references public.automation_trigger_occurrences(workspace_id,id) on delete restrict,
  foreign key(workspace_id,automation_id,automation_definition_version,trigger_id)
    references public.automation_triggers(workspace_id,automation_id,automation_definition_version,id) on delete restrict,
  check((scope_type='property' and cardinality(property_ids)=1) or (scope_type='selected-properties' and cardinality(property_ids)>0) or scope_type in('portfolio','organization'))
);

create table public.automation_scheduler_leases(
  partition_key text primary key,
  workspace_id uuid not null,
  owner_id text not null,
  generation bigint not null check(generation>0),
  acquired_at timestamptz not null,
  expires_at timestamptz not null,
  heartbeat_at timestamptz not null,
  progress bigint not null default 0 check(progress>=0),
  check(expires_at>heartbeat_at)
);

create table public.automation_scheduler_checkpoints(
  partition_key text primary key references public.automation_scheduler_leases(partition_key) on delete restrict,
  workspace_id uuid not null,
  watermark timestamptz not null,
  version integer not null check(version>0),
  updated_at timestamptz not null,
  lease_generation bigint not null check(lease_generation>0)
);

create table public.automation_trigger_evaluation_state(
  workspace_id uuid not null,
  automation_id text not null,
  automation_definition_version integer not null,
  trigger_id text not null,
  target_key text not null,
  last_source_version bigint,
  last_source_classification text,
  last_accepted_occurrence_id text,
  last_accepted_at timestamptz,
  armed boolean not null default true,
  cooldown_until timestamptz,
  version integer not null check(version>0),
  primary key(workspace_id,trigger_id,target_key),
  foreign key(workspace_id,automation_id,automation_definition_version,trigger_id)
    references public.automation_triggers(workspace_id,automation_id,automation_definition_version,id) on delete restrict,
  foreign key(workspace_id,last_accepted_occurrence_id) references public.automation_trigger_occurrences(workspace_id,id) on delete restrict
);

create table public.automation_backfill_jobs(
  id text primary key,
  workspace_id uuid not null,
  trigger_id text not null,
  automation_id text not null,
  automation_definition_version integer not null,
  from_at timestamptz not null,
  through_at timestamptz not null,
  maximum_count integer not null check(maximum_count between 1 and 500),
  status text not null check(status in('PENDING','PROCESSING','COMPLETED','CANCELLED','FAILED_SAFE')),
  processed_count integer not null default 0 check(processed_count>=0 and processed_count<=maximum_count),
  idempotency_key text not null,
  reason text not null check(btrim(reason)<>''),
  requested_by_profile_id uuid not null references public.profiles(id) on delete restrict,
  correlation_id text not null,
  created_at timestamptz not null,
  version integer not null check(version>0),
  unique(workspace_id,idempotency_key),
  unique(workspace_id,id),
  foreign key(workspace_id,automation_id,automation_definition_version,trigger_id)
    references public.automation_triggers(workspace_id,automation_id,automation_definition_version,id) on delete restrict,
  check(through_at>=from_at)
);

create table public.automation_trigger_activity(
  id text primary key,
  workspace_id uuid not null,
  automation_id text not null,
  trigger_id text not null,
  occurrence_id text,
  event_type text not null,
  actor_id text not null,
  occurred_at timestamptz not null,
  correlation_id text not null,
  causation_id text,
  aggregate_version integer not null check(aggregate_version>0),
  safe_metadata jsonb not null default '{}',
  unique(workspace_id,id),
  foreign key(workspace_id,automation_id,trigger_id)
    references public.automation_triggers(workspace_id,automation_id,id) on delete restrict,
  foreign key(workspace_id,occurrence_id) references public.automation_trigger_occurrences(workspace_id,id) on delete restrict
);

create index automation_triggers_due_idx on public.automation_triggers(workspace_id,enabled,effective_from,effective_until) where enabled;
create index automation_triggers_event_idx on public.automation_triggers(workspace_id,kind,((configuration->>'eventType'))) where enabled and kind='DOMAIN_EVENT';
create index automation_trigger_occurrences_history_idx on public.automation_trigger_occurrences(workspace_id,trigger_id,occurred_at desc);
create index automation_trigger_occurrences_disposition_idx on public.automation_trigger_occurrences(workspace_id,disposition,detected_at desc);
create index automation_run_requests_status_idx on public.automation_run_requests(workspace_id,status,requested_at);
create index automation_backfill_jobs_queue_idx on public.automation_backfill_jobs(workspace_id,status,created_at);
create index automation_trigger_activity_history_idx on public.automation_trigger_activity(workspace_id,trigger_id,occurred_at);

alter table public.automation_triggers enable row level security;
alter table public.automation_trigger_occurrences enable row level security;
alter table public.automation_run_requests enable row level security;
alter table public.automation_scheduler_leases enable row level security;
alter table public.automation_scheduler_checkpoints enable row level security;
alter table public.automation_trigger_evaluation_state enable row level security;
alter table public.automation_backfill_jobs enable row level security;
alter table public.automation_trigger_activity enable row level security;

create policy "Members inspect authorized automation triggers" on public.automation_triggers for select to authenticated
using(public.can_access_automation_properties(workspace_id,property_ids));
create policy "Members inspect authorized trigger occurrences" on public.automation_trigger_occurrences for select to authenticated
using(exists(select 1 from public.automation_triggers trigger where trigger.id=trigger_id and trigger.workspace_id=automation_trigger_occurrences.workspace_id and public.can_access_automation_properties(trigger.workspace_id,trigger.property_ids)));
create policy "Members inspect authorized automation run requests" on public.automation_run_requests for select to authenticated
using(public.can_access_automation_properties(workspace_id,property_ids));
create policy "Automation administrators inspect scheduler leases" on public.automation_scheduler_leases for select to authenticated
using(public.active_workspace_role(workspace_id) in('owner','administrator'));
create policy "Automation administrators inspect scheduler checkpoints" on public.automation_scheduler_checkpoints for select to authenticated
using(public.active_workspace_role(workspace_id) in('owner','administrator'));
create policy "Members inspect authorized trigger evaluation state" on public.automation_trigger_evaluation_state for select to authenticated
using(exists(select 1 from public.automation_triggers trigger where trigger.id=trigger_id and trigger.workspace_id=automation_trigger_evaluation_state.workspace_id and public.can_access_automation_properties(trigger.workspace_id,trigger.property_ids)));
create policy "Members inspect authorized backfill jobs" on public.automation_backfill_jobs for select to authenticated
using(exists(select 1 from public.automation_triggers trigger where trigger.id=trigger_id and trigger.workspace_id=automation_backfill_jobs.workspace_id and public.can_access_automation_properties(trigger.workspace_id,trigger.property_ids)));
create policy "Members inspect authorized trigger activity" on public.automation_trigger_activity for select to authenticated
using(exists(select 1 from public.automation_triggers trigger where trigger.id=trigger_id and trigger.workspace_id=automation_trigger_activity.workspace_id and public.can_access_automation_properties(trigger.workspace_id,trigger.property_ids)));

grant select on public.automation_triggers,public.automation_trigger_occurrences,public.automation_run_requests,public.automation_scheduler_leases,public.automation_scheduler_checkpoints,public.automation_trigger_evaluation_state,public.automation_backfill_jobs,public.automation_trigger_activity to authenticated;
grant all on public.automation_triggers,public.automation_trigger_occurrences,public.automation_run_requests,public.automation_scheduler_leases,public.automation_scheduler_checkpoints,public.automation_trigger_evaluation_state,public.automation_backfill_jobs,public.automation_trigger_activity to service_role;

create or replace function public.prevent_automation_trigger_history_change() returns trigger language plpgsql as $$
begin raise exception 'Automation trigger history is append-only' using errcode='42501'; end; $$;
create trigger automation_occurrences_append_only before update or delete on public.automation_trigger_occurrences for each row execute function public.prevent_automation_trigger_history_change();
create trigger automation_run_requests_append_only before update or delete on public.automation_run_requests for each row execute function public.prevent_automation_trigger_history_change();
create trigger automation_trigger_activity_append_only before update or delete on public.automation_trigger_activity for each row execute function public.prevent_automation_trigger_history_change();

create or replace function public.register_automation_trigger(p_trigger jsonb,p_activity jsonb)
returns public.automation_triggers language plpgsql security definer set search_path=public as $$
declare trigger_row public.automation_triggers;activity_row public.automation_trigger_activity;
begin
  trigger_row:=jsonb_populate_record(null::public.automation_triggers,p_trigger);
  activity_row:=jsonb_populate_record(null::public.automation_trigger_activity,p_activity);
  if public.active_workspace_role(trigger_row.workspace_id) not in('owner','administrator','operator') or not public.can_access_automation_properties(trigger_row.workspace_id,trigger_row.property_ids) then raise exception 'Trigger access denied' using errcode='42501'; end if;
  if trigger_row.created_by_profile_id<>auth.uid() or activity_row.workspace_id<>trigger_row.workspace_id or activity_row.automation_id<>trigger_row.automation_id or activity_row.trigger_id<>trigger_row.id then raise exception 'Trigger registration lineage mismatch' using errcode='23514'; end if;
  insert into public.automation_triggers select trigger_row.*;
  insert into public.automation_trigger_activity select activity_row.*;
  return trigger_row;
end;$$;
revoke all on function public.register_automation_trigger(jsonb,jsonb) from public,anon;
grant execute on function public.register_automation_trigger(jsonb,jsonb) to authenticated;

create or replace function public.set_automation_trigger_enabled(p_workspace_id uuid,p_trigger_id text,p_expected_version integer,p_enabled boolean,p_actor_id text,p_occurred_at timestamptz,p_activity jsonb)
returns public.automation_triggers language plpgsql security definer set search_path=public as $$
declare trigger_row public.automation_triggers;activity_row public.automation_trigger_activity;
begin
  select * into trigger_row from public.automation_triggers where workspace_id=p_workspace_id and id=p_trigger_id and version=p_expected_version for update;
  if trigger_row.id is null then raise exception 'Trigger version conflict' using errcode='40001'; end if;
  if public.active_workspace_role(p_workspace_id) not in('owner','administrator','operator') or not public.can_access_automation_properties(p_workspace_id,trigger_row.property_ids) then raise exception 'Trigger access denied' using errcode='42501'; end if;
  activity_row:=jsonb_populate_record(null::public.automation_trigger_activity,p_activity);
  if activity_row.workspace_id<>p_workspace_id or activity_row.trigger_id<>p_trigger_id or activity_row.aggregate_version<>p_expected_version+1 then raise exception 'Trigger activity lineage mismatch' using errcode='23514'; end if;
  update public.automation_triggers set enabled=p_enabled,updated_by_profile_id=p_actor_id::uuid,updated_at=p_occurred_at,version=version+1 where workspace_id=p_workspace_id and id=p_trigger_id and version=p_expected_version returning * into trigger_row;
  insert into public.automation_trigger_activity select activity_row.*;
  return trigger_row;
end;$$;
revoke all on function public.set_automation_trigger_enabled(uuid,text,integer,boolean,text,timestamptz,jsonb) from public,anon;
grant execute on function public.set_automation_trigger_enabled(uuid,text,integer,boolean,text,timestamptz,jsonb) to authenticated;

create or replace function public.save_automation_backfill_job(p_job jsonb,p_expected_version integer default null)
returns public.automation_backfill_jobs language plpgsql security definer set search_path=public as $$
declare job_row public.automation_backfill_jobs;trigger_row public.automation_triggers;
begin
  job_row:=jsonb_populate_record(null::public.automation_backfill_jobs,p_job);
  select * into trigger_row from public.automation_triggers where workspace_id=job_row.workspace_id and id=job_row.trigger_id;
  if trigger_row.id is null or (auth.role()<>'service_role' and (public.active_workspace_role(job_row.workspace_id) not in('owner','administrator','operator') or not public.can_access_automation_properties(job_row.workspace_id,trigger_row.property_ids))) then raise exception 'Backfill access denied' using errcode='42501'; end if;
  if p_expected_version is null then insert into public.automation_backfill_jobs select job_row.* returning * into job_row;
  else
    update public.automation_backfill_jobs set status=job_row.status,processed_count=job_row.processed_count,version=job_row.version where workspace_id=job_row.workspace_id and id=job_row.id and version=p_expected_version returning * into job_row;
    if job_row.id is null then raise exception 'Backfill version conflict' using errcode='40001'; end if;
  end if;
  return job_row;
end;$$;
revoke all on function public.save_automation_backfill_job(jsonb,integer) from public,anon;
grant execute on function public.save_automation_backfill_job(jsonb,integer) to authenticated,service_role;

create or replace function public.accept_automation_trigger_occurrence(p_occurrence jsonb,p_run_request jsonb,p_activity jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare occurrence_row public.automation_trigger_occurrences;run_row public.automation_run_requests;existing_run public.automation_run_requests;
begin
  occurrence_row:=jsonb_populate_record(null::public.automation_trigger_occurrences,p_occurrence);
  if not exists(
    select 1 from public.automation_triggers trigger
    where trigger.workspace_id=occurrence_row.workspace_id and trigger.id=occurrence_row.trigger_id
      and (auth.role()='service_role' or public.can_access_automation_properties(trigger.workspace_id,trigger.property_ids))
  ) then raise exception 'Trigger occurrence access denied' using errcode='42501'; end if;
  insert into public.automation_trigger_occurrences select occurrence_row.* on conflict(workspace_id,occurrence_key) do nothing;
  if not found then
    select * into occurrence_row from public.automation_trigger_occurrences where workspace_id=occurrence_row.workspace_id and occurrence_key=occurrence_row.occurrence_key;
    select * into existing_run from public.automation_run_requests where workspace_id=occurrence_row.workspace_id and occurrence_id=occurrence_row.id;
    return jsonb_build_object('created',false,'occurrence',to_jsonb(occurrence_row),'runRequest',case when existing_run.id is null then null else to_jsonb(existing_run) end);
  end if;
  if p_run_request is not null then
    run_row:=jsonb_populate_record(null::public.automation_run_requests,p_run_request);
    if run_row.workspace_id<>occurrence_row.workspace_id or run_row.occurrence_id<>occurrence_row.id or run_row.automation_id<>occurrence_row.automation_id or run_row.automation_definition_version<>occurrence_row.automation_definition_version or run_row.trigger_id<>occurrence_row.trigger_id then raise exception 'Run request lineage mismatch' using errcode='23514'; end if;
    insert into public.automation_run_requests select run_row.*;
  end if;
  insert into public.automation_trigger_activity select * from jsonb_populate_recordset(null::public.automation_trigger_activity,coalesce(p_activity,'[]'::jsonb));
  return jsonb_build_object('created',true,'occurrence',to_jsonb(occurrence_row),'runRequest',case when run_row.id is null then null else to_jsonb(run_row) end);
end;$$;
revoke all on function public.accept_automation_trigger_occurrence(jsonb,jsonb,jsonb) from public,anon;
grant execute on function public.accept_automation_trigger_occurrence(jsonb,jsonb,jsonb) to authenticated,service_role;

create or replace function public.claim_automation_scheduler_lease(p_partition_key text,p_workspace_id uuid,p_owner_id text,p_now timestamptz,p_duration_ms bigint)
returns public.automation_scheduler_leases language plpgsql security definer set search_path=public as $$
declare claimed public.automation_scheduler_leases;
begin
  if p_duration_ms<1000 or p_duration_ms>300000 then raise exception 'Scheduler lease duration invalid' using errcode='23514'; end if;
  insert into public.automation_scheduler_leases(partition_key,workspace_id,owner_id,generation,acquired_at,expires_at,heartbeat_at,progress)
  values(p_partition_key,p_workspace_id,p_owner_id,1,p_now,p_now+(p_duration_ms*interval '1 millisecond'),p_now,0)
  on conflict(partition_key) do update set workspace_id=excluded.workspace_id,owner_id=excluded.owner_id,generation=automation_scheduler_leases.generation+1,acquired_at=excluded.acquired_at,expires_at=excluded.expires_at,heartbeat_at=excluded.heartbeat_at,progress=0
  where automation_scheduler_leases.expires_at<=p_now
  returning * into claimed;
  return claimed;
end;$$;
revoke all on function public.claim_automation_scheduler_lease(text,uuid,text,timestamptz,bigint) from public,anon,authenticated;
grant execute on function public.claim_automation_scheduler_lease(text,uuid,text,timestamptz,bigint) to service_role;

create or replace function public.heartbeat_automation_scheduler_lease(p_partition_key text,p_owner_id text,p_generation bigint,p_now timestamptz,p_duration_ms bigint,p_progress bigint)
returns public.automation_scheduler_leases language plpgsql security definer set search_path=public as $$
declare lease public.automation_scheduler_leases;
begin
  if p_duration_ms<1000 or p_duration_ms>300000 or p_progress<0 then raise exception 'Scheduler heartbeat invalid' using errcode='23514'; end if;
  update public.automation_scheduler_leases set heartbeat_at=p_now,expires_at=p_now+(p_duration_ms*interval '1 millisecond'),progress=p_progress
  where partition_key=p_partition_key and owner_id=p_owner_id and generation=p_generation and expires_at>p_now and p_progress>=progress returning * into lease;
  if lease.partition_key is null then raise exception 'Scheduler lease lost' using errcode='40001'; end if;
  return lease;
end;$$;
revoke all on function public.heartbeat_automation_scheduler_lease(text,text,bigint,timestamptz,bigint,bigint) from public,anon,authenticated;
grant execute on function public.heartbeat_automation_scheduler_lease(text,text,bigint,timestamptz,bigint,bigint) to service_role;

create or replace function public.release_automation_scheduler_lease(p_partition_key text,p_owner_id text,p_generation bigint,p_now timestamptz)
returns void language plpgsql security definer set search_path=public as $$
begin
  update public.automation_scheduler_leases set expires_at=p_now,heartbeat_at=p_now where partition_key=p_partition_key and owner_id=p_owner_id and generation=p_generation;
  if not found then raise exception 'Scheduler lease lost' using errcode='40001'; end if;
end;$$;
revoke all on function public.release_automation_scheduler_lease(text,text,bigint,timestamptz) from public,anon,authenticated;
grant execute on function public.release_automation_scheduler_lease(text,text,bigint,timestamptz) to service_role;

create or replace function public.advance_automation_scheduler_checkpoint(p_partition_key text,p_owner_id text,p_lease_generation bigint,p_expected_version integer,p_watermark timestamptz,p_now timestamptz)
returns public.automation_scheduler_checkpoints language plpgsql security definer set search_path=public as $$
declare active_lease public.automation_scheduler_leases;checkpoint public.automation_scheduler_checkpoints;
begin
  select * into active_lease from public.automation_scheduler_leases where partition_key=p_partition_key and owner_id=p_owner_id and generation=p_lease_generation and expires_at>p_now for update;
  if active_lease.partition_key is null then raise exception 'Scheduler lease lost' using errcode='40001'; end if;
  if p_expected_version=0 then
    insert into public.automation_scheduler_checkpoints(partition_key,workspace_id,watermark,version,updated_at,lease_generation) values(p_partition_key,active_lease.workspace_id,p_watermark,1,p_now,p_lease_generation) on conflict do nothing returning * into checkpoint;
  else
    update public.automation_scheduler_checkpoints set watermark=p_watermark,version=version+1,updated_at=p_now,lease_generation=p_lease_generation where partition_key=p_partition_key and version=p_expected_version and watermark<=p_watermark returning * into checkpoint;
  end if;
  if checkpoint.partition_key is null then raise exception 'Scheduler checkpoint conflict' using errcode='40001'; end if;
  return checkpoint;
end;$$;
revoke all on function public.advance_automation_scheduler_checkpoint(text,text,bigint,integer,timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function public.advance_automation_scheduler_checkpoint(text,text,bigint,integer,timestamptz,timestamptz) to service_role;

commit;
