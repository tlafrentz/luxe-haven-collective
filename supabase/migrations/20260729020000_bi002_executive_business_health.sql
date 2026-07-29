-- BI-002: immutable Executive Business Health projections.
create table public.executive_health_projections (
  id text primary key,
  workspace_id uuid not null references public.owners(id) on delete cascade,
  period_from date not null,
  period_to date not null,
  schema_version text not null check(schema_version='executive-business-health.v1'),
  calculation_version text not null,
  projection jsonb not null,
  score numeric,
  confidence numeric,
  evidence_artifact_ids text[] not null default '{}',
  generated_at timestamptz not null,
  created_by_profile_id uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  check(period_to>=period_from),
  check(score is null or score between 0 and 100),
  check(confidence is null or confidence between 0 and 100)
);
create index executive_health_timeline_idx on public.executive_health_projections(workspace_id,generated_at desc);
alter table public.executive_health_projections enable row level security;
create policy "executive health workspace read" on public.executive_health_projections for select to authenticated
using(public.can_access_platform_action_workspace(workspace_id));
revoke all on public.executive_health_projections from anon;
grant select on public.executive_health_projections to authenticated;
grant all on public.executive_health_projections to service_role;
