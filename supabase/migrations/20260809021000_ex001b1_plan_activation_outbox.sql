-- EX-001B1: atomic Action Plan activation and provider-neutral notification outbox.
begin;

create table public.platform_action_plan_draft_actions(
  workspace_id text not null,
  plan_id text not null,
  id text not null,
  position integer not null check(position>=0),
  title text not null check(btrim(title)<>''),
  description text,
  action_type text,
  category text,
  priority text,
  property_id uuid references public.properties(id) on delete restrict,
  owner_type text,
  owner_id text,
  start_at timestamptz,
  due_at timestamptz,
  completion_criteria jsonb not null default '[]',
  evidence_policy jsonb not null default '{}',
  expected_outcome text,
  success_metric text,
  dependencies jsonb not null default '[]',
  measurement_requirement jsonb,
  primary key(workspace_id,plan_id,id),
  unique(workspace_id,plan_id,position),
  foreign key(workspace_id,plan_id) references public.platform_action_plans(workspace_id,id) on delete restrict,
  check(due_at is null or start_at is null or due_at>=start_at)
);
alter table public.platform_action_plan_draft_actions enable row level security;
create policy "Members read authorized Draft Actions" on public.platform_action_plan_draft_actions for select to authenticated using(exists(select 1 from public.platform_action_plans plan where plan.workspace_id=platform_action_plan_draft_actions.workspace_id and plan.id=platform_action_plan_draft_actions.plan_id));
create policy "Members create authorized Draft Actions" on public.platform_action_plan_draft_actions for insert to authenticated with check(exists(select 1 from public.platform_action_plans plan where plan.workspace_id=platform_action_plan_draft_actions.workspace_id and plan.id=platform_action_plan_draft_actions.plan_id and plan.status='draft') and (property_id is null or public.can_access_workspace_property(property_id)));
create policy "Members remove authorized Draft Actions" on public.platform_action_plan_draft_actions for delete to authenticated using(exists(select 1 from public.platform_action_plans plan where plan.workspace_id=platform_action_plan_draft_actions.workspace_id and plan.id=platform_action_plan_draft_actions.plan_id and plan.status='draft'));
grant select,insert,delete on public.platform_action_plan_draft_actions to authenticated;
grant all on public.platform_action_plan_draft_actions to service_role;

create table public.execute_notification_outbox (
  workspace_id text not null,
  id text not null,
  recipient_type text not null,
  recipient_id text not null,
  event_type text not null,
  entity_type text not null check (entity_type in ('plan','action','evidence','blocker','recurrence','escalation')),
  entity_id text not null,
  safe_template_variables jsonb not null default '{}',
  channel text not null check (channel in ('in-app','email','sms','slack','teams')),
  delivery_status text not null default 'pending' check (delivery_status in ('pending','processing','delivered','failed','suppressed')),
  idempotency_key text not null,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  last_failure_classification text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  failed_at timestamptz,
  next_attempt_at timestamptz,
  primary key (workspace_id,id),
  unique (workspace_id,idempotency_key)
);
create index execute_notification_outbox_delivery_idx on public.execute_notification_outbox(delivery_status,next_attempt_at,created_at) where delivery_status in ('pending','failed');
alter table public.execute_notification_outbox enable row level security;
create policy "Members read own Execute notification intents" on public.execute_notification_outbox for select to authenticated
using (public.can_access_platform_action_workspace(workspace_id) and recipient_type='user' and recipient_id=auth.uid()::text);
create policy "Members create authorized Execute notification intents" on public.execute_notification_outbox for insert to authenticated
with check (public.can_access_platform_action_workspace(workspace_id));
create policy "Members append authorized Execute activity" on public.platform_action_activity for insert to authenticated
with check (public.can_access_platform_action_workspace(workspace_id));
grant select,insert on public.execute_notification_outbox to authenticated;
grant insert on public.platform_action_activity to authenticated;
grant all on public.execute_notification_outbox to service_role;

create or replace function public.save_execute_action_plan(
  p_plan jsonb,p_draft_actions jsonb,p_activity_events jsonb,p_expected_version integer default null
) returns jsonb language plpgsql security invoker set search_path=public as $$
declare plan_row public.platform_action_plans;
begin
  plan_row:=jsonb_populate_record(null::public.platform_action_plans,p_plan);
  if not public.can_access_platform_action_workspace(plan_row.workspace_id) then raise exception 'Execute workspace access denied' using errcode='42501'; end if;
  if p_expected_version is null then
    if plan_row.version<>1 then raise exception 'New Action Plan version must be 1' using errcode='23514'; end if;
    insert into public.platform_action_plans select plan_row.*;
  else
    if plan_row.version<>p_expected_version+1 then raise exception 'Action Plan version must increment once' using errcode='40001'; end if;
    perform 1 from public.platform_action_plans where workspace_id=plan_row.workspace_id and id=plan_row.id and version=p_expected_version for update;
    if not found then raise exception 'Action plan version conflict' using errcode='40001'; end if;
    update public.platform_action_plans set title=plan_row.title,description=plan_row.description,owner_type=plan_row.owner_type,owner_id=plan_row.owner_id,status=plan_row.status,priority=plan_row.priority,start_at=plan_row.start_at,target_completion_at=plan_row.target_completion_at,expected_outcome=plan_row.expected_outcome,success_metrics=plan_row.success_metrics,activated_by_id=plan_row.activated_by_id,activated_at=plan_row.activated_at,completed_at=plan_row.completed_at,cancelled_at=plan_row.cancelled_at,updated_at=plan_row.updated_at,version=plan_row.version where workspace_id=plan_row.workspace_id and id=plan_row.id and version=p_expected_version;
    if not found then raise exception 'Action plan version conflict' using errcode='40001'; end if;
    if plan_row.status='draft' then delete from public.platform_action_plan_draft_actions where workspace_id=plan_row.workspace_id and plan_id=plan_row.id; end if;
  end if;
  if plan_row.status='draft' then insert into public.platform_action_plan_draft_actions select * from jsonb_populate_recordset(null::public.platform_action_plan_draft_actions,coalesce(p_draft_actions,'[]'::jsonb)); end if;
  insert into public.platform_action_activity(workspace_id,id,entity_type,entity_id,action_id,event_type,actor_type,actor_id,occurred_at,metadata,correlation_id,causation_id) select workspace_id,id,entity_type,entity_id,action_id,event_type,actor_type,actor_id,occurred_at,metadata,correlation_id,causation_id from jsonb_populate_recordset(null::public.platform_action_activity,coalesce(p_activity_events,'[]'::jsonb));
  return jsonb_build_object('planId',plan_row.id,'version',plan_row.version,'status',plan_row.status);
end;$$;
grant execute on function public.save_execute_action_plan(jsonb,jsonb,jsonb,integer) to authenticated;

create or replace function public.activate_execute_action_plan(
  p_workspace_id text,
  p_plan_id text,
  p_expected_version integer,
  p_activated_at timestamptz,
  p_actor_id text,
  p_action_payloads jsonb,
  p_activity_events jsonb,
  p_notification_intents jsonb
) returns jsonb
language plpgsql
security invoker
set search_path=public
as $$
declare
  current_plan public.platform_action_plans;
  action_payload jsonb;
  action_workspace text;
  action_id text;
begin
  if not public.can_access_platform_action_workspace(p_workspace_id) then raise exception 'Execute workspace access denied' using errcode='42501'; end if;
  select * into current_plan from public.platform_action_plans where workspace_id=p_workspace_id and id=p_plan_id for update;
  if not found then raise exception 'Action plan not found' using errcode='P0002'; end if;
  if current_plan.version<>p_expected_version then raise exception 'Action plan version conflict' using errcode='40001'; end if;
  if current_plan.status<>'draft' then raise exception 'Only a draft Action Plan can be activated' using errcode='P0001'; end if;
  if jsonb_typeof(coalesce(p_action_payloads,'[]'::jsonb))<>'array' or jsonb_array_length(coalesce(p_action_payloads,'[]'::jsonb))=0 then raise exception 'Action Plan activation requires Actions' using errcode='23514'; end if;

  for action_payload in select value from jsonb_array_elements(p_action_payloads)
  loop
    action_workspace:=action_payload->'action'->>'workspace_id'; action_id:=action_payload->'action'->>'id';
    if action_workspace is distinct from p_workspace_id then raise exception 'Action payload crosses workspace scope' using errcode='42501'; end if;
    perform public.platform_action_add(action_payload);
    update public.platform_actions set plan_id=p_plan_id where workspace_id=p_workspace_id and id=action_id;
  end loop;

  update public.platform_action_plans set status='active',activated_by_id=p_actor_id,activated_at=p_activated_at,updated_at=p_activated_at,version=p_expected_version+1 where workspace_id=p_workspace_id and id=p_plan_id and version=p_expected_version;
  if not found then raise exception 'Action plan version conflict' using errcode='40001'; end if;

  insert into public.platform_action_activity(workspace_id,id,entity_type,entity_id,action_id,event_type,actor_type,actor_id,occurred_at,metadata,correlation_id,causation_id)
  select workspace_id,id,entity_type,entity_id,action_id,event_type,actor_type,actor_id,occurred_at,metadata,correlation_id,causation_id
  from jsonb_populate_recordset(null::public.platform_action_activity,coalesce(p_activity_events,'[]'::jsonb));
  insert into public.execute_notification_outbox(workspace_id,id,recipient_type,recipient_id,event_type,entity_type,entity_id,safe_template_variables,channel,delivery_status,idempotency_key,attempt_count,created_at)
  select workspace_id,id,recipient_type,recipient_id,event_type,entity_type,entity_id,safe_template_variables,channel,delivery_status,idempotency_key,attempt_count,created_at
  from jsonb_populate_recordset(null::public.execute_notification_outbox,coalesce(p_notification_intents,'[]'::jsonb));
  return jsonb_build_object('planId',p_plan_id,'version',p_expected_version+1,'status','active','actionCount',jsonb_array_length(p_action_payloads));
end;
$$;

grant execute on function public.activate_execute_action_plan(text,text,integer,timestamptz,text,jsonb,jsonb,jsonb) to authenticated;

create or replace function public.claim_execute_notification_outbox(
  p_limit integer default 25
) returns setof public.execute_notification_outbox
language plpgsql
security definer
set search_path=public
as $$
begin
  if p_limit < 1 or p_limit > 100 then
    raise exception 'Notification claim limit must be between 1 and 100' using errcode='22023';
  end if;

  return query
  with candidates as (
    select workspace_id,id
    from public.execute_notification_outbox
    where delivery_status in ('pending','failed')
      and (next_attempt_at is null or next_attempt_at<=now())
    order by created_at,id
    for update skip locked
    limit p_limit
  )
  update public.execute_notification_outbox intent
  set delivery_status='processing',
      attempt_count=intent.attempt_count+1,
      last_failure_classification=null,
      failed_at=null
  from candidates
  where intent.workspace_id=candidates.workspace_id and intent.id=candidates.id
  returning intent.*;
end;
$$;

create or replace function public.complete_execute_notification_delivery(
  p_workspace_id text,
  p_id text,
  p_delivered boolean,
  p_failure_classification text default null,
  p_next_attempt_at timestamptz default null
) returns public.execute_notification_outbox
language plpgsql
security definer
set search_path=public
as $$
declare result public.execute_notification_outbox;
begin
  if not p_delivered and nullif(btrim(p_failure_classification),'') is null then
    raise exception 'A recoverable failure classification is required' using errcode='22023';
  end if;

  update public.execute_notification_outbox
  set delivery_status=case when p_delivered then 'delivered' else 'failed' end,
      sent_at=case when p_delivered then now() else null end,
      failed_at=case when p_delivered then null else now() end,
      last_failure_classification=case when p_delivered then null else p_failure_classification end,
      next_attempt_at=case when p_delivered then null else p_next_attempt_at end
  where workspace_id=p_workspace_id and id=p_id and delivery_status='processing'
  returning * into result;

  if not found then
    raise exception 'Notification intent is not currently claimed' using errcode='P0001';
  end if;
  return result;
end;
$$;

revoke all on function public.claim_execute_notification_outbox(integer) from public,anon,authenticated;
revoke all on function public.complete_execute_notification_delivery(text,text,boolean,text,timestamptz) from public,anon,authenticated;
grant execute on function public.claim_execute_notification_outbox(integer) to service_role;
grant execute on function public.complete_execute_notification_delivery(text,text,boolean,text,timestamptz) to service_role;

commit;
