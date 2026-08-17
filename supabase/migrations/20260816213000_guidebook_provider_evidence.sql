begin;

create table public.guidebook_creation_provider_evidence (
  id uuid primary key default gen_random_uuid(),
  verification_run_id uuid,
  job_id uuid not null,
  attempt_id uuid not null unique,
  workspace_id uuid not null,
  stage text not null check (stage in ('extraction','generation','section_regeneration')),
  provider_key text not null,
  provider_request_id text,
  configured_model text not null,
  resolved_snapshot text,
  upstream_http_status integer check (upstream_http_status between 100 and 599),
  response_status text check (response_status in ('completed','incomplete','failed')),
  incomplete_reason text,
  input_tokens bigint check (input_tokens is null or input_tokens >= 0),
  cached_input_tokens bigint check (cached_input_tokens is null or cached_input_tokens >= 0),
  output_tokens bigint check (output_tokens is null or output_tokens >= 0),
  reasoning_tokens bigint check (reasoning_tokens is null or reasoning_tokens >= 0),
  calculated_cost_usd numeric(12,8) check (calculated_cost_usd is null or calculated_cost_usd >= 0),
  latency_ms integer check (latency_ms is null or latency_ms >= 0),
  safe_classification text not null check (safe_classification in ('response_received','provider_failure','transport_failure','timeout','incomplete','invalid_structured_output','application_schema_failure','reconciliation_required')),
  schema_validation_paths jsonb not null default '[]',
  correlation_id uuid not null,
  recorded_at timestamptz not null default now(),
  check (jsonb_typeof(schema_validation_paths) = 'array')
);

create unique index guidebook_provider_evidence_request_unique
  on public.guidebook_creation_provider_evidence(provider_request_id)
  where provider_request_id is not null;
create index guidebook_provider_evidence_correlation_idx
  on public.guidebook_creation_provider_evidence(correlation_id, recorded_at);

create table public.guidebook_creation_provider_evidence_outcomes (
  id uuid primary key default gen_random_uuid(),
  evidence_id uuid not null references public.guidebook_creation_provider_evidence(id) on delete restrict,
  safe_classification text not null check (safe_classification in ('invalid_structured_output','application_schema_failure')),
  schema_validation_paths jsonb not null default '[]' check (jsonb_typeof(schema_validation_paths)='array'),
  correlation_id uuid not null,
  recorded_at timestamptz not null default now(),
  unique(evidence_id,safe_classification)
);

alter table public.guidebook_creation_provider_evidence enable row level security;
alter table public.guidebook_creation_provider_evidence_outcomes enable row level security;
create policy "Provider evidence is Admin-readable" on public.guidebook_creation_provider_evidence
  for select to authenticated using (public.is_admin());
create policy "Provider evidence outcomes are Admin-readable" on public.guidebook_creation_provider_evidence_outcomes
  for select to authenticated using (public.is_admin());
grant select on public.guidebook_creation_provider_evidence,public.guidebook_creation_provider_evidence_outcomes to authenticated;
revoke all on public.guidebook_creation_provider_evidence,public.guidebook_creation_provider_evidence_outcomes from anon;

create or replace function public.guidebook_provider_evidence_immutable()
returns trigger language plpgsql security invoker set search_path=public as $$
begin
  raise exception 'GUIDEBOOK_PROVIDER_EVIDENCE_IMMUTABLE' using errcode='P0001';
end;
$$;
create trigger guidebook_provider_evidence_no_update
  before update or delete on public.guidebook_creation_provider_evidence
  for each row execute function public.guidebook_provider_evidence_immutable();
create trigger guidebook_provider_evidence_outcomes_no_update
  before update or delete on public.guidebook_creation_provider_evidence_outcomes
  for each row execute function public.guidebook_provider_evidence_immutable();

alter table public.guidebook_creation_attempts drop constraint guidebook_creation_attempts_status_check;
alter table public.guidebook_creation_attempts add constraint guidebook_creation_attempts_status_check
  check (status in ('queued','processing','completed','retryable_failure','terminal_failure','cancelled','reconciliation_required'));

commit;
