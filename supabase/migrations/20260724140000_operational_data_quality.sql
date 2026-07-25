create table if not exists public.operational_quality_evaluations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  record_type text not null,
  record_id uuid not null,
  profile_id text not null,
  status text not null default 'unknown',
  dimensions jsonb not null default '{}'::jsonb,
  evaluated_at timestamptz not null,
  policy_id text not null,
  policy_version text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint operational_quality_evaluations_status_check check (
    status in ('trusted', 'usable-with-gaps', 'attention-needed', 'degraded', 'unusable', 'unknown')
  ),
  unique (owner_id, record_type, record_id, profile_id, policy_version)
);

create index if not exists operational_quality_evaluations_owner_status_idx
on public.operational_quality_evaluations (owner_id, status, record_type);

create index if not exists operational_quality_evaluations_record_idx
on public.operational_quality_evaluations (owner_id, record_type, record_id);

create table if not exists public.operational_data_quality_issues (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  evaluation_id uuid references public.operational_quality_evaluations(id) on delete cascade,
  record_type text not null,
  record_id uuid not null,
  field_name text not null default '',
  issue_code text not null,
  severity text not null,
  evidence jsonb not null default '[]'::jsonb,
  impact text not null,
  suggested_resolution text not null,
  resolution_state text not null default 'open',
  first_observed_at timestamptz not null,
  last_observed_at timestamptz not null,
  resolved_at timestamptz,
  policy_version text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint operational_data_quality_issue_severity_check
    check (severity in ('information', 'warning', 'critical')),
  constraint operational_data_quality_issue_resolution_check
    check (resolution_state in ('open', 'acknowledged', 'resolved', 'superseded', 'ignored-by-policy'))
);

create unique index if not exists operational_data_quality_issue_identity_idx
on public.operational_data_quality_issues (
  owner_id,
  record_type,
  record_id,
  issue_code,
  field_name
);

create index if not exists operational_data_quality_issues_open_idx
on public.operational_data_quality_issues (owner_id, resolution_state, severity, record_type);

create table if not exists public.operational_record_provenance (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  record_type text not null,
  record_id uuid not null,
  field_name text,
  source_type text not null,
  provider text,
  external_record_reference text,
  observed_at timestamptz,
  ingested_at timestamptz not null,
  mapping_version text,
  canonical_policy_version text not null,
  user_override_reference uuid,
  metadata jsonb not null default '{}'::jsonb,
  constraint operational_record_provenance_source_check
    check (source_type in ('provider', 'user', 'platform-derived', 'system-default'))
);

create index if not exists operational_record_provenance_record_idx
on public.operational_record_provenance (owner_id, record_type, record_id);

create table if not exists public.operational_sync_summaries (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  connection_id uuid references public.integration_connections(id) on delete set null,
  sync_run_id uuid references public.integration_sync_runs(id) on delete set null,
  provider text not null,
  status text not null default 'never-run',
  started_at timestamptz,
  completed_at timestamptz,
  records_discovered integer,
  records_created integer not null default 0,
  records_updated integer not null default 0,
  records_unchanged integer not null default 0,
  records_skipped integer not null default 0,
  records_failed integer not null default 0,
  warnings jsonb not null default '[]'::jsonb,
  affected_capabilities text[] not null default '{}',
  created_at timestamptz not null default now(),
  constraint operational_sync_summary_status_check check (
    status in ('succeeded', 'partially-succeeded', 'failed', 'skipped', 'in-progress', 'never-run')
  )
);

create index if not exists operational_sync_summaries_owner_started_idx
on public.operational_sync_summaries (owner_id, started_at desc);

create table if not exists public.operational_quality_re_evaluation_queue (
  owner_id uuid not null references public.profiles(id) on delete cascade,
  record_type text not null,
  record_id uuid not null,
  reason text not null,
  queued_at timestamptz not null default now(),
  primary key (owner_id, record_type, record_id)
);

alter table public.operational_quality_evaluations enable row level security;
alter table public.operational_data_quality_issues enable row level security;
alter table public.operational_record_provenance enable row level security;
alter table public.operational_sync_summaries enable row level security;
alter table public.operational_quality_re_evaluation_queue enable row level security;

create policy "Owners read own operational quality evaluations"
on public.operational_quality_evaluations for select using (owner_id = auth.uid());
create policy "Owners read own operational quality issues"
on public.operational_data_quality_issues for select using (owner_id = auth.uid());
create policy "Owners read own operational sync summaries"
on public.operational_sync_summaries for select using (owner_id = auth.uid());

create policy "Admins manage operational quality evaluations"
on public.operational_quality_evaluations for all using (public.is_admin()) with check (public.is_admin());
create policy "Admins manage operational quality issues"
on public.operational_data_quality_issues for all using (public.is_admin()) with check (public.is_admin());
create policy "Admins manage operational provenance"
on public.operational_record_provenance for all using (public.is_admin()) with check (public.is_admin());
create policy "Admins manage operational sync summaries"
on public.operational_sync_summaries for all using (public.is_admin()) with check (public.is_admin());
create policy "Admins manage operational quality queue"
on public.operational_quality_re_evaluation_queue for all using (public.is_admin()) with check (public.is_admin());

grant select on public.operational_quality_evaluations to authenticated;
grant select on public.operational_data_quality_issues to authenticated;
grant select on public.operational_sync_summaries to authenticated;

create or replace function public.queue_booking_quality_re_evaluation()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  booking_owner uuid;
begin
  select o.profile_id
    into booking_owner
    from public.properties p
    join public.owners o on o.id = p.owner_id
   where p.id = new.property_id;
  if booking_owner is not null then
    insert into public.operational_quality_re_evaluation_queue (owner_id, record_type, record_id, reason, queued_at)
    values (booking_owner, 'booking', new.id, 'canonical-booking-changed', now())
    on conflict (owner_id, record_type, record_id) do update
      set reason = excluded.reason, queued_at = excluded.queued_at;
  end if;
  return new;
end;
$$;

drop trigger if exists queue_booking_quality_re_evaluation on public.bookings;
create trigger queue_booking_quality_re_evaluation
after insert or update on public.bookings
for each row execute function public.queue_booking_quality_re_evaluation();

comment on table public.operational_quality_evaluations is
  'Versioned fitness-for-use evaluations; canonical records remain owned by their domains.';
comment on table public.operational_data_quality_issues is
  'Typed, workspace-scoped quality issues with non-destructive lifecycle.';
comment on table public.operational_record_provenance is
  'Field-level source lineage without raw provider payloads or guest personal data.';
