\set ON_ERROR_STOP on

-- Targeted PostgreSQL verification for AU-001A. The repository's historical
-- migration chain currently lacks the migration that creates public.owners,
-- so this harness supplies only the canonical contracts AU-001A consumes.
create schema if not exists auth;
do $$ begin
  if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role nologin; end if;
end $$;
grant usage on schema public, auth to anon, authenticated, service_role;

create function auth.uid() returns uuid
language sql stable
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create function auth.role() returns text
language sql stable
as $$ select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), current_user) $$;
grant execute on function auth.uid(), auth.role() to anon, authenticated, service_role;

create table public.profiles(id uuid primary key);
create table public.test_workspace_memberships(
  workspace_id uuid not null,
  profile_id uuid not null references public.profiles(id),
  role text not null,
  property_ids uuid[] not null default '{}',
  primary key(workspace_id, profile_id)
);
create table public.properties(id uuid primary key, workspace_id uuid not null);

create function public.active_workspace_role(p_workspace_id uuid) returns text
language sql stable security definer set search_path=''
as $$
  select membership.role
  from public.test_workspace_memberships membership
  where membership.workspace_id=p_workspace_id
    and membership.profile_id=auth.uid()
$$;
create function public.can_access_workspace_property(p_property_id uuid) returns boolean
language sql stable security definer set search_path=''
as $$
  select exists(
    select 1
    from public.properties property
    join public.test_workspace_memberships membership
      on membership.workspace_id=property.workspace_id
    where property.id=p_property_id
      and membership.profile_id=auth.uid()
      and (
        membership.role in ('owner','administrator')
        or p_property_id=any(membership.property_ids)
      )
  )
$$;
grant execute on function public.active_workspace_role(uuid), public.can_access_workspace_property(uuid)
  to authenticated, service_role;

create table public.execute_notification_outbox(
  workspace_id text not null,
  id text not null,
  recipient_type text not null,
  recipient_id text not null,
  event_type text not null,
  entity_type text not null check(entity_type in('plan','action','evidence','blocker','recurrence','escalation','measurement','learning-signal','pattern','lesson','recommendation-opportunity','recommendation')),
  entity_id text not null,
  safe_template_variables jsonb not null default '{}',
  channel text not null,
  delivery_status text not null,
  idempotency_key text not null,
  attempt_count integer not null default 0,
  created_at timestamptz not null,
  primary key(workspace_id,id),
  unique(workspace_id,idempotency_key)
);
alter table public.execute_notification_outbox enable row level security;
create policy "Members read own test notification intents"
on public.execute_notification_outbox for select to authenticated
using(
  public.active_workspace_role(workspace_id::uuid) is not null
  and recipient_type='user'
  and recipient_id=auth.uid()::text
);
grant select on public.execute_notification_outbox to authenticated;

\ir ../migrations/20260810010000_au001a_automation_foundation.sql

insert into public.profiles(id) values
  ('10000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000002'),
  ('10000000-0000-0000-0000-000000000003'),
  ('10000000-0000-0000-0000-000000000004');
insert into public.properties(id,workspace_id) values
  ('30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001'),
  ('30000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001'),
  ('30000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000002');
insert into public.test_workspace_memberships(workspace_id,profile_id,role,property_ids) values
  ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','owner','{}'),
  ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002','administrator','{}'),
  ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000003','operator','{30000000-0000-0000-0000-000000000002}'),
  ('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000004','owner','{}');

set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',false);
select public.save_automation_definition(
  jsonb_build_object(
    'id','automation-1','workspace_id','20000000-0000-0000-0000-000000000001','status','draft',
    'current_version',1,'aggregate_version',1,'property_ids',jsonb_build_array('30000000-0000-0000-0000-000000000001'),
    'created_by_profile_id','10000000-0000-0000-0000-000000000001','created_at','2026-08-10T12:00:00Z'
  ),
  jsonb_build_object(
    'id','automation-version-1','automation_id','automation-1','workspace_id','20000000-0000-0000-0000-000000000001',
    'version',1,'name','Arrival readiness','description','Prepare the property for arrival.','status','draft',
    'scope_type','property','property_ids',jsonb_build_array('30000000-0000-0000-0000-000000000001'),
    'owner_profile_id','10000000-0000-0000-0000-000000000001','trigger_specification','{}'::jsonb,
    'condition_specifications','[]'::jsonb,'exclusion_specifications','[]'::jsonb,'command_specification','{}'::jsonb,
    'approval_policy','{}'::jsonb,'execution_policy','{}'::jsonb,'retry_policy','{}'::jsonb,'notification_policy','{}'::jsonb,
    'effective_from','2026-08-10T12:00:00Z','schema_version','au001-definition.v1','policy_version','au001-foundation.v1',
    'compatibility','compatible','created_by_profile_id','10000000-0000-0000-0000-000000000001',
    'created_at','2026-08-10T12:00:00Z','reason','Initial definition'
  ),
  jsonb_build_object(
    'id','automation-activity-1','workspace_id','20000000-0000-0000-0000-000000000001','automation_id','automation-1',
    'definition_version',1,'event_type','created','actor_profile_id','10000000-0000-0000-0000-000000000001',
    'occurred_at','2026-08-10T12:00:00Z','correlation_id','correlation-1','safe_metadata','{}'::jsonb
  ),
  jsonb_build_object(
    'id','automation-notification-1','recipient_id','10000000-0000-0000-0000-000000000001','event_type','automation.created',
    'safe_template_variables','{}'::jsonb,'idempotency_key','automation-1:created:1','created_at','2026-08-10T12:00:00Z'
  ),
  null
);

do $$ begin
  if (select count(*) from public.automation_definitions)<>1 then raise exception 'owner cannot read automation'; end if;
  if (select count(*) from public.automation_definition_versions)<>1 then raise exception 'version was not persisted'; end if;
  if (select count(*) from public.automation_definition_activity)<>1 then raise exception 'activity was not persisted'; end if;
  if (select count(*) from public.execute_notification_outbox)<>1 then raise exception 'notification intent was not persisted'; end if;
end $$;

-- Same-workspace administrator can inspect authorized records.
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',false);
do $$ begin
  if (select count(*) from public.automation_definitions)<>1 then raise exception 'administrator cannot read automation'; end if;
end $$;

-- A property-limited operator cannot inspect or create against another property.
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000003',false);
do $$ begin
  if (select count(*) from public.automation_definitions)<>0 then raise exception 'restricted property leaked'; end if;
  begin
    perform public.save_automation_definition(
      jsonb_build_object('id','forbidden','workspace_id','20000000-0000-0000-0000-000000000001','status','draft','current_version',1,'aggregate_version',1,'property_ids',jsonb_build_array('30000000-0000-0000-0000-000000000001'),'created_by_profile_id','10000000-0000-0000-0000-000000000003','created_at','2026-08-10T12:00:00Z'),
      '{}'::jsonb,'{}'::jsonb,null,null
    );
    raise exception 'restricted property write unexpectedly succeeded';
  exception when insufficient_privilege then null; end;
end $$;

-- Another workspace owner cannot see or mutate the automation.
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000004',false);
do $$ begin
  if (select count(*) from public.automation_definitions)<>0 then raise exception 'cross-tenant automation leaked'; end if;
  begin
    perform public.save_automation_definition(
      jsonb_build_object('id','automation-1','workspace_id','20000000-0000-0000-0000-000000000001','status','draft','current_version',2,'aggregate_version',2,'property_ids',jsonb_build_array('30000000-0000-0000-0000-000000000001'),'created_by_profile_id','10000000-0000-0000-0000-000000000001','created_at','2026-08-10T12:00:00Z'),
      '{}'::jsonb,'{}'::jsonb,null,1
    );
    raise exception 'cross-tenant write unexpectedly succeeded';
  exception when insufficient_privilege then null; end;
end $$;

-- Anonymous actors receive no table access.
reset role;
set role anon;
do $$ begin
  begin perform count(*) from public.automation_definitions; raise exception 'anonymous read unexpectedly succeeded';
  exception when insufficient_privilege then null; end;
end $$;

-- History is immutable even for the service role, and stale updates append nothing.
reset role;
set role service_role;
do $$ begin
  begin update public.automation_definition_versions set reason='tampered' where id='automation-version-1'; raise exception 'history update unexpectedly succeeded';
  exception when insufficient_privilege then null; end;
end $$;

reset role;
set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',false);
do $$ declare before_versions integer; before_events integer; begin
  select count(*) into before_versions from public.automation_definition_versions;
  select count(*) into before_events from public.automation_definition_activity;
  begin
    perform public.save_automation_definition(
      jsonb_build_object('id','automation-1','workspace_id','20000000-0000-0000-0000-000000000001','status','draft','current_version',3,'aggregate_version',3,'property_ids',jsonb_build_array('30000000-0000-0000-0000-000000000001'),'created_by_profile_id','10000000-0000-0000-0000-000000000001','created_at','2026-08-10T12:00:00Z'),
      '{}'::jsonb,'{}'::jsonb,null,2
    );
    raise exception 'stale update unexpectedly succeeded';
  exception when serialization_failure then null; end;
  if (select count(*) from public.automation_definition_versions)<>before_versions then raise exception 'stale update appended version'; end if;
  if (select count(*) from public.automation_definition_activity)<>before_events then raise exception 'stale update appended activity'; end if;
end $$;

reset role;
select 'AU-001A PostgreSQL and RLS verification passed' as result;
