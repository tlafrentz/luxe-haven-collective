-- Sprint 4D: canonical properties with workspace-owned provider references.
begin;

alter table public.integration_connections
  add column if not exists workspace_id uuid references public.owners(id) on delete cascade,
  add column if not exists account_label text,
  add column if not exists connected_at timestamptz,
  add column if not exists last_successful_sync_at timestamptz,
  add column if not exists last_attempt_at timestamptz,
  add column if not exists authorization_expires_at timestamptz;

alter table public.integration_connections
  drop constraint if exists integration_connections_status_check,
  add constraint integration_connections_status_check check (
    status in ('active','paused','error','disconnected','authorization-expired')
  );

update public.integration_connections connection
set workspace_id = resolved.workspace_id,
    account_label = coalesce(connection.account_label, connection.name),
    connected_at = coalesce(connection.connected_at, connection.created_at),
    last_successful_sync_at = coalesce(connection.last_successful_sync_at, connection.last_synced_at)
from (
  select external.connection_id, min(property.owner_id::text)::uuid workspace_id
  from public.external_properties external
  join public.properties property on property.id=external.property_id
  group by external.connection_id
  having count(distinct property.owner_id)=1
) resolved
where connection.id=resolved.connection_id and connection.workspace_id is null;

create unique index if not exists integration_connections_workspace_provider_key
on public.integration_connections(workspace_id,provider) where workspace_id is not null;
create index if not exists integration_connections_workspace_status_idx
on public.integration_connections(workspace_id,status);

alter table public.external_properties
  add column if not exists workspace_id uuid references public.owners(id) on delete cascade,
  add column if not exists link_status text,
  add column if not exists reconciliation_status text not null default 'unreviewed',
  add column if not exists last_observed_at timestamptz;

update public.external_properties external
set
  workspace_id = coalesce(
    external.workspace_id,
    resolved.connection_workspace_id,
    resolved.property_owner_id
  ),
  link_status = coalesce(
    external.link_status,
    case
      when external.property_id is not null then 'linked'
      when external.sync_status = 'error' then 'conflict'
      else 'unlinked'
    end
  ),
  last_observed_at = coalesce(
    external.last_observed_at,
    external.last_synced_at
  )
from (
  select
    source.id as external_property_id,
    connection.workspace_id as connection_workspace_id,
    property.owner_id as property_owner_id
  from public.external_properties source
  join public.integration_connections connection
    on connection.id = source.connection_id
  left join public.properties property
    on property.id = source.property_id
) resolved
where external.id = resolved.external_property_id;

alter table public.external_properties
  drop constraint if exists external_properties_link_status_check,
  add constraint external_properties_link_status_check check (
    link_status is null or link_status in ('linked','unlinked','potential-match','conflict','disconnected','unknown','rejected')
  );
create unique index if not exists external_properties_workspace_provider_external_key
on public.external_properties(workspace_id,provider,external_id) where workspace_id is not null;
create unique index if not exists external_properties_connection_property_key
on public.external_properties(connection_id,property_id) where property_id is not null and link_status='linked';
create index if not exists external_properties_workspace_link_idx
on public.external_properties(workspace_id,link_status,last_observed_at desc);

create table if not exists public.property_workspace_configuration (
  property_id uuid primary key references public.properties(id) on delete cascade,
  workspace_id uuid not null references public.owners(id) on delete cascade,
  inclusion text not null default 'included' check(inclusion in ('included','excluded','archived')),
  status_override text check(status_override is null or status_override in ('active','inactive','archived')),
  timezone_override text,
  country_override text,
  currency_override text,
  updated_by_profile_id uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  revision bigint not null default 0,
  constraint property_workspace_configuration_owner_check check (workspace_id is not null)
);
create index if not exists property_workspace_configuration_workspace_inclusion_idx
on public.property_workspace_configuration(workspace_id,inclusion);

insert into public.property_workspace_configuration(property_id,workspace_id,inclusion)
select property.id,property.owner_id,
  case when property.status='archived' then 'archived' else 'included' end
from public.properties property
join public.owners owner on owner.id=property.owner_id
where property.owner_id is not null
on conflict(property_id) do nothing;

create table if not exists public.workspace_property_system_activity (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.owners(id) on delete cascade,
  actor_profile_id uuid references public.profiles(id) on delete set null,
  property_id uuid references public.properties(id) on delete set null,
  connection_id uuid references public.integration_connections(id) on delete set null,
  action text not null,
  result text not null default 'succeeded',
  command_id text not null,
  occurred_at timestamptz not null default now()
);
create unique index if not exists workspace_property_system_activity_command_key
on public.workspace_property_system_activity(workspace_id,command_id);
create index if not exists workspace_property_system_activity_workspace_idx
on public.workspace_property_system_activity(workspace_id,occurred_at desc);

alter table public.property_workspace_configuration enable row level security;
alter table public.workspace_property_system_activity enable row level security;

create policy "Members read accessible property configuration"
on public.property_workspace_configuration for select to authenticated using (
  public.can_access_workspace_property(property_id) or public.is_admin()
);
create policy "Members read accessible property system activity"
on public.workspace_property_system_activity for select to authenticated using (
  (property_id is null and public.active_workspace_role(workspace_id) in ('owner','administrator'))
  or (property_id is not null and public.can_access_workspace_property(property_id))
  or public.is_admin()
);
grant select on public.property_workspace_configuration,public.workspace_property_system_activity to authenticated;

drop policy if exists "Admins can manage integration connections" on public.integration_connections;
create policy "Workspace members read connected systems"
on public.integration_connections for select to authenticated using (
  public.active_workspace_role(workspace_id) is not null or public.is_admin()
);
drop policy if exists "Admins can manage external properties" on public.external_properties;
create policy "Workspace members read provider property references"
on public.external_properties for select to authenticated using (
  public.active_workspace_role(workspace_id) is not null or public.is_admin()
);
drop policy if exists "Admins can manage integration sync runs" on public.integration_sync_runs;
create policy "Workspace members read synchronization history"
on public.integration_sync_runs for select to authenticated using (
  exists(select 1 from public.integration_connections connection
    where connection.id=connection_id and public.active_workspace_role(connection.workspace_id) is not null)
  or public.is_admin()
);

create or replace function public.apply_workspace_property_system_command(
  p_workspace_id uuid,p_action text,p_target_id uuid,p_payload jsonb,p_command_id text
) returns jsonb language plpgsql security definer set search_path=public as $$
declare actor_id uuid:=auth.uid(); actor_role text; property_row public.properties%rowtype;
  connection_row public.integration_connections%rowtype; external_row public.external_properties%rowtype;
begin
  actor_role:=public.active_workspace_role(p_workspace_id);
  if actor_id is null or actor_role not in ('owner','administrator') then
    raise exception 'Property and connection management requires workspace administration' using errcode='42501';
  end if;
  if exists(select 1 from public.workspace_property_system_activity
    where workspace_id=p_workspace_id and command_id=p_command_id) then
    return jsonb_build_object('ok',true,'commandId',p_command_id,'replayed',true);
  end if;
  if p_action in ('include-property','exclude-property','archive-property') then
    select * into property_row from public.properties where id=p_target_id and owner_id=p_workspace_id;
    if not found then raise exception 'Workspace property was not found' using errcode='42501'; end if;
    insert into public.property_workspace_configuration(property_id,workspace_id,inclusion,updated_by_profile_id,revision)
    values(property_row.id,p_workspace_id,
      case p_action when 'include-property' then 'included' when 'exclude-property' then 'excluded' else 'archived' end,
      actor_id,1)
    on conflict(property_id) do update set inclusion=excluded.inclusion,updated_by_profile_id=actor_id,
      updated_at=now(),revision=property_workspace_configuration.revision+1;
    insert into public.workspace_property_system_activity(workspace_id,actor_profile_id,property_id,action,command_id)
    values(p_workspace_id,actor_id,property_row.id,p_action,p_command_id);
  elsif p_action in ('confirm-link','reject-match') then
    select * into external_row from public.external_properties where id=p_target_id and workspace_id=p_workspace_id for update;
    if not found then raise exception 'Provider property reference was not found' using errcode='42501'; end if;
    if p_action='confirm-link' then
      select * into property_row from public.properties where id=(p_payload->>'propertyId')::uuid and owner_id=p_workspace_id;
      if not found then raise exception 'Canonical property was not found in this workspace' using errcode='42501'; end if;
      update public.external_properties set property_id=property_row.id,link_status='linked',sync_status='linked',
        reconciliation_status='confirmed',updated_at=now() where id=external_row.id;
    else
      update public.external_properties set link_status='rejected',reconciliation_status='rejected',updated_at=now()
      where id=external_row.id;
    end if;
    insert into public.workspace_property_system_activity(workspace_id,actor_profile_id,property_id,connection_id,action,command_id)
    values(p_workspace_id,actor_id,case when p_action='confirm-link' then property_row.id else null end,external_row.connection_id,p_action,p_command_id);
  elsif p_action in ('disconnect','reconnect') then
    select * into connection_row from public.integration_connections where id=p_target_id and workspace_id=p_workspace_id for update;
    if not found then raise exception 'Connected system was not found' using errcode='42501'; end if;
    update public.integration_connections set status=case when p_action='disconnect' then 'paused' else 'active' end,
      updated_at=now() where id=connection_row.id;
    update public.external_properties set link_status=case when p_action='disconnect' then 'disconnected'
      when property_id is not null then 'linked' else 'unlinked' end,updated_at=now()
      where connection_id=connection_row.id;
    insert into public.workspace_property_system_activity(workspace_id,actor_profile_id,connection_id,action,command_id)
    values(p_workspace_id,actor_id,connection_row.id,p_action,p_command_id);
  else raise exception 'Unsupported property or system command' using errcode='22023';
  end if;
  return jsonb_build_object('ok',true,'commandId',p_command_id);
end $$;
revoke all on function public.apply_workspace_property_system_command(uuid,text,uuid,jsonb,text) from public;
grant execute on function public.apply_workspace_property_system_command(uuid,text,uuid,jsonb,text) to authenticated;

do $$ begin
  if exists(select 1 from public.properties property left join public.owners owner on owner.id=property.owner_id
    where property.status='active' and owner.id is null) then
    raise exception 'Active property exists without a valid workspace owner';
  end if;
  if exists(select 1 from public.external_properties external join public.properties property on property.id=external.property_id
    where external.workspace_id is distinct from property.owner_id) then
    raise exception 'Provider property reference crosses workspace ownership';
  end if;
end $$;
commit;
