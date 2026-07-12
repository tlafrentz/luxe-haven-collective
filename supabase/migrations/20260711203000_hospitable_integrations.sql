create table if not exists public.integration_connections (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  name text not null,
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint integration_connections_provider_check
    check (provider in ('hospitable')),

  constraint integration_connections_status_check
    check (status in ('active', 'paused', 'error'))
);

create unique index if not exists
  integration_connections_provider_name_key
on public.integration_connections (provider, name);

create table if not exists public.external_properties (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null
    references public.integration_connections(id)
    on delete cascade,
  property_id uuid
    references public.properties(id)
    on delete set null,
  provider text not null,
  external_id text not null,
  external_name text,
  sync_status text not null default 'pending',
  raw_payload jsonb not null default '{}'::jsonb,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint external_properties_provider_check
    check (provider in ('hospitable')),

  constraint external_properties_sync_status_check
    check (
      sync_status in (
        'pending',
        'linked',
        'synced',
        'error',
        'ignored'
      )
    )
);

create unique index if not exists
  external_properties_connection_external_id_key
on public.external_properties (
  connection_id,
  external_id
);

create index if not exists
  external_properties_property_id_idx
on public.external_properties (property_id);

create table if not exists public.integration_sync_runs (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null
    references public.integration_connections(id)
    on delete cascade,
  sync_type text not null,
  status text not null default 'running',
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  records_processed integer not null default 0,
  records_created integer not null default 0,
  records_updated integer not null default 0,
  records_failed integer not null default 0,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,

  constraint integration_sync_runs_sync_type_check
    check (
      sync_type in (
        'properties',
        'reservations',
        'full'
      )
    ),

  constraint integration_sync_runs_status_check
    check (
      status in (
        'running',
        'completed',
        'failed',
        'partial'
      )
    )
);

create index if not exists
  integration_sync_runs_connection_started_at_idx
on public.integration_sync_runs (
  connection_id,
  started_at desc
);

alter table public.integration_connections
  enable row level security;

alter table public.external_properties
  enable row level security;

alter table public.integration_sync_runs
  enable row level security;

create policy "Admins can manage integration connections"
on public.integration_connections
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
);

create policy "Admins can manage external properties"
on public.external_properties
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
);

create policy "Admins can manage integration sync runs"
on public.integration_sync_runs
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
);

grant select, insert, update, delete
on table public.integration_connections
to authenticated;

grant select, insert, update, delete
on table public.external_properties
to authenticated;

grant select, insert, update, delete
on table public.integration_sync_runs
to authenticated;
