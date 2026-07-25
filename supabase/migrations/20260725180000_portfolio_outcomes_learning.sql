-- PI-001G immutable portfolio outcome reviews and versioned organizational learning.

create table public.portfolio_decision_outcome_reviews (
  id text not null,
  workspace_id uuid not null references public.owners(id) on delete cascade,
  decision_id text not null,
  outcome_id text not null,
  assessment_id text not null,
  assessment_version bigint not null,
  decision_evidence_version text not null,
  success text not null,
  snapshot jsonb not null,
  reviewed_by_profile_id uuid not null references public.profiles(id),
  reviewed_at timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (workspace_id, id),
  foreign key (workspace_id, decision_id)
    references public.portfolio_recommendation_reviews(workspace_id, id) on delete restrict,
  unique (workspace_id, assessment_id, assessment_version),
  constraint portfolio_outcome_success check (success in (
    'exceeded-expectations','met-expectations','partially-met',
    'did-not-meet','unable-to-evaluate'
  )),
  constraint portfolio_outcome_immutable check ((snapshot->>'immutable')::boolean is true)
);

create table public.portfolio_learning_records (
  id text not null,
  workspace_id uuid not null references public.owners(id) on delete cascade,
  category text not null,
  maturity text not null,
  confidence text not null,
  version bigint not null,
  snapshot jsonb not null,
  created_by_profile_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  primary key (workspace_id, id),
  constraint portfolio_learning_maturity check (maturity in (
    'emerging','supported','established','well-validated'
  ))
);

create table public.portfolio_learning_command_receipts (
  workspace_id uuid not null references public.owners(id) on delete cascade,
  command_id text not null,
  record_type text not null check (record_type in ('review','learning')),
  record_id text not null,
  payload_hash text not null,
  result_snapshot jsonb not null,
  completed_at timestamptz not null default now(),
  primary key (workspace_id, command_id)
);

create index portfolio_outcome_decision_idx
  on public.portfolio_decision_outcome_reviews(workspace_id, decision_id, reviewed_at desc);
create index portfolio_learning_category_idx
  on public.portfolio_learning_records(workspace_id, category, created_at desc);

alter table public.portfolio_decision_outcome_reviews enable row level security;
alter table public.portfolio_learning_records enable row level security;
alter table public.portfolio_learning_command_receipts enable row level security;

create policy "Workspace members read portfolio outcome reviews"
on public.portfolio_decision_outcome_reviews for select to authenticated
using (
  public.can_access_platform_action_workspace(workspace_id)
  and exists (
    select 1 from public.portfolio_recommendation_reviews decision
    where decision.workspace_id = portfolio_decision_outcome_reviews.workspace_id
      and decision.id = portfolio_decision_outcome_reviews.decision_id
  )
);
create policy "Workspace members read portfolio learning"
on public.portfolio_learning_records for select to authenticated
using (public.can_access_platform_action_workspace(workspace_id));
create policy "Workspace reviewers read learning receipts"
on public.portfolio_learning_command_receipts for select to authenticated
using (public.active_workspace_role(workspace_id) in ('owner','administrator'));

grant select on public.portfolio_decision_outcome_reviews,
  public.portfolio_learning_records, public.portfolio_learning_command_receipts to authenticated;

create or replace function public.append_portfolio_outcome_review(
  p_workspace_id uuid, p_review_id text, p_decision_id text,
  p_command_id text, p_snapshot jsonb
) returns jsonb language plpgsql security definer set search_path=public as $$
declare actor_id uuid:=auth.uid(); receipt public.portfolio_learning_command_receipts;
  fingerprint text:=encode(digest(p_snapshot::text,'sha256'),'hex');
begin
  if public.active_workspace_role(p_workspace_id) not in ('owner','administrator') then
    raise exception 'Outcome review authority required' using errcode='42501';
  end if;
  select * into receipt from public.portfolio_learning_command_receipts
  where workspace_id=p_workspace_id and command_id=p_command_id;
  if found then
    if receipt.payload_hash<>fingerprint then raise exception 'Idempotency key reused' using errcode='22023'; end if;
    return receipt.result_snapshot;
  end if;
  insert into public.portfolio_decision_outcome_reviews(
    id,workspace_id,decision_id,outcome_id,assessment_id,assessment_version,
    decision_evidence_version,success,snapshot,reviewed_by_profile_id,reviewed_at
  ) values (
    p_review_id,p_workspace_id,p_decision_id,p_snapshot->>'outcomeId',
    p_snapshot->>'assessmentId',(p_snapshot->>'assessmentVersion')::bigint,
    p_snapshot->>'decisionEvidenceVersion',p_snapshot->>'success',p_snapshot,
    actor_id,(p_snapshot->>'reviewDate')::timestamptz
  );
  insert into public.portfolio_learning_command_receipts
    (workspace_id,command_id,record_type,record_id,payload_hash,result_snapshot)
  values (p_workspace_id,p_command_id,'review',p_review_id,fingerprint,p_snapshot);
  return p_snapshot;
end; $$;

create or replace function public.append_portfolio_learning_record(
  p_workspace_id uuid, p_learning_id text, p_command_id text, p_snapshot jsonb
) returns jsonb language plpgsql security definer set search_path=public as $$
declare actor_id uuid:=auth.uid(); receipt public.portfolio_learning_command_receipts;
  fingerprint text:=encode(digest(p_snapshot::text,'sha256'),'hex');
begin
  if public.active_workspace_role(p_workspace_id) not in ('owner','administrator') then
    raise exception 'Learning publication authority required' using errcode='42501';
  end if;
  select * into receipt from public.portfolio_learning_command_receipts
  where workspace_id=p_workspace_id and command_id=p_command_id;
  if found then
    if receipt.payload_hash<>fingerprint then raise exception 'Idempotency key reused' using errcode='22023'; end if;
    return receipt.result_snapshot;
  end if;
  insert into public.portfolio_learning_records(
    id,workspace_id,category,maturity,confidence,version,snapshot,created_by_profile_id,created_at
  ) values (
    p_learning_id,p_workspace_id,p_snapshot->>'category',p_snapshot->>'maturity',
    p_snapshot->>'confidence',(p_snapshot->>'version')::bigint,p_snapshot,
    actor_id,(p_snapshot->>'createdAt')::timestamptz
  );
  insert into public.portfolio_learning_command_receipts
    (workspace_id,command_id,record_type,record_id,payload_hash,result_snapshot)
  values (p_workspace_id,p_command_id,'learning',p_learning_id,fingerprint,p_snapshot);
  return p_snapshot;
end; $$;

revoke all on function public.append_portfolio_outcome_review(uuid,text,text,text,jsonb) from public;
revoke all on function public.append_portfolio_learning_record(uuid,text,text,jsonb) from public;
grant execute on function public.append_portfolio_outcome_review(uuid,text,text,text,jsonb) to authenticated;
grant execute on function public.append_portfolio_learning_record(uuid,text,text,jsonb) to authenticated;
