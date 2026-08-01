create table public.provider_api_call_log (
  id bigint generated always as identity primary key,
  provider text not null,
  occurred_at timestamptz not null default now()
);
create index provider_api_call_log_provider_idx on public.provider_api_call_log(provider);

alter table public.provider_api_call_log enable row level security;
create policy "Authenticated users read provider API call volume"
on public.provider_api_call_log for select to authenticated using (true);
grant select on public.provider_api_call_log to authenticated;

create view public.provider_api_call_counts
with (security_invoker=true) as
select provider, count(*) as call_count
from public.provider_api_call_log
group by provider;
grant select on public.provider_api_call_counts to authenticated;
