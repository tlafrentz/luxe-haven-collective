-- BI-001: canonical evidence-backed financial observations and immutable snapshots.
create table public.financial_accounts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.owners(id) on delete cascade,
  code text not null,
  name text not null,
  category text not null check(category in('revenue','cost-of-revenue','operating-expense','capital-expense','asset','liability','equity','reserve')),
  subcategory text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(workspace_id,code)
);

create table public.financial_transactions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.owners(id) on delete cascade,
  account_id uuid not null references public.financial_accounts(id),
  property_id uuid references public.properties(id) on delete restrict,
  amount_minor bigint not null,
  currency text not null check(currency ~ '^[A-Z]{3}$'),
  measurement text not null check(measurement in('actual','forecast','scenario','budget','target')),
  effective_date date not null,
  effective_to date,
  frequency text not null default 'one-time' check(frequency in('one-time','nightly','weekly','monthly','quarterly','annual')),
  posting_date date,
  status text not null check(status in('pending','posted','voided')),
  source_provider text not null,
  source_external_id text,
  evidence_ids text[] not null default '{}',
  idempotency_key text not null,
  created_by_profile_id uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique(workspace_id,idempotency_key),
  check(status <> 'posted' or posting_date is not null),
  check(effective_to is null or effective_to >= effective_date)
);

create table public.financial_snapshots (
  id text primary key,
  workspace_id uuid not null references public.owners(id) on delete cascade,
  property_id uuid references public.properties(id) on delete restrict,
  portfolio_id text,
  period_from date not null,
  period_to date not null,
  basis text not null check(basis in('actual','forecast','scenario','budget','target')),
  schema_version text not null,
  calculation_version text not null,
  source_fingerprint text not null,
  snapshot jsonb not null,
  confidence text not null,
  freshness text not null,
  captured_at timestamptz not null,
  created_by_profile_id uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique(workspace_id,property_id,portfolio_id,period_from,period_to,basis,source_fingerprint),
  check(period_to >= period_from)
);

create index financial_transactions_scope_idx on public.financial_transactions(workspace_id,property_id,effective_date,status);
create index financial_snapshots_timeline_idx on public.financial_snapshots(workspace_id,property_id,period_from desc,period_to desc,captured_at desc);

alter table public.financial_accounts enable row level security;
alter table public.financial_transactions enable row level security;
alter table public.financial_snapshots enable row level security;

create function public.can_manage_financial_observation(p_workspace_id uuid,p_property_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select public.active_workspace_role(p_workspace_id) in ('owner','administrator','operator')
    and(p_property_id is null or public.can_access_workspace_property(p_property_id))
$$;
grant execute on function public.can_manage_financial_observation(uuid,uuid) to authenticated;

create policy "financial accounts workspace read" on public.financial_accounts for select to authenticated
using(public.can_access_platform_action_workspace(workspace_id));
create policy "financial accounts workspace write" on public.financial_accounts for all to authenticated
using(public.can_manage_financial_observation(workspace_id,null))
with check(public.can_manage_financial_observation(workspace_id,null));
create policy "financial transactions workspace read" on public.financial_transactions for select to authenticated
using(public.can_access_platform_action_workspace(workspace_id));
create policy "financial transactions workspace write" on public.financial_transactions for insert to authenticated
with check(
  public.can_manage_financial_observation(workspace_id,property_id)
  and created_by_profile_id=auth.uid()
  and exists(select 1 from public.financial_accounts account where account.id=account_id and account.workspace_id=workspace_id)
  and(property_id is null or exists(select 1 from public.properties property where property.id=property_id and property.owner_id=workspace_id))
);
create policy "financial snapshots workspace read" on public.financial_snapshots for select to authenticated
using(public.can_access_platform_action_workspace(workspace_id));

revoke all on public.financial_accounts,public.financial_transactions,public.financial_snapshots from anon;
grant select,insert,update on public.financial_accounts to authenticated;
grant select,insert on public.financial_transactions to authenticated;
grant select on public.financial_snapshots to authenticated;
grant all on public.financial_accounts,public.financial_transactions,public.financial_snapshots to service_role;
