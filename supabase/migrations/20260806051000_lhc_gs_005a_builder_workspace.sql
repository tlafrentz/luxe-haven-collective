-- LHC-GS-005A: durable builder state layered over canonical guidebook drafts.
create table if not exists public.guidebook_builder_sessions (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null, guidebook_id uuid not null,
 actor_id uuid not null, draft_revision integer not null, selected_section_id uuid, selected_component_id uuid,
 preview_mode text not null default 'desktop' check(preview_mode in('desktop','tablet','mobile','pdf','guest_portal')),
 panel text not null default 'content', last_seen_at timestamptz not null default now(), created_at timestamptz not null default now(),
 unique(workspace_id,guidebook_id,actor_id)
);
create table if not exists public.guidebook_builder_validation_runs (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null, guidebook_id uuid not null,
 guidebook_version_id uuid, draft_revision integer not null, health_score integer not null check(health_score between 0 and 100),
 blocking_count integer not null, warning_count integer not null, issues jsonb not null default '[]', created_at timestamptz not null default now()
);
create table if not exists public.guidebook_builder_activity (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null, guidebook_id uuid not null,
 actor_id uuid not null, draft_revision integer not null, action text not null, safe_metadata jsonb not null default '{}', created_at timestamptz not null default now()
);
alter table public.guidebook_builder_sessions enable row level security;
alter table public.guidebook_builder_validation_runs enable row level security;
alter table public.guidebook_builder_activity enable row level security;
create policy builder_sessions_workspace_scope on public.guidebook_builder_sessions for all to authenticated using(workspace_id=auth.uid()) with check(workspace_id=auth.uid());
create policy builder_validation_workspace_scope on public.guidebook_builder_validation_runs for all to authenticated using(workspace_id=auth.uid()) with check(workspace_id=auth.uid());
create policy builder_activity_workspace_scope on public.guidebook_builder_activity for select to authenticated using(workspace_id=auth.uid());
revoke all on public.guidebook_builder_sessions,public.guidebook_builder_validation_runs,public.guidebook_builder_activity from anon;
