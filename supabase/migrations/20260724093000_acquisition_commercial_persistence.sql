-- IA-002A.7.3: accepted agreement lineage and commercial persistence constraints.
alter table public.acquisition_pipelines add column if not exists accepted_agreement jsonb;
alter table public.acquisition_pipelines add constraint acquisition_pipelines_accepted_agreement_object check (accepted_agreement is null or jsonb_typeof(accepted_agreement) = 'object');
create index if not exists acquisition_contracts_pipeline_recorded_idx on public.acquisition_contracts(pipeline_id, recorded_at);
create index if not exists acquisition_responses_pipeline_responded_idx on public.acquisition_counterparty_responses(pipeline_id, responded_at, id);
create unique index if not exists acquisition_responses_one_id_idx on public.acquisition_counterparty_responses(id);

create table if not exists public.acquisition_agreement_bases (
  pipeline_id text primary key references public.acquisition_pipelines(id) on delete restrict,
  source text not null check (source in ('offer','counteroffer')),
  offer_id text not null references public.acquisition_offers(id) on delete restrict,
  response_id text references public.acquisition_counterparty_responses(id) on delete restrict,
  accepted_terms jsonb not null check (jsonb_typeof(accepted_terms) = 'object'),
  accepted_at timestamptz not null
);
alter table public.acquisition_agreement_bases enable row level security;
create policy "Owners manage acquisition agreement bases" on public.acquisition_agreement_bases for all to authenticated using (exists (select 1 from public.acquisition_pipelines p where p.id = pipeline_id and (p.owner_id = auth.uid() or public.is_admin()))) with check (exists (select 1 from public.acquisition_pipelines p where p.id = pipeline_id and (p.owner_id = auth.uid() or public.is_admin())));
grant select, insert, update on public.acquisition_agreement_bases to authenticated;

-- Commercial terms are immutable after submission; draft updates remain domain-controlled.
create or replace function public.prevent_submitted_acquisition_offer_mutation() returns trigger language plpgsql as $$ begin if old.status <> 'draft' and (new.terms is distinct from old.terms or new.source_analysis is distinct from old.source_analysis or new.route is distinct from old.route or new.sequence is distinct from old.sequence) then raise exception 'Submitted acquisition offers are immutable' using errcode = 'P0001'; end if; return new; end; $$;
create trigger acquisition_offers_submitted_immutable before update on public.acquisition_offers for each row execute function public.prevent_submitted_acquisition_offer_mutation();

-- Rollback: drop trigger/function, agreement RLS/policies/table, indexes, and column constraint/column.
