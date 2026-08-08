-- FS-003: reusable room requirements and versioned furnishing package intelligence.
begin;

alter table public.furnishing_room_packages drop constraint furnishing_room_packages_lifecycle_status_check;
alter table public.furnishing_room_packages add constraint furnishing_room_packages_lifecycle_status_check check(lifecycle_status in('draft','in_review','approved','deprecated','archived'));
alter table public.furnishing_room_packages add column if not exists scope text not null default 'platform' check(scope in('platform','workspace')), add column if not exists style_tags text[] not null default '{}';
alter table public.furnishing_room_package_versions drop constraint furnishing_room_package_versions_lifecycle_status_check;
alter table public.furnishing_room_package_versions add constraint furnishing_room_package_versions_lifecycle_status_check check(lifecycle_status in('draft','in_review','approved','superseded','archived'));

create table public.furnishing_room_requirements(
  id uuid primary key default gen_random_uuid(), workspace_id uuid references public.owners(id), scope text not null default 'platform' check(scope in('platform','workspace')),
  key text not null, name text not null, description text, category_id uuid not null references public.furnishing_product_categories(id), default_room_type text not null references public.furnishing_room_types(id),
  requirement_type text not null check(requirement_type in('furnishing','equipment','linen','amenity','safety','operational_supply','consumable')),
  lifecycle_status text not null default 'draft' check(lifecycle_status in('draft','approved','deprecated','archived')),
  created_by uuid not null references public.profiles(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(workspace_id,key)
);
alter table public.furnishing_room_package_items add column if not exists room_requirement_id uuid references public.furnishing_room_requirements(id), add column if not exists notes text;
create unique index furnishing_room_package_requirement_unique on public.furnishing_room_package_items(room_package_version_id,room_requirement_id) where room_requirement_id is not null;
create table public.furnishing_package_product_alternatives(
  id uuid primary key default gen_random_uuid(), room_package_item_id uuid not null references public.furnishing_room_package_items(id) on delete cascade,
  product_id uuid not null references public.furnishing_products(id), rank integer not null check(rank>0), status text not null default 'approved' check(status in('approved','fallback','deprecated')), notes text,
  unique(room_package_item_id,product_id), unique(room_package_item_id,rank)
);
alter table public.furnishing_package_versions add column if not exists bedroom_min integer, add column if not exists bedroom_max integer, add column if not exists bathroom_min integer, add column if not exists bathroom_max integer, add column if not exists guest_min integer, add column if not exists guest_max integer, add column if not exists applicability jsonb not null default '{}';
alter table public.furnishing_package_room_composition add column if not exists composition_rule jsonb not null default '{"kind":"fixed","value":1}';

create table public.furnishing_package_imports(
  id uuid primary key default gen_random_uuid(), source_filename text not null, source_sheet text not null, status text not null default 'parsed' check(status in('parsed','review_required','importing','partial_success','failed','complete')),
  created_by uuid not null references public.profiles(id), created_at timestamptz not null default now(), completed_at timestamptz
);
create table public.furnishing_package_import_items(
  id uuid primary key default gen_random_uuid(), import_id uuid not null references public.furnishing_package_imports(id) on delete cascade, source_row integer not null,
  source_item text not null, source_quantity text, proposed_requirement_id uuid references public.furnishing_room_requirements(id), proposed_product_id uuid references public.furnishing_products(id),
  proposed_quantity_rule_id uuid references public.furnishing_quantity_rules(id), review_status text not null default 'requires_review' check(review_status in('matched','requires_review','unmapped','skip')),
  notes text[] not null default '{}', raw_source jsonb not null default '{}', unique(import_id,source_row)
);

alter table public.furnishing_room_requirements enable row level security;
alter table public.furnishing_package_product_alternatives enable row level security;
alter table public.furnishing_package_imports enable row level security;
alter table public.furnishing_package_import_items enable row level security;
create policy "Members read furnishing requirements" on public.furnishing_room_requirements for select to authenticated using(scope='platform' or public.active_workspace_role(workspace_id)is not null or public.is_admin());
create policy "Members read package alternatives" on public.furnishing_package_product_alternatives for select to authenticated using(true);
create policy "Admins read package imports" on public.furnishing_package_imports for select to authenticated using(public.is_admin());
create policy "Admins read package import items" on public.furnishing_package_import_items for select to authenticated using(public.is_admin());

insert into public.furnishing_quantity_rules(name,rule_type,multiplier,minimum,maximum,custom_expression,rounding)
select seed.name,seed.rule_type,seed.multiplier,null,null,null,seed.rounding
from (values
  ('Fixed 1','fixed',1::numeric,'none'),
  ('1 per bedroom','per_bedroom',1::numeric,'none'),
  ('2 per bedroom','per_bedroom',2::numeric,'none'),
  ('1 per bathroom','per_bathroom',1::numeric,'none'),
  ('1 per guest','per_guest',1::numeric,'up'),
  ('1 per bed','per_bed',1::numeric,'none')
) as seed(name,rule_type,multiplier,rounding)
where not exists(
  select 1 from public.furnishing_quantity_rules existing
  where existing.workspace_id is null
    and existing.rule_type=seed.rule_type
    and existing.multiplier=seed.multiplier
    and existing.rounding=seed.rounding
);

commit;
