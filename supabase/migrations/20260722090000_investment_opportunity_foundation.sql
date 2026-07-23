-- IA-001A: durable Investment Opportunity aggregate, immutable analysis history,
-- append-only activity, owner RLS, and atomic optimistic-concurrency persistence.

create table public.investment_opportunities (
  id text primary key,
  owner_id uuid not null references auth.users(id) on delete restrict,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  route text not null check (route in ('purchase', 'rental-arbitrage')),
  status text not null check (status in ('evaluating', 'researching', 'shortlisted', 'offer-submitted', 'under-contract', 'acquired', 'rejected')),
  market_property_id text,
  display_address text not null check (btrim(display_address) <> ''),
  normalized_address jsonb not null check (jsonb_typeof(normalized_address) = 'object'),
  property_snapshot jsonb not null check (jsonb_typeof(property_snapshot) = 'object'),
  current_analysis_id text,
  archived_at timestamptz,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  version integer not null check (version >= 1)
);

create table public.investment_opportunity_analyses (
  id text primary key,
  opportunity_id text not null references public.investment_opportunities(id) on delete restrict,
  sequence integer not null check (sequence > 0),
  route text not null check (route in ('purchase', 'rental-arbitrage')),
  investment_analysis_id text not null check (btrim(investment_analysis_id) <> ''),
  investment_decision_id text,
  market_analysis_id text,
  result_snapshot jsonb not null check (jsonb_typeof(result_snapshot) = 'object'),
  source_summary jsonb not null check (jsonb_typeof(source_summary) = 'object'),
  policy_versions jsonb not null check (jsonb_typeof(policy_versions) = 'object'),
  lineage jsonb not null check (jsonb_typeof(lineage) = 'object'),
  created_by jsonb not null check (jsonb_typeof(created_by) = 'object'),
  created_at timestamptz not null,
  unique (opportunity_id, sequence),
  unique (opportunity_id, id)
);

create unique index investment_opportunity_analysis_lifecycle_identity_idx
  on public.investment_opportunity_analyses(opportunity_id, investment_analysis_id, (lineage->>'investmentLifecycleResultId'));

alter table public.investment_opportunities add constraint investment_opportunities_current_analysis_fk
  foreign key (id, current_analysis_id) references public.investment_opportunity_analyses(opportunity_id, id) deferrable initially deferred;

create table public.investment_opportunity_tags (
  opportunity_id text not null references public.investment_opportunities(id) on delete restrict,
  normalized_value text not null check (char_length(btrim(normalized_value)) between 1 and 40),
  display_value text not null check (char_length(btrim(display_value)) between 1 and 40),
  created_at timestamptz not null,
  primary key (opportunity_id, normalized_value)
);

create table public.investment_opportunity_activity (
  id text primary key,
  opportunity_id text not null references public.investment_opportunities(id) on delete restrict,
  type text not null check (type in ('opportunity-created', 'analysis-saved', 'status-changed', 'name-changed', 'tags-changed', 'opportunity-archived', 'opportunity-restored')),
  actor jsonb not null check (jsonb_typeof(actor) = 'object'),
  details jsonb not null check (jsonb_typeof(details) = 'object'),
  occurred_at timestamptz not null,
  aggregate_version integer not null check (aggregate_version >= 1),
  command_id text
);

create table public.investment_opportunity_commands (
  owner_id uuid not null references auth.users(id) on delete restrict,
  command_id text not null,
  opportunity_id text not null references public.investment_opportunities(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (owner_id, command_id)
);

create index investment_opportunities_owner_archive_updated_idx on public.investment_opportunities(owner_id, archived_at, updated_at desc);
create index investment_opportunities_owner_status_updated_idx on public.investment_opportunities(owner_id, status, updated_at desc);
create index investment_opportunities_owner_route_updated_idx on public.investment_opportunities(owner_id, route, updated_at desc);
create index investment_opportunity_analyses_order_idx on public.investment_opportunity_analyses(opportunity_id, sequence desc);
create index investment_opportunity_activity_order_idx on public.investment_opportunity_activity(opportunity_id, occurred_at desc, id);
create index investment_opportunity_tags_value_idx on public.investment_opportunity_tags(normalized_value);

alter table public.investment_opportunities enable row level security;
alter table public.investment_opportunity_analyses enable row level security;
alter table public.investment_opportunity_tags enable row level security;
alter table public.investment_opportunity_activity enable row level security;
alter table public.investment_opportunity_commands enable row level security;

create policy "Owners and admins read Investment Opportunities" on public.investment_opportunities for select to authenticated using (owner_id = auth.uid() or public.is_admin());
create policy "Owners read Investment Opportunity analyses" on public.investment_opportunity_analyses for select to authenticated using (exists (select 1 from public.investment_opportunities opportunity where opportunity.id = opportunity_id and (opportunity.owner_id = auth.uid() or public.is_admin())));
create policy "Owners read Investment Opportunity tags" on public.investment_opportunity_tags for select to authenticated using (exists (select 1 from public.investment_opportunities opportunity where opportunity.id = opportunity_id and (opportunity.owner_id = auth.uid() or public.is_admin())));
create policy "Owners read Investment Opportunity activity" on public.investment_opportunity_activity for select to authenticated using (exists (select 1 from public.investment_opportunities opportunity where opportunity.id = opportunity_id and (opportunity.owner_id = auth.uid() or public.is_admin())));

grant select on public.investment_opportunities, public.investment_opportunity_analyses, public.investment_opportunity_tags, public.investment_opportunity_activity to authenticated;

create or replace function public.prevent_investment_opportunity_append_only_change()
returns trigger language plpgsql as $$ begin raise exception 'Investment Opportunity historical records are append-only' using errcode = 'P0001'; end; $$;
create trigger investment_opportunity_analyses_append_only before update or delete on public.investment_opportunity_analyses for each row execute function public.prevent_investment_opportunity_append_only_change();
create trigger investment_opportunity_activity_append_only before update or delete on public.investment_opportunity_activity for each row execute function public.prevent_investment_opportunity_append_only_change();

create or replace function public.save_investment_opportunity(p_payload jsonb, p_expected_version integer default null, p_command_id text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare proposed public.investment_opportunities; current_version integer; existing_command text;
begin
  proposed := jsonb_populate_record(null::public.investment_opportunities, p_payload->'opportunity');
  if auth.uid() is null or (proposed.owner_id <> auth.uid() and not public.is_admin()) then raise exception 'Investment Opportunity access denied' using errcode = '42501'; end if;
  if p_command_id is not null then
    select opportunity_id into existing_command from public.investment_opportunity_commands where owner_id = proposed.owner_id and command_id = p_command_id;
    if found then return jsonb_build_object('opportunityId', existing_command, 'idempotent', true); end if;
  end if;
  select version into current_version from public.investment_opportunities where id = proposed.id for update;
  if found then
    if p_expected_version is null or current_version <> p_expected_version or proposed.version <> p_expected_version + 1 then raise exception 'Stale Investment Opportunity version' using errcode = '40001'; end if;
    update public.investment_opportunities set name=proposed.name, status=proposed.status, current_analysis_id=proposed.current_analysis_id, archived_at=proposed.archived_at, updated_at=proposed.updated_at, version=proposed.version
      where id=proposed.id and owner_id=proposed.owner_id and version=p_expected_version;
  else
    if p_expected_version is not null or proposed.version < 1 then raise exception 'Invalid initial Investment Opportunity version' using errcode = '40001'; end if;
    insert into public.investment_opportunities select proposed.*;
  end if;
  insert into public.investment_opportunity_analyses select * from jsonb_populate_recordset(null::public.investment_opportunity_analyses, coalesce(p_payload->'analyses','[]'::jsonb)) on conflict (id) do nothing;
  delete from public.investment_opportunity_tags where opportunity_id=proposed.id;
  insert into public.investment_opportunity_tags select * from jsonb_populate_recordset(null::public.investment_opportunity_tags, coalesce(p_payload->'tags','[]'::jsonb));
  insert into public.investment_opportunity_activity select * from jsonb_populate_recordset(null::public.investment_opportunity_activity, coalesce(p_payload->'activity','[]'::jsonb)) on conflict (id) do nothing;
  if p_command_id is not null then insert into public.investment_opportunity_commands(owner_id,command_id,opportunity_id) values(proposed.owner_id,p_command_id,proposed.id); end if;
  return jsonb_build_object('opportunityId', proposed.id, 'version', proposed.version, 'idempotent', false);
end; $$;

revoke all on function public.save_investment_opportunity(jsonb, integer, text) from public;
grant execute on function public.save_investment_opportunity(jsonb, integer, text) to authenticated;

-- Rollback: drop save_investment_opportunity first, then commands/activity/tags,
-- remove the deferred current-analysis FK, and finally drop analyses/opportunities.
