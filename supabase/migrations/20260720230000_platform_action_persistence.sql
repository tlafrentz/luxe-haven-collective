-- PF-009 Batch 3: canonical Platform Action persistence.

create table public.platform_action_workspace_members (
  workspace_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table public.platform_actions (
  workspace_id text not null,
  id text not null,
  title text not null check (btrim(title) <> ''),
  description text,
  action_type text,
  status text not null check (status in ('draft', 'committed', 'ready', 'in-progress', 'blocked', 'completed', 'cancelled', 'archived')),
  priority text not null check (priority in ('critical', 'high', 'normal', 'low', 'deferred')),
  owner_type text not null check (owner_type in ('user', 'team', 'system', 'automation', 'unknown')),
  owner_id text,
  schedule_created timestamptz not null,
  schedule_scheduled timestamptz,
  schedule_start_after timestamptz,
  schedule_due timestamptz,
  schedule_completed timestamptz,
  created_at timestamptz not null,
  created_by_type text not null check (created_by_type in ('user', 'team', 'system', 'automation', 'unknown')),
  created_by_id text,
  updated_at timestamptz not null,
  version integer not null check (version > 0),
  primary key (workspace_id, id),
  constraint platform_actions_schedule_order check (schedule_due is null or schedule_start_after is null or schedule_due >= schedule_start_after),
  constraint platform_actions_completion_state check (schedule_completed is null or status in ('completed', 'archived'))
);

create table public.platform_action_assignments (
  workspace_id text not null,
  action_id text not null,
  id text not null,
  assignee_type text not null check (assignee_type in ('user', 'team', 'system', 'automation', 'unknown')),
  assignee_id text,
  queue text,
  status text not null check (status in ('assigned', 'queued', 'claimed', 'released')),
  assigned_at timestamptz not null,
  assigned_by_type text not null check (assigned_by_type in ('user', 'team', 'system', 'automation', 'unknown')),
  assigned_by_id text,
  claimed_at timestamptz,
  released_at timestamptz,
  primary key (workspace_id, action_id, id),
  foreign key (workspace_id, action_id) references public.platform_actions(workspace_id, id) on delete restrict,
  constraint platform_action_assignment_queue check (status <> 'queued' or nullif(btrim(queue), '') is not null)
);

create unique index platform_action_one_active_assignment_idx
on public.platform_action_assignments (workspace_id, action_id)
where status <> 'released';

create table public.platform_action_sources (
  workspace_id text not null,
  action_id text not null,
  source_type text not null check (source_type in ('recommendation', 'decision', 'manual', 'automation', 'import', 'api')),
  source_id text,
  capability text,
  external_system text,
  recorded_at timestamptz not null,
  recorded_by_type text not null check (recorded_by_type in ('user', 'team', 'system', 'automation', 'unknown')),
  recorded_by_id text,
  foreign key (workspace_id, action_id) references public.platform_actions(workspace_id, id) on delete restrict,
  constraint platform_action_upstream_source_id check (source_type not in ('recommendation', 'decision') or nullif(btrim(source_id), '') is not null)
);

create unique index platform_action_source_identity_idx
on public.platform_action_sources (workspace_id, action_id, source_type, coalesce(source_id, ''), coalesce(capability, ''), coalesce(external_system, ''));

create table public.platform_action_history (
  workspace_id text not null,
  action_id text not null,
  id text not null,
  version integer not null check (version > 0),
  operation text not null check (operation in ('created', 'committed', 'owner-changed', 'priority-changed', 'assigned', 'assignment-released', 'claimed', 'scheduled', 'marked-ready', 'started', 'blocked', 'unblocked', 'completed', 'cancelled', 'archived', 'outcome-linked')),
  previous_status text check (previous_status is null or previous_status in ('draft', 'committed', 'ready', 'in-progress', 'blocked', 'completed', 'cancelled', 'archived')),
  resulting_status text check (resulting_status is null or resulting_status in ('draft', 'committed', 'ready', 'in-progress', 'blocked', 'completed', 'cancelled', 'archived')),
  occurred_at timestamptz not null,
  actor_type text not null check (actor_type in ('user', 'team', 'system', 'automation', 'unknown')),
  actor_id text,
  reason text,
  command_id text,
  external_event_id text,
  primary key (workspace_id, action_id, id),
  unique (workspace_id, action_id, version),
  foreign key (workspace_id, action_id) references public.platform_actions(workspace_id, id) on delete restrict
);

create table public.platform_action_outcome_references (
  workspace_id text not null,
  action_id text not null,
  outcome_id text not null,
  link_type text not null check (link_type in ('result', 'impact', 'related')),
  linked_at timestamptz not null,
  linked_by_type text not null check (linked_by_type in ('user', 'team', 'system', 'automation', 'unknown')),
  linked_by_id text,
  primary key (workspace_id, action_id, outcome_id),
  foreign key (workspace_id, action_id) references public.platform_actions(workspace_id, id) on delete restrict
);

create index platform_actions_workspace_status_idx on public.platform_actions (workspace_id, status);
create index platform_actions_workspace_owner_idx on public.platform_actions (workspace_id, owner_type, owner_id);
create index platform_actions_workspace_due_idx on public.platform_actions (workspace_id, schedule_due) where schedule_due is not null;
create index platform_action_assignments_assignee_idx on public.platform_action_assignments (workspace_id, assignee_type, assignee_id) where status <> 'released';
create index platform_action_sources_lookup_idx on public.platform_action_sources (workspace_id, source_type, source_id);
create index platform_action_history_order_idx on public.platform_action_history (workspace_id, action_id, version);

create or replace function public.can_access_platform_action_workspace(requested_workspace_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.platform_action_workspace_members membership
    where membership.workspace_id = requested_workspace_id and membership.user_id = auth.uid()
  ) or exists (
    select 1 from public.profiles profile where profile.id = auth.uid() and profile.role = 'admin'
  );
$$;

revoke all on function public.can_access_platform_action_workspace(text) from public;
grant execute on function public.can_access_platform_action_workspace(text) to authenticated;

alter table public.platform_action_workspace_members enable row level security;
alter table public.platform_actions enable row level security;
alter table public.platform_action_assignments enable row level security;
alter table public.platform_action_sources enable row level security;
alter table public.platform_action_history enable row level security;
alter table public.platform_action_outcome_references enable row level security;

create policy "Users can view own Platform Action workspace membership" on public.platform_action_workspace_members for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "Admins can manage Platform Action workspace membership" on public.platform_action_workspace_members for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "Members can manage Platform Actions" on public.platform_actions for all to authenticated using (public.can_access_platform_action_workspace(workspace_id)) with check (public.can_access_platform_action_workspace(workspace_id));
create policy "Members can manage Platform Action assignments" on public.platform_action_assignments for all to authenticated using (public.can_access_platform_action_workspace(workspace_id)) with check (public.can_access_platform_action_workspace(workspace_id));
create policy "Members can manage Platform Action sources" on public.platform_action_sources for all to authenticated using (public.can_access_platform_action_workspace(workspace_id)) with check (public.can_access_platform_action_workspace(workspace_id));
create policy "Members can manage Platform Action history" on public.platform_action_history for all to authenticated using (public.can_access_platform_action_workspace(workspace_id)) with check (public.can_access_platform_action_workspace(workspace_id));
create policy "Members can manage Platform Action Outcome references" on public.platform_action_outcome_references for all to authenticated using (public.can_access_platform_action_workspace(workspace_id)) with check (public.can_access_platform_action_workspace(workspace_id));

grant select, insert, update on public.platform_actions, public.platform_action_assignments to authenticated;
grant select, insert on public.platform_action_sources, public.platform_action_history, public.platform_action_outcome_references to authenticated;
grant select on public.platform_action_workspace_members to authenticated;

create or replace function public.prevent_platform_action_append_only_change()
returns trigger language plpgsql as $$ begin raise exception 'Platform Action append-only records cannot be changed' using errcode = 'P0001'; end; $$;
create trigger platform_action_sources_append_only before update or delete on public.platform_action_sources for each row execute function public.prevent_platform_action_append_only_change();
create trigger platform_action_history_append_only before update or delete on public.platform_action_history for each row execute function public.prevent_platform_action_append_only_change();
create trigger platform_action_outcomes_append_only before update or delete on public.platform_action_outcome_references for each row execute function public.prevent_platform_action_append_only_change();

create or replace function public.platform_action_payload(p_workspace_id text, p_action_id text)
returns jsonb language sql stable security invoker set search_path = public as $$
  select jsonb_build_object(
    'action', to_jsonb(action_row),
    'assignments', coalesce((select jsonb_agg(to_jsonb(item) order by item.assigned_at) from public.platform_action_assignments item where item.workspace_id = p_workspace_id and item.action_id = p_action_id), '[]'::jsonb),
    'sources', coalesce((select jsonb_agg(to_jsonb(item) order by item.recorded_at) from public.platform_action_sources item where item.workspace_id = p_workspace_id and item.action_id = p_action_id), '[]'::jsonb),
    'history', coalesce((select jsonb_agg(to_jsonb(item) order by item.version) from public.platform_action_history item where item.workspace_id = p_workspace_id and item.action_id = p_action_id), '[]'::jsonb),
    'outcomeReferences', coalesce((select jsonb_agg(to_jsonb(item) order by item.linked_at) from public.platform_action_outcome_references item where item.workspace_id = p_workspace_id and item.action_id = p_action_id), '[]'::jsonb)
  ) from public.platform_actions action_row where action_row.workspace_id = p_workspace_id and action_row.id = p_action_id;
$$;

create or replace function public.platform_action_find_by_id(p_workspace_id text, p_action_id text)
returns jsonb language sql stable security invoker set search_path = public as $$ select public.platform_action_payload(p_workspace_id, p_action_id); $$;

create or replace function public.platform_action_find(p_workspace_id text, p_query jsonb default '{}'::jsonb)
returns setof jsonb language sql stable security invoker set search_path = public as $$
  select public.platform_action_payload(action_row.workspace_id, action_row.id)
  from public.platform_actions action_row
  where action_row.workspace_id = p_workspace_id
    and (not (p_query ? 'statuses') or action_row.status in (select jsonb_array_elements_text(p_query->'statuses')))
    and (not (p_query ? 'ownerType') or action_row.owner_type = p_query->>'ownerType')
    and (not (p_query ? 'ownerId') or action_row.owner_id = p_query->>'ownerId')
    and (not (p_query ? 'dueBefore') or action_row.schedule_due < (p_query->>'dueBefore')::timestamptz)
    and (not (p_query ? 'assigneeType') or exists (select 1 from public.platform_action_assignments assignment where assignment.workspace_id = action_row.workspace_id and assignment.action_id = action_row.id and assignment.status <> 'released' and assignment.assignee_type = p_query->>'assigneeType' and (not (p_query ? 'assigneeId') or assignment.assignee_id = p_query->>'assigneeId')))
    and (not (p_query ? 'sourceType') or exists (select 1 from public.platform_action_sources source where source.workspace_id = action_row.workspace_id and source.action_id = action_row.id and source.source_type = p_query->>'sourceType' and (not (p_query ? 'sourceId') or source.source_id = p_query->>'sourceId')))
  order by action_row.updated_at desc;
$$;

create or replace function public.platform_action_insert_children(p_payload jsonb)
returns void language plpgsql security invoker set search_path = public as $$
begin
  insert into public.platform_action_assignments select * from jsonb_populate_recordset(null::public.platform_action_assignments, coalesce(p_payload->'assignments', '[]'::jsonb));
  insert into public.platform_action_sources select * from jsonb_populate_recordset(null::public.platform_action_sources, coalesce(p_payload->'sources', '[]'::jsonb));
  insert into public.platform_action_history select * from jsonb_populate_recordset(null::public.platform_action_history, coalesce(p_payload->'history', '[]'::jsonb));
  insert into public.platform_action_outcome_references select * from jsonb_populate_recordset(null::public.platform_action_outcome_references, coalesce(p_payload->'outcomeReferences', '[]'::jsonb));
end;
$$;

create or replace function public.platform_action_add(p_payload jsonb)
returns void language plpgsql security invoker set search_path = public as $$
begin
  insert into public.platform_actions select * from jsonb_populate_record(null::public.platform_actions, p_payload->'action');
  perform public.platform_action_insert_children(p_payload);
end;
$$;

create or replace function public.platform_action_replace(p_payload jsonb, p_expected_version integer)
returns void language plpgsql security invoker set search_path = public as $$
declare current_row public.platform_actions; next_row public.platform_actions; source_count integer; retained_source_count integer;
begin
  next_row := jsonb_populate_record(null::public.platform_actions, p_payload->'action');
  if next_row.version <> p_expected_version + 1 then raise exception 'Replacement Action version must increment exactly once' using errcode = '40001'; end if;
  select * into current_row from public.platform_actions where workspace_id = next_row.workspace_id and id = next_row.id for update;
  if not found or current_row.version <> p_expected_version then raise exception 'Stale Platform Action version' using errcode = '40001'; end if;
  select count(*) into source_count from public.platform_action_sources where workspace_id = next_row.workspace_id and action_id = next_row.id;
  select count(*) into retained_source_count from public.platform_action_sources existing where existing.workspace_id = next_row.workspace_id and existing.action_id = next_row.id and exists (select 1 from jsonb_populate_recordset(null::public.platform_action_sources, coalesce(p_payload->'sources', '[]'::jsonb)) proposed where proposed.source_type = existing.source_type and coalesce(proposed.source_id, '') = coalesce(existing.source_id, '') and coalesce(proposed.capability, '') = coalesce(existing.capability, '') and coalesce(proposed.external_system, '') = coalesce(existing.external_system, ''));
  if source_count <> retained_source_count or source_count <> jsonb_array_length(coalesce(p_payload->'sources', '[]'::jsonb)) then raise exception 'Platform Action provenance cannot be rewritten' using errcode = 'P0001'; end if;
  if (select count(*) from jsonb_populate_recordset(null::public.platform_action_history, coalesce(p_payload->'history', '[]'::jsonb)) proposed where proposed.version = next_row.version) <> 1 then raise exception 'Replacement must append exactly one history version' using errcode = 'P0001'; end if;
  update public.platform_actions set title = next_row.title, description = next_row.description, action_type = next_row.action_type, status = next_row.status, priority = next_row.priority, owner_type = next_row.owner_type, owner_id = next_row.owner_id, schedule_created = next_row.schedule_created, schedule_scheduled = next_row.schedule_scheduled, schedule_start_after = next_row.schedule_start_after, schedule_due = next_row.schedule_due, schedule_completed = next_row.schedule_completed, updated_at = next_row.updated_at, version = next_row.version where workspace_id = next_row.workspace_id and id = next_row.id and version = p_expected_version;
  update public.platform_action_assignments existing set assignee_type = proposed.assignee_type, assignee_id = proposed.assignee_id, queue = proposed.queue, status = proposed.status, claimed_at = proposed.claimed_at, released_at = proposed.released_at from jsonb_populate_recordset(null::public.platform_action_assignments, coalesce(p_payload->'assignments', '[]'::jsonb)) proposed where existing.workspace_id = proposed.workspace_id and existing.action_id = proposed.action_id and existing.id = proposed.id;
  insert into public.platform_action_assignments select * from jsonb_populate_recordset(null::public.platform_action_assignments, coalesce(p_payload->'assignments', '[]'::jsonb)) on conflict (workspace_id, action_id, id) do nothing;
  insert into public.platform_action_history select * from jsonb_populate_recordset(null::public.platform_action_history, coalesce(p_payload->'history', '[]'::jsonb)) on conflict (workspace_id, action_id, id) do nothing;
  insert into public.platform_action_outcome_references select * from jsonb_populate_recordset(null::public.platform_action_outcome_references, coalesce(p_payload->'outcomeReferences', '[]'::jsonb)) on conflict (workspace_id, action_id, outcome_id) do nothing;
end;
$$;

grant execute on function public.platform_action_find_by_id(text, text), public.platform_action_find(text, jsonb), public.platform_action_add(jsonb), public.platform_action_replace(jsonb, integer) to authenticated;
revoke all on function public.platform_action_insert_children(jsonb), public.platform_action_payload(text, text) from public;
grant execute on function public.platform_action_insert_children(jsonb), public.platform_action_payload(text, text) to authenticated;
