begin;

create table public.canonical_reports(
  id text primary key,
  workspace_id uuid not null,
  family text not null check(family in('executive','owner','investment','operations','custom')),
  report_type text not null,
  definition_id text not null,
  created_by_profile_id uuid not null,
  created_at timestamptz not null,
  archived_at timestamptz,
  unique(workspace_id,id)
);

create table public.canonical_report_versions(
  id text primary key,
  report_id text not null references public.canonical_reports(id) on delete restrict,
  workspace_id uuid not null,
  version_number integer not null check(version_number>0),
  definition_id text not null,
  definition_version integer not null check(definition_version>0),
  family text not null check(family in('executive','owner','investment','operations','custom')),
  report_type text not null,
  title text not null check(char_length(title) between 1 and 160),
  description text,
  requested_by_profile_id uuid not null,
  generated_for_id text,
  scope_kind text not null check(scope_kind in('portfolio','selected_properties','property','owner_portfolio','investment_opportunity','investment_comparison')),
  scope_snapshot jsonb not null,
  property_ids uuid[] not null default '{}',
  owner_id uuid,
  opportunity_id text,
  status text not null check(status in('draft','generating','ready','failed')),
  period_snapshot jsonb not null,
  comparison_period_snapshot jsonb,
  content_snapshot jsonb,
  snapshot_schema_version text,
  source_lineage_snapshot jsonb not null default '[]'::jsonb,
  freshness_snapshot jsonb,
  data_gap_snapshot jsonb not null default '[]'::jsonb,
  idempotency_key text,
  requested_at timestamptz not null,
  generation_started_at timestamptz,
  generated_at timestamptz,
  failure_code text,
  failure_message text,
  unique(report_id,version_number),
  unique(workspace_id,id),
  unique(workspace_id,idempotency_key),
  foreign key(workspace_id,report_id) references public.canonical_reports(workspace_id,id) on delete restrict,
  check((status='ready' and content_snapshot is not null and snapshot_schema_version is not null and generated_at is not null and failure_code is null)
    or status<>'ready'),
  check((status='failed' and failure_code is not null) or status<>'failed')
);

create index canonical_reports_workspace_family_idx on public.canonical_reports(workspace_id,family,created_at desc);
create index canonical_reports_workspace_archive_idx on public.canonical_reports(workspace_id,archived_at);
create index canonical_report_versions_report_idx on public.canonical_report_versions(report_id,version_number desc);
create index canonical_report_versions_workspace_status_idx on public.canonical_report_versions(workspace_id,status,generated_at desc);
create index canonical_report_versions_properties_idx on public.canonical_report_versions using gin(property_ids);

alter table public.canonical_reports enable row level security;
alter table public.canonical_report_versions enable row level security;

create policy "Authorized members read canonical reports" on public.canonical_reports
for select to authenticated using(public.active_workspace_role(workspace_id)is not null);

create policy "Authorized members read canonical report versions" on public.canonical_report_versions
for select to authenticated using(
  public.active_workspace_role(workspace_id)is not null
  and not exists(select 1 from unnest(property_ids) property_id where not public.can_access_workspace_property(property_id))
);

grant select on public.canonical_reports,public.canonical_report_versions to authenticated;
grant all on public.canonical_reports,public.canonical_report_versions to service_role;

create or replace function public.prevent_ready_report_version_mutation()
returns trigger language plpgsql set search_path=public as $$
begin
  if old.status='ready' then raise exception 'Ready report versions are immutable' using errcode='23514'; end if;
  return new;
end;$$;

create trigger canonical_ready_report_version_immutable before update or delete
on public.canonical_report_versions for each row execute function public.prevent_ready_report_version_mutation();

commit;
