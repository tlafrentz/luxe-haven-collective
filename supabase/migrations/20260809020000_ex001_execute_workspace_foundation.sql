-- EX-001 Execute Workspace v1: extend canonical Platform Actions; never create a competing task model.
begin;

alter table public.platform_actions drop constraint if exists platform_actions_status_check;
alter table public.platform_actions add constraint platform_actions_status_check check (status in ('draft','committed','ready','in-progress','blocked','awaiting-review','completed','failed','cancelled','archived'));
alter table public.platform_action_history drop constraint if exists platform_action_history_operation_check;
alter table public.platform_action_history add constraint platform_action_history_operation_check check (operation in ('created','committed','owner-changed','priority-changed','assigned','assignment-released','claimed','scheduled','marked-ready','started','blocked','unblocked','submitted-for-review','returned-for-correction','completed','failed','retried','reopened','cancelled','archived','outcome-linked'));
alter table public.platform_action_history drop constraint if exists platform_action_history_previous_status_check;
alter table public.platform_action_history add constraint platform_action_history_previous_status_check check (previous_status is null or previous_status in ('draft','committed','ready','in-progress','blocked','awaiting-review','completed','failed','cancelled','archived'));
alter table public.platform_action_history drop constraint if exists platform_action_history_resulting_status_check;
alter table public.platform_action_history add constraint platform_action_history_resulting_status_check check (resulting_status is null or resulting_status in ('draft','committed','ready','in-progress','blocked','awaiting-review','completed','failed','cancelled','archived'));

create table public.platform_action_plans (
  workspace_id text not null,
  id text not null,
  title text not null check (btrim(title) <> ''),
  description text,
  origin_type text not null check (origin_type in ('decision','recommendation','opportunity','insight','manual','follow-up')),
  origin_id text,
  source_capability text,
  decision_id text,
  scope_type text not null check (scope_type in ('property','multiple-properties','portfolio','organization')),
  property_ids uuid[] not null default '{}',
  owner_type text not null check (owner_type in ('user','team','system','automation','unknown')),
  owner_id text,
  status text not null default 'draft' check (status in ('draft','active','at-risk','blocked','completed','cancelled')),
  priority text not null check (priority in ('critical','high','normal','low','deferred')),
  start_at timestamptz,
  target_completion_at timestamptz,
  expected_outcome text,
  success_metrics jsonb not null default '[]',
  source_context jsonb not null default '{}',
  created_by_type text not null check (created_by_type in ('user','team','system','automation','unknown')),
  created_by_id text,
  activated_by_id text,
  activated_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1 check (version > 0),
  primary key (workspace_id,id),
  check (target_completion_at is null or start_at is null or target_completion_at >= start_at),
  check (scope_type <> 'property' or cardinality(property_ids) = 1),
  check (status <> 'active' or activated_at is not null)
);

alter table public.platform_actions
  add column if not exists plan_id text,
  add column if not exists property_id uuid references public.properties(id) on delete restrict,
  add column if not exists scope_type text not null default 'organization' check (scope_type in ('property','multiple-properties','portfolio','organization')),
  add column if not exists category text not null default 'other' check (category in ('revenue','guest-experience','listing','furnishing','property-operations','maintenance','supplies','compliance','investment','administrative','other')),
  add column if not exists expected_outcome text,
  add column if not exists completion_criteria jsonb not null default '[]',
  add column if not exists evidence_policy jsonb not null default '{"mode":"optional"}',
  add column if not exists measurement_requirement jsonb,
  add column if not exists review_required boolean not null default false,
  add column if not exists archived_at timestamptz,
  add constraint platform_actions_plan_fk foreign key (workspace_id,plan_id) references public.platform_action_plans(workspace_id,id) on delete restrict,
  add constraint platform_actions_property_scope_check check (scope_type <> 'property' or property_id is not null);

create table public.platform_action_dependencies (
  workspace_id text not null,
  action_id text not null,
  depends_on_action_id text not null,
  created_by_id text,
  created_at timestamptz not null default now(),
  override_reason text,
  overridden_by_id text,
  overridden_at timestamptz,
  primary key (workspace_id,action_id,depends_on_action_id),
  foreign key (workspace_id,action_id) references public.platform_actions(workspace_id,id) on delete restrict,
  foreign key (workspace_id,depends_on_action_id) references public.platform_actions(workspace_id,id) on delete restrict,
  check (action_id <> depends_on_action_id),
  check ((overridden_at is null and overridden_by_id is null) or (overridden_at is not null and overridden_by_id is not null and nullif(btrim(override_reason),'') is not null))
);

create table public.platform_action_blockers (
  workspace_id text not null,
  id text not null,
  action_id text not null,
  category text not null check (category in ('awaiting-approval','awaiting-information','awaiting-vendor','access-unavailable','supply-unavailable','property-condition','technical-issue','financial-approval','dependency-incomplete','other')),
  description text not null check (btrim(description) <> ''),
  blocking_party text,
  identified_at timestamptz not null,
  expected_resolution_at timestamptz,
  severity text not null check (severity in ('low','medium','high','critical')),
  resolution_note text,
  resolved_by_id text,
  resolved_at timestamptz,
  primary key (workspace_id,id),
  foreign key (workspace_id,action_id) references public.platform_actions(workspace_id,id) on delete restrict,
  check ((resolved_at is null and resolved_by_id is null) or (resolved_at is not null and resolved_by_id is not null and nullif(btrim(resolution_note),'') is not null))
);

create table public.platform_action_evidence (
  workspace_id text not null,
  id text not null,
  action_id text not null,
  evidence_type text not null check (evidence_type in ('photo','document','receipt-invoice','url','checklist','text-note','metric-snapshot','approval','system-event')),
  storage_reference text,
  reference_url text,
  caption text,
  original_filename text,
  mime_type text,
  file_size_bytes bigint check (file_size_bytes is null or file_size_bytes >= 0),
  created_by_id text not null,
  created_at timestamptz not null default now(),
  review_status text not null default 'pending' check (review_status in ('pending','accepted','rejected','not-required')),
  reviewer_id text,
  reviewed_at timestamptz,
  rejection_reason text,
  integrity_hash text,
  administratively_removed_at timestamptz,
  administratively_removed_by_id text,
  primary key (workspace_id,id),
  foreign key (workspace_id,action_id) references public.platform_actions(workspace_id,id) on delete restrict,
  check (storage_reference is not null or reference_url is not null or evidence_type in ('checklist','text-note','metric-snapshot','approval','system-event')),
  check (review_status <> 'rejected' or nullif(btrim(rejection_reason),'') is not null)
);

create table public.platform_action_recurrence_templates (
  workspace_id text not null,
  id text not null,
  title text not null check (btrim(title) <> ''),
  description text,
  scope_type text not null check (scope_type in ('property','multiple-properties','portfolio','organization')),
  property_ids uuid[] not null default '{}',
  default_owner_type text not null check (default_owner_type in ('user','team','system','automation','unknown')),
  default_owner_id text,
  default_priority text not null check (default_priority in ('critical','high','normal','low','deferred')),
  recurrence_rule jsonb not null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  due_offset_seconds integer,
  completion_criteria jsonb not null default '[]',
  evidence_policy jsonb not null default '{"mode":"optional"}',
  escalation_policy jsonb not null default '{}',
  state text not null default 'active' check (state in ('active','paused','archived')),
  version integer not null default 1 check (version > 0),
  created_by_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id,id),
  check (ends_at is null or ends_at >= starts_at)
);

create table public.platform_action_occurrences (
  workspace_id text not null,
  template_id text not null,
  template_version integer not null,
  occurrence_key text not null,
  action_id text not null,
  trigger_type text not null check (trigger_type in ('schedule','reservation','check-in','checkout','manual')),
  trigger_id text,
  scheduled_for timestamptz not null,
  rule_snapshot jsonb not null,
  generated_at timestamptz not null default now(),
  primary key (workspace_id,template_id,occurrence_key),
  unique (workspace_id,action_id),
  foreign key (workspace_id,template_id) references public.platform_action_recurrence_templates(workspace_id,id) on delete restrict,
  foreign key (workspace_id,action_id) references public.platform_actions(workspace_id,id) on delete restrict
);

create table public.platform_action_escalations (
  workspace_id text not null,
  id text not null,
  action_id text not null,
  trigger_type text not null check (trigger_type in ('unassigned','not-started','due-soon','overdue','critically-overdue','blocked-too-long','evidence-rejected','review-pending','failed','recurrence-missed','owner-inactive')),
  policy_version text not null,
  severity text not null check (severity in ('warning','at-risk','escalated')),
  state text not null default 'warning' check (state in ('warning','at-risk','escalated','resolved')),
  rule_snapshot jsonb not null default '{}',
  corrective_action text,
  created_at timestamptz not null default now(),
  acknowledged_by_id text,
  acknowledged_at timestamptz,
  resolved_by_id text,
  resolved_at timestamptz,
  resolution_note text,
  primary key (workspace_id,id),
  foreign key (workspace_id,action_id) references public.platform_actions(workspace_id,id) on delete restrict,
  check (state <> 'resolved' or (resolved_at is not null and resolved_by_id is not null))
);

create table public.platform_action_activity (
  workspace_id text not null,
  id text not null,
  entity_type text not null check (entity_type in ('plan','action','evidence','blocker','recurrence','escalation')),
  entity_id text not null,
  action_id text,
  event_type text not null,
  actor_type text not null check (actor_type in ('user','team','system','automation','unknown')),
  actor_id text,
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}',
  correlation_id text,
  causation_id text,
  primary key (workspace_id,id)
);

create index platform_action_plans_workspace_status_idx on public.platform_action_plans(workspace_id,status,updated_at desc);
create index platform_actions_execute_queue_idx on public.platform_actions(workspace_id,status,schedule_due,priority);
create index platform_actions_property_idx on public.platform_actions(workspace_id,property_id,status) where property_id is not null;
create index platform_action_blockers_open_idx on public.platform_action_blockers(workspace_id,action_id,severity) where resolved_at is null;
create index platform_action_evidence_action_idx on public.platform_action_evidence(workspace_id,action_id,created_at desc);
create index platform_action_escalations_attention_idx on public.platform_action_escalations(workspace_id,state,severity,created_at) where state <> 'resolved';
create index platform_action_activity_timeline_idx on public.platform_action_activity(workspace_id,entity_type,entity_id,occurred_at,id);

alter table public.platform_action_plans enable row level security;
alter table public.platform_action_dependencies enable row level security;
alter table public.platform_action_blockers enable row level security;
alter table public.platform_action_evidence enable row level security;
alter table public.platform_action_recurrence_templates enable row level security;
alter table public.platform_action_occurrences enable row level security;
alter table public.platform_action_escalations enable row level security;
alter table public.platform_action_activity enable row level security;

drop policy if exists "Members can manage Platform Actions" on public.platform_actions;
create policy "Members manage authorized Platform Actions" on public.platform_actions for all to authenticated
using (public.can_access_platform_action_workspace(workspace_id) and (property_id is null or public.can_access_workspace_property(property_id)))
with check (public.can_access_platform_action_workspace(workspace_id) and (property_id is null or public.can_access_workspace_property(property_id)));
create policy "Members manage Execute action plans" on public.platform_action_plans for all to authenticated using (public.can_access_platform_action_workspace(workspace_id)) with check (public.can_access_platform_action_workspace(workspace_id));
create policy "Members manage Execute dependencies" on public.platform_action_dependencies for all to authenticated using (exists(select 1 from public.platform_actions action where action.workspace_id=platform_action_dependencies.workspace_id and action.id=platform_action_dependencies.action_id)) with check (exists(select 1 from public.platform_actions action where action.workspace_id=platform_action_dependencies.workspace_id and action.id=platform_action_dependencies.action_id));
create policy "Members manage Execute blockers" on public.platform_action_blockers for all to authenticated using (exists(select 1 from public.platform_actions action where action.workspace_id=platform_action_blockers.workspace_id and action.id=platform_action_blockers.action_id)) with check (exists(select 1 from public.platform_actions action where action.workspace_id=platform_action_blockers.workspace_id and action.id=platform_action_blockers.action_id));
create policy "Members manage Execute evidence" on public.platform_action_evidence for all to authenticated using (exists(select 1 from public.platform_actions action where action.workspace_id=platform_action_evidence.workspace_id and action.id=platform_action_evidence.action_id)) with check (exists(select 1 from public.platform_actions action where action.workspace_id=platform_action_evidence.workspace_id and action.id=platform_action_evidence.action_id));
create policy "Members manage Execute recurrence" on public.platform_action_recurrence_templates for all to authenticated using (public.can_access_platform_action_workspace(workspace_id)) with check (public.can_access_platform_action_workspace(workspace_id));
create policy "Members read Execute occurrences" on public.platform_action_occurrences for select to authenticated using (public.can_access_platform_action_workspace(workspace_id));
create policy "Members manage Execute escalations" on public.platform_action_escalations for all to authenticated using (public.can_access_platform_action_workspace(workspace_id)) with check (public.can_access_platform_action_workspace(workspace_id));
create policy "Members read Execute activity" on public.platform_action_activity for select to authenticated using (public.can_access_platform_action_workspace(workspace_id));

grant select,insert,update on public.platform_action_plans,public.platform_action_dependencies,public.platform_action_blockers,public.platform_action_evidence,public.platform_action_recurrence_templates,public.platform_action_escalations to authenticated;
grant select on public.platform_action_occurrences,public.platform_action_activity to authenticated;
grant all on public.platform_action_plans,public.platform_action_dependencies,public.platform_action_blockers,public.platform_action_evidence,public.platform_action_recurrence_templates,public.platform_action_occurrences,public.platform_action_escalations,public.platform_action_activity to service_role;

create trigger platform_action_activity_append_only before update or delete on public.platform_action_activity for each row execute function public.prevent_platform_action_append_only_change();
create trigger platform_action_occurrences_append_only before update or delete on public.platform_action_occurrences for each row execute function public.prevent_platform_action_append_only_change();

commit;
