-- Sprint 4B: Organization is the customer-facing projection rooted in owners.

begin;

alter table public.owners
  add column if not exists display_name text,
  add column if not exists legal_name text,
  add column if not exists organization_description text,
  add column if not exists website text,
  add column if not exists logo_url text,
  add column if not exists business_email text,
  add column if not exists business_phone text,
  add column if not exists organization_address jsonb,
  add column if not exists timezone text default 'America/Chicago',
  add column if not exists currency text default 'USD',
  add column if not exists language text default 'en-US',
  add column if not exists country text default 'US',
  add column if not exists organization_confirmed_fields text[] not null default '{}'::text[],
  add column if not exists organization_revision bigint not null default 0,
  add column if not exists organization_updated_at timestamptz not null default now();

update public.owners
set
  display_name = coalesce(display_name, nullif(trim(company_name), '')),
  timezone = coalesce(nullif(trim(timezone), ''), 'America/Chicago'),
  currency = coalesce(nullif(upper(trim(currency)), ''), 'USD'),
  language = coalesce(nullif(trim(language), ''), 'en-US'),
  country = coalesce(nullif(upper(trim(country)), ''), 'US'),
  organization_confirmed_fields = case
    when nullif(trim(company_name), '') is not null
      and not ('displayName' = any(organization_confirmed_fields))
      then array_append(organization_confirmed_fields, 'displayName')
    else organization_confirmed_fields
  end
where
  display_name is null
  or timezone is null
  or currency is null
  or language is null
  or country is null
  or (
    nullif(trim(company_name), '') is not null
    and not ('displayName' = any(organization_confirmed_fields))
  );

alter table public.owners
  drop constraint if exists owners_organization_timezone_check,
  add constraint owners_organization_timezone_check check (
    timezone is null
    or (
      timezone ~ '^[A-Za-z_]+(/[A-Za-z0-9_+-]+)+$'
      and timezone !~ '^[+-]'
    )
  ) not valid,
  drop constraint if exists owners_organization_currency_check,
  add constraint owners_organization_currency_check check (
    currency is null or currency ~ '^[A-Z]{3}$'
  ) not valid,
  drop constraint if exists owners_organization_language_check,
  add constraint owners_organization_language_check check (
    language is null or language ~ '^[a-z]{2,3}(-[A-Z]{2})?$'
  ) not valid,
  drop constraint if exists owners_organization_country_check,
  add constraint owners_organization_country_check check (
    country is null or country ~ '^[A-Z]{2}$'
  ) not valid,
  drop constraint if exists owners_organization_address_check,
  add constraint owners_organization_address_check check (
    organization_address is null
    or jsonb_typeof(organization_address) = 'object'
  ) not valid;

create table if not exists public.organization_activity (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.owners(id) on delete cascade,
  actor_profile_id uuid not null references public.profiles(id) on delete restrict,
  changed_fields text[] not null,
  occurred_at timestamptz not null default now()
);

create index if not exists organization_activity_workspace_occurred_idx
on public.organization_activity (workspace_id, occurred_at desc);

create table if not exists public.organization_update_receipts (
  workspace_id uuid not null references public.owners(id) on delete cascade,
  command_id text not null,
  payload_hash text not null,
  completed_revision bigint not null,
  completed_at timestamptz not null default now(),
  primary key (workspace_id, command_id)
);

create or replace function public.can_update_workspace_organization(p_workspace_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists (
    select 1 from public.owners owner
    join public.profiles profile on profile.id=auth.uid()
    where owner.id=p_workspace_id
      and (owner.profile_id=auth.uid() or profile.role='admin')
  )
$$;

alter table public.organization_activity enable row level security;
alter table public.organization_update_receipts enable row level security;

drop policy if exists "Workspace members read organization activity"
on public.organization_activity;
create policy "Workspace members read organization activity"
on public.organization_activity for select to authenticated
using (public.owner_profile_id(workspace_id) = auth.uid() or public.is_admin());

grant select on public.organization_activity to authenticated;

create or replace function public.update_workspace_organization(
  p_workspace_id uuid,
  p_expected_revision bigint,
  p_command_id text,
  p_payload jsonb
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  authenticated_profile_id uuid := auth.uid();
  current_owner public.owners%rowtype;
  existing_receipt public.organization_update_receipts%rowtype;
  payload_hash text := md5(p_payload::text);
  changed_fields text[];
  next_revision bigint;
begin
  if authenticated_profile_id is null then
    raise exception 'Organization authentication is required' using errcode = '42501';
  end if;

  select * into current_owner
  from public.owners
  where id = p_workspace_id
  for update;

  if not found or not public.can_update_workspace_organization(p_workspace_id) then
    raise exception 'Organization workspace is not accessible' using errcode = '42501';
  end if;

  select * into existing_receipt
  from public.organization_update_receipts
  where workspace_id = p_workspace_id and command_id = p_command_id;

  if found then
    if existing_receipt.payload_hash <> payload_hash then
      raise exception 'Organization command was reused with different input'
        using errcode = '22023';
    end if;
    return existing_receipt.completed_revision;
  end if;

  if current_owner.organization_revision <> p_expected_revision then
    raise exception 'Organization settings changed concurrently'
      using errcode = '40001';
  end if;

  if nullif(trim(p_payload->>'displayName'), '') is null then
    raise exception 'Organization display name is required' using errcode = '22023';
  end if;
  if coalesce(p_payload->>'timezone', '') !~ '^[A-Za-z_]+(/[A-Za-z0-9_+-]+)+$' then
    raise exception 'Organization timezone must be an IANA identifier' using errcode = '22023';
  end if;
  if coalesce(p_payload->>'currency', '') !~ '^[A-Z]{3}$'
    or coalesce(p_payload->>'language', '') !~ '^[a-z]{2,3}(-[A-Z]{2})?$'
    or coalesce(p_payload->>'country', '') !~ '^[A-Z]{2}$' then
    raise exception 'Organization regional defaults are invalid' using errcode = '22023';
  end if;

  changed_fields := array_remove(array[
    case when current_owner.display_name is distinct from p_payload->>'displayName' then 'displayName' end,
    case when current_owner.legal_name is distinct from nullif(p_payload->>'legalName', '') then 'legalName' end,
    case when current_owner.organization_description is distinct from nullif(p_payload->>'description', '') then 'description' end,
    case when current_owner.website is distinct from nullif(p_payload->>'website', '') then 'website' end,
    case when current_owner.logo_url is distinct from nullif(p_payload->>'logoUrl', '') then 'logoUrl' end,
    case when current_owner.business_email is distinct from nullif(p_payload->>'businessEmail', '') then 'businessEmail' end,
    case when current_owner.business_phone is distinct from nullif(p_payload->>'businessPhone', '') then 'businessPhone' end,
    case when current_owner.organization_address is distinct from p_payload->'address' then 'address' end,
    case when current_owner.preferred_contact_method is distinct from nullif(p_payload->>'preferredContactMethod', '') then 'preferredContactMethod' end,
    case when current_owner.timezone is distinct from p_payload->>'timezone' then 'timezone' end,
    case when current_owner.currency is distinct from p_payload->>'currency' then 'currency' end,
    case when current_owner.language is distinct from p_payload->>'language' then 'language' end,
    case when current_owner.country is distinct from p_payload->>'country' then 'country' end
  ], null);

  next_revision := current_owner.organization_revision + 1;

  update public.owners
  set
    display_name = p_payload->>'displayName',
    company_name = coalesce(nullif(p_payload->>'legalName', ''), company_name),
    legal_name = nullif(p_payload->>'legalName', ''),
    organization_description = nullif(p_payload->>'description', ''),
    website = nullif(p_payload->>'website', ''),
    logo_url = nullif(p_payload->>'logoUrl', ''),
    business_email = nullif(p_payload->>'businessEmail', ''),
    business_phone = nullif(p_payload->>'businessPhone', ''),
    organization_address = p_payload->'address',
    preferred_contact_method = nullif(p_payload->>'preferredContactMethod', ''),
    timezone = p_payload->>'timezone',
    currency = p_payload->>'currency',
    language = p_payload->>'language',
    country = p_payload->>'country',
    organization_confirmed_fields = array[
      'displayName', 'timezone', 'currency', 'language', 'country'
    ],
    organization_revision = next_revision,
    organization_updated_at = now()
  where id = p_workspace_id;

  if cardinality(changed_fields) > 0 then
    insert into public.organization_activity (
      workspace_id, actor_profile_id, changed_fields
    ) values (
      p_workspace_id, authenticated_profile_id, changed_fields
    );
  end if;

  insert into public.organization_update_receipts (
    workspace_id, command_id, payload_hash, completed_revision
  ) values (
    p_workspace_id, p_command_id, payload_hash, next_revision
  );

  return next_revision;
end;
$$;

revoke all on function public.update_workspace_organization(uuid, bigint, text, jsonb)
from public;
revoke all on function public.can_update_workspace_organization(uuid) from public;
grant execute on function public.update_workspace_organization(uuid, bigint, text, jsonb)
to authenticated;

commit;
