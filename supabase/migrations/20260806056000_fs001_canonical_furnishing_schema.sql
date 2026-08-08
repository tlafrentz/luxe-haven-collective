-- FS-001: canonical Furnishing Studio domain boundaries.
begin;

alter table public.furnishing_projects
  add column if not exists workspace_id uuid references public.owners(id),
  add column if not exists description text,
  add column if not exists lifecycle_status text not null default 'draft'
    check(lifecycle_status in('draft','planning','designing','awaiting_approval','approved','procuring','installing','launch_review','completed','cancelled','archived')),
  add column if not exists project_type text not null default 'full_property'
    check(project_type in('full_property','partial_property','refresh','replacement')),
  add column if not exists target_budget_minor bigint check(target_budget_minor is null or target_budget_minor>=0),
  add column if not exists target_budget_currency text not null default 'USD' check(target_budget_currency ~ '^[A-Z]{3}$'),
  add column if not exists target_launch_date date,
  add column if not exists completed_at timestamptz;

update public.furnishing_projects project set workspace_id=property.owner_id
from public.properties property
where property.id=project.property_id and project.workspace_id is null;
alter table public.furnishing_projects alter column workspace_id set not null;

create table public.property_furnishing_profiles(
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null unique references public.properties(id) on delete cascade,
  bedroom_count integer check(bedroom_count is null or bedroom_count>=0),
  bathroom_count numeric(4,1) check(bathroom_count is null or bathroom_count>=0),
  guest_capacity integer check(guest_capacity is null or guest_capacity>=0),
  square_feet integer check(square_feet is null or square_feet>=0),
  property_type text,
  furnishing_state text not null default 'unknown'
    check(furnishing_state in('empty','partially_furnished','furnished','refresh_needed','unknown')),
  style_preference_id uuid,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.furnishing_rooms(
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.furnishing_projects(id) on delete cascade,
  room_type text not null check(room_type in('living_room','bedroom','primary_bedroom','kitchen','dining_room','bathroom','office','outdoor','entry','laundry','garage','other')),
  name text not null check(length(trim(name))>0), ordinal integer check(ordinal is null or ordinal>0),
  status text not null default 'not_started'
    check(status in('not_started','planning','selected','approved','ordered','delivered','installed','complete')),
  target_budget_minor bigint check(target_budget_minor is null or target_budget_minor>=0),
  target_budget_currency text not null default 'USD' check(target_budget_currency ~ '^[A-Z]{3}$'),
  sort_order integer not null check(sort_order>=0),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(project_id,name), unique(project_id,sort_order)
);

create table public.furnishing_retailers(
  id uuid primary key default gen_random_uuid(), name text not null unique,
  website_url text not null, status text not null default 'active' check(status in('active','inactive')),
  supports_affiliate_links boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.furnishing_products(
  id uuid primary key default gen_random_uuid(), workspace_id uuid references public.owners(id),
  name text not null, description text, product_type text not null, category text not null,
  subcategory text, brand text, manufacturer_part_number text, default_media_asset_id uuid,
  status text not null default 'draft' check(status in('draft','approved','discontinued','archived')),
  scope text not null default 'workspace' check(scope in('platform','workspace')),
  tags text[] not null default '{}', created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check((scope='platform' and workspace_id is null)or(scope='workspace' and workspace_id is not null))
);
create table public.furnishing_product_offers(
  id uuid primary key default gen_random_uuid(), product_id uuid not null references public.furnishing_products(id) on delete cascade,
  retailer_id uuid not null references public.furnishing_retailers(id), retailer_product_id text, sku text,
  product_url text not null, listed_price_minor bigint check(listed_price_minor is null or listed_price_minor>=0),
  shipping_price_minor bigint check(shipping_price_minor is null or shipping_price_minor>=0),
  currency text not null default 'USD' check(currency ~ '^[A-Z]{3}$'),
  availability text not null default 'unknown' check(availability in('in_stock','low_stock','out_of_stock','unknown')),
  affiliate_url text, last_verified_at timestamptz,
  status text not null default 'active' check(status in('active','unavailable','discontinued','archived')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(product_id,retailer_id,product_url)
);

create table public.furnishing_quantity_rules(
  id uuid primary key default gen_random_uuid(), workspace_id uuid references public.owners(id), name text not null,
  rule_type text not null check(rule_type in('fixed','per_bedroom','per_bathroom','per_guest','per_room','per_bed','custom')),
  multiplier numeric(12,4) not null check(multiplier>=0), minimum numeric(12,4) check(minimum is null or minimum>=0),
  maximum numeric(12,4) check(maximum is null or maximum>=0), custom_expression jsonb,
  rounding text not null default 'none' check(rounding in('none','up','down','nearest')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check(maximum is null or minimum is null or maximum>=minimum),
  check((rule_type='custom')=(custom_expression is not null))
);

create table public.furnishing_room_packages(
  id uuid primary key default gen_random_uuid(), workspace_id uuid references public.owners(id),
  name text not null, room_type text not null, tier text not null check(tier in('essential','elevated','luxury','custom')),
  description text, lifecycle_status text not null default 'draft' check(lifecycle_status in('draft','approved','deprecated','archived')),
  current_version_id uuid, created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.furnishing_room_package_versions(
  id uuid primary key default gen_random_uuid(), room_package_id uuid not null references public.furnishing_room_packages(id) on delete cascade,
  version_number integer not null check(version_number>0),
  lifecycle_status text not null default 'draft' check(lifecycle_status in('draft','approved','superseded','archived')),
  estimated_budget_minor bigint check(estimated_budget_minor is null or estimated_budget_minor>=0),
  currency text not null default 'USD' check(currency ~ '^[A-Z]{3}$'),
  created_by uuid not null references public.profiles(id), approved_by uuid references public.profiles(id),
  created_at timestamptz not null default now(), approved_at timestamptz, unique(room_package_id,version_number)
);
alter table public.furnishing_room_packages add constraint furnishing_room_packages_current_version_fkey
  foreign key(current_version_id) references public.furnishing_room_package_versions(id) on delete set null;
create table public.furnishing_room_package_items(
  id uuid primary key default gen_random_uuid(), room_package_version_id uuid not null references public.furnishing_room_package_versions(id) on delete cascade,
  requirement_key text not null, category text not null, recommended_product_id uuid references public.furnishing_products(id),
  quantity_rule_id uuid not null references public.furnishing_quantity_rules(id), required boolean not null default true,
  priority text not null default 'essential' check(priority in('essential','recommended','optional')),
  substitution_policy text not null default 'allowed' check(substitution_policy in('allowed','approval_required','not_allowed')),
  sort_order integer not null check(sort_order>=0), unique(room_package_version_id,requirement_key), unique(room_package_version_id,sort_order)
);

alter table public.furnishing_packages
  add column if not exists workspace_id uuid references public.owners(id),
  add column if not exists tier text check(tier is null or tier in('essential','elevated','luxury','custom')),
  add column if not exists lifecycle_status text not null default 'draft' check(lifecycle_status in('draft','approved','deprecated','archived')),
  add column if not exists current_version_id uuid;
create table public.furnishing_package_versions(
  id uuid primary key default gen_random_uuid(), furnishing_package_id uuid not null references public.furnishing_packages(id) on delete cascade,
  version_number integer not null check(version_number>0), lifecycle_status text not null default 'draft' check(lifecycle_status in('draft','approved','superseded')),
  target_property_type text, estimated_budget_low_minor bigint check(estimated_budget_low_minor is null or estimated_budget_low_minor>=0),
  estimated_budget_high_minor bigint check(estimated_budget_high_minor is null or estimated_budget_high_minor>=0),
  currency text not null default 'USD' check(currency ~ '^[A-Z]{3}$'), created_at timestamptz not null default now(), approved_at timestamptz,
  unique(furnishing_package_id,version_number), check(estimated_budget_high_minor is null or estimated_budget_low_minor is null or estimated_budget_high_minor>=estimated_budget_low_minor)
);
alter table public.furnishing_packages add constraint furnishing_packages_current_version_fkey
  foreign key(current_version_id) references public.furnishing_package_versions(id) on delete set null;
create table public.furnishing_package_room_composition(
  id uuid primary key default gen_random_uuid(), furnishing_package_version_id uuid not null references public.furnishing_package_versions(id) on delete cascade,
  room_package_version_id uuid not null references public.furnishing_room_package_versions(id), room_type text not null,
  quantity_rule_id uuid not null references public.furnishing_quantity_rules(id), sort_order integer not null check(sort_order>=0),
  unique(furnishing_package_version_id,room_package_version_id,room_type)
);

create table public.furnishing_plans(
  id uuid primary key default gen_random_uuid(), project_id uuid not null references public.furnishing_projects(id) on delete cascade,
  version_number integer not null check(version_number>0), based_on_plan_id uuid references public.furnishing_plans(id),
  furnishing_package_version_id uuid references public.furnishing_package_versions(id),
  status text not null default 'draft' check(status in('draft','awaiting_approval','approved','superseded')),
  estimated_subtotal_minor bigint not null default 0 check(estimated_subtotal_minor>=0),
  estimated_shipping_minor bigint not null default 0 check(estimated_shipping_minor>=0),
  estimated_tax_minor bigint not null default 0 check(estimated_tax_minor>=0),
  estimated_total_minor bigint not null default 0 check(estimated_total_minor>=0), currency text not null default 'USD' check(currency ~ '^[A-Z]{3}$'),
  created_by uuid not null references public.profiles(id), approved_by uuid references public.profiles(id),
  created_at timestamptz not null default now(), approved_at timestamptz, unique(project_id,version_number)
);
alter table public.furnishing_projects add column if not exists current_plan_version_id uuid references public.furnishing_plans(id) on delete set null;
create table public.furnishing_product_selections(
  id uuid primary key default gen_random_uuid(), furnishing_plan_id uuid not null references public.furnishing_plans(id) on delete cascade,
  room_id uuid not null references public.furnishing_rooms(id), package_item_id uuid references public.furnishing_room_package_items(id),
  product_id uuid not null references public.furnishing_products(id), selected_offer_id uuid references public.furnishing_product_offers(id),
  quantity_rule_id uuid references public.furnishing_quantity_rules(id), resolved_quantity numeric(12,4) not null check(resolved_quantity>=0),
  estimated_unit_price_minor bigint check(estimated_unit_price_minor is null or estimated_unit_price_minor>=0),
  estimated_total_minor bigint check(estimated_total_minor is null or estimated_total_minor>=0), currency text not null default 'USD' check(currency ~ '^[A-Z]{3}$'),
  price_observed_at timestamptz, selection_source text not null check(selection_source in('package','manual','substitution','existing_inventory')),
  selection_status text not null default 'recommended' check(selection_status in('recommended','selected','approved','rejected','replaced')),
  required boolean not null default true, notes text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.furnishing_budgets(
  id uuid primary key default gen_random_uuid(), project_id uuid not null unique references public.furnishing_projects(id) on delete cascade,
  target_amount_minor bigint not null check(target_amount_minor>=0), currency text not null default 'USD' check(currency ~ '^[A-Z]{3}$'),
  contingency_basis_points integer check(contingency_basis_points is null or contingency_basis_points between 0 and 10000),
  status text not null default 'draft' check(status in('draft','approved','locked')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.furnishing_procurement_items(
  id uuid primary key default gen_random_uuid(), project_id uuid not null references public.furnishing_projects(id) on delete cascade,
  product_selection_id uuid not null references public.furnishing_product_selections(id), product_id uuid not null references public.furnishing_products(id),
  product_offer_id uuid references public.furnishing_product_offers(id), ordered_quantity numeric(12,4) not null check(ordered_quantity>0),
  unit_price_paid_minor bigint not null check(unit_price_paid_minor>=0), subtotal_paid_minor bigint not null check(subtotal_paid_minor>=0),
  currency text not null default 'USD' check(currency ~ '^[A-Z]{3}$'), status text not null default 'not_ordered'
    check(status in('not_ordered','ready_to_order','ordered','partially_shipped','shipped','delivered','cancelled','returned')),
  ordered_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(product_selection_id)
);
alter table public.furnishing_procurement_orders
  add column if not exists retailer_id uuid references public.furnishing_retailers(id),
  add column if not exists external_order_id text,
  add column if not exists subtotal_minor bigint check(subtotal_minor is null or subtotal_minor>=0),
  add column if not exists shipping_minor bigint check(shipping_minor is null or shipping_minor>=0),
  add column if not exists tax_minor bigint check(tax_minor is null or tax_minor>=0),
  add column if not exists total_minor bigint check(total_minor is null or total_minor>=0),
  add column if not exists currency text not null default 'USD' check(currency ~ '^[A-Z]{3}$'),
  add column if not exists placed_at timestamptz;
create table public.furnishing_order_items(
  order_id uuid not null references public.furnishing_procurement_orders(id) on delete cascade,
  procurement_item_id uuid not null references public.furnishing_procurement_items(id),
  primary key(order_id,procurement_item_id)
);
create table public.furnishing_shipments(
  id uuid primary key default gen_random_uuid(), order_id uuid not null references public.furnishing_procurement_orders(id) on delete cascade,
  carrier text, tracking_number text, tracking_url text,
  status text not null default 'pending' check(status in('pending','shipped','in_transit','out_for_delivery','delivered','delayed','exception')),
  estimated_delivery_at timestamptz, delivered_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.furnishing_receiving_records(
  id uuid primary key default gen_random_uuid(), procurement_item_id uuid not null references public.furnishing_procurement_items(id) on delete cascade,
  quantity_received numeric(12,4) not null check(quantity_received>0),
  condition text not null check(condition in('good','damaged','missing_parts','wrong_item','other')),
  notes text, media_asset_ids uuid[] not null default '{}', received_by uuid not null references public.profiles(id),
  received_at timestamptz not null default now()
);

create index furnishing_projects_workspace_lifecycle_idx on public.furnishing_projects(workspace_id,lifecycle_status,updated_at desc);
create index furnishing_rooms_project_order_idx on public.furnishing_rooms(project_id,sort_order);
create index furnishing_products_workspace_category_idx on public.furnishing_products(workspace_id,category,status);
create index furnishing_offers_product_status_idx on public.furnishing_product_offers(product_id,status,availability);
create index furnishing_selections_plan_room_idx on public.furnishing_product_selections(furnishing_plan_id,room_id);
create index furnishing_procurement_items_project_status_idx on public.furnishing_procurement_items(project_id,status);

alter table public.property_furnishing_profiles enable row level security;
alter table public.furnishing_rooms enable row level security;
alter table public.furnishing_retailers enable row level security;
alter table public.furnishing_products enable row level security;
alter table public.furnishing_product_offers enable row level security;
alter table public.furnishing_quantity_rules enable row level security;
alter table public.furnishing_room_packages enable row level security;
alter table public.furnishing_room_package_versions enable row level security;
alter table public.furnishing_room_package_items enable row level security;
alter table public.furnishing_package_versions enable row level security;
alter table public.furnishing_package_room_composition enable row level security;
alter table public.furnishing_plans enable row level security;
alter table public.furnishing_product_selections enable row level security;
alter table public.furnishing_budgets enable row level security;
alter table public.furnishing_procurement_items enable row level security;
alter table public.furnishing_order_items enable row level security;
alter table public.furnishing_shipments enable row level security;
alter table public.furnishing_receiving_records enable row level security;

drop policy if exists "Admins manage furnishing projects" on public.furnishing_projects;
create policy "Workspace members read furnishing projects" on public.furnishing_projects for select to authenticated
  using(public.active_workspace_role(workspace_id)is not null or public.is_admin());
create policy "Workspace editors manage furnishing projects" on public.furnishing_projects for all to authenticated
  using(public.active_workspace_role(workspace_id)in('owner','administrator','operator','contributor')or public.is_admin())
  with check(public.active_workspace_role(workspace_id)in('owner','administrator','operator','contributor')or public.is_admin());
create policy "Workspace members read property furnishing profiles" on public.property_furnishing_profiles for select to authenticated
  using(public.can_access_workspace_property(property_id)or public.is_admin());
create policy "Workspace members read furnishing rooms" on public.furnishing_rooms for select to authenticated
  using(exists(select 1 from public.furnishing_projects p where p.id=project_id and(public.active_workspace_role(p.workspace_id)is not null or public.is_admin())));
create policy "Workspace members read furnishing plans" on public.furnishing_plans for select to authenticated
  using(exists(select 1 from public.furnishing_projects p where p.id=project_id and(public.active_workspace_role(p.workspace_id)is not null or public.is_admin())));
create policy "Workspace members read furnishing selections" on public.furnishing_product_selections for select to authenticated
  using(exists(select 1 from public.furnishing_plans plan join public.furnishing_projects p on p.id=plan.project_id where plan.id=furnishing_plan_id and(public.active_workspace_role(p.workspace_id)is not null or public.is_admin())));
create policy "Workspace members read furnishing budgets" on public.furnishing_budgets for select to authenticated
  using(exists(select 1 from public.furnishing_projects p where p.id=project_id and(public.active_workspace_role(p.workspace_id)is not null or public.is_admin())));
create policy "Members read scoped furnishing products" on public.furnishing_products for select to authenticated
  using(scope='platform'or public.active_workspace_role(workspace_id)is not null or public.is_admin());
create policy "Members read furnishing offers" on public.furnishing_product_offers for select to authenticated
  using(exists(select 1 from public.furnishing_products p where p.id=product_id and(p.scope='platform'or public.active_workspace_role(p.workspace_id)is not null or public.is_admin())));
create policy "Members read furnishing retailers" on public.furnishing_retailers for select to authenticated using(true);
create policy "Members read quantity rules" on public.furnishing_quantity_rules for select to authenticated
  using(workspace_id is null or public.active_workspace_role(workspace_id)is not null or public.is_admin());

commit;
