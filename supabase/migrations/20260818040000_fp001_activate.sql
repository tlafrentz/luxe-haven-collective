-- FP-001C Activate. Properties, data-connection status, and HPM baseline are
-- lightweight program-scoped capture (admin-facilitated, no partner login and
-- no real owners/properties workspace this pass) — never a duplicate of the
-- canonical properties table or the live HPM lifecycle engine.
create table public.founding_partner_properties(
  id uuid primary key default gen_random_uuid(),
  customer_program_id uuid not null references public.customer_programs(id) on delete restrict,
  name text not null, address text, property_type text, unit_count integer,
  notes text not null default '', created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create table public.founding_partner_data_connections(
  id uuid primary key default gen_random_uuid(),
  customer_program_id uuid not null references public.customer_programs(id) on delete restrict,
  source_type text not null check(source_type in('pms','booking_channels','market_data','financial_data')),
  status text not null default 'missing' check(status in('connected','partial','missing','not_required')),
  notes text not null default '', updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now(),
  unique(customer_program_id,source_type)
);
create table public.founding_partner_baseline(
  id uuid primary key default gen_random_uuid(),
  customer_program_id uuid not null references public.customer_programs(id) on delete restrict,
  pillar text not null check(pillar in('investment','financial','revenue','operations','guest-experience','risk','growth')),
  status text not null default 'insufficient_data' check(status in('measured','partial','insufficient_data')),
  data_completeness_percent integer not null default 0 check(data_completeness_percent between 0 and 100),
  notes text not null default '', assessed_by uuid references public.profiles(id), assessed_at timestamptz,
  unique(customer_program_id,pillar)
);

do $$
declare v_constraint text;
begin
  for v_constraint in
    select c.conname from pg_catalog.pg_constraint c
    where c.conrelid='public.founding_partner_events'::regclass and c.contype='c'
  loop
    execute format('alter table public.founding_partner_events drop constraint %I',v_constraint);
  end loop;
end$$;
alter table public.founding_partner_events add constraint founding_partner_events_event_name_check
  check(event_name in('founding_partner_page_viewed','founding_partner_cta_clicked','founding_partner_application_started','founding_partner_application_completed','founding_partner_qualified','founding_partner_discovery_completed','founding_partner_accepted','founding_partner_onboarding_completed','founding_partner_baseline_completed'));

create trigger customer_program_audit_events_append_only before update or delete on public.customer_program_audit_events
  for each row execute function public.reject_append_only_change();

alter table public.founding_partner_properties enable row level security;
alter table public.founding_partner_data_connections enable row level security;
alter table public.founding_partner_baseline enable row level security;
create policy "admins manage founding properties" on public.founding_partner_properties for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy "admins manage founding data connections" on public.founding_partner_data_connections for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy "admins manage founding baseline" on public.founding_partner_baseline for all to authenticated using(public.is_admin()) with check(public.is_admin());
revoke all on public.founding_partner_properties,public.founding_partner_data_connections,public.founding_partner_baseline from anon;
grant select,insert,update,delete on public.founding_partner_properties to authenticated;
grant select,insert,update on public.founding_partner_data_connections,public.founding_partner_baseline to authenticated;
