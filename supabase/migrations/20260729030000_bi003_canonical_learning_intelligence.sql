-- BI-003: canonical outcome-backed organizational learning.
create function public.learning_lineage_complete(value jsonb) returns boolean language sql immutable as $$
  select jsonb_typeof(value)='object'
    and jsonb_array_length(coalesce(value->'observations','[]'::jsonb))>0
    and jsonb_array_length(coalesce(value->'decisions','[]'::jsonb))>0
    and jsonb_array_length(coalesce(value->'actions','[]'::jsonb))>0
    and jsonb_array_length(coalesce(value->'outcomes','[]'::jsonb))>0
    and jsonb_array_length(coalesce(value->'reviews','[]'::jsonb))>0
$$;

create table public.canonical_learning_candidates(
  id text primary key,workspace_id uuid not null references public.owners(id) on delete cascade,
  series_id text not null,category text not null,statement text not null,applicability jsonb not null,
  lineage jsonb not null check(public.learning_lineage_complete(lineage)),
  confidence jsonb not null,validation_status text not null check(validation_status in('proposed','scheduled','in-review')),
  policy_version text not null,created_at timestamptz not null,unique(workspace_id,series_id,id)
);
create table public.canonical_learning_reviews(
  id text primary key,workspace_id uuid not null references public.owners(id) on delete cascade,
  candidate_id text not null references public.canonical_learning_candidates(id),
  status text not null check(status in('proposed','scheduled','in-review','validated','rejected','unable-to-evaluate')),
  reviewer_profile_id uuid references public.profiles(id),decision text,evidence jsonb not null,
  outcome_references jsonb not null check(jsonb_typeof(outcome_references)='array'),
  confidence jsonb not null,scheduled_at timestamptz not null,completed_at timestamptz
);
create table public.validated_learning_versions(
  id text primary key,workspace_id uuid not null references public.owners(id) on delete cascade,
  series_id text not null,version integer not null check(version>0),category text not null,
  statement text not null,future_guidance text not null,applicability jsonb not null,
  lineage jsonb not null check(public.learning_lineage_complete(lineage)),confidence jsonb not null,
  status text not null check(status in('validated','retired','contradicted')),
  supersedes_learning_id text references public.validated_learning_versions(id),
  validated_by_profile_id uuid not null references public.profiles(id),validated_at timestamptz not null,
  policy_version text not null,unique(workspace_id,series_id,version)
);
create table public.canonical_learning_knowledge_gaps(
  id text primary key,workspace_id uuid not null references public.owners(id) on delete cascade,
  gap_type text not null,severity text not null check(severity in('high','medium','low')),
  title text not null,detail text not null,suggested_evidence text not null,suggested_action text not null,
  expected_impact text not null check(expected_impact in('high','medium','low')),
  status text not null default 'open' check(status in('open','resolved','superseded')),
  detected_at timestamptz not null,resolved_at timestamptz
);
create table public.learning_guidance_projections(
  id text primary key,workspace_id uuid not null references public.owners(id) on delete cascade,
  capability text not null,guidance jsonb not null,source_learning_ids text[] not null,
  generated_at timestamptz not null,created_at timestamptz not null default now()
);
create index canonical_learning_timeline_idx on public.validated_learning_versions(workspace_id,validated_at desc);
create index canonical_learning_gap_idx on public.canonical_learning_knowledge_gaps(workspace_id,status,severity);
alter table public.canonical_learning_candidates enable row level security;
alter table public.canonical_learning_reviews enable row level security;
alter table public.validated_learning_versions enable row level security;
alter table public.canonical_learning_knowledge_gaps enable row level security;
alter table public.learning_guidance_projections enable row level security;
do $$ declare table_name text; begin foreach table_name in array array['canonical_learning_candidates','canonical_learning_reviews','validated_learning_versions','canonical_learning_knowledge_gaps','learning_guidance_projections'] loop
  execute format('create policy %I on public.%I for select to authenticated using(public.can_access_platform_action_workspace(workspace_id))',table_name||'_workspace_read',table_name);
  execute format('revoke all on public.%I from anon',table_name);
  execute format('grant select on public.%I to authenticated',table_name);
  execute format('grant all on public.%I to service_role',table_name);
end loop;end $$;
