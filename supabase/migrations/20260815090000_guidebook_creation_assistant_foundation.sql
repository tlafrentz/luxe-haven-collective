-- Guidebook Creation Assistant foundation. Upstream of canonical drafts only.
begin;

create table public.guidebook_creation_jobs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.owners(id),
  property_id uuid not null references public.properties(id),
  guidebook_id uuid references public.guidebooks(id),
  requested_by_profile_id uuid not null references public.profiles(id),
  requested_by_role text not null,
  creation_path text not null default 'assistant' check (creation_path in ('assistant')),
  template_artifact_id uuid references public.guidebook_library_artifacts(id),
  template_version_id uuid references public.guidebook_library_versions(id),
  state text not null default 'draft' check (state in ('draft','uploading','ready_for_extraction','extracting','awaiting_review','ready_to_generate','generating','completed','failed','cancelled')),
  current_stage text not null default 'property',
  idempotency_key text not null,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  expected_draft_revision integer,
  resulting_draft_revision integer,
  cancelled_at timestamptz,
  cancelled_by_profile_id uuid references public.profiles(id),
  failure_class text,
  safe_failure_message text,
  correlation_id uuid not null default gen_random_uuid(),
  provider_policy_version text not null default 'guidebook-assistant.v1',
  created_at timestamptz not null default now(),
  started_at timestamptz,
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  unique(workspace_id,idempotency_key),
  unique(id,workspace_id),
  check ((state='cancelled')=(cancelled_at is not null)),
  check (state<>'completed' or (guidebook_id is not null and resulting_draft_revision is not null))
);

create table public.guidebook_creation_attempts (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.guidebook_creation_jobs(id) on delete cascade,
  workspace_id uuid not null,
  attempt_number integer not null check (attempt_number > 0),
  stage text not null check (stage in ('extraction','generation','section_regeneration')),
  status text not null default 'queued' check (status in ('queued','processing','completed','retryable_failure','terminal_failure','cancelled')),
  provider_key text not null,
  provider_request_id text,
  idempotency_key text not null,
  usage_metadata jsonb not null default '{}',
  safe_failure_code text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key(job_id,workspace_id) references public.guidebook_creation_jobs(id,workspace_id) on delete cascade,
  unique(job_id,idempotency_key),
  unique(job_id,attempt_number,stage)
);

create table public.guidebook_creation_sources (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.guidebook_creation_jobs(id) on delete cascade,
  workspace_id uuid not null,
  source_type text not null check (source_type in ('pdf','docx','text','image')),
  original_filename text not null check (length(original_filename) between 1 and 180),
  storage_path text not null unique,
  media_type text not null,
  byte_size bigint not null check (byte_size > 0 and byte_size <= 26214400),
  integrity_sha256 text not null check (integrity_sha256 ~ '^[a-f0-9]{64}$'),
  upload_status text not null default 'ready' check (upload_status in ('pending','ready','failed')),
  extraction_status text not null default 'pending' check (extraction_status in ('pending','processing','completed','failed','unsupported')),
  retention_state text not null default 'active' check (retention_state in ('active','expired','cleanup_queued','deleted','legal_hold')),
  created_by_profile_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  foreign key(job_id,workspace_id) references public.guidebook_creation_jobs(id,workspace_id) on delete cascade,
  unique(job_id,integrity_sha256)
);

create table public.guidebook_creation_facts (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.guidebook_creation_jobs(id) on delete cascade,
  workspace_id uuid not null,
  category text not null,
  field_key text not null,
  normalized_value jsonb,
  display_value text,
  source_id uuid references public.guidebook_creation_sources(id) on delete restrict,
  source_location text,
  confidence numeric(5,4) check (confidence between 0 and 1),
  review_status text not null check (review_status in ('confirmed','needs_review','missing','conflicting','rejected')),
  conflict_group uuid,
  sensitivity text not null default 'internal' check (sensitivity in ('public','internal','sensitive','secret')),
  high_risk boolean not null default false,
  corrected_value jsonb,
  reviewed_by_profile_id uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key(job_id,workspace_id) references public.guidebook_creation_jobs(id,workspace_id) on delete cascade,
  check (review_status not in ('confirmed','rejected') or reviewed_at is not null),
  check (sensitivity <> 'secret' or normalized_value is null)
);

create table public.guidebook_creation_confirmations (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.guidebook_creation_jobs(id) on delete cascade,
  workspace_id uuid not null,
  fact_id uuid not null references public.guidebook_creation_facts(id) on delete cascade,
  confirmed_by_profile_id uuid not null references public.profiles(id),
  confirmation_version integer not null default 1,
  confirmed_at timestamptz not null default now(),
  revoked_at timestamptz,
  foreign key(job_id,workspace_id) references public.guidebook_creation_jobs(id,workspace_id) on delete cascade,
  unique(fact_id,confirmation_version)
);

create table public.guidebook_creation_artifacts (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.guidebook_creation_jobs(id) on delete cascade,
  workspace_id uuid not null,
  attempt_id uuid not null references public.guidebook_creation_attempts(id) on delete restrict,
  guidebook_id uuid not null references public.guidebooks(id) on delete restrict,
  draft_revision integer not null check (draft_revision > 0),
  artifact_type text not null check (artifact_type in ('initial_draft','section_regeneration')),
  section_id text,
  based_on_revision integer,
  supersedes_artifact_id uuid references public.guidebook_creation_artifacts(id),
  template_version_id uuid references public.guidebook_library_versions(id),
  component_lineage jsonb not null default '[]',
  fact_lineage jsonb not null default '[]',
  draft_snapshot jsonb not null,
  created_at timestamptz not null default now(),
  foreign key(job_id,workspace_id) references public.guidebook_creation_jobs(id,workspace_id) on delete cascade
);

create table public.guidebook_creation_events (
  id bigint generated always as identity primary key,
  job_id uuid not null references public.guidebook_creation_jobs(id) on delete cascade,
  workspace_id uuid not null,
  actor_profile_id uuid references public.profiles(id),
  event_type text not null,
  correlation_id uuid not null,
  safe_metadata jsonb not null default '{}',
  occurred_at timestamptz not null default now(),
  foreign key(job_id,workspace_id) references public.guidebook_creation_jobs(id,workspace_id) on delete cascade
);

create table public.guidebook_creation_work_items (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.guidebook_creation_jobs(id) on delete cascade,
  workspace_id uuid not null,
  stage text not null check (stage in ('extraction','generation','section_regeneration')),
  payload jsonb not null default '{}',
  idempotency_key text not null,
  status text not null default 'queued' check (status in ('queued','processing','completed','retryable_failure','terminal_failure','cancelled')),
  attempts integer not null default 0,
  available_at timestamptz not null default now(),
  lease_owner text,
  lease_expires_at timestamptz,
  safe_failure_code text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  foreign key(job_id,workspace_id) references public.guidebook_creation_jobs(id,workspace_id) on delete cascade,
  unique(job_id,idempotency_key)
);

create index guidebook_creation_jobs_work_idx on public.guidebook_creation_jobs(state,updated_at);
create index guidebook_creation_sources_job_idx on public.guidebook_creation_sources(job_id,extraction_status);
create index guidebook_creation_facts_job_idx on public.guidebook_creation_facts(job_id,category,review_status);
create index guidebook_creation_events_job_idx on public.guidebook_creation_events(job_id,occurred_at);
create unique index guidebook_creation_artifact_revision_idx on public.guidebook_creation_artifacts(job_id,draft_revision,coalesce(section_id,''));
create index guidebook_creation_work_queue_idx on public.guidebook_creation_work_items(status,available_at) where status in ('queued','retryable_failure');

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('guidebook-creation-sources','guidebook-creation-sources',false,26214400,
  array['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/plain','image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

alter table public.guidebook_creation_jobs enable row level security;
alter table public.guidebook_creation_attempts enable row level security;
alter table public.guidebook_creation_sources enable row level security;
alter table public.guidebook_creation_facts enable row level security;
alter table public.guidebook_creation_confirmations enable row level security;
alter table public.guidebook_creation_artifacts enable row level security;
alter table public.guidebook_creation_events enable row level security;
alter table public.guidebook_creation_work_items enable row level security;

create policy "Scoped creation jobs are readable" on public.guidebook_creation_jobs for select to authenticated using (
  public.is_admin() or (public.active_workspace_role(workspace_id) is not null and public.can_access_workspace_property(property_id))
);
create policy "Scoped creation attempts are readable" on public.guidebook_creation_attempts for select to authenticated using (
  exists(select 1 from public.guidebook_creation_jobs job where job.id=job_id and (public.is_admin() or (public.active_workspace_role(job.workspace_id) is not null and public.can_access_workspace_property(job.property_id))))
);
create policy "Scoped creation sources are readable" on public.guidebook_creation_sources for select to authenticated using (
  exists(select 1 from public.guidebook_creation_jobs job where job.id=job_id and (public.is_admin() or (public.active_workspace_role(job.workspace_id) is not null and public.can_access_workspace_property(job.property_id))))
);
create policy "Scoped creation facts are readable" on public.guidebook_creation_facts for select to authenticated using (
  exists(select 1 from public.guidebook_creation_jobs job where job.id=job_id and (public.is_admin() or (public.active_workspace_role(job.workspace_id) is not null and public.can_access_workspace_property(job.property_id))))
);
create policy "Scoped creation confirmations are readable" on public.guidebook_creation_confirmations for select to authenticated using (
  exists(select 1 from public.guidebook_creation_jobs job where job.id=job_id and (public.is_admin() or (public.active_workspace_role(job.workspace_id) is not null and public.can_access_workspace_property(job.property_id))))
);
create policy "Scoped creation artifacts are readable" on public.guidebook_creation_artifacts for select to authenticated using (
  exists(select 1 from public.guidebook_creation_jobs job where job.id=job_id and (public.is_admin() or (public.active_workspace_role(job.workspace_id) is not null and public.can_access_workspace_property(job.property_id))))
);
create policy "Scoped creation events are readable" on public.guidebook_creation_events for select to authenticated using (
  exists(select 1 from public.guidebook_creation_jobs job where job.id=job_id and (public.is_admin() or (public.active_workspace_role(job.workspace_id) is not null and public.can_access_workspace_property(job.property_id))))
);
create policy "Scoped creation work is readable" on public.guidebook_creation_work_items for select to authenticated using (
  exists(select 1 from public.guidebook_creation_jobs job where job.id=job_id and (public.is_admin() or (public.active_workspace_role(job.workspace_id) is not null and public.can_access_workspace_property(job.property_id))))
);

create policy "Scoped private creation source objects are readable" on storage.objects for select to authenticated using (
  bucket_id='guidebook-creation-sources' and exists(
    select 1 from public.guidebook_creation_sources source
    join public.guidebook_creation_jobs job on job.id=source.job_id
    where source.storage_path=name and (public.is_admin() or (public.active_workspace_role(job.workspace_id) is not null and public.can_access_workspace_property(job.property_id)))
  )
);

grant select on public.guidebook_creation_jobs,public.guidebook_creation_attempts,public.guidebook_creation_sources,
  public.guidebook_creation_facts,public.guidebook_creation_confirmations,public.guidebook_creation_artifacts,
  public.guidebook_creation_events to authenticated;
grant select on public.guidebook_creation_work_items to authenticated;
revoke all on public.guidebook_creation_jobs,public.guidebook_creation_attempts,public.guidebook_creation_sources,
  public.guidebook_creation_facts,public.guidebook_creation_confirmations,public.guidebook_creation_artifacts,
  public.guidebook_creation_events from anon;
revoke all on public.guidebook_creation_work_items from anon;

create or replace function public.claim_guidebook_creation_work(p_worker_id text,p_lease_seconds integer default 120)
returns setof public.guidebook_creation_work_items language plpgsql security definer set search_path=public as $$
declare item public.guidebook_creation_work_items%rowtype;
begin
  if auth.role()<>'service_role' then raise exception 'guidebook_creation_worker_unauthorized'; end if;
  select * into item from public.guidebook_creation_work_items
   where status in('queued','retryable_failure') and available_at<=now()
     and (lease_expires_at is null or lease_expires_at<=now())
   order by available_at,created_at for update skip locked limit 1;
  if item.id is null then return; end if;
  update public.guidebook_creation_work_items set status='processing',attempts=attempts+1,
    lease_owner=p_worker_id,lease_expires_at=now()+make_interval(secs=>greatest(10,least(p_lease_seconds,600)))
   where id=item.id returning * into item;
  return next item;
end$$;
revoke all on function public.claim_guidebook_creation_work(text,integer) from public,anon,authenticated;
grant execute on function public.claim_guidebook_creation_work(text,integer) to service_role;

commit;
