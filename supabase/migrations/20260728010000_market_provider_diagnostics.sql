-- MI-002: correlated, safe Market Intelligence provider diagnostics.
begin;

create table public.market_analysis_runs(
  id text primary key,
  workspace_id uuid not null references public.owners(id) on delete restrict,
  user_id uuid not null references public.profiles(id) on delete restrict,
  property_id text,
  acquisition_route text not null check(acquisition_route in('purchase','rental-arbitrage')),
  subject_address_hash text not null check(length(subject_address_hash)=64),
  subject_property_type text not null,
  started_at timestamptz not null,
  completed_at timestamptz,
  duration_ms integer check(duration_ms is null or duration_ms>=0),
  result text not null check(result in('running','succeeded','failed')),
  application_error_code text,
  created_at timestamptz not null default now()
);
create index market_analysis_runs_workspace_started_idx on public.market_analysis_runs(workspace_id,started_at desc);

create table public.market_provider_operations(
  id text primary key,
  run_id text not null references public.market_analysis_runs(id) on delete restrict,
  attempt integer not null check(attempt>0),
  provider text not null,
  operation_type text not null check(operation_type in('property-resolution','sale-estimate','rent-estimate')),
  started_at timestamptz not null,
  completed_at timestamptz,
  duration_ms integer check(duration_ms is null or duration_ms>=0),
  result text not null check(result in('running','succeeded','failed')),
  request_fingerprint text not null check(length(request_fingerprint)=64),
  safe_request_metadata jsonb not null default '{}',
  http_status integer check(http_status is null or http_status between 100 and 599),
  provider_error_code text,
  application_error_code text,
  classification text check(classification is null or classification in(
    'SUCCESS','INVALID_REQUEST','AUTHENTICATION','AUTHORIZATION','SUBJECT_NOT_FOUND',
    'TIMEOUT','RATE_LIMITED','PROVIDER_FAILURE','TRANSPORT_FAILURE',
    'PROVIDER_SERIALIZATION','UNKNOWN'
  )),
  retryable boolean not null default false,
  payload_size integer check(payload_size is null or payload_size>=0),
  response_hash text check(response_hash is null or length(response_hash)=64),
  unique(run_id,operation_type,attempt)
);
create index market_provider_operations_run_started_idx on public.market_provider_operations(run_id,started_at);

create table public.market_provider_events(
  id text primary key,
  run_id text not null references public.market_analysis_runs(id) on delete restrict,
  operation_id text references public.market_provider_operations(id) on delete restrict,
  event_type text not null check(event_type in('analysis-stage','provider-request-started','provider-request-completed')),
  stage text not null,
  status text not null check(status in('started','completed','failed')),
  safe_metadata jsonb not null default '{}',
  occurred_at timestamptz not null
);
create index market_provider_events_timeline_idx on public.market_provider_events(run_id,occurred_at,id);

alter table public.market_analysis_runs enable row level security;
alter table public.market_provider_operations enable row level security;
alter table public.market_provider_events enable row level security;

create policy "Admins inspect Market analysis runs" on public.market_analysis_runs
for select to authenticated using(public.is_admin());
create policy "Admins inspect Market provider operations" on public.market_provider_operations
for select to authenticated using(public.is_admin());
create policy "Admins inspect Market provider events" on public.market_provider_events
for select to authenticated using(public.is_admin());

grant select on public.market_analysis_runs,public.market_provider_operations,public.market_provider_events to authenticated;

create view public.market_analysis_execution_timeline
with(security_invoker=true) as
select
  event.run_id,
  event.id as event_id,
  event.operation_id,
  event.event_type,
  event.stage,
  event.status,
  event.occurred_at,
  operation.provider,
  operation.operation_type,
  operation.attempt,
  operation.duration_ms,
  operation.http_status,
  operation.provider_error_code,
  operation.application_error_code,
  operation.classification,
  operation.retryable,
  event.safe_metadata
from public.market_provider_events event
left join public.market_provider_operations operation on operation.id=event.operation_id;
grant select on public.market_analysis_execution_timeline to authenticated;

create or replace function public.prevent_market_provider_event_change()
returns trigger language plpgsql as $$begin raise exception 'market provider events are append-only' using errcode='55000';end$$;
create trigger market_provider_events_append_only before update on public.market_provider_events
for each row execute function public.prevent_market_provider_event_change();

create or replace function public.prune_market_provider_diagnostics(p_retention interval default interval '30 days')
returns integer language plpgsql security definer set search_path=public as $$
declare deleted_runs integer;
begin
  if auth.role()<>'service_role' then
    raise exception 'market diagnostics retention requires service role' using errcode='42501';
  end if;
  if p_retention<interval '1 day' then
    raise exception 'market diagnostics retention must be at least one day';
  end if;
  delete from public.market_provider_events event
  using public.market_analysis_runs run
  where event.run_id=run.id and run.started_at<now()-p_retention;
  delete from public.market_provider_operations operation
  using public.market_analysis_runs run
  where operation.run_id=run.id and run.started_at<now()-p_retention;
  delete from public.market_analysis_runs where started_at<now()-p_retention;
  get diagnostics deleted_runs=row_count;
  return deleted_runs;
end$$;
revoke all on function public.prune_market_provider_diagnostics(interval) from public;
grant execute on function public.prune_market_provider_diagnostics(interval) to service_role;

commit;
