-- Whole prose sections (Things To Do, FAQ, safety tips, welcome letters) that
-- don't reduce to an atomic guidebook_creation_facts row. Same (job_id,
-- workspace_id) composite-FK + RLS shape as guidebook_creation_facts, but no
-- sensitivity/high-risk/conflict-group machinery — that lens doesn't apply
-- to narrative content.
create table public.guidebook_creation_narrative_sections(
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.guidebook_creation_jobs(id) on delete cascade,
  workspace_id uuid not null,
  title text not null,
  body text not null,
  edited_body text,
  source_id uuid references public.guidebook_creation_sources(id) on delete restrict,
  source_location text,
  review_status text not null check(review_status in('confirmed','needs_review','missing','conflicting','rejected')),
  reviewed_by_profile_id uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key(job_id,workspace_id) references public.guidebook_creation_jobs(id,workspace_id) on delete cascade,
  check(review_status not in('confirmed','rejected') or reviewed_at is not null)
);
create index guidebook_creation_narrative_sections_job_idx on public.guidebook_creation_narrative_sections(job_id,review_status);

alter table public.guidebook_creation_narrative_sections enable row level security;
create policy "Scoped creation narrative sections are readable" on public.guidebook_creation_narrative_sections for select to authenticated using(
  exists(select 1 from public.guidebook_creation_jobs job where job.id=job_id and (public.is_admin() or (public.active_workspace_role(job.workspace_id) is not null and public.can_access_workspace_property(job.property_id))))
);
grant select on public.guidebook_creation_narrative_sections to authenticated;
revoke all on public.guidebook_creation_narrative_sections from anon;
grant all on public.guidebook_creation_narrative_sections to service_role;
