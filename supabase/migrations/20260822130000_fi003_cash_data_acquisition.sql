-- FI-003: provider-neutral cash accounts, immutable balances, and import metadata.
alter table public.financial_accounts
  add column if not exists account_type text check(account_type in('operating','reserve','tax','other-cash')),
  add column if not exists status text not null default 'active' check(status in('active','inactive','disconnected')),
  add column if not exists source_type text not null default 'manual' check(source_type in('manual','csv','provider')),
  add column if not exists provider_connection_id text,
  add column if not exists provider_account_ref text,
  add column if not exists notes text;

create table if not exists public.cash_balance_observations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.owners(id) on delete cascade,
  account_id uuid not null references public.financial_accounts(id) on delete cascade,
  property_id uuid references public.properties(id) on delete restrict,
  amount_minor bigint not null,
  currency text not null check(currency ~ '^[A-Z]{3}$'),
  as_of date not null,
  source_type text not null check(source_type in('manual','csv','provider')),
  source_reference text,
  idempotency_key text not null,
  recorded_by_profile_id uuid references public.profiles(id),
  recorded_at timestamptz not null default now(),
  unique(workspace_id,idempotency_key)
);

alter table public.financial_transactions
  add column if not exists direction text check(direction in('inflow','outflow')),
  add column if not exists description text,
  add column if not exists import_category text;

create index if not exists cash_balance_observations_latest_idx on public.cash_balance_observations(workspace_id,account_id,as_of desc,recorded_at desc);
alter table public.cash_balance_observations enable row level security;
create policy "cash balances workspace read" on public.cash_balance_observations for select to authenticated using(public.can_access_platform_action_workspace(workspace_id));
create policy "cash balances workspace write" on public.cash_balance_observations for insert to authenticated with check(public.can_manage_financial_observation(workspace_id,property_id) and recorded_by_profile_id=auth.uid());
revoke all on public.cash_balance_observations from anon;
grant select,insert on public.cash_balance_observations to authenticated;
grant all on public.cash_balance_observations to service_role;
