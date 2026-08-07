-- Complete the canonical property address shape used by Guidebook Studio.
begin;

alter table public.properties
  add column if not exists address_line_1 text,
  add column if not exists postal_code text,
  add column if not exists country text not null default 'US';

create index if not exists properties_workspace_address_postal_idx
on public.properties (
  owner_id,
  lower(regexp_replace(trim(coalesce(address_line_1,'')), '[^a-zA-Z0-9]+', '', 'g')),
  lower(trim(coalesce(postal_code,'')))
);

commit;
