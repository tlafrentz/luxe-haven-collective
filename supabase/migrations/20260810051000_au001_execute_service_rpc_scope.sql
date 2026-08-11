-- AU-001: expose only atomic draft-plan creation to the scoped Execute identity.
begin;

create policy "Automation Execute identity reads own drafts"
on public.platform_action_plans for select to authenticated
using(
 status='draft'
 and created_by_type='automation'
 and created_by_id=auth.uid()::text
 and public.is_automation_execute_service_identity(workspace_id,property_ids)
);

create or replace function public.save_execute_action_plan(
 p_plan jsonb,p_draft_actions jsonb,p_activity_events jsonb,p_expected_version integer default null
) returns jsonb language plpgsql security definer set search_path=public as $$
declare plan_row public.platform_action_plans;is_automation_identity boolean;
begin
 plan_row:=jsonb_populate_record(null::public.platform_action_plans,p_plan);
 is_automation_identity:=public.is_automation_execute_service_identity(plan_row.workspace_id,plan_row.property_ids);
 if is_automation_identity then
  if p_expected_version is not null
   or plan_row.version<>1
   or plan_row.status<>'draft'
   or plan_row.created_by_type<>'automation'
   or plan_row.created_by_id<>auth.uid()::text
   or plan_row.owner_type<>'automation'
   or plan_row.owner_id<>auth.uid()::text
   or plan_row.scope_type not in('property','multiple-properties')
   or jsonb_array_length(coalesce(p_draft_actions,'[]'::jsonb))<>0
  then raise exception 'Automation Execute identity may create an empty draft plan only' using errcode='42501'; end if;
 else
  if not public.can_access_platform_action_workspace(plan_row.workspace_id) then raise exception 'Execute workspace access denied' using errcode='42501'; end if;
 end if;
 if p_expected_version is null then
  if plan_row.version<>1 then raise exception 'New Action Plan version must be 1' using errcode='23514'; end if;
  insert into public.platform_action_plans select plan_row.*;
 else
  if is_automation_identity then raise exception 'Automation Execute identity may not mutate a plan' using errcode='42501'; end if;
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
revoke all on function public.save_execute_action_plan(jsonb,jsonb,jsonb,integer) from public,anon;
grant execute on function public.save_execute_action_plan(jsonb,jsonb,jsonb,integer) to authenticated;

commit;
