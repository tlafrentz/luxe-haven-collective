-- IA-002A.7.4: operational requirement references, outcomes, history, and closing facts.
alter table public.acquisition_contingencies add column if not exists due_at timestamptz;
alter table public.acquisition_contingencies add column if not exists action_references jsonb not null default '[]'::jsonb;
alter table public.acquisition_contingencies add column if not exists evidence_references jsonb not null default '[]'::jsonb;
alter table public.acquisition_contingencies add column if not exists document_references jsonb not null default '[]'::jsonb;
alter table public.acquisition_due_diligence_items add column if not exists due_at timestamptz;
alter table public.acquisition_due_diligence_items add column if not exists action_references jsonb not null default '[]'::jsonb;
alter table public.acquisition_due_diligence_items add column if not exists evidence_references jsonb not null default '[]'::jsonb;
alter table public.acquisition_due_diligence_items add column if not exists document_references jsonb not null default '[]'::jsonb;
alter table public.acquisition_contingencies add constraint acquisition_contingencies_reference_arrays check (jsonb_typeof(action_references) = 'array' and jsonb_typeof(evidence_references) = 'array' and jsonb_typeof(document_references) = 'array');
alter table public.acquisition_due_diligence_items add constraint acquisition_diligence_reference_arrays check (jsonb_typeof(action_references) = 'array' and jsonb_typeof(evidence_references) = 'array' and jsonb_typeof(document_references) = 'array');
create index if not exists acquisition_contingencies_created_idx on public.acquisition_contingencies(pipeline_id, created_at, id);
create index if not exists acquisition_diligence_created_idx on public.acquisition_due_diligence_items(pipeline_id, created_at, id);
create index if not exists acquisition_requirement_history_order_idx on public.acquisition_requirement_history(pipeline_id, occurred_at, id);

alter table public.acquisition_pipelines add constraint acquisition_pipelines_closing_facts_object check (closing_facts is null or jsonb_typeof(closing_facts) = 'object');

-- Rollback: drop reference constraints/indexes and added columns.
