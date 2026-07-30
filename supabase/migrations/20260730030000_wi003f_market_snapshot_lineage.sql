alter table public.investment_analysis_save_tokens
  add column if not exists analysis_id text,
  add column if not exists subject_property_snapshot_id text references public.property_snapshots(id) on delete restrict,
  add column if not exists market_snapshot_id uuid references public.str_market_snapshots(id) on delete restrict,
  add column if not exists assumption_version text,
  add column if not exists confidence_version text,
  add column if not exists comparable_policy_version text;

alter table public.investment_opportunity_analyses
  add column if not exists subject_property_snapshot_id text references public.property_snapshots(id) on delete restrict,
  add column if not exists market_snapshot_id uuid references public.str_market_snapshots(id) on delete restrict;

alter table public.investment_scenarios
  add column if not exists subject_property_snapshot_id text references public.property_snapshots(id) on delete restrict,
  add column if not exists market_snapshot_id uuid references public.str_market_snapshots(id) on delete restrict,
  add column if not exists source_analysis_id text;

create index if not exists investment_analysis_market_snapshot_idx
  on public.investment_opportunity_analyses(market_snapshot_id);
create index if not exists investment_scenario_market_snapshot_idx
  on public.investment_scenarios(market_snapshot_id);

create or replace function public.prevent_market_lineage_mutation()
returns trigger language plpgsql as $$
begin
  if old.market_snapshot_id is distinct from new.market_snapshot_id
     or old.subject_property_snapshot_id is distinct from new.subject_property_snapshot_id then
    raise exception 'Canonical market lineage is immutable';
  end if;
  return new;
end;
$$;

drop trigger if exists investment_scenario_market_lineage_immutable on public.investment_scenarios;
create trigger investment_scenario_market_lineage_immutable
before update on public.investment_scenarios
for each row execute function public.prevent_market_lineage_mutation();

create or replace function public.populate_scenario_market_lineage()
returns trigger language plpgsql as $$
begin
  select analysis.subject_property_snapshot_id, analysis.market_snapshot_id, analysis.investment_analysis_id
    into new.subject_property_snapshot_id, new.market_snapshot_id, new.source_analysis_id
  from public.investment_opportunity_analyses analysis
  where analysis.opportunity_id = new.opportunity_id
    and analysis.id = new.source_analysis_version_id;
  if not found then
    raise exception 'Authorized source analysis is required';
  end if;
  return new;
end;
$$;

drop trigger if exists investment_scenario_populate_market_lineage on public.investment_scenarios;
create trigger investment_scenario_populate_market_lineage
before insert on public.investment_scenarios
for each row execute function public.populate_scenario_market_lineage();
