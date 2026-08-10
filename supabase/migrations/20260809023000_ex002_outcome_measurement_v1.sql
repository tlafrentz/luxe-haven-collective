-- EX-002 Outcome Measurement v1: connect the canonical Learning measurement engine to Execute Actions.
begin;

alter table public.learning_measurement_plan_versions
  add column if not exists source_action_id text,
  add column if not exists source_action_plan_id text,
  add column if not exists source_decision_id text,
  add column if not exists property_id uuid references public.properties(id) on delete restrict,
  add column if not exists measurement_question text,
  add column if not exists measurement_type text check(measurement_type is null or measurement_type in('quantitative-metric','percentage-change','currency-change','rate-or-ratio','count-or-frequency','duration','score-or-index','boolean-result','qualitative-assessment','mixed')),
  add column if not exists measurement_method text,
  add column if not exists review_required boolean not null default false,
  add column if not exists reviewer_profile_id uuid references public.profiles(id) on delete restrict,
  add column if not exists minimum_data_quality text check(minimum_data_quality is null or minimum_data_quality in('complete','sufficient','limited','conflicting','stale','missing','invalid')),
  add column if not exists attribution_statement text;

create unique index if not exists ex002_one_measurement_series_per_action
  on public.learning_measurement_plan_versions(workspace_id,source_action_id,series_id)
  where source_action_id is not null;
create index if not exists ex002_measurement_action_idx on public.learning_measurement_plan_versions(workspace_id,source_action_id);
create index if not exists ex002_measurement_property_idx on public.learning_measurement_plan_versions(workspace_id,property_id);

create table public.learning_execute_measurement_state(
  workspace_id uuid not null,
  measurement_plan_version_id text primary key references public.learning_measurement_plan_versions(id) on delete restrict,
  status text not null default 'draft' check(status in('draft','scheduled','awaiting-data','ready-to-measure','in-progress','awaiting-review','finalized','inconclusive','not-measurable','cancelled','archived')),
  outcome_classification text check(outcome_classification is null or outcome_classification in('achieved','partially-achieved','not-achieved','inconclusive','not-measurable')),
  confidence text check(confidence is null or confidence in('high','moderate','low','insufficient-evidence')),
  data_quality text check(data_quality is null or data_quality in('complete','sufficient','limited','conflicting','stale','missing','invalid')),
  version integer not null default 1 check(version>0),
  updated_at timestamptz not null default now(),
  submitted_by_profile_id uuid references public.profiles(id) on delete restrict,
  submitted_at timestamptz,
  reviewed_by_profile_id uuid references public.profiles(id) on delete restrict,
  reviewed_at timestamptz,
  finalized_at timestamptz,
  override_reason text,
  check(status<>'finalized' or(outcome_classification is not null and finalized_at is not null)),
  check(override_reason is null or btrim(override_reason)<>'')
);
create index ex002_measurement_state_queue_idx on public.learning_execute_measurement_state(workspace_id,status,updated_at);

create table public.learning_measurement_target_amendments(
  id text primary key,
  workspace_id uuid not null,
  measurement_plan_version_id text not null references public.learning_measurement_plan_versions(id) on delete restrict,
  expected_outcome_id text not null references public.learning_expected_outcome_specifications(id) on delete restrict,
  previous_target jsonb not null,
  revised_target jsonb not null,
  reason text not null check(btrim(reason)<>''),
  amended_by_profile_id uuid not null references public.profiles(id) on delete restrict,
  amended_at timestamptz not null,
  result_was_visible boolean not null default false,
  version integer not null check(version>0),
  unique(measurement_plan_version_id,expected_outcome_id,version)
);

create table public.learning_measurement_baseline_amendments(
  id text primary key,
  workspace_id uuid not null,
  measurement_plan_version_id text not null references public.learning_measurement_plan_versions(id) on delete restrict,
  previous_baseline jsonb not null,
  revised_baseline jsonb not null,
  reason text not null check(btrim(reason)<>''),
  amended_by_profile_id uuid not null references public.profiles(id) on delete restrict,
  amended_at timestamptz not null,
  version integer not null check(version>0),
  unique(measurement_plan_version_id,version)
);

create table public.learning_measurement_guardrails(
  id text primary key,
  workspace_id uuid not null,
  measurement_plan_version_id text not null references public.learning_measurement_plan_versions(id) on delete restrict,
  metric_definition jsonb not null,
  baseline jsonb,
  acceptable_boundary jsonb not null,
  actual_result jsonb,
  required boolean not null default true,
  evaluation_status text not null default 'pending' check(evaluation_status in('pending','passed','failed','not-measurable')),
  data_quality text check(data_quality is null or data_quality in('complete','sufficient','limited','conflicting','stale','missing','invalid')),
  created_at timestamptz not null default now()
);

create table public.learning_measurement_exceptions(
  id text primary key,
  workspace_id uuid not null,
  measurement_plan_version_id text not null references public.learning_measurement_plan_versions(id) on delete restrict,
  exception_type text not null check(exception_type in('baseline-unavailable','insufficient-post-action-data','provider-unavailable','metric-definition-changed','property-inactive','action-partially-cancelled','window-invalidated','concurrent-changes','data-sources-conflict','seasonal-periods-incomparable','target-invalid','attribution-unsupported','no-longer-relevant')),
  explanation text not null check(btrim(explanation)<>''),
  status text not null default 'open' check(status in('open','resolved','accepted')),
  created_by_profile_id uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  resolved_by_profile_id uuid references public.profiles(id) on delete restrict,
  resolved_at timestamptz,
  resolution_note text
);

alter table public.learning_measurement_target_amendments enable row level security;
alter table public.learning_measurement_baseline_amendments enable row level security;
alter table public.learning_measurement_guardrails enable row level security;
alter table public.learning_measurement_exceptions enable row level security;
alter table public.learning_execute_measurement_state enable row level security;

create or replace function public.can_access_execute_measurement(p_workspace_id uuid,p_measurement_plan_version_id text)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(
  select 1 from public.learning_measurement_plan_versions measurement
  left join public.platform_actions action on action.workspace_id=measurement.workspace_id::text and action.id=measurement.source_action_id
  where measurement.workspace_id=p_workspace_id and measurement.id=p_measurement_plan_version_id
   and public.active_workspace_role(measurement.workspace_id) is not null
   and(measurement.property_id is null or public.can_access_workspace_property(measurement.property_id))
   and(measurement.source_action_id is null or action.id is not null)
 );
$$;

drop policy if exists "Members inspect measurement plans" on public.learning_measurement_plan_versions;
create policy "Members inspect authorized measurements" on public.learning_measurement_plan_versions for select to authenticated
using(public.active_workspace_role(workspace_id)is not null and(property_id is null or public.can_access_workspace_property(property_id)));
create policy "Members create authorized measurements" on public.learning_measurement_plan_versions for insert to authenticated
with check(public.active_workspace_role(workspace_id)in('owner','administrator','operator','contributor') and(property_id is null or public.can_access_workspace_property(property_id)) and(source_action_id is null or exists(select 1 from public.platform_actions action where action.workspace_id=workspace_id::text and action.id=source_action_id and(action.property_id is null or public.can_access_workspace_property(action.property_id)))));

create policy "Members inspect measurement target amendments" on public.learning_measurement_target_amendments for select to authenticated using(public.can_access_execute_measurement(workspace_id,measurement_plan_version_id));
create policy "Members append measurement target amendments" on public.learning_measurement_target_amendments for insert to authenticated with check(public.can_access_execute_measurement(workspace_id,measurement_plan_version_id));
create policy "Members inspect measurement baseline amendments" on public.learning_measurement_baseline_amendments for select to authenticated using(public.can_access_execute_measurement(workspace_id,measurement_plan_version_id));
create policy "Members append measurement baseline amendments" on public.learning_measurement_baseline_amendments for insert to authenticated with check(public.can_access_execute_measurement(workspace_id,measurement_plan_version_id));
create policy "Members manage measurement guardrails" on public.learning_measurement_guardrails for all to authenticated using(public.can_access_execute_measurement(workspace_id,measurement_plan_version_id)) with check(public.can_access_execute_measurement(workspace_id,measurement_plan_version_id));
create policy "Members manage measurement exceptions" on public.learning_measurement_exceptions for all to authenticated using(public.can_access_execute_measurement(workspace_id,measurement_plan_version_id)) with check(public.can_access_execute_measurement(workspace_id,measurement_plan_version_id));
create policy "Members inspect Execute measurement state" on public.learning_execute_measurement_state for select to authenticated using(public.can_access_execute_measurement(workspace_id,measurement_plan_version_id));
create policy "Members create Execute measurement state" on public.learning_execute_measurement_state for insert to authenticated with check(public.can_access_execute_measurement(workspace_id,measurement_plan_version_id));
create policy "Members update Execute measurement state" on public.learning_execute_measurement_state for update to authenticated using(public.can_access_execute_measurement(workspace_id,measurement_plan_version_id)) with check(public.can_access_execute_measurement(workspace_id,measurement_plan_version_id));

grant select,insert on public.learning_measurement_target_amendments,public.learning_measurement_baseline_amendments to authenticated;
grant select,insert,update on public.learning_measurement_guardrails,public.learning_measurement_exceptions to authenticated;
grant select,insert,update on public.learning_execute_measurement_state to authenticated;
grant all on public.learning_measurement_target_amendments,public.learning_measurement_baseline_amendments,public.learning_measurement_guardrails,public.learning_measurement_exceptions,public.learning_execute_measurement_state to service_role;

create trigger learning_target_amendments_append_only before update or delete on public.learning_measurement_target_amendments for each row execute function public.prevent_learning_history_change();
create trigger learning_baseline_amendments_append_only before update or delete on public.learning_measurement_baseline_amendments for each row execute function public.prevent_learning_history_change();

alter table public.platform_action_activity drop constraint if exists platform_action_activity_entity_type_check;
alter table public.platform_action_activity add constraint platform_action_activity_entity_type_check check(entity_type in('plan','action','evidence','blocker','dependency','recurrence','escalation','measurement'));
alter table public.execute_notification_outbox drop constraint if exists execute_notification_outbox_entity_type_check;
alter table public.execute_notification_outbox add constraint execute_notification_outbox_entity_type_check check(entity_type in('plan','action','evidence','blocker','dependency','recurrence','escalation','measurement'));

commit;
