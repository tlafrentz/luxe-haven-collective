-- IA-002A.7: durable Acquisition Pipeline records, immutable history, owner RLS,
-- and transactional optimistic-concurrency/idempotency primitives.

create table public.acquisition_pipelines (
  id text primary key,
  opportunity_id text not null unique references public.investment_opportunities(id) on delete restrict,
  owner_id uuid not null references auth.users(id) on delete restrict,
  route text not null check (route in ('purchase','rental-arbitrage')),
  stage text not null check (stage in ('pursuit','offer-preparation','offer-submitted','negotiating','under-contract','due-diligence','closing-preparation','closed-acquired','exited')),
  activation jsonb not null check (jsonb_typeof(activation) = 'object'),
  version integer not null check (version >= 1),
  closing_facts jsonb,
  updated_at timestamptz not null,
  created_at timestamptz not null
);
create index acquisition_pipelines_owner_stage_idx on public.acquisition_pipelines(owner_id, stage, updated_at desc);

create table public.acquisition_stage_history (
  transition_id text primary key,
  pipeline_id text not null references public.acquisition_pipelines(id) on delete restrict,
  from_stage text,
  to_stage text not null,
  occurred_at timestamptz not null,
  actor jsonb not null check (jsonb_typeof(actor) = 'object'),
  classification text not null check (classification in ('forward','backward','terminal')),
  reason jsonb,
  aggregate_version integer not null check (aggregate_version >= 1),
  unique (pipeline_id, aggregate_version)
);
create index acquisition_stage_history_order_idx on public.acquisition_stage_history(pipeline_id, occurred_at, transition_id);

create table public.acquisition_pipeline_activity (
  id text primary key,
  pipeline_id text not null references public.acquisition_pipelines(id) on delete restrict,
  type text not null,
  occurred_at timestamptz not null,
  actor jsonb not null check (jsonb_typeof(actor) = 'object'),
  details jsonb not null check (jsonb_typeof(details) = 'object'),
  aggregate_version integer not null check (aggregate_version >= 1),
  unique (pipeline_id, aggregate_version)
);
create index acquisition_pipeline_activity_order_idx on public.acquisition_pipeline_activity(pipeline_id, occurred_at desc, id);

create table public.acquisition_offers (
  id text primary key,
  pipeline_id text not null references public.acquisition_pipelines(id) on delete restrict,
  sequence integer not null check (sequence > 0),
  route text not null check (route in ('purchase','rental-arbitrage')),
  status text not null check (status in ('draft','submitted','countered','accepted','rejected','withdrawn','expired','superseded')),
  source_analysis jsonb not null check (jsonb_typeof(source_analysis) = 'object'),
  terms jsonb not null check (jsonb_typeof(terms) = 'object'),
  created_by jsonb not null check (jsonb_typeof(created_by) = 'object'),
  created_at timestamptz not null,
  submitted_at timestamptz,
  expires_at timestamptz,
  current_offer boolean not null default false,
  unique (pipeline_id, sequence)
);
create unique index acquisition_offers_one_current_idx on public.acquisition_offers(pipeline_id) where current_offer;
create index acquisition_offers_pipeline_status_idx on public.acquisition_offers(pipeline_id, status, sequence desc);

create table public.acquisition_counterparty_responses (
  id text primary key,
  pipeline_id text not null references public.acquisition_pipelines(id) on delete restrict,
  offer_id text not null references public.acquisition_offers(id) on delete restrict,
  response_type text not null check (response_type in ('acceptance','rejection','counter')),
  counterparty jsonb not null check (jsonb_typeof(counterparty) = 'object'),
  terms jsonb,
  responded_at timestamptz not null,
  recorded_at timestamptz not null,
  recorded_by jsonb not null check (jsonb_typeof(recorded_by) = 'object'),
  explanation text
);
create index acquisition_responses_offer_idx on public.acquisition_counterparty_responses(offer_id, recorded_at);

create table public.acquisition_contracts (
  id text primary key,
  pipeline_id text not null unique references public.acquisition_pipelines(id) on delete restrict,
  route text not null check (route in ('purchase','rental-arbitrage')),
  status text not null check (status = 'recorded'),
  source jsonb not null check (jsonb_typeof(source) = 'object'),
  terms jsonb not null check (jsonb_typeof(terms) = 'object'),
  recorded_by jsonb not null check (jsonb_typeof(recorded_by) = 'object'),
  recorded_at timestamptz not null
);

create table public.acquisition_contingencies (
  id text primary key,
  pipeline_id text not null references public.acquisition_pipelines(id) on delete restrict,
  route text not null check (route in ('purchase','rental-arbitrage')),
  type text not null,
  title text not null,
  status text not null check (status in ('not-started','in-progress','satisfied','waived','failed','not-applicable')),
  blocking boolean not null,
  priority text not null,
  source jsonb not null check (jsonb_typeof(source) = 'object'),
  outcome jsonb,
  created_at timestamptz not null,
  created_by jsonb not null check (jsonb_typeof(created_by) = 'object'),
  updated_at timestamptz not null
);
create index acquisition_contingencies_pipeline_status_idx on public.acquisition_contingencies(pipeline_id, status);

create table public.acquisition_due_diligence_items (
  id text primary key,
  pipeline_id text not null references public.acquisition_pipelines(id) on delete restrict,
  route text not null check (route in ('purchase','rental-arbitrage')),
  category text not null,
  title text not null,
  status text not null check (status in ('not-started','in-progress','satisfied','waived','failed','not-applicable')),
  blocking boolean not null,
  priority text not null,
  related_contingency_id text references public.acquisition_contingencies(id) on delete restrict,
  outcome jsonb,
  created_at timestamptz not null,
  created_by jsonb not null check (jsonb_typeof(created_by) = 'object'),
  updated_at timestamptz not null
);
create index acquisition_diligence_pipeline_status_idx on public.acquisition_due_diligence_items(pipeline_id, status);

create table public.acquisition_requirement_history (
  id text primary key,
  pipeline_id text not null references public.acquisition_pipelines(id) on delete restrict,
  requirement_id text not null,
  from_status text not null,
  to_status text not null,
  actor jsonb not null check (jsonb_typeof(actor) = 'object'),
  occurred_at timestamptz not null,
  reason jsonb,
  aggregate_version integer not null check (aggregate_version >= 1)
);

create table public.acquisition_command_receipts (
  owner_id uuid not null references auth.users(id) on delete restrict,
  command_id text not null,
  command_type text not null,
  pipeline_id text references public.acquisition_pipelines(id) on delete restrict,
  completed_at timestamptz not null,
  result jsonb not null check (jsonb_typeof(result) = 'object'),
  primary key (owner_id, command_id)
);
create index acquisition_command_receipts_pipeline_idx on public.acquisition_command_receipts(pipeline_id);

alter table public.acquisition_pipelines enable row level security;
alter table public.acquisition_stage_history enable row level security;
alter table public.acquisition_pipeline_activity enable row level security;
alter table public.acquisition_offers enable row level security;
alter table public.acquisition_counterparty_responses enable row level security;
alter table public.acquisition_contracts enable row level security;
alter table public.acquisition_contingencies enable row level security;
alter table public.acquisition_due_diligence_items enable row level security;
alter table public.acquisition_requirement_history enable row level security;
alter table public.acquisition_command_receipts enable row level security;

create policy "Owners read acquisition pipelines" on public.acquisition_pipelines for select to authenticated using (owner_id = auth.uid() or public.is_admin());
create policy "Owners manage acquisition pipelines" on public.acquisition_pipelines for all to authenticated using (owner_id = auth.uid() or public.is_admin()) with check (owner_id = auth.uid() or public.is_admin());

create policy "Owners read acquisition children" on public.acquisition_stage_history for select to authenticated using (exists (select 1 from public.acquisition_pipelines p where p.id = pipeline_id and (p.owner_id = auth.uid() or public.is_admin())));
create policy "Owners read acquisition activity" on public.acquisition_pipeline_activity for select to authenticated using (exists (select 1 from public.acquisition_pipelines p where p.id = pipeline_id and (p.owner_id = auth.uid() or public.is_admin())));
create policy "Owners manage acquisition offers" on public.acquisition_offers for all to authenticated using (exists (select 1 from public.acquisition_pipelines p where p.id = pipeline_id and (p.owner_id = auth.uid() or public.is_admin()))) with check (exists (select 1 from public.acquisition_pipelines p where p.id = pipeline_id and (p.owner_id = auth.uid() or public.is_admin())));
create policy "Owners manage acquisition responses" on public.acquisition_counterparty_responses for all to authenticated using (exists (select 1 from public.acquisition_pipelines p where p.id = pipeline_id and (p.owner_id = auth.uid() or public.is_admin()))) with check (exists (select 1 from public.acquisition_pipelines p where p.id = pipeline_id and (p.owner_id = auth.uid() or public.is_admin())));
create policy "Owners manage acquisition contracts" on public.acquisition_contracts for all to authenticated using (exists (select 1 from public.acquisition_pipelines p where p.id = pipeline_id and (p.owner_id = auth.uid() or public.is_admin()))) with check (exists (select 1 from public.acquisition_pipelines p where p.id = pipeline_id and (p.owner_id = auth.uid() or public.is_admin())));
create policy "Owners manage acquisition contingencies" on public.acquisition_contingencies for all to authenticated using (exists (select 1 from public.acquisition_pipelines p where p.id = pipeline_id and (p.owner_id = auth.uid() or public.is_admin()))) with check (exists (select 1 from public.acquisition_pipelines p where p.id = pipeline_id and (p.owner_id = auth.uid() or public.is_admin())));
create policy "Owners manage acquisition diligence" on public.acquisition_due_diligence_items for all to authenticated using (exists (select 1 from public.acquisition_pipelines p where p.id = pipeline_id and (p.owner_id = auth.uid() or public.is_admin()))) with check (exists (select 1 from public.acquisition_pipelines p where p.id = pipeline_id and (p.owner_id = auth.uid() or public.is_admin())));
create policy "Owners read acquisition requirement history" on public.acquisition_requirement_history for select to authenticated using (exists (select 1 from public.acquisition_pipelines p where p.id = pipeline_id and (p.owner_id = auth.uid() or public.is_admin())));
create policy "Owners manage acquisition receipts" on public.acquisition_command_receipts for all to authenticated using (owner_id = auth.uid() or public.is_admin()) with check (owner_id = auth.uid() or public.is_admin());

grant select, insert, update on public.acquisition_pipelines to authenticated;
grant select, insert, update on public.acquisition_offers, public.acquisition_counterparty_responses, public.acquisition_contracts, public.acquisition_contingencies, public.acquisition_due_diligence_items, public.acquisition_command_receipts to authenticated;
grant select on public.acquisition_stage_history, public.acquisition_pipeline_activity, public.acquisition_requirement_history to authenticated;

-- Storage-level protection: history and receipts are append-only; lifecycle decisions remain domain-owned.
create or replace function public.prevent_acquisition_history_mutation() returns trigger language plpgsql as $$ begin raise exception 'Acquisition history is append-only' using errcode = 'P0001'; end; $$;
create trigger acquisition_stage_history_append_only before update or delete on public.acquisition_stage_history for each row execute function public.prevent_acquisition_history_mutation();
create trigger acquisition_activity_append_only before update or delete on public.acquisition_pipeline_activity for each row execute function public.prevent_acquisition_history_mutation();
create trigger acquisition_requirement_history_append_only before update or delete on public.acquisition_requirement_history for each row execute function public.prevent_acquisition_history_mutation();

-- The application unit-of-work uses this security-definer boundary for mutations
-- that must update both aggregates and the command receipt in one transaction.
create or replace function public.save_acquisition_pipeline_transaction(
  p_pipeline jsonb,
  p_opportunity_id text,
  p_opportunity_status text,
  p_opportunity_expected_version integer,
  p_pipeline_expected_version integer,
  p_command_id text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare pipeline_row public.acquisition_pipelines; current_pipeline_version integer; current_opportunity_version integer; owner uuid; existing_receipt public.acquisition_command_receipts;
begin
  if auth.uid() is null then raise exception 'Acquisition access denied' using errcode = '42501'; end if;
  pipeline_row := jsonb_populate_record(null::public.acquisition_pipelines, p_pipeline);
  owner := pipeline_row.owner_id;
  if owner <> auth.uid() and not public.is_admin() then raise exception 'Acquisition access denied' using errcode = '42501'; end if;
  select * into existing_receipt from public.acquisition_command_receipts where owner_id = owner and command_id = p_command_id;
  if found then return jsonb_build_object('idempotent', true, 'result', existing_receipt.result); end if;
  select version into current_pipeline_version from public.acquisition_pipelines where id = pipeline_row.id and owner_id = owner for update;
  if found then
    if p_pipeline_expected_version is null or current_pipeline_version <> p_pipeline_expected_version or pipeline_row.version <> p_pipeline_expected_version + 1 then raise exception 'Stale Acquisition Pipeline version' using errcode = '40001'; end if;
    update public.acquisition_pipelines set stage=pipeline_row.stage, activation=pipeline_row.activation, closing_facts=pipeline_row.closing_facts, version=pipeline_row.version, updated_at=pipeline_row.updated_at where id=pipeline_row.id and owner_id=owner and version=p_pipeline_expected_version;
  else
    if p_pipeline_expected_version is not null or pipeline_row.version <> 1 then raise exception 'Invalid initial Acquisition Pipeline version' using errcode = '40001'; end if;
    insert into public.acquisition_pipelines select pipeline_row.*;
  end if;
  select version into current_opportunity_version from public.investment_opportunities where id=p_opportunity_id and owner_id=owner for update;
  if not found then raise exception 'Investment Opportunity not found' using errcode = '42501'; end if;
  if p_opportunity_expected_version is not null and current_opportunity_version <> p_opportunity_expected_version then raise exception 'Stale Investment Opportunity version' using errcode = '40001'; end if;
  update public.investment_opportunities set status=p_opportunity_status, version=version+1, updated_at=pipeline_row.updated_at where id=p_opportunity_id and owner_id=owner and status <> p_opportunity_status;
  insert into public.acquisition_command_receipts(owner_id,command_id,command_type,pipeline_id,completed_at,result) values(owner,p_command_id,'acquisition-pipeline',pipeline_row.id,pipeline_row.updated_at,jsonb_build_object('pipelineId',pipeline_row.id,'pipelineVersion',pipeline_row.version));
  return jsonb_build_object('idempotent', false, 'pipelineId', pipeline_row.id, 'pipelineVersion', pipeline_row.version);
end; $$;
revoke all on function public.save_acquisition_pipeline_transaction(jsonb,text,text,integer,integer,text) from public;
grant execute on function public.save_acquisition_pipeline_transaction(jsonb,text,text,integer,integer,text) to authenticated;

-- Rollback: drop policies/triggers/functions, then child tables, receipts, and acquisition_pipelines.
