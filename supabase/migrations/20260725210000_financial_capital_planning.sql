-- FI-001F governed capital-plan persistence. Financial decisions and execution
-- actions remain in the canonical platform Decision and Action stores.
create table if not exists public.financial_capital_plans (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.profiles(id) on delete cascade,
  scope jsonb not null, period jsonb not null, status text not null check(status in ('draft','under-review','approved','active','amended','superseded','closed','cancelled')),
  current_version integer not null default 1 check(current_version > 0), selected_alternative_id text, decision_id text,
  approved_by_profile_id uuid references public.profiles(id), approved_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.financial_capital_plan_versions (
  plan_id uuid not null references public.financial_capital_plans(id) on delete cascade, version integer not null check(version > 0),
  snapshot jsonb not null, evidence_version text not null, created_by_profile_id uuid references public.profiles(id),
  created_at timestamptz not null default now(), primary key(plan_id,version)
);
create table if not exists public.financial_capital_requests (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.profiles(id) on delete cascade,
  property_id uuid references public.properties(id) on delete set null, status text not null, current_revision integer not null default 1,
  created_by_profile_id uuid references public.profiles(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.financial_capital_request_revisions (
  request_id uuid not null references public.financial_capital_requests(id) on delete cascade, revision integer not null,
  snapshot jsonb not null, evidence_version text not null, created_at timestamptz not null default now(), primary key(request_id,revision)
);
create table if not exists public.financial_capital_allocations (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.profiles(id) on delete cascade,
  plan_id uuid not null references public.financial_capital_plans(id), request_id uuid not null references public.financial_capital_requests(id),
  decision_id text not null, status text not null, approved_amount_minor bigint not null check(approved_amount_minor >= 0), currency text not null,
  funding_source_id text not null, revision integer not null default 1, conditions jsonb not null default '[]', review_at timestamptz not null,
  measurement_plan_id text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.financial_capital_command_receipts (
  workspace_id uuid not null references public.profiles(id) on delete cascade, idempotency_key text not null,
  result_id text not null, created_at timestamptz not null default now(), primary key(workspace_id,idempotency_key)
);
create index if not exists financial_capital_plans_workspace_idx on public.financial_capital_plans(workspace_id,status);
create index if not exists financial_capital_requests_workspace_idx on public.financial_capital_requests(workspace_id,status);
create index if not exists financial_capital_allocations_plan_idx on public.financial_capital_allocations(plan_id,status);
alter table public.financial_capital_plans enable row level security;
alter table public.financial_capital_plan_versions enable row level security;
alter table public.financial_capital_requests enable row level security;
alter table public.financial_capital_request_revisions enable row level security;
alter table public.financial_capital_allocations enable row level security;
alter table public.financial_capital_command_receipts enable row level security;
create policy "capital plans workspace access" on public.financial_capital_plans for select using(public.can_access_platform_action_workspace(workspace_id));
create policy "capital requests workspace access" on public.financial_capital_requests for select using(public.can_access_platform_action_workspace(workspace_id));
create policy "capital allocations workspace access" on public.financial_capital_allocations for select using(public.can_access_platform_action_workspace(workspace_id));
create policy "capital versions through plan access" on public.financial_capital_plan_versions for select using(exists(select 1 from public.financial_capital_plans p where p.id=plan_id and public.can_access_platform_action_workspace(p.workspace_id)));
create policy "capital request revisions through request access" on public.financial_capital_request_revisions for select using(exists(select 1 from public.financial_capital_requests r where r.id=request_id and public.can_access_platform_action_workspace(r.workspace_id)));
revoke all on public.financial_capital_plans,public.financial_capital_plan_versions,public.financial_capital_requests,public.financial_capital_request_revisions,public.financial_capital_allocations,public.financial_capital_command_receipts from anon;
grant select on public.financial_capital_plans,public.financial_capital_plan_versions,public.financial_capital_requests,public.financial_capital_request_revisions,public.financial_capital_allocations to authenticated;
