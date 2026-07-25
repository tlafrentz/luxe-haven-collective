-- PI-001F recommendation review extension for canonical Platform Decisions.
-- Workflow metadata remains distinct from immutable approved Decision snapshots.

create table if not exists public.portfolio_recommendation_reviews (
  id text not null,
  workspace_id uuid not null references public.owners(id) on delete cascade,
  recommendation_id text,
  status text not null,
  evidence_version text not null,
  affected_property_ids uuid[] not null default '{}',
  snapshot jsonb not null,
  revision bigint not null default 1,
  created_by_profile_id uuid not null references public.profiles(id),
  decided_by_profile_id uuid references public.profiles(id),
  review_at timestamptz,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, id),
  constraint portfolio_review_status check (status in (
    'draft','ready-for-review','under-review','approved','rejected',
    'deferred','superseded','completed','expired'
  )),
  constraint portfolio_review_revision check (revision > 0)
);

create table if not exists public.portfolio_decision_command_receipts (
  workspace_id uuid not null references public.owners(id) on delete cascade,
  command_id text not null,
  decision_id text not null,
  payload_hash text not null,
  completed_revision bigint not null,
  result_snapshot jsonb not null,
  completed_at timestamptz not null default now(),
  primary key (workspace_id, command_id)
);

create table if not exists public.portfolio_decision_measurement_plans (
  workspace_id uuid not null references public.owners(id) on delete cascade,
  decision_id text not null,
  plan jsonb not null,
  evidence_version text not null,
  review_at timestamptz not null,
  created_by_profile_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  primary key (workspace_id, decision_id),
  foreign key (workspace_id, decision_id)
    references public.portfolio_recommendation_reviews(workspace_id, id) on delete restrict
);

create index if not exists portfolio_reviews_workspace_status_idx
  on public.portfolio_recommendation_reviews(workspace_id, status);
create index if not exists portfolio_reviews_review_at_idx
  on public.portfolio_recommendation_reviews(workspace_id, review_at)
  where review_at is not null;

alter table public.portfolio_recommendation_reviews enable row level security;
alter table public.portfolio_decision_command_receipts enable row level security;
alter table public.portfolio_decision_measurement_plans enable row level security;

create policy "Workspace members read scoped portfolio decisions"
on public.portfolio_recommendation_reviews for select to authenticated
using (
  public.can_access_platform_action_workspace(workspace_id)
  and (
    affected_property_ids = '{}'
    or not exists (
      select 1 from unnest(affected_property_ids) property_id
      where not public.can_access_workspace_property(property_id)
    )
  )
);

create policy "Workspace owners manage portfolio decisions"
on public.portfolio_recommendation_reviews for all to authenticated
using (
  exists (
    select 1 from public.workspace_memberships membership
    where membership.workspace_id = portfolio_recommendation_reviews.workspace_id
      and membership.profile_id = auth.uid()
      and membership.role = 'owner' and membership.status = 'active'
  )
)
with check (
  exists (
    select 1 from public.workspace_memberships membership
    where membership.workspace_id = portfolio_recommendation_reviews.workspace_id
      and membership.profile_id = auth.uid()
      and membership.role = 'owner' and membership.status = 'active'
  )
);

create policy "Workspace owners read decision command receipts"
on public.portfolio_decision_command_receipts for select to authenticated
using (public.can_access_platform_action_workspace(workspace_id));

create policy "Workspace members read scoped measurement plans"
on public.portfolio_decision_measurement_plans for select to authenticated
using (public.can_access_platform_action_workspace(workspace_id));

create policy "Workspace owners manage measurement plans"
on public.portfolio_decision_measurement_plans for all to authenticated
using (
  exists (
    select 1 from public.workspace_memberships membership
    where membership.workspace_id = portfolio_decision_measurement_plans.workspace_id
      and membership.profile_id = auth.uid()
      and membership.role = 'owner' and membership.status = 'active'
  )
)
with check (
  exists (
    select 1 from public.workspace_memberships membership
    where membership.workspace_id = portfolio_decision_measurement_plans.workspace_id
      and membership.profile_id = auth.uid()
      and membership.role = 'owner' and membership.status = 'active'
  )
);

grant select on public.portfolio_recommendation_reviews,
  public.portfolio_decision_measurement_plans to authenticated;
grant insert, update on public.portfolio_decision_measurement_plans to authenticated;
grant select on public.portfolio_decision_command_receipts to authenticated;

create or replace function public.save_portfolio_recommendation_review(
  p_workspace_id uuid,
  p_decision_id text,
  p_expected_revision bigint,
  p_command_id text,
  p_snapshot jsonb
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  existing_receipt public.portfolio_decision_command_receipts;
  current_review public.portfolio_recommendation_reviews;
  payload_hash text := encode(digest(p_snapshot::text, 'sha256'), 'hex');
begin
  if actor_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if not exists (
    select 1 from public.workspace_memberships
    where workspace_id = p_workspace_id and profile_id = actor_id
      and role = 'owner' and status = 'active'
  ) then raise exception 'Portfolio decision authority required' using errcode = '42501'; end if;

  select * into existing_receipt from public.portfolio_decision_command_receipts
  where workspace_id = p_workspace_id and command_id = p_command_id;
  if found then
    if existing_receipt.payload_hash <> payload_hash then
      raise exception 'Idempotency key reused for a different command' using errcode = '22023';
    end if;
    return existing_receipt.result_snapshot;
  end if;

  select * into current_review from public.portfolio_recommendation_reviews
  where workspace_id = p_workspace_id and id = p_decision_id for update;
  if found and current_review.revision <> p_expected_revision then
    raise exception 'Decision updated by another user' using errcode = '40001';
  end if;

  insert into public.portfolio_recommendation_reviews(
    id, workspace_id, recommendation_id, status, evidence_version,
    affected_property_ids, snapshot, revision, created_by_profile_id,
    decided_by_profile_id, review_at, decided_at, created_at, updated_at
  ) values (
    p_decision_id, p_workspace_id, p_snapshot->>'recommendationId',
    p_snapshot->>'status', p_snapshot->>'evidenceVersion',
    coalesce(array(select jsonb_array_elements_text(p_snapshot->'affectedPropertyIds'))::uuid[], '{}'),
    p_snapshot, (p_snapshot->>'revision')::bigint, actor_id,
    nullif(p_snapshot->>'decidedByProfileId','')::uuid,
    nullif(p_snapshot->>'reviewAt','')::timestamptz,
    nullif(p_snapshot->>'decidedAt','')::timestamptz,
    coalesce(nullif(p_snapshot->>'createdAt','')::timestamptz, now()), now()
  )
  on conflict (workspace_id, id) do update set
    status = excluded.status, evidence_version = excluded.evidence_version,
    affected_property_ids = excluded.affected_property_ids,
    snapshot = excluded.snapshot, revision = excluded.revision,
    decided_by_profile_id = excluded.decided_by_profile_id,
    review_at = excluded.review_at, decided_at = excluded.decided_at,
    updated_at = now();

  insert into public.portfolio_decision_command_receipts(
    workspace_id, command_id, decision_id, payload_hash, completed_revision, result_snapshot
  ) values (
    p_workspace_id, p_command_id, p_decision_id, payload_hash,
    (p_snapshot->>'revision')::bigint, p_snapshot
  );
  return p_snapshot;
end;
$$;

revoke all on function public.save_portfolio_recommendation_review(uuid,text,bigint,text,jsonb) from public;
grant execute on function public.save_portfolio_recommendation_review(uuid,text,bigint,text,jsonb) to authenticated;
