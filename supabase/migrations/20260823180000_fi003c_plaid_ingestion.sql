-- FI-003C: Plaid is a private ingestion adapter. Cash Flow reads only the
-- canonical financial_accounts, cash_balance_observations and
-- financial_transactions tables.
create table if not exists public.financial_provider_connections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.owners(id) on delete cascade,
  provider text not null check (provider in ('plaid')),
  provider_item_ref text not null,
  encrypted_access_token text not null,
  token_key_version smallint not null default 1,
  status text not null default 'selecting-accounts' check(status in('selecting-accounts','active','attention','disconnected')),
  transaction_cursor text,
  institution_name text,
  last_balances_at timestamptz,
  last_transactions_at timestamptz,
  last_error_code text,
  created_by_profile_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_id,provider,provider_item_ref)
);

create table if not exists public.financial_provider_accounts (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.financial_provider_connections(id) on delete cascade,
  provider_account_ref text not null,
  canonical_account_id uuid references public.financial_accounts(id) on delete set null,
  display_name text not null,
  mask text,
  account_type text not null,
  account_subtype text,
  currency text not null check(currency ~ '^[A-Z]{3}$'),
  selected boolean not null default false,
  unique(connection_id,provider_account_ref)
);

alter table public.financial_provider_connections enable row level security;
alter table public.financial_provider_accounts enable row level security;
-- Tokens are deliberately service-role only. Authenticated clients receive
-- safe projections through server actions, never these rows.
revoke all on public.financial_provider_connections from anon, authenticated;
revoke all on public.financial_provider_accounts from anon, authenticated;
grant all on public.financial_provider_connections to service_role;
grant all on public.financial_provider_accounts to service_role;

create index if not exists financial_provider_connections_workspace_idx
  on public.financial_provider_connections(workspace_id,status);
create index if not exists financial_provider_accounts_connection_idx
  on public.financial_provider_accounts(connection_id,selected);
