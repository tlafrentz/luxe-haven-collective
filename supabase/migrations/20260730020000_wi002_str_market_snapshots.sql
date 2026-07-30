create table if not exists public.str_market_snapshots (
  id uuid primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid not null,
  subject_property_id text not null,
  subject_property_snapshot_id text not null references public.property_snapshots(id),
  provider text not null check (provider = 'airroi'),
  provider_version text not null,
  query_policy_version text not null,
  comparable_policy_version text not null,
  confidence_score numeric not null check (confidence_score between 0 and 100),
  completeness text not null check (completeness in ('complete', 'partial', 'insufficient')),
  warnings jsonb not null default '[]'::jsonb,
  payload jsonb not null,
  created_at timestamptz not null,
  expires_at timestamptz not null
);

create index if not exists str_market_snapshots_compatible_idx
  on public.str_market_snapshots (owner_id, workspace_id, subject_property_snapshot_id, comparable_policy_version, provider_version, expires_at desc);

alter table public.str_market_snapshots enable row level security;

create policy "Owners can read STR market snapshots"
  on public.str_market_snapshots for select
  using (owner_id = auth.uid());

create policy "Owners can create STR market snapshots"
  on public.str_market_snapshots for insert
  with check (owner_id = auth.uid());

revoke update, delete on public.str_market_snapshots from authenticated;

create function public.prevent_str_market_snapshot_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'STR market snapshots are immutable';
end;
$$;

create trigger str_market_snapshots_immutable
before update or delete on public.str_market_snapshots
for each row execute function public.prevent_str_market_snapshot_mutation();
