create table public.commerce_offer_definitions(
 product_id text primary key references public.commerce_products(id) on delete cascade,
 offer_type text not null check(offer_type in('digital_product','configured_product','fixed_scope_service','consulting_engagement','subscription')),
 fulfillment_model text not null check(fulfillment_model in('immediate_access','customer_configured','luxe_haven_delivered','collaborative_delivery','recurring_service')),
 payment_model text not null check(payment_model in('free','one_time','deposit_balance','installments','subscription','invoice','proposal_required')),
 specialist_workspace text, owner_name text, catalog_status text not null default 'draft' check(catalog_status in('draft','under_review','published','paused','archived')),
 intended_customer text, best_fit text, prerequisites text, included_outcomes jsonb not null default '[]', exclusions jsonb not null default '[]', expected_time_to_value text,
 cover_image text, gallery jsonb not null default '[]', featured boolean not null default false, terms jsonb not null default '{}', available_from timestamptz, available_to timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.commerce_offer_variants(
 id uuid primary key default gen_random_uuid(), product_id text not null references public.commerce_products(id) on delete cascade, name text not null, sku text unique not null,
 description text not null default '', price_override_minor bigint, currency text not null default 'USD', required_intake_fields jsonb not null default '[]', availability text not null default 'available',
 fulfillment_duration text, status text not null default 'draft', sort_order integer not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.commerce_offer_deliverables(
 id uuid primary key default gen_random_uuid(), product_id text not null references public.commerce_products(id) on delete cascade, variant_id uuid references public.commerce_offer_variants(id) on delete cascade,
 name text not null, description text not null default '', quantity integer not null default 1, delivery_method text not null, required boolean not null default true,
 fulfilled_by text not null, expected_timing text, sort_order integer not null default 0
);
create table public.commerce_catalog_addons(
 id uuid primary key default gen_random_uuid(), name text not null, description text not null default '', linked_product_ids text[] not null default '{}', linked_category_ids text[] not null default '{}',
 amount_minor bigint not null default 0, currency text not null default 'USD', payment_model text not null default 'one_time', selection_rule text not null default 'optional', selection_limit integer,
 dependencies jsonb not null default '[]', fulfillment_effect jsonb not null default '{}', activation_effect jsonb not null default '{}', status text not null default 'active', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.commerce_bundles(
 id uuid primary key default gen_random_uuid(), name text not null, slug text unique not null, description text not null default '', amount_minor bigint not null default 0,
 currency text not null default 'USD', status text not null default 'draft', storefront_content jsonb not null default '{}', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.commerce_bundle_items(
 id uuid primary key default gen_random_uuid(), bundle_id uuid not null references public.commerce_bundles(id) on delete cascade, product_id text not null references public.commerce_products(id),
 variant_id uuid references public.commerce_offer_variants(id), activation_order integer not null default 0, dependencies jsonb not null default '[]', snapshot jsonb not null default '{}'
);
create table public.commerce_checkout_flows(
 id uuid primary key default gen_random_uuid(), product_id text unique references public.commerce_products(id) on delete cascade, mode text not null default 'self_service',
 stages jsonb not null default '["offer_selection","variant_selection","addons","customer_information","payment","agreement","confirmation"]', settings jsonb not null default '{}', fields jsonb not null default '[]', updated_at timestamptz not null default now()
);
create table public.commerce_activation_flows(
 id uuid primary key default gen_random_uuid(), product_id text unique references public.commerce_products(id) on delete cascade, name text not null, trigger_type text not null,
 status text not null default 'draft', version integer not null default 1, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.commerce_activation_steps(
 id uuid primary key default gen_random_uuid(), flow_id uuid not null references public.commerce_activation_flows(id) on delete cascade, step_type text not null, name text not null,
 position integer not null, dependencies jsonb not null default '[]', configuration jsonb not null default '{}', manual_owner_required boolean not null default false, retryable boolean not null default true, unique(flow_id,position)
);
create table public.commerce_activation_runs(
 id uuid primary key default gen_random_uuid(), order_id text not null references public.commerce_orders(id), flow_id uuid not null references public.commerce_activation_flows(id),
 idempotency_key text unique not null, status text not null default 'not_started', current_step integer, failure_code text, started_at timestamptz, completed_at timestamptz, created_at timestamptz not null default now()
);
create table public.commerce_activation_step_runs(
 id uuid primary key default gen_random_uuid(), run_id uuid not null references public.commerce_activation_runs(id) on delete cascade, step_id uuid not null references public.commerce_activation_steps(id),
 status text not null default 'not_started', attempts integer not null default 0, assigned_owner text, due_at timestamptz, target_type text, target_id text, failure_code text, updated_at timestamptz not null default now(), unique(run_id,step_id)
);
create table public.commerce_offer_activity(id uuid primary key default gen_random_uuid(),product_id text references public.commerce_products(id) on delete cascade,event_type text not null,summary text not null,actor_id uuid references public.profiles(id),metadata jsonb not null default '{}',occurred_at timestamptz not null default now());
create table public.commerce_catalog_settings(id text primary key default 'default',catalog_name text not null default 'Luxe Haven Offer Catalog',default_currency text not null default 'USD',timezone text not null default 'America/Chicago',date_format text not null default 'MM/DD/YYYY',review_required boolean not null default true,order_comments boolean not null default true,catalog_status text not null default 'live',settings jsonb not null default '{}',updated_at timestamptz not null default now());
alter table public.commerce_orders add column if not exists activation_status text not null default 'not_started',add column if not exists fulfillment_status text not null default 'not_required',add column if not exists internal_owner text,add column if not exists customer_next_action text,add column if not exists internal_next_action text;
create index commerce_offer_definition_status_idx on public.commerce_offer_definitions(catalog_status,offer_type);
create index commerce_activation_run_order_idx on public.commerce_activation_runs(order_id,status);
alter table public.commerce_offer_definitions enable row level security;alter table public.commerce_offer_variants enable row level security;alter table public.commerce_offer_deliverables enable row level security;alter table public.commerce_catalog_addons enable row level security;alter table public.commerce_bundles enable row level security;alter table public.commerce_bundle_items enable row level security;alter table public.commerce_checkout_flows enable row level security;alter table public.commerce_activation_flows enable row level security;alter table public.commerce_activation_steps enable row level security;alter table public.commerce_activation_runs enable row level security;alter table public.commerce_activation_step_runs enable row level security;alter table public.commerce_offer_activity enable row level security;alter table public.commerce_catalog_settings enable row level security;
create policy "Admins manage offer definitions" on public.commerce_offer_definitions for all to authenticated using(public.is_admin())with check(public.is_admin());create policy "Admins manage offer variants" on public.commerce_offer_variants for all to authenticated using(public.is_admin())with check(public.is_admin());create policy "Admins manage offer deliverables" on public.commerce_offer_deliverables for all to authenticated using(public.is_admin())with check(public.is_admin());create policy "Admins manage catalog addons" on public.commerce_catalog_addons for all to authenticated using(public.is_admin())with check(public.is_admin());create policy "Admins manage bundles" on public.commerce_bundles for all to authenticated using(public.is_admin())with check(public.is_admin());create policy "Admins manage bundle items" on public.commerce_bundle_items for all to authenticated using(public.is_admin())with check(public.is_admin());create policy "Admins manage checkout flows" on public.commerce_checkout_flows for all to authenticated using(public.is_admin())with check(public.is_admin());create policy "Admins manage activation flows" on public.commerce_activation_flows for all to authenticated using(public.is_admin())with check(public.is_admin());create policy "Admins manage activation steps" on public.commerce_activation_steps for all to authenticated using(public.is_admin())with check(public.is_admin());create policy "Admins manage activation runs" on public.commerce_activation_runs for all to authenticated using(public.is_admin())with check(public.is_admin());create policy "Admins manage activation step runs" on public.commerce_activation_step_runs for all to authenticated using(public.is_admin())with check(public.is_admin());create policy "Admins read offer activity" on public.commerce_offer_activity for select to authenticated using(public.is_admin());create policy "Admins manage catalog settings" on public.commerce_catalog_settings for all to authenticated using(public.is_admin())with check(public.is_admin());
insert into public.commerce_catalog_settings(id)values('default')on conflict(id)do nothing;
insert into public.commerce_offer_definitions(product_id,offer_type,fulfillment_model,payment_model,specialist_workspace,catalog_status,owner_name,intended_customer,best_fit,expected_time_to_value)
select id,case when product_type='subscription'then'subscription'when fulfillment_type='digital-download'then'digital_product'when fulfillment_type='service-project'then'fixed_scope_service'else'configured_product'end,
case when fulfillment_type in('digital-download','entitlement-grant')then'immediate_access'when fulfillment_type='service-project'then'luxe_haven_delivered'else'customer_configured'end,
case when product_type='subscription'then'subscription'else'one_time'end,case when slug like'%guidebook%'then'guidebook-studio'when slug like'%furnish%'then'furnishing-studio'else null end,
case status when'active'then'published'when'inactive'then'paused'else status end,'Luxe Haven Operations','Hospitality owners and operators','Customers seeking a governed Luxe Haven outcome','Immediately after activation'
from public.commerce_products on conflict(product_id)do nothing;
