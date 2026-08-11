-- AU-001 production runtime: least-privilege Execute command identity.
begin;

create table public.automation_execute_service_grants(
 workspace_id uuid not null references public.owners(id) on delete restrict,
 profile_id uuid not null references public.profiles(id) on delete restrict,
 property_ids uuid[] not null check(cardinality(property_ids)>0),
 command_type text not null check(command_type='createDraftPlan'),
 active boolean not null default true,
 created_by_profile_id uuid not null references public.profiles(id) on delete restrict,
 created_at timestamptz not null default now(),
 revoked_by_profile_id uuid references public.profiles(id) on delete restrict,
 revoked_at timestamptz,
 primary key(workspace_id,profile_id,command_type),
 check((active and revoked_at is null and revoked_by_profile_id is null) or (not active and revoked_at is not null and revoked_by_profile_id is not null))
);

alter table public.automation_execute_service_grants enable row level security;
grant all on public.automation_execute_service_grants to service_role;

create or replace function public.is_automation_execute_service_identity(p_workspace_id text,p_property_ids uuid[] default '{}')
returns boolean language sql stable security definer set search_path='' as $$
 select exists(
  select 1 from public.automation_execute_service_grants grant_row
  where grant_row.workspace_id::text=p_workspace_id
   and grant_row.profile_id=auth.uid()
   and grant_row.command_type='createDraftPlan'
   and grant_row.active
   and not exists(
    select 1 from unnest(coalesce(p_property_ids,'{}'::uuid[])) property_id
    where not property_id=any(grant_row.property_ids)
   )
 );
$$;
revoke all on function public.is_automation_execute_service_identity(text,uuid[]) from public,anon;
grant execute on function public.is_automation_execute_service_identity(text,uuid[]) to authenticated,service_role;

create or replace function public.enforce_automation_execute_draft_only()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if public.is_automation_execute_service_identity(coalesce(new.workspace_id,old.workspace_id),coalesce(new.property_ids,old.property_ids,'{}'::uuid[])) then
  if tg_op<>'INSERT' then
   raise exception 'Automation Execute identity may not mutate an existing plan' using errcode='42501';
  end if;
  if new.status<>'draft' or new.created_by_type<>'automation' or new.created_by_id<>auth.uid()::text then
   raise exception 'Automation Execute identity may create draft plans only' using errcode='42501';
  end if;
 end if;
 return case when tg_op='DELETE' then old else new end;
end;
$$;

create trigger automation_execute_draft_only
before insert or update or delete on public.platform_action_plans
for each row execute function public.enforce_automation_execute_draft_only();

create or replace function public.prevent_automation_execute_action_creation()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if public.is_automation_execute_service_identity(new.workspace_id,array[new.property_id]::uuid[]) then
  raise exception 'Automation Execute identity may not create assigned Actions' using errcode='42501';
 end if;
 return new;
end;
$$;

create trigger automation_execute_no_actions
before insert on public.platform_actions
for each row execute function public.prevent_automation_execute_action_creation();

commit;
