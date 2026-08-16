-- Forward-compatible bootstrap repair for the owner/workspace aggregate.
--
-- The original production baseline created public.owners before the security
-- hardening migration. That baseline was later removed from the repository,
-- while the minimal 0001 bootstrap still points properties.owner_id directly
-- at profiles.id. Existing databases already have the canonical owners table;
-- this migration is therefore an idempotent no-op for them and repairs only a
-- fresh or legacy-minimal bootstrap.

create table if not exists public.owners (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  company_name text,
  mailing_address text,
  preferred_contact_method text default 'email',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id)
);

do $repair$
declare
  owner_foreign_key text;
  owner_foreign_table text;
begin
  select constraint_record.conname, target_table.relname
  into owner_foreign_key, owner_foreign_table
  from pg_constraint constraint_record
  join pg_class source_table on source_table.oid = constraint_record.conrelid
  join pg_namespace source_schema on source_schema.oid = source_table.relnamespace
  join pg_class target_table on target_table.oid = constraint_record.confrelid
  where constraint_record.contype = 'f'
    and source_schema.nspname = 'public'
    and source_table.relname = 'properties'
    and constraint_record.conkey = array[
      (select attribute.attnum
       from pg_attribute attribute
       where attribute.attrelid = source_table.oid
         and attribute.attname = 'owner_id')
    ]::smallint[]
  limit 1;

  if owner_foreign_table = 'profiles' then
    insert into public.owners (profile_id)
    select distinct property.owner_id
    from public.properties property
    where property.owner_id is not null
    on conflict (profile_id) do nothing;

    update public.properties property
    set owner_id = owner_record.id
    from public.owners owner_record
    where property.owner_id = owner_record.profile_id;

    execute format(
      'alter table public.properties drop constraint %I',
      owner_foreign_key
    );
    alter table public.properties
      add constraint properties_owner_id_fkey
      foreign key (owner_id) references public.owners(id) on delete set null;
  elsif owner_foreign_table is null then
    alter table public.properties
      add constraint properties_owner_id_fkey
      foreign key (owner_id) references public.owners(id) on delete set null;
  elsif owner_foreign_table <> 'owners' then
    raise exception
      'Unsupported properties.owner_id foreign key target: %',
      owner_foreign_table;
  end if;
end;
$repair$;

create index if not exists properties_owner_id_idx
on public.properties (owner_id);

-- The deleted production baseline also supplied this canonical extension bag.
-- A later guest-context migration reads it before any other migration adds it.
alter table public.properties
  add column if not exists metadata jsonb not null default '{}'::jsonb;

-- Preserve the server-side application boundary supplied by the production
-- baseline. RLS bypass does not itself grant table privileges in PostgreSQL.
grant all on public.owners to service_role;
grant all on public.profiles, public.properties to service_role;
