-- FS-002: governed operational product catalog.
begin;

alter table public.furnishing_products drop constraint furnishing_products_status_check;
alter table public.furnishing_products add constraint furnishing_products_status_check
  check(status in('draft','in_review','approved','discontinued','archived'));

create table public.furnishing_product_categories(
  id uuid primary key default gen_random_uuid(), parent_id uuid references public.furnishing_product_categories(id),
  name text not null, slug text not null unique, group_name text not null,
  status text not null default 'active' check(status in('active','inactive','archived')),
  sort_order integer not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.furnishing_room_types(
  id text primary key, name text not null unique, status text not null default 'active' check(status in('active','inactive')),
  sort_order integer not null default 0
);

alter table public.furnishing_products
  add column if not exists category_id uuid references public.furnishing_product_categories(id),
  add column if not exists color text, add column if not exists material text,
  add column if not exists finish text, add column if not exists dimensions jsonb not null default '{}',
  add column if not exists weight jsonb not null default '{}',
  add column if not exists assembly_required boolean,
  add column if not exists indoor_outdoor text check(indoor_outdoor is null or indoor_outdoor in('indoor','outdoor','both')),
  add column if not exists hospitality_attributes text[] not null default '{}',
  add column if not exists style_tags text[] not null default '{}',
  add column if not exists durability_type text not null default 'durable' check(durability_type in('durable','consumable')),
  add column if not exists replenishment_type text not null default 'one_time' check(replenishment_type in('one_time','recurring')),
  add column if not exists purchase_unit text not null default 'each',
  add column if not exists units_per_purchase integer not null default 1 check(units_per_purchase>0),
  add column if not exists usable_unit text not null default 'item',
  add column if not exists family_product_id uuid references public.furnishing_products(id),
  add column if not exists source_type text, add column if not exists source_import_id uuid,
  add column if not exists source_sheet text, add column if not exists source_row integer,
  add column if not exists imported_at timestamptz;

create table public.furnishing_product_room_compatibility(
  product_id uuid not null references public.furnishing_products(id) on delete cascade,
  room_type_id text not null references public.furnishing_room_types(id),
  primary key(product_id,room_type_id)
);
create table public.furnishing_product_media(
  id uuid primary key default gen_random_uuid(), product_id uuid not null references public.furnishing_products(id) on delete cascade,
  storage_path text, source_url text, alt_text text, media_kind text not null default 'product'
    check(media_kind in('product','packaging','installed_reference')),
  is_primary boolean not null default false, sort_order integer not null default 0,
  created_by uuid not null references public.profiles(id), created_at timestamptz not null default now(),
  check(storage_path is not null or source_url is not null)
);
create unique index furnishing_product_primary_media_idx on public.furnishing_product_media(product_id) where is_primary;
create table public.furnishing_product_specifications(
  product_id uuid not null references public.furnishing_products(id) on delete cascade,
  specification_key text not null, value_text text, value_number numeric(14,4), unit text,
  primary key(product_id,specification_key), check((value_text is not null)::integer+(value_number is not null)::integer=1)
);

alter table public.furnishing_retailers
  add column if not exists domain text unique,
  add column if not exists logo_media_id uuid,
  add column if not exists notes text;
alter table public.furnishing_product_offers
  add column if not exists notes text,
  add column if not exists source_type text,
  add column if not exists source_import_id uuid,
  add column if not exists source_sheet text,
  add column if not exists source_row integer,
  add column if not exists imported_at timestamptz;
alter table public.furnishing_products add column if not exists preferred_offer_id uuid references public.furnishing_product_offers(id) on delete set null;
create unique index furnishing_offer_retailer_identifier_idx
  on public.furnishing_product_offers(product_id,retailer_id,retailer_product_id)
  where retailer_product_id is not null and status<>'archived';

create table public.furnishing_catalog_imports(
  id uuid primary key default gen_random_uuid(), workspace_id uuid references public.owners(id),
  source_type text not null default 'xlsx' check(source_type='xlsx'), source_filename text not null,
  status text not null default 'uploading' check(status in('uploading','parsing','mapping','review_required','importing','partial_success','failed','complete')),
  column_mapping jsonb not null default '{}', total_rows integer not null default 0,
  created_count integer not null default 0, matched_count integer not null default 0,
  skipped_count integer not null default 0, failed_count integer not null default 0,
  error_code text, created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(), completed_at timestamptz
);
alter table public.furnishing_products add constraint furnishing_products_source_import_fkey
  foreign key(source_import_id) references public.furnishing_catalog_imports(id) on delete set null;
alter table public.furnishing_product_offers add constraint furnishing_offers_source_import_fkey
  foreign key(source_import_id) references public.furnishing_catalog_imports(id) on delete set null;
create table public.furnishing_catalog_import_items(
  id uuid primary key default gen_random_uuid(), import_id uuid not null references public.furnishing_catalog_imports(id) on delete cascade,
  source_sheet text not null, source_row integer not null check(source_row>0), source_item text not null,
  proposed_name text not null, proposed_category_id uuid references public.furnishing_product_categories(id),
  proposed_room_type_id text references public.furnishing_room_types(id), proposed_retailer_id uuid references public.furnishing_retailers(id),
  proposed_product_url text, proposed_price_minor bigint check(proposed_price_minor is null or proposed_price_minor>=0),
  currency text not null default 'USD' check(currency ~ '^[A-Z]{3}$'), duplicate_product_id uuid references public.furnishing_products(id),
  review_action text not null default 'review' check(review_action in('review','create','match','skip')),
  matched_product_id uuid references public.furnishing_products(id), validation_issues text[] not null default '{}',
  raw_source jsonb not null default '{}', imported_product_id uuid references public.furnishing_products(id),
  imported_offer_id uuid references public.furnishing_product_offers(id), unique(import_id,source_sheet,source_row)
);
create table public.furnishing_catalog_activity(
  id uuid primary key default gen_random_uuid(), workspace_id uuid references public.owners(id),
  product_id uuid references public.furnishing_products(id) on delete set null,
  offer_id uuid references public.furnishing_product_offers(id) on delete set null,
  import_id uuid references public.furnishing_catalog_imports(id) on delete set null,
  event_type text not null, actor_id uuid not null references public.profiles(id),
  metadata jsonb not null default '{}', occurred_at timestamptz not null default now()
);

create index furnishing_products_catalog_filter_idx on public.furnishing_products(status,category_id,updated_at desc);
create index furnishing_products_name_search_idx on public.furnishing_products(lower(name));
create index furnishing_product_rooms_room_idx on public.furnishing_product_room_compatibility(room_type_id,product_id);
create index furnishing_import_items_review_idx on public.furnishing_catalog_import_items(import_id,review_action);

alter table public.furnishing_product_categories enable row level security;
alter table public.furnishing_room_types enable row level security;
alter table public.furnishing_product_room_compatibility enable row level security;
alter table public.furnishing_product_media enable row level security;
alter table public.furnishing_product_specifications enable row level security;
alter table public.furnishing_catalog_imports enable row level security;
alter table public.furnishing_catalog_import_items enable row level security;
alter table public.furnishing_catalog_activity enable row level security;

create policy "Catalog taxonomy is readable internally" on public.furnishing_product_categories for select to authenticated using(true);
create policy "Catalog room types are readable internally" on public.furnishing_room_types for select to authenticated using(true);
create policy "Members read product room compatibility" on public.furnishing_product_room_compatibility for select to authenticated
  using(exists(select 1 from public.furnishing_products p where p.id=product_id and(p.scope='platform'or public.active_workspace_role(p.workspace_id)is not null or public.is_admin())));
create policy "Members read product media" on public.furnishing_product_media for select to authenticated
  using(exists(select 1 from public.furnishing_products p where p.id=product_id and(p.scope='platform'or public.active_workspace_role(p.workspace_id)is not null or public.is_admin())));
create policy "Members read product specifications" on public.furnishing_product_specifications for select to authenticated
  using(exists(select 1 from public.furnishing_products p where p.id=product_id and(p.scope='platform'or public.active_workspace_role(p.workspace_id)is not null or public.is_admin())));
create policy "Workspace members read catalog imports" on public.furnishing_catalog_imports for select to authenticated
  using(public.active_workspace_role(workspace_id)is not null or public.is_admin());
create policy "Workspace members read catalog import items" on public.furnishing_catalog_import_items for select to authenticated
  using(exists(select 1 from public.furnishing_catalog_imports i where i.id=import_id and(public.active_workspace_role(i.workspace_id)is not null or public.is_admin())));
create policy "Admins read catalog activity" on public.furnishing_catalog_activity for select to authenticated using(public.is_admin());

insert into public.furnishing_room_types(id,name,sort_order) values
('living_room','Living Room',10),('bedroom','Bedroom',20),('primary_bedroom','Primary Bedroom',30),
('guest_room','Guest Room',40),('bathroom','Bathroom',50),('kitchen','Kitchen',60),('dining_room','Dining Room',70),
('office','Office',80),('outdoor','Outdoor',90),('entry','Entry',100),('laundry','Laundry',110),('garage','Garage',120),('other','Other',999)
on conflict(id) do update set name=excluded.name,sort_order=excluded.sort_order;

insert into public.furnishing_product_categories(name,slug,group_name,sort_order) values
('Seating','seating','Furniture',10),('Beds & Frames','beds-frames','Furniture',20),('Mattresses','mattresses','Furniture',30),
('Nightstands','nightstands','Furniture',40),('Dressers','dressers','Furniture',50),('Desks','desks','Furniture',60),
('Tables','tables','Furniture',70),('TV Stands','tv-stands','Furniture',80),('Dining Furniture','dining-furniture','Furniture',90),
('Outdoor Furniture','outdoor-furniture','Furniture',100),('Table Lamps','table-lamps','Lighting',110),('Floor Lamps','floor-lamps','Lighting',120),
('Task Lighting','task-lighting','Lighting',130),('Sheets','sheets','Textiles',140),('Comforters','comforters','Textiles',150),
('Pillows','pillows','Textiles',160),('Towels','towels','Textiles',170),('Bath Mats','bath-mats','Textiles',180),
('Curtains','curtains','Textiles',190),('Rugs','rugs','Textiles',200),('Televisions','televisions','Electronics',210),
('TV Mounts','tv-mounts','Electronics',220),('Small Electronics','small-electronics','Electronics',230),
('Cookware','cookware','Kitchen',240),('Tableware','tableware','Kitchen',250),('Drinkware','drinkware','Kitchen',260),
('Flatware','flatware','Kitchen',270),('Small Appliances','small-appliances','Kitchen',280),('Food Preparation','food-preparation','Kitchen',290),
('Kitchen Organization','kitchen-organization','Kitchen',300),('Bathroom Accessories','bathroom-accessories','Bath',310),
('Shower','shower','Bath',320),('Hair Care','hair-care','Bath',330),('Dispensers','dispensers','Bath',340),
('Cleaning Equipment','cleaning-equipment','Cleaning & Operations',350),('Cleaning Supplies','cleaning-supplies','Cleaning & Operations',360),
('Trash','trash','Cleaning & Operations',370),('Laundry','laundry','Cleaning & Operations',380),('Paper Goods','paper-goods','Cleaning & Operations',390),
('Coffee & Beverage','coffee-beverage','Amenities',400),('Guest Supplies','guest-supplies','Amenities',410),('Hangers','hangers','Amenities',420),
('Ironing','ironing','Amenities',430),('Convenience Items','convenience-items','Amenities',440),('First Aid','first-aid','Safety',450),
('Fire Safety','fire-safety','Safety',460),('Emergency Supplies','emergency-supplies','Safety',470),('Wall Art','wall-art','Decor',480),
('Plants','plants','Decor',490),('Decorative Objects','decorative-objects','Decor',500),('Mirrors','mirrors','Decor',510),('Custom','custom','Other',999)
on conflict(slug) do update set name=excluded.name,group_name=excluded.group_name,sort_order=excluded.sort_order;

insert into public.furnishing_retailers(name,website_url,domain,status,supports_affiliate_links) values
('Amazon','https://www.amazon.com','amazon.com','active',true),('Walmart','https://www.walmart.com','walmart.com','active',true),
('Lowe''s','https://www.lowes.com','lowes.com','active',true),('Costco','https://www.costco.com','costco.com','active',true),
('Kohl''s','https://www.kohls.com','kohls.com','active',true),('Wayfair','https://www.wayfair.com','wayfair.com','active',true),
('Target','https://www.target.com','target.com','active',true)
on conflict(name) do update set website_url=excluded.website_url,domain=excluded.domain,status=excluded.status,supports_affiliate_links=excluded.supports_affiliate_links;

commit;
