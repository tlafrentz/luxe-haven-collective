create table public.furnishing_packages(
 id uuid primary key default gen_random_uuid(), name text not null, description text not null default '', property_type text not null, style text not null,
 budget_tier text not null check(budget_tier in('essential','standard','premium','luxury')), starting_budget numeric(12,2) not null default 0,
 status text not null default 'draft' check(status in('draft','under_review','published','archived')), cover_image text, version integer not null default 1,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.furnishing_package_variants(
 id uuid primary key default gen_random_uuid(), package_id uuid not null references public.furnishing_packages(id) on delete cascade, name text not null,
 bedroom_count integer, guest_capacity integer, estimated_budget numeric(12,2) not null default 0, estimated_install_days integer not null default 1,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(package_id,name)
);
create table public.furnishing_package_rooms(
 id uuid primary key default gen_random_uuid(), variant_id uuid not null references public.furnishing_package_variants(id) on delete cascade,
 name text not null, position integer not null default 0, unique(variant_id,name)
);
create table public.furnishing_package_items(
 id uuid primary key default gen_random_uuid(), room_id uuid not null references public.furnishing_package_rooms(id) on delete cascade, name text not null,
 category text not null, required boolean not null default true, quantity numeric(10,2) not null default 1, notes text not null default '', position integer not null default 0
);
create table public.furnishing_product_options(
 id uuid primary key default gen_random_uuid(), item_id uuid not null references public.furnishing_package_items(id) on delete cascade, vendor text not null,
 product_name text not null, product_url text, affiliate_url text, affiliate_program text, current_price numeric(12,2), currency text not null default 'USD',
 availability text not null default 'unknown', lead_time text, dimensions text, material text, color text, warranty text, image_url text,
 preferred boolean not null default false, commission_disclosure_required boolean not null default false, last_verified_at timestamptz, archived_at timestamptz
);
create table public.furnishing_projects(
 id uuid primary key default gen_random_uuid(), property_id uuid not null references public.properties(id), name text not null, owner_name text,
 project_lead text, target_install_date date, status text not null default 'draft' check(status in('draft','planned','in_progress','on_hold','completed','archived')),
 phase text not null default 'setup' check(phase in('setup','design','selections','procurement','installation','punch_list','complete')),
 package_id uuid references public.furnishing_packages(id), variant_id uuid references public.furnishing_package_variants(id), package_snapshot jsonb not null default '{}'::jsonb,
 scope jsonb not null default '[]'::jsonb, budget jsonb not null default '{}'::jsonb, selections jsonb not null default '[]'::jsonb,
 progress integer not null default 0 check(progress between 0 and 100), created_by uuid references public.profiles(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.furnishing_procurement_orders(
 id uuid primary key default gen_random_uuid(), project_id uuid not null references public.furnishing_projects(id) on delete cascade, po_number text not null unique,
 vendor text not null, status text not null default 'draft' check(status in('draft','ready_to_order','ordered','partially_fulfilled','shipped','delivered','cancelled','returned','refunded')),
 items jsonb not null default '[]'::jsonb, total numeric(12,2) not null default 0, order_date date, estimated_delivery date, actual_delivery date,
 tracking_number text, receipt_url text, notes text not null default '', affiliate_source text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.furnishing_installation_tasks(
 id uuid primary key default gen_random_uuid(), project_id uuid not null references public.furnishing_projects(id) on delete cascade, room text not null,
 item_name text not null, quantity_expected numeric(10,2) not null default 1, quantity_installed numeric(10,2) not null default 0,
 status text not null default 'pending' check(status in('pending','ready','installed','damaged','missing','incorrect','deferred','not_required')),
 condition text, photo_url text, installer text, notes text not null default '', scheduled_at timestamptz, updated_at timestamptz not null default now()
);
create table public.furnishing_punch_list_items(
 id uuid primary key default gen_random_uuid(), project_id uuid not null references public.furnishing_projects(id) on delete cascade, room text not null,
 issue text not null, severity text not null default 'normal', owner_name text, target_resolution date, status text not null default 'open', evidence_url text,
 resolution text, exception_authorized_by uuid references public.profiles(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.furnishing_activity(
 id uuid primary key default gen_random_uuid(), project_id uuid references public.furnishing_projects(id) on delete cascade, event_type text not null,
 summary text not null, metadata jsonb not null default '{}'::jsonb, actor_id uuid references public.profiles(id), occurred_at timestamptz not null default now()
);
create index furnishing_projects_property_idx on public.furnishing_projects(property_id,status,phase);
create index furnishing_orders_project_idx on public.furnishing_procurement_orders(project_id,status);
create index furnishing_install_project_idx on public.furnishing_installation_tasks(project_id,status);
alter table public.furnishing_packages enable row level security;
alter table public.furnishing_package_variants enable row level security;
alter table public.furnishing_package_rooms enable row level security;
alter table public.furnishing_package_items enable row level security;
alter table public.furnishing_product_options enable row level security;
alter table public.furnishing_projects enable row level security;
alter table public.furnishing_procurement_orders enable row level security;
alter table public.furnishing_installation_tasks enable row level security;
alter table public.furnishing_punch_list_items enable row level security;
alter table public.furnishing_activity enable row level security;
create policy "Admins manage furnishing packages" on public.furnishing_packages for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy "Admins manage furnishing variants" on public.furnishing_package_variants for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy "Admins manage furnishing rooms" on public.furnishing_package_rooms for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy "Admins manage furnishing items" on public.furnishing_package_items for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy "Admins manage furnishing products" on public.furnishing_product_options for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy "Admins manage furnishing projects" on public.furnishing_projects for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy "Admins manage furnishing orders" on public.furnishing_procurement_orders for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy "Admins manage furnishing installs" on public.furnishing_installation_tasks for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy "Admins manage furnishing punch list" on public.furnishing_punch_list_items for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy "Admins read furnishing activity" on public.furnishing_activity for select to authenticated using(public.is_admin());

with p as (insert into public.furnishing_packages(name,description,property_type,style,budget_tier,starting_budget,status)
 values ('Modern Apartment','A complete hospitality collection for modern apartments.','apartment','modern','standard',17450,'published'),
 ('Mountain Cabin','Durable warm furnishings for four-season cabin stays.','cabin','mountain','premium',19850,'published'),
 ('Beach House','Light, resilient pieces for coastal hospitality properties.','house','coastal','premium',21250,'published') returning id,name),
v as (insert into public.furnishing_package_variants(package_id,name,bedroom_count,guest_capacity,estimated_budget,estimated_install_days)
 select id,'2 Bedroom',2,6,case when name='Modern Apartment' then 17450 when name='Mountain Cabin' then 19850 else 21250 end,2 from p returning id,package_id),
r as (insert into public.furnishing_package_rooms(variant_id,name,position) select id,x.name,x.pos from v cross join (values('Living Room',1),('Dining Room',2),('Kitchen',3),('Primary Bedroom',4),('Guest Bedroom',5)) x(name,pos) returning id,name)
insert into public.furnishing_package_items(room_id,name,category,required,quantity,position)
select id,case name when 'Living Room' then 'Sofa' when 'Dining Room' then 'Dining table' when 'Kitchen' then 'Cookware set' when 'Primary Bedroom' then 'King bed frame' else 'Queen bed frame' end,
case name when 'Kitchen' then 'Kitchenware' when 'Primary Bedroom' then 'Bed and bath' when 'Guest Bedroom' then 'Bed and bath' else 'Furniture' end,true,1,1 from r;
