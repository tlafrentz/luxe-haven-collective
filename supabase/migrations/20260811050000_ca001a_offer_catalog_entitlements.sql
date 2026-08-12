-- CA-001A canonical offer catalog and entitlements. Provider-neutral and forward-only.
create table public.commercial_offer_versions (
  id uuid primary key default gen_random_uuid(), code text not null, version integer not null check(version > 0),
  product_family text not null check(product_family in ('hpm','guidebook_studio','furnishing','investment_intelligence')),
  name text not null, short_description text not null, status text not null check(status in ('draft','active','inactive','retired')),
  customer_type text not null check(customer_type in ('individual_operator','portfolio_operator','owner','investor','service_client')),
  acquisition_mode text not null check(acquisition_mode in ('self_service','contact_sales','proposal_required')),
  billing_model text not null check(billing_model in ('one_time','recurring','usage_based','custom_quote')),
  currency text check(currency ~ '^[A-Z]{3}$'), amount_minor bigint check(amount_minor >= 0),
  billing_interval text check(billing_interval in ('month','year')), interval_count integer check(interval_count > 0),
  standalone_eligible boolean not null, prerequisite_offer_codes text[] not null default '{}', compatible_offer_codes text[] not null default '{}', upgrade_offer_codes text[] not null default '{}',
  effective_from timestamptz not null, effective_until timestamptz, schema_version integer not null check(schema_version > 0),
  created_at timestamptz not null default now(), unique(code,version),
  check(effective_until is null or effective_until > effective_from),
  check((billing_model = 'custom_quote' and currency is null and amount_minor is null) or (billing_model <> 'custom_quote')),
  check((billing_model <> 'recurring') or currency is null or (billing_interval is not null and interval_count is not null))
);
create table public.commercial_offer_capabilities (
  offer_id uuid not null references public.commercial_offer_versions(id), capability_code text not null,
  resource_type text not null check(resource_type in ('workspace','property','guidebook','report','furnishing_project','investment_analysis','investment_opportunity')),
  primary key(offer_id,capability_code)
);
create table public.commercial_offer_limits (
  offer_id uuid not null references public.commercial_offer_versions(id), limit_code text not null check(limit_code in ('workspace_count','property_count','guidebook_count','published_guidebook_count','team_member_count','saved_investment_count','investment_analysis_count_per_period','furnishing_project_count')),
  allowance_kind text not null check(allowance_kind in ('finite','unlimited')), allowance_value bigint,
  period text check(period in ('lifetime','month','year')), enforcement text not null check(enforcement in ('hard','soft')),
  primary key(offer_id,limit_code), check((allowance_kind='unlimited' and allowance_value is null) or (allowance_kind='finite' and allowance_value >= 0))
);
create table public.commercial_offer_onboarding_requirements (
  offer_id uuid not null references public.commercial_offer_versions(id), requirement_code text not null check(requirement_code in ('accept_terms','create_workspace','create_or_select_property','complete_property_profile','connect_data_source','upload_historical_data','complete_guidebook_intake','complete_furnishing_intake','complete_investment_profile','schedule_consultation')),
  primary key(offer_id,requirement_code)
);
create table public.customer_accounts (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.owners(id),
  account_type text not null check(account_type in ('individual','organization','owner','investor','service_client')),
  status text not null default 'pending' check(status in ('pending','active','suspended','closed')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(id,tenant_id)
);
create table public.customer_account_memberships (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null, customer_account_id uuid not null,
  profile_id uuid not null references public.profiles(id), status text not null default 'active' check(status in ('active','suspended','removed')),
  created_at timestamptz not null default now(), unique(customer_account_id,profile_id),
  foreign key(customer_account_id,tenant_id) references public.customer_accounts(id,tenant_id)
);
create table public.commercial_entitlements (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null, customer_account_id uuid not null,
  capability_code text not null, resource_scope_type text not null check(resource_scope_type in ('customer_account','workspace','property','guidebook','furnishing_project')),
  resource_scope_id uuid not null, source text not null check(source in ('offer_activation','subscription','service_engagement','administrative_grant','migration')),
  source_reference_id text not null, offer_code text, offer_version integer, status text not null check(status in ('pending','active','suspended','expired','revoked')),
  effective_from timestamptz not null, effective_until timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), revision integer not null default 1 check(revision > 0),
  foreign key(customer_account_id,tenant_id) references public.customer_accounts(id,tenant_id),
  check(effective_until is null or effective_until > effective_from),
  check(source not in ('offer_activation','subscription') or (offer_code is not null and offer_version is not null)),
  unique(tenant_id,customer_account_id,capability_code,resource_scope_type,resource_scope_id,source,source_reference_id)
);
create table public.commercial_entitlement_status_history (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null, entitlement_id uuid not null references public.commercial_entitlements(id),
  from_status text, to_status text not null, actor_id uuid not null references public.profiles(id), reason_code text not null,
  source_reference_id text not null, idempotency_key text not null unique, occurred_at timestamptz not null,
  created_at timestamptz not null default now()
);
create table public.commercial_activation_attempts (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null, customer_account_id uuid not null,
  offer_code text not null, offer_version integer not null, idempotency_key text not null unique,
  status text not null check(status in ('started','succeeded','rejected')), correlation_id text not null, terminal_recorded_at timestamptz,
  created_at timestamptz not null default now(), foreign key(customer_account_id,tenant_id) references public.customer_accounts(id,tenant_id)
);

create index commercial_entitlements_active_lookup_idx on public.commercial_entitlements(tenant_id,customer_account_id,capability_code,status,effective_from,effective_until);
create index commercial_entitlements_scope_idx on public.commercial_entitlements(tenant_id,resource_scope_type,resource_scope_id,capability_code,status);
create index customer_account_memberships_profile_idx on public.customer_account_memberships(profile_id,tenant_id,status);

create function public.prevent_commercial_origin_mutation() returns trigger language plpgsql set search_path='' as $$ begin
  if old.tenant_id<>new.tenant_id or old.customer_account_id<>new.customer_account_id or old.capability_code<>new.capability_code or old.resource_scope_type<>new.resource_scope_type or old.resource_scope_id<>new.resource_scope_id or old.source<>new.source or old.source_reference_id<>new.source_reference_id or old.offer_code is distinct from new.offer_code or old.offer_version is distinct from new.offer_version or old.created_at<>new.created_at then raise exception 'Entitlement origin is immutable'; end if;
  if new.revision<>old.revision+1 then raise exception 'Entitlement revision must increment'; end if; return new;
end $$;
create trigger commercial_entitlement_origin_immutable before update on public.commercial_entitlements for each row execute function public.prevent_commercial_origin_mutation();
create function public.prevent_active_offer_mutation() returns trigger language plpgsql set search_path='' as $$ begin if old.status='active' then raise exception 'Active offer versions are immutable'; end if; return new; end $$;
create trigger commercial_offer_active_immutable before update or delete on public.commercial_offer_versions for each row execute function public.prevent_active_offer_mutation();

alter table public.commercial_offer_versions enable row level security;
alter table public.commercial_offer_capabilities enable row level security;
alter table public.commercial_offer_limits enable row level security;
alter table public.commercial_offer_onboarding_requirements enable row level security;
alter table public.customer_accounts enable row level security;
alter table public.customer_account_memberships enable row level security;
alter table public.commercial_entitlements enable row level security;
alter table public.commercial_entitlement_status_history enable row level security;
alter table public.commercial_activation_attempts enable row level security;

create policy "admins read commercial offer versions" on public.commercial_offer_versions for select to authenticated using(public.is_admin());
create policy "admins read commercial offer capabilities" on public.commercial_offer_capabilities for select to authenticated using(public.is_admin());
create policy "admins read commercial offer limits" on public.commercial_offer_limits for select to authenticated using(public.is_admin());
create policy "admins read commercial onboarding" on public.commercial_offer_onboarding_requirements for select to authenticated using(public.is_admin());
create policy "members read their customer account" on public.customer_accounts for select to authenticated using(tenant_id in(select m.tenant_id from public.customer_account_memberships m where m.customer_account_id=id and m.profile_id=auth.uid() and m.status='active'));
create policy "members read own account membership" on public.customer_account_memberships for select to authenticated using(profile_id=auth.uid());
create policy "members read own active entitlements" on public.commercial_entitlements for select to authenticated using(exists(select 1 from public.customer_account_memberships m where m.customer_account_id=commercial_entitlements.customer_account_id and m.tenant_id=commercial_entitlements.tenant_id and m.profile_id=auth.uid() and m.status='active'));
create policy "admins read entitlement history" on public.commercial_entitlement_status_history for select to authenticated using(public.is_admin());
create policy "admins read activation attempts" on public.commercial_activation_attempts for select to authenticated using(public.is_admin());

revoke all on public.commercial_offer_versions,public.commercial_offer_capabilities,public.commercial_offer_limits,public.commercial_offer_onboarding_requirements,public.customer_accounts,public.customer_account_memberships,public.commercial_entitlements,public.commercial_entitlement_status_history,public.commercial_activation_attempts from anon;
revoke insert,update,delete on public.customer_accounts,public.customer_account_memberships,public.commercial_entitlements,public.commercial_entitlement_status_history,public.commercial_activation_attempts from authenticated;
grant select on public.customer_accounts,public.customer_account_memberships,public.commercial_entitlements to authenticated;

alter table public.properties add column if not exists product_participation text[] not null default array['hpm_managed']::text[];
alter table public.properties add constraint properties_product_participation_valid check(product_participation <@ array['guidebook_only','hpm_managed','investment_subject','furnishing_project']::text[] and cardinality(product_participation)>0);
comment on column public.properties.product_participation is 'Product participation only; does not alter canonical identity or grant access.';

insert into public.commercial_offer_versions(code,version,product_family,name,short_description,status,customer_type,acquisition_mode,billing_model,standalone_eligible,prerequisite_offer_codes,compatible_offer_codes,upgrade_offer_codes,effective_from,schema_version)
values
('hpm.starter',1,'hpm','HPM Starter','Hospitality performance management for an individual operator.','draft','individual_operator','self_service','recurring',true,'{}','{guidebook.standalone}','{hpm.portfolio,hpm.sales_assisted}','2026-08-11',1),
('hpm.portfolio',1,'hpm','HPM Portfolio','Higher-capacity hospitality performance management.','draft','portfolio_operator','self_service','recurring',true,'{}','{guidebook.standalone}','{hpm.sales_assisted}','2026-08-11',1),
('hpm.sales_assisted',1,'hpm','HPM Sales Assisted','A tailored HPM engagement for larger operators.','draft','portfolio_operator','contact_sales','custom_quote',true,'{}','{guidebook.standalone}','{}','2026-08-11',1),
('guidebook.standalone',1,'guidebook_studio','Standalone Guidebook','Create and publish a guidebook without HPM enrollment.','draft','individual_operator','self_service','one_time',true,'{}','{hpm.starter,hpm.portfolio,hpm.sales_assisted}','{guidebook.multi}','2026-08-11',1),
('guidebook.multi',1,'guidebook_studio','Guidebook Multi','Create and manage multiple guidebooks.','draft','portfolio_operator','self_service','recurring',true,'{}','{hpm.starter,hpm.portfolio,hpm.sales_assisted}','{}','2026-08-11',1),
('furnishing.consultation',1,'furnishing','Furnishing Consultation','A scoped furnishing consultation.','draft','service_client','proposal_required','custom_quote',true,'{}','{}','{furnishing.essentials,furnishing.custom}','2026-08-11',1),
('furnishing.essentials',1,'furnishing','Essentials Furnishing Package','A managed essentials furnishing engagement.','draft','service_client','proposal_required','custom_quote',true,'{}','{}','{furnishing.custom}','2026-08-11',1),
('furnishing.custom',1,'furnishing','Custom Furnishing Engagement','A custom managed furnishing engagement.','draft','service_client','proposal_required','custom_quote',true,'{}','{}','{}','2026-08-11',1),
('investment.single',1,'investment_intelligence','Single Property Analysis','Analyze one investment property.','draft','investor','self_service','one_time',true,'{}','{}','{investment.multi,investment.sales_assisted}','2026-08-11',1),
('investment.multi',1,'investment_intelligence','Investment Multi','Recurring access for multiple analyses.','draft','investor','self_service','recurring',true,'{}','{}','{investment.sales_assisted}','2026-08-11',1),
('investment.sales_assisted',1,'investment_intelligence','Investor Advisory','A sales-assisted investment intelligence engagement.','draft','investor','contact_sales','custom_quote',true,'{}','{}','{}','2026-08-11',1)
on conflict(code,version) do nothing;
