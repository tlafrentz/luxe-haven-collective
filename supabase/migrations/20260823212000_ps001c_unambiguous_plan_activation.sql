-- PS-001C: remove the ambiguous Action identifier from atomic plan activation.
begin;

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
  payload_action_id text;
begin
  if not public.can_access_platform_action_workspace(p_workspace_id) then raise exception 'Execute workspace access denied' using errcode='42501'; end if;
  select * into current_plan from public.platform_action_plans where workspace_id=p_workspace_id and id=p_plan_id for update;
  if not found then raise exception 'Action plan not found' using errcode='P0002'; end if;
  if current_plan.version<>p_expected_version then raise exception 'Action plan version conflict' using errcode='40001'; end if;
  if current_plan.status<>'draft' then raise exception 'Only a draft Action Plan can be activated' using errcode='P0001'; end if;
  if jsonb_typeof(coalesce(p_action_payloads,'[]'::jsonb))<>'array' or jsonb_array_length(coalesce(p_action_payloads,'[]'::jsonb))=0 then raise exception 'Action Plan activation requires Actions' using errcode='23514'; end if;

  for action_payload in select value from jsonb_array_elements(p_action_payloads)
  loop
    action_workspace:=action_payload->'action'->>'workspace_id';
    payload_action_id:=action_payload->'action'->>'id';
    if action_workspace is distinct from p_workspace_id then raise exception 'Action payload crosses workspace scope' using errcode='42501'; end if;
    perform public.platform_action_add(action_payload);
    update public.platform_actions action
      set plan_id=p_plan_id
      where action.workspace_id=p_workspace_id and action.id=payload_action_id;
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

commit;
