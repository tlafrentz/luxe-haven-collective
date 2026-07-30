begin;

alter table public.investment_opportunities
  add column if not exists scenario_only boolean not null default false;

create index if not exists investment_opportunities_scenario_only_idx
  on public.investment_opportunities(workspace_id, scenario_only, updated_at desc);

comment on column public.investment_opportunities.scenario_only is
  'True while the analysis is a saved scenario and has not been promoted to the Opportunities pipeline.';

commit;
