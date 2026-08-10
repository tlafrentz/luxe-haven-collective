-- AU-001A Automation Foundation: inert, governed definitions only. No triggers, runs, scheduling, or dispatch.
begin;

create or replace function public.can_access_automation_properties(p_workspace_id uuid,p_property_ids uuid[])
returns boolean language sql stable security definer set search_path='' as $$
 select public.active_workspace_role(p_workspace_id)is not null
 and not exists(select 1 from unnest(coalesce(p_property_ids,'{}'::uuid[]))property_id where not public.can_access_workspace_property(property_id));
$$;
revoke all on function public.can_access_automation_properties(uuid,uuid[]) from public;
grant execute on function public.can_access_automation_properties(uuid,uuid[]) to authenticated,service_role;

create table public.automation_definitions(
 id text primary key,
 workspace_id uuid not null,
 status text not null check(status in('draft','ready-for-review','active','paused','retired','archived')),
 current_version integer not null check(current_version>0),
 aggregate_version integer not null check(aggregate_version>0),
 property_ids uuid[] not null default '{}',
 created_by_profile_id uuid not null references public.profiles(id) on delete restrict,
 created_at timestamptz not null,
 activated_by_profile_id uuid references public.profiles(id) on delete restrict,
 activated_at timestamptz,
 paused_by_profile_id uuid references public.profiles(id) on delete restrict,
 paused_at timestamptz,
 retired_by_profile_id uuid references public.profiles(id) on delete restrict,
 retired_at timestamptz,
 archived_by_profile_id uuid references public.profiles(id) on delete restrict,
 archived_at timestamptz,
 unique(workspace_id,id),
 unique(workspace_id,id,aggregate_version)
);

create table public.automation_definition_versions(
 id text primary key,
 automation_id text not null references public.automation_definitions(id) on delete restrict,
 workspace_id uuid not null,
 version integer not null check(version>0),
 name text not null check(btrim(name)<>''),
 description text not null check(btrim(description)<>''),
 status text not null check(status in('draft','ready-for-review','active','paused','retired','archived')),
 template_origin text,
 scope_type text not null check(scope_type in('property','selected-properties','portfolio','organization')),
 property_ids uuid[] not null default '{}',
 owner_profile_id uuid not null references public.profiles(id) on delete restrict,
 operational_steward_profile_id uuid references public.profiles(id) on delete restrict,
 trigger_specification jsonb not null,
 condition_specifications jsonb not null default '[]' check(jsonb_typeof(condition_specifications)='array'),
 exclusion_specifications jsonb not null default '[]' check(jsonb_typeof(exclusion_specifications)='array'),
 command_specification jsonb not null,
 approval_policy jsonb not null,
 execution_policy jsonb not null,
 retry_policy jsonb not null,
 notification_policy jsonb not null,
 effective_from timestamptz not null,
 valid_until timestamptz,
 schema_version text not null check(schema_version='au001-definition.v1'),
 policy_version text not null check(policy_version='au001-foundation.v1'),
 compatibility text not null check(compatibility in('compatible','incompatible','unverified')),
 created_by_profile_id uuid not null references public.profiles(id) on delete restrict,
 created_at timestamptz not null,
 reason text not null check(btrim(reason)<>''),
 unique(automation_id,version),
 unique(workspace_id,automation_id,version),
 check(valid_until is null or valid_until>effective_from),
 check((scope_type='property' and cardinality(property_ids)=1) or (scope_type='selected-properties' and cardinality(property_ids)>0) or scope_type in('portfolio','organization'))
);

create table public.automation_definition_activity(
 id text primary key,
 workspace_id uuid not null,
 automation_id text not null references public.automation_definitions(id) on delete restrict,
 definition_version integer not null check(definition_version>0),
 event_type text not null,
 actor_profile_id uuid not null references public.profiles(id) on delete restrict,
 occurred_at timestamptz not null,
 correlation_id text not null,
 causation_id text,
 safe_metadata jsonb not null default '{}'
);

create index automation_definitions_queue_idx on public.automation_definitions(workspace_id,status,created_at);
create index automation_definitions_property_idx on public.automation_definitions using gin(property_ids);
create index automation_definition_versions_history_idx on public.automation_definition_versions(workspace_id,automation_id,version desc);
create index automation_definition_activity_history_idx on public.automation_definition_activity(workspace_id,automation_id,occurred_at);

alter table public.automation_definitions enable row level security;
alter table public.automation_definition_versions enable row level security;
alter table public.automation_definition_activity enable row level security;

create policy "Members inspect authorized automation definitions" on public.automation_definitions for select to authenticated
 using(public.can_access_automation_properties(workspace_id,property_ids));
create policy "Managers create automation definitions" on public.automation_definitions for insert to authenticated
 with check(public.active_workspace_role(workspace_id)in('owner','administrator','operator') and public.can_access_automation_properties(workspace_id,property_ids));
create policy "Managers update automation definitions" on public.automation_definitions for update to authenticated
 using(public.active_workspace_role(workspace_id)in('owner','administrator','operator') and public.can_access_automation_properties(workspace_id,property_ids))
 with check(public.active_workspace_role(workspace_id)in('owner','administrator','operator') and public.can_access_automation_properties(workspace_id,property_ids));
create policy "Members inspect authorized automation versions" on public.automation_definition_versions for select to authenticated
 using(public.can_access_automation_properties(workspace_id,property_ids));
create policy "Managers append automation versions" on public.automation_definition_versions for insert to authenticated
 with check(public.active_workspace_role(workspace_id)in('owner','administrator','operator') and public.can_access_automation_properties(workspace_id,property_ids));
create policy "Members inspect authorized automation activity" on public.automation_definition_activity for select to authenticated
 using(exists(select 1 from public.automation_definitions definition where definition.id=automation_id and definition.workspace_id=automation_definition_activity.workspace_id and public.can_access_automation_properties(definition.workspace_id,definition.property_ids)));
create policy "Managers append automation activity" on public.automation_definition_activity for insert to authenticated
 with check(exists(select 1 from public.automation_definitions definition where definition.id=automation_id and definition.workspace_id=automation_definition_activity.workspace_id and public.active_workspace_role(definition.workspace_id)in('owner','administrator','operator') and public.can_access_automation_properties(definition.workspace_id,definition.property_ids)));

-- Ordinary actors may read through RLS. Writes are available only through the
-- atomic command function below so a definition cannot bypass version/activity.
grant select on public.automation_definitions,public.automation_definition_versions,public.automation_definition_activity to authenticated;
grant all on public.automation_definitions,public.automation_definition_versions,public.automation_definition_activity to service_role;

create or replace function public.prevent_automation_history_change() returns trigger language plpgsql as $$ begin raise exception 'Automation history is append-only' using errcode='42501'; end; $$;
create trigger automation_definition_versions_append_only before update or delete on public.automation_definition_versions for each row execute function public.prevent_automation_history_change();
create trigger automation_definition_activity_append_only before update or delete on public.automation_definition_activity for each row execute function public.prevent_automation_history_change();

alter table public.execute_notification_outbox drop constraint if exists execute_notification_outbox_entity_type_check;
alter table public.execute_notification_outbox add constraint execute_notification_outbox_entity_type_check check(entity_type in('plan','action','evidence','blocker','dependency','recurrence','escalation','measurement','learning-signal','pattern','lesson','recommendation-opportunity','recommendation','automation-definition'));

create or replace function public.save_automation_definition(
 p_definition jsonb,p_version jsonb,p_activity jsonb,p_notification jsonb default null,p_expected_version integer default null
) returns jsonb language plpgsql security definer set search_path=public as $$
declare definition_row public.automation_definitions;version_row public.automation_definition_versions;activity_row public.automation_definition_activity;
begin
 definition_row:=jsonb_populate_record(null::public.automation_definitions,p_definition);
 version_row:=jsonb_populate_record(null::public.automation_definition_versions,p_version);
 activity_row:=jsonb_populate_record(null::public.automation_definition_activity,p_activity);
 if not public.can_access_automation_properties(definition_row.workspace_id,definition_row.property_ids) or public.active_workspace_role(definition_row.workspace_id)not in('owner','administrator','operator') then raise exception 'Automation access denied' using errcode='42501'; end if;
 if definition_row.id<>version_row.automation_id or definition_row.workspace_id<>version_row.workspace_id or definition_row.id<>activity_row.automation_id or definition_row.workspace_id<>activity_row.workspace_id then raise exception 'Automation lineage mismatch' using errcode='23514'; end if;
 if p_expected_version is null then
  if definition_row.aggregate_version<>1 or definition_row.current_version<>1 or version_row.version<>1 then raise exception 'Initial automation version must be 1' using errcode='23514'; end if;
  insert into public.automation_definitions select definition_row.*;
 else
  if definition_row.aggregate_version<>p_expected_version+1 then raise exception 'Automation version conflict' using errcode='40001'; end if;
  perform 1 from public.automation_definitions where workspace_id=definition_row.workspace_id and id=definition_row.id and aggregate_version=p_expected_version for update;
  if not found then raise exception 'Automation version conflict' using errcode='40001'; end if;
  update public.automation_definitions set status=definition_row.status,current_version=definition_row.current_version,aggregate_version=definition_row.aggregate_version,property_ids=definition_row.property_ids,activated_by_profile_id=definition_row.activated_by_profile_id,activated_at=definition_row.activated_at,paused_by_profile_id=definition_row.paused_by_profile_id,paused_at=definition_row.paused_at,retired_by_profile_id=definition_row.retired_by_profile_id,retired_at=definition_row.retired_at,archived_by_profile_id=definition_row.archived_by_profile_id,archived_at=definition_row.archived_at where workspace_id=definition_row.workspace_id and id=definition_row.id and aggregate_version=p_expected_version;
  if not found then raise exception 'Automation version conflict' using errcode='40001'; end if;
 end if;
 insert into public.automation_definition_versions select version_row.*;
 insert into public.automation_definition_activity select activity_row.*;
 if p_notification is not null then insert into public.execute_notification_outbox(workspace_id,id,recipient_type,recipient_id,event_type,entity_type,entity_id,safe_template_variables,channel,delivery_status,idempotency_key,attempt_count,created_at) values(definition_row.workspace_id::text,p_notification->>'id','user',p_notification->>'recipient_id',p_notification->>'event_type','automation-definition',definition_row.id,coalesce(p_notification->'safe_template_variables','{}'::jsonb),'in-app','pending',p_notification->>'idempotency_key',0,(p_notification->>'created_at')::timestamptz); end if;
 return jsonb_build_object('automationId',definition_row.id,'version',definition_row.aggregate_version,'definitionVersion',definition_row.current_version,'status',definition_row.status);
end;$$;
revoke all on function public.save_automation_definition(jsonb,jsonb,jsonb,jsonb,integer) from public;
grant execute on function public.save_automation_definition(jsonb,jsonb,jsonb,jsonb,integer) to authenticated;

commit;
