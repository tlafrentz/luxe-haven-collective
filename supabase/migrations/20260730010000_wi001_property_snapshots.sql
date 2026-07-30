-- WI-001: immutable, provider-neutral property discovery snapshots.
create table public.property_snapshots (
  id text primary key,
  subject_property_id text not null,
  provider text not null check (provider = 'realtyapi'),
  provider_property_id text not null,
  normalized_address_key text not null,
  version integer not null check (version > 0),
  schema_version text not null,
  provider_version text not null,
  source_endpoint text not null,
  payload jsonb not null,
  captured_at timestamptz not null,
  listing_fresh_until timestamptz not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique(subject_property_id, version),
  check(listing_fresh_until >= captured_at),
  check(expires_at >= listing_fresh_until)
);

create index property_snapshots_address_cache_idx
  on public.property_snapshots(normalized_address_key, expires_at desc, version desc);
create index property_snapshots_subject_history_idx
  on public.property_snapshots(subject_property_id, version desc);

alter table public.property_snapshots enable row level security;
revoke all on public.property_snapshots from anon, authenticated;
grant all on public.property_snapshots to service_role;

create function public.prevent_property_snapshot_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'Property snapshots are immutable';
end;
$$;

create trigger property_snapshots_immutable
before update or delete on public.property_snapshots
for each row execute function public.prevent_property_snapshot_mutation();
