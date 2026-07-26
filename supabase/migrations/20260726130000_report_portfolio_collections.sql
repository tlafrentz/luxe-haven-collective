-- REP v1.3: reportable-by-design registry metadata, relationships, and immutable report collections.
begin;

alter table public.report_definitions add column if not exists audiences text[] not null default '{}';

create table public.report_collections(
  id text primary key,
  workspace_id uuid not null,
  name text not null check(char_length(btrim(name)) between 1 and 160),
  description text,
  collection_type text not null check(collection_type in('investor-due-diligence','monthly-operations','quarterly-executive-review','board-meeting','acquisition-package','custom')),
  status text not null check(status in('draft','published','archived')),
  created_by_profile_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  archived_at timestamptz
);
create table public.report_collection_items(
  id text primary key,
  collection_id text not null references public.report_collections(id),
  report_id text not null references public.generated_reports(id),
  position integer not null check(position>=0),
  added_by_profile_id uuid not null,
  added_at timestamptz not null default now(),
  unique(collection_id,report_id),unique(collection_id,position)
);
create table public.report_relationships(
  id text primary key,
  from_report_id text not null references public.generated_reports(id),
  to_report_id text not null references public.generated_reports(id),
  relationship_type text not null check(relationship_type in('supports','compares-to','actualizes','supersedes','related')),
  safe_summary text,
  created_by_profile_id uuid not null,
  created_at timestamptz not null default now(),
  unique(from_report_id,to_report_id,relationship_type),
  check(from_report_id<>to_report_id)
);
alter table public.report_collections enable row level security;
alter table public.report_collection_items enable row level security;
alter table public.report_relationships enable row level security;
create policy "Workspace collections are readable" on public.report_collections for select to authenticated using(public.active_workspace_role(workspace_id)is not null);
create policy "Collection items are readable" on public.report_collection_items for select to authenticated using(exists(select 1 from public.report_collections collection where collection.id=collection_id and public.active_workspace_role(collection.workspace_id)is not null));
create policy "Report relationships are readable" on public.report_relationships for select to authenticated using(exists(select 1 from public.generated_reports report where report.id=from_report_id and public.active_workspace_role(report.workspace_id)is not null));
grant select on public.report_collections,public.report_collection_items,public.report_relationships to authenticated;
create index report_collections_workspace_idx on public.report_collections(workspace_id,status,updated_at desc);
create index report_collection_items_order_idx on public.report_collection_items(collection_id,position);
create index report_relationships_from_idx on public.report_relationships(from_report_id,created_at);

update public.report_definitions set audiences=case report_type
  when'investment-decision'then array['Investor','Owner','Partner','Advisor']
  when'property-performance'then array['Owner','Property Manager']
  when'portfolio-performance'then array['Owner','Executive']
  when'financial-performance'then array['Owner','CPA','Lender'] end;

commit;
