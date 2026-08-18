-- FP-001 Recruit + Qualify. Founding HPM is a program relationship on the
-- canonical commercial customer account, never a parallel customer directory.
alter table public.customer_accounts alter column tenant_id drop not null;
alter table public.customer_accounts drop constraint if exists customer_accounts_account_type_check;
alter table public.customer_accounts add constraint customer_accounts_account_type_check
  check(account_type in('prospect','individual','organization','owner','investor','service_client'));
alter table public.customer_accounts add column if not exists display_name text;
alter table public.customer_accounts add column if not exists primary_email text;
alter table public.customer_accounts add column if not exists lifecycle_stage text not null default 'prospect'
  check(lifecycle_stage in('prospect','applied','qualified','discovery','accepted','onboarding','active','converted','declined','exited'));
create unique index if not exists customer_accounts_primary_email_uidx
  on public.customer_accounts(lower(primary_email)) where primary_email is not null;

create table public.customer_programs(
  id uuid primary key default gen_random_uuid(),
  customer_account_id uuid not null references public.customer_accounts(id) on delete restrict,
  program_type text not null,
  cohort text not null,
  program_status text not null check(program_status in('applied','review','accepted','onboarding','active','day_90_review','completed','exited')),
  partner_identifier text unique,
  accepted_at timestamptz, started_at timestamptz, target_end_at timestamptz,
  next_action text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(customer_account_id,program_type,cohort)
);
create table public.founding_partner_applications(
  id uuid primary key default gen_random_uuid(),
  customer_account_id uuid not null references public.customer_accounts(id) on delete restrict,
  customer_program_id uuid not null unique references public.customer_programs(id) on delete restrict,
  first_name text not null, last_name text not null, email text not null, business_name text not null,
  operating_model text not null, property_count integer not null check(property_count between 0 and 100000),
  years_operating integer not null check(years_operating between 0 and 200), primary_markets text not null,
  twelve_month_goal text not null, primary_difficulty text not null, improvement_area text not null,
  monthly_feedback_consent boolean not null, early_capability_consent boolean not null,
  program_interest text not null, testimonial_consent boolean not null default false,
  submitted_at timestamptz not null default now(), source text not null default 'founding_partners_public'
);
create table public.founding_partner_qualifications(
  id uuid primary key default gen_random_uuid(), customer_program_id uuid not null unique references public.customer_programs(id) on delete restrict,
  growth_orientation text not null default 'unknown', business_seriousness text not null default 'unknown',
  technology_openness text not null default 'unknown', feedback_willingness text not null default 'unknown',
  hpm_problem_fit text not null default 'unknown', learning_value text not null default 'unknown',
  recommendation text not null default 'discuss' check(recommendation in('recommended','discuss','not_fit')),
  notes text not null default '', assessed_by uuid references public.profiles(id), assessed_at timestamptz,
  check(growth_orientation in('strong','moderate','weak','unknown') and business_seriousness in('strong','moderate','weak','unknown') and technology_openness in('strong','moderate','weak','unknown') and feedback_willingness in('strong','moderate','weak','unknown') and hpm_problem_fit in('strong','moderate','weak','unknown') and learning_value in('strong','moderate','weak','unknown'))
);
create table public.founding_partner_discovery(
  id uuid primary key default gen_random_uuid(), customer_program_id uuid not null unique references public.customer_programs(id) on delete restrict,
  business_notes text not null default '', performance_notes text not null default '', systems_notes text not null default '',
  decisions_notes text not null default '', hpm_reaction_notes text not null default '', partnership_fit_notes text not null default '',
  twelve_month_build text not null default '', information_gap_decision text not null default '', tomorrow_question text not null default '',
  outcome text check(outcome in('accept','hold','decline')), rationale text not null default '',
  completed_by uuid references public.profiles(id), completed_at timestamptz
);
create table public.founding_partner_events(
  id uuid primary key default gen_random_uuid(), event_name text not null,
  customer_program_id uuid references public.customer_programs(id) on delete set null,
  safe_context jsonb not null default '{}'::jsonb, occurred_at timestamptz not null default now(),
  check(event_name in('founding_partner_page_viewed','founding_partner_cta_clicked','founding_partner_application_started','founding_partner_application_completed','founding_partner_qualified','founding_partner_discovery_completed','founding_partner_accepted'))
);
create table public.customer_program_audit_events(
  id uuid primary key default gen_random_uuid(), customer_program_id uuid not null references public.customer_programs(id) on delete restrict,
  event_type text not null, actor_id uuid references public.profiles(id), reason text,
  safe_metadata jsonb not null default '{}'::jsonb, occurred_at timestamptz not null default now()
);

alter table public.customer_programs enable row level security;
alter table public.founding_partner_applications enable row level security;
alter table public.founding_partner_qualifications enable row level security;
alter table public.founding_partner_discovery enable row level security;
alter table public.founding_partner_events enable row level security;
alter table public.customer_program_audit_events enable row level security;
create policy "admins read customer accounts" on public.customer_accounts for select to authenticated using(public.is_admin());
create policy "admins manage customer programs" on public.customer_programs for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy "admins manage founding applications" on public.founding_partner_applications for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy "admins manage founding qualifications" on public.founding_partner_qualifications for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy "admins manage founding discovery" on public.founding_partner_discovery for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy "admins read founding events" on public.founding_partner_events for select to authenticated using(public.is_admin());
create policy "admins read program audit" on public.customer_program_audit_events for select to authenticated using(public.is_admin());
revoke all on public.customer_programs,public.founding_partner_applications,public.founding_partner_qualifications,public.founding_partner_discovery,public.founding_partner_events,public.customer_program_audit_events from anon;
grant select,insert,update on public.customer_programs,public.founding_partner_applications,public.founding_partner_qualifications,public.founding_partner_discovery to authenticated;
grant select on public.founding_partner_events,public.customer_program_audit_events to authenticated;

create function public.submit_founding_partner_application(p_application jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_customer uuid;v_program uuid;v_email text;v_name text;
begin
  v_email=lower(trim(p_application->>'email'));
  v_name=trim(p_application->>'business_name');
  if v_email=''or v_name='' then raise exception'FP001_APPLICATION_INVALID';end if;
  select id into v_customer from public.customer_accounts where lower(primary_email)=v_email limit 1 for update;
  if v_customer is null then
    insert into public.customer_accounts(account_type,status,display_name,primary_email,lifecycle_stage)
    values('prospect','pending',v_name,v_email,'applied') returning id into v_customer;
  else
    update public.customer_accounts set display_name=coalesce(nullif(v_name,''),display_name),lifecycle_stage=case when lifecycle_stage='prospect'then'applied'else lifecycle_stage end,updated_at=now() where id=v_customer;
  end if;
  insert into public.customer_programs(customer_account_id,program_type,cohort,program_status,next_action)
  values(v_customer,'FOUNDING_HPM_PARTNER','2026-01','applied','Review application')
  on conflict(customer_account_id,program_type,cohort)do update set updated_at=now()
  returning id into v_program;
  insert into public.founding_partner_applications(customer_account_id,customer_program_id,first_name,last_name,email,business_name,operating_model,property_count,years_operating,primary_markets,twelve_month_goal,primary_difficulty,improvement_area,monthly_feedback_consent,early_capability_consent,program_interest,testimonial_consent)
  values(v_customer,v_program,trim(p_application->>'first_name'),trim(p_application->>'last_name'),v_email,v_name,trim(p_application->>'operating_model'),(p_application->>'property_count')::integer,(p_application->>'years_operating')::integer,trim(p_application->>'primary_markets'),trim(p_application->>'twelve_month_goal'),trim(p_application->>'primary_difficulty'),trim(p_application->>'improvement_area'),(p_application->>'monthly_feedback_consent')::boolean,(p_application->>'early_capability_consent')::boolean,trim(p_application->>'program_interest'),coalesce((p_application->>'testimonial_consent')::boolean,false))
  on conflict(customer_program_id)do update set first_name=excluded.first_name,last_name=excluded.last_name,business_name=excluded.business_name,operating_model=excluded.operating_model,property_count=excluded.property_count,years_operating=excluded.years_operating,primary_markets=excluded.primary_markets,twelve_month_goal=excluded.twelve_month_goal,primary_difficulty=excluded.primary_difficulty,improvement_area=excluded.improvement_area,monthly_feedback_consent=excluded.monthly_feedback_consent,early_capability_consent=excluded.early_capability_consent,program_interest=excluded.program_interest,testimonial_consent=excluded.testimonial_consent,submitted_at=now();
  insert into public.founding_partner_events(event_name,customer_program_id,safe_context)values('founding_partner_application_completed',v_program,jsonb_build_object('cohort','2026-01','source','public_application'));
  insert into public.customer_program_audit_events(customer_program_id,event_type,reason,safe_metadata)values(v_program,'application_submitted','public_application',jsonb_build_object('cohort','2026-01'));
  return v_program;
end$$;
revoke all on function public.submit_founding_partner_application(jsonb) from public;
grant execute on function public.submit_founding_partner_application(jsonb) to anon,authenticated;
