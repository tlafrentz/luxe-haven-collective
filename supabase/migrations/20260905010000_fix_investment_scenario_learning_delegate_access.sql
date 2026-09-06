-- Fix: scenario comparison / outcome / observation RPCs and their RLS were
-- never updated by 20260727020000_saved_analysis_canonical_recovery.sql's
-- workspace/delegate refactor. Three compounding defects, all fixed here:
--
-- 1. Existence checks still query investment_opportunity_analyses, a table
--    that migration deliberately stopped populating for scenarios and
--    purged existing scenario rows from -- so every one of these three
--    RPCs unconditionally raises scenario_unavailable for everyone,
--    owner included. Fixed to check investment_scenarios (by scenario_id)
--    instead, matching create_investment_scenario/mutate_investment_scenario.
-- 2. Authorization is still the pre-refactor "literal creator or platform
--    admin" check (owner_id=actor_id or is_admin()), never upgraded to
--    can_manage_investment_opportunity(workspace_id,property_id) like its
--    sibling RPCs -- so a workspace delegate (administrator/operator/
--    contributor) who can already create/edit scenarios cannot save a
--    comparison selection, record an outcome, or add an observation.
-- 3. The four new tables these RPCs write to were seeded with
--    investment_opportunities.owner_id (the original creator's auth.users
--    id) in a column named workspace_id -- not the real workspace id
--    (investment_opportunities.workspace_id, an owners.id). Every RLS
--    policy on those tables (and the pre-existing, correctly-designed
--    learning_subjects/learning_evidence/learning_lineage policies these
--    RPCs also feed) checks workspace_id against a real workspace concept
--    (active_workspace_role / can_read_investment_opportunity), so this
--    mislabeling makes the rows unreadable to everyone except, by
--    coincidence, the literal creator -- not even the workspace owner
--    querying normally, and never a delegate. Fixed by writing the real
--    workspace_id and updating the RLS policies to match.
--
-- Also fixes a check-then-act idempotency race in record_investment_scenario_
-- outcome/add_investment_scenario_observation: the command-id receipt was
-- read before the advisory lock was taken (add_investment_scenario_observation
-- took no lock at all), so two concurrent identical requests could both pass
-- the "not yet recorded" check and race on the receipts table's primary key,
-- surfacing a raw unique-violation instead of an idempotent replay.
--
-- Also fixes a schema-level instance of the same stale-table defect: all
-- three tables these RPCs write scenario-linked rows into were declared with
-- a hard foreign key from scenario_id to investment_opportunity_analyses(id)
-- -- the same table the refactor stopped populating for scenarios and purged
-- existing scenario rows from. Even with the app-logic existence check fixed
-- above, every insert would still fail with a foreign-key violation. Confirmed
-- by actually running this migration against a real local Postgres instance,
-- not just by reading the RPC bodies -- a plain code review would not have
-- caught this. Re-points each constraint at investment_scenarios(scenario_id),
-- the table that has actually owned scenario identity since that refactor.
--
-- CRITICAL, separately discovered while verifying the above against a real
-- database: can_read_investment_opportunity/can_manage_investment_opportunity
-- (20260727020000_saved_analysis_canonical_recovery.sql) return SQL NULL, not
-- false, for any actor with no workspace_memberships row at all (active_
-- workspace_role returns null, and null propagates through `in (...)` and
-- `or` untouched). Every RPC that gates on `not can_manage_investment_
-- opportunity(...)`/`not can_read_investment_opportunity(...)` inside an
-- `if ... then raise exception` -- create_investment_scenario, mutate_
-- investment_scenario, save_investment_opportunity, get_investment_
-- opportunity_bundle, and now this migration's own three RPCs -- silently
-- lets a non-member through, because PL/pgSQL's `if <null> then` never
-- executes the exception. (RLS policies built directly from these two
-- functions are unaffected: Postgres treats a null USING clause as "exclude
-- the row," which is already the correct deny outcome -- only the RPC-level
-- `if not ... then raise` pattern inverts a null into permissive behavior.)
-- This is a live, currently-exploitable cross-tenant bypass predating this
-- migration entirely, not something introduced here -- fixed by coalescing
-- both functions to false, which repairs every consumer at once since none
-- of them need to change.
begin;

create or replace function public.can_read_investment_opportunity(p_workspace_id uuid,p_property_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select coalesce(
    public.active_workspace_role(p_workspace_id) in ('owner','administrator')
      or (
        public.active_workspace_role(p_workspace_id) is not null
        and p_property_id is not null
        and public.can_access_workspace_property(p_property_id)
      ),
    false
  )
$$;
create or replace function public.can_manage_investment_opportunity(p_workspace_id uuid,p_property_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select coalesce(
    public.active_workspace_role(p_workspace_id) in ('owner','administrator')
      or (
        public.active_workspace_role(p_workspace_id) in ('operator','contributor')
        and p_property_id is not null
        and public.can_access_workspace_property(p_property_id)
      ),
    false
  )
$$;

alter table public.investment_scenario_outcome_revisions drop constraint if exists investment_scenario_outcome_revisions_scenario_id_fkey;
alter table public.investment_scenario_outcome_revisions add constraint investment_scenario_outcome_revisions_scenario_id_fkey foreign key (scenario_id) references public.investment_scenarios(scenario_id) on delete restrict;
alter table public.investment_scenario_observations drop constraint if exists investment_scenario_observations_scenario_id_fkey;
alter table public.investment_scenario_observations add constraint investment_scenario_observations_scenario_id_fkey foreign key (scenario_id) references public.investment_scenarios(scenario_id) on delete restrict;
alter table public.investment_scenario_learning_activity drop constraint if exists investment_scenario_learning_activity_scenario_id_fkey;
alter table public.investment_scenario_learning_activity add constraint investment_scenario_learning_activity_scenario_id_fkey foreign key (scenario_id) references public.investment_scenarios(scenario_id) on delete restrict;

-- Best-effort backfill: repair any rows written during the narrow window
-- (2026-07-26 to 2026-07-27) when investment_opportunity_analyses still held
-- scenario rows and these RPCs could have actually succeeded, storing the
-- wrong workspace_id. Safe to run even if zero rows match.
update public.investment_scenario_outcome_revisions revision
set workspace_id=o.workspace_id
from public.investment_opportunities o
where o.id=revision.opportunity_id and revision.workspace_id<>o.workspace_id;
update public.investment_scenario_observations observation
set workspace_id=o.workspace_id
from public.investment_opportunities o
where o.id=observation.opportunity_id and observation.workspace_id<>o.workspace_id;
update public.investment_scenario_learning_activity activity
set workspace_id=o.workspace_id
from public.investment_opportunities o
where o.id=activity.opportunity_id and activity.workspace_id<>o.workspace_id;
update public.learning_subjects subject
set workspace_id=o.workspace_id
from public.investment_scenarios scenario
join public.investment_opportunities o on o.id=scenario.opportunity_id
where subject.subject_type='investment-scenario'
  and subject.source_id=scenario.scenario_id
  and subject.workspace_id<>o.workspace_id;
-- investment_scenario_learning_receipts has no opportunity_id to backfill
-- against, and learning_evidence/learning_lineage have no direct scenario
-- reference either -- any stale rows from that narrow window are accepted
-- as a disclosed limitation on pre-existing historical data, not a
-- reintroduction of the bug going forward.

drop policy if exists "Owners inspect scenario outcomes" on public.investment_scenario_outcome_revisions;
create policy "Workspace members read scenario outcomes" on public.investment_scenario_outcome_revisions for select to authenticated using(exists(select 1 from public.investment_opportunities o where o.id=opportunity_id and public.can_read_investment_opportunity(o.workspace_id,o.property_id)));
drop policy if exists "Owners inspect scenario observations" on public.investment_scenario_observations;
create policy "Workspace members read scenario observations" on public.investment_scenario_observations for select to authenticated using(exists(select 1 from public.investment_opportunities o where o.id=opportunity_id and public.can_read_investment_opportunity(o.workspace_id,o.property_id)));
drop policy if exists "Owners inspect scenario learning activity" on public.investment_scenario_learning_activity;
create policy "Workspace members read scenario learning activity" on public.investment_scenario_learning_activity for select to authenticated using(exists(select 1 from public.investment_opportunities o where o.id=opportunity_id and public.can_read_investment_opportunity(o.workspace_id,o.property_id)));
drop policy if exists "Owners inspect own scenario learning receipts" on public.investment_scenario_learning_receipts;
create policy "Workspace members read scenario learning receipts" on public.investment_scenario_learning_receipts for select to authenticated using(public.active_workspace_role(workspace_id) is not null or public.is_admin());
drop policy if exists "Operators read own scenario comparison session" on public.investment_scenario_comparison_sessions;
create policy "Workspace members read own scenario comparison session" on public.investment_scenario_comparison_sessions for select to authenticated using(profile_id=auth.uid() and exists(select 1 from public.investment_opportunities o where o.id=opportunity_id and public.can_read_investment_opportunity(o.workspace_id,o.property_id)));

create or replace function public.save_scenario_comparison_session(p_opportunity_id text,p_scenario_ids text[])
returns void language plpgsql security definer set search_path=public as $$
declare o public.investment_opportunities%rowtype;
begin
  select * into o from public.investment_opportunities where id=p_opportunity_id;
  if o.id is null or auth.uid() is null or not public.can_manage_investment_opportunity(o.workspace_id,o.property_id) then raise exception 'scenario_permission_denied' using errcode='42501';end if;
  if cardinality(p_scenario_ids)<2 or cardinality(p_scenario_ids)>4 or cardinality(p_scenario_ids)<>cardinality(array(select distinct value from unnest(p_scenario_ids)value))then raise exception 'scenario_selection_invalid';end if;
  if exists(select 1 from unnest(p_scenario_ids)value where not exists(select 1 from public.investment_scenarios scenario where scenario.scenario_id=value and scenario.opportunity_id=o.id))then raise exception 'scenario_unavailable';end if;
  insert into public.investment_scenario_comparison_sessions values(p_opportunity_id,auth.uid(),p_scenario_ids,now())
  on conflict(opportunity_id,profile_id)do update set scenario_ids=excluded.scenario_ids,updated_at=excluded.updated_at;
end $$;

create or replace function public.record_investment_scenario_outcome(
  p_opportunity_id text,p_scenario_id text,p_outcome_id text,p_command_id text,
  p_period_start date,p_period_end date,p_actual_metrics jsonb,
  p_recommendation_outcome text,p_confidence text,p_evidence jsonb
) returns text language plpgsql security definer set search_path=public as $$
declare
  actor_id uuid:=auth.uid(); o public.investment_opportunities%rowtype; next_revision integer; fingerprint text;
  receipt public.investment_scenario_learning_receipts; subject_id text; evidence_id text; lineage_id text;
begin
  select * into o from public.investment_opportunities where id=p_opportunity_id;
  if o.id is null or actor_id is null or not public.can_manage_investment_opportunity(o.workspace_id,o.property_id) then raise exception 'scenario_permission_denied' using errcode='42501'; end if;
  if not exists(select 1 from public.investment_scenarios where scenario_id=p_scenario_id and opportunity_id=o.id) then raise exception 'scenario_unavailable'; end if;
  if p_period_end<p_period_start or jsonb_typeof(p_actual_metrics)<>'object' or p_actual_metrics='{}'::jsonb or jsonb_typeof(p_evidence)<>'array' or jsonb_array_length(p_evidence)=0 then raise exception 'scenario_outcome_invalid'; end if;
  if exists(select 1 from jsonb_object_keys(p_actual_metrics) key where key not in('annualRevenue','adr','occupancy','operatingExpenses','noi','annualCashFlow','cashOnCashReturn'))
    or exists(select 1 from jsonb_each(p_actual_metrics) item where jsonb_typeof(item.value)<>'number')
    or coalesce((p_actual_metrics->>'occupancy')::numeric,0)<0 or coalesce((p_actual_metrics->>'occupancy')::numeric,0)>100
    or coalesce((p_actual_metrics->>'annualRevenue')::numeric,0)<0 or coalesce((p_actual_metrics->>'adr')::numeric,0)<0
    or coalesce((p_actual_metrics->>'operatingExpenses')::numeric,0)<0
  then raise exception 'scenario_outcome_invalid'; end if;
  fingerprint:=encode(digest(concat_ws('|',p_scenario_id,p_period_start,p_period_end,p_actual_metrics::text,p_recommendation_outcome,p_confidence,p_evidence::text),'sha256'),'hex');
  perform pg_advisory_xact_lock(hashtext(p_scenario_id));
  select * into receipt from public.investment_scenario_learning_receipts where workspace_id=o.workspace_id and command_id=p_command_id;
  if found then
    if receipt.payload_hash<>fingerprint then raise exception 'scenario_idempotency_conflict'; end if;
    return receipt.result_id;
  end if;
  select coalesce(max(revision),0)+1 into next_revision from public.investment_scenario_outcome_revisions where series_id=p_scenario_id;
  insert into public.investment_scenario_outcome_revisions values(p_outcome_id,p_scenario_id,next_revision,p_opportunity_id,p_scenario_id,o.workspace_id,p_period_start,p_period_end,p_actual_metrics,p_recommendation_outcome,p_confidence,p_evidence,actor_id,now());
  insert into public.investment_scenario_learning_receipts values(o.workspace_id,p_command_id,'record-outcome',fingerprint,p_outcome_id,now());
  insert into public.investment_scenario_learning_activity values('scenario-learning-activity-'||gen_random_uuid(),p_opportunity_id,p_scenario_id,o.workspace_id,actor_id,'measurement-added','Measured operating outcome appended without changing the scenario forecast.',now());
  insert into public.investment_scenario_learning_activity values('scenario-learning-activity-'||gen_random_uuid(),p_opportunity_id,p_scenario_id,o.workspace_id,actor_id,'lesson-generated','Structured scenario lessons regenerated from measured evidence.',now());
  insert into public.investment_scenario_learning_activity values('scenario-learning-activity-'||gen_random_uuid(),p_opportunity_id,p_scenario_id,o.workspace_id,actor_id,'calibration-updated','Scenario confidence calibration updated from the latest outcome revision.',now());

  subject_id:='learning-subject-scenario-'||p_scenario_id;
  evidence_id:='learning-evidence-scenario-outcome-'||p_outcome_id;
  lineage_id:='learning-lineage-scenario-outcome-'||p_outcome_id;
  insert into public.learning_subjects(id,workspace_id,subject_type,source_capability,source_id,source_version,created_by_profile_id,created_at)
  values(subject_id,o.workspace_id,'investment-scenario','investment-scenarios',p_scenario_id,p_scenario_id,actor_id,now()) on conflict do nothing;
  insert into public.learning_evidence(id,workspace_id,evidence_references,confidence,freshness,captured_at)
  values(evidence_id,o.workspace_id,p_evidence,p_confidence,'current',now()) on conflict do nothing;
  insert into public.learning_lineage(id,workspace_id,subject_id,from_reference,to_reference,relationship,created_at)
  values(lineage_id,o.workspace_id,subject_id,jsonb_build_object('type','investment-scenario','id',p_scenario_id),jsonb_build_object('type','scenario-outcome','id',p_outcome_id,'evidenceId',evidence_id),'measured-by',now()) on conflict do nothing;
  return p_outcome_id;
end $$;

create or replace function public.add_investment_scenario_observation(
  p_opportunity_id text,p_scenario_id text,p_observation_id text,p_command_id text,p_body text,p_observed_at timestamptz
) returns text language plpgsql security definer set search_path=public as $$
declare actor_id uuid:=auth.uid();o public.investment_opportunities%rowtype;fingerprint text;receipt public.investment_scenario_learning_receipts;
begin
  select * into o from public.investment_opportunities where id=p_opportunity_id;
  if o.id is null or actor_id is null or not public.can_manage_investment_opportunity(o.workspace_id,o.property_id) then raise exception 'scenario_permission_denied' using errcode='42501'; end if;
  if not exists(select 1 from public.investment_scenarios where scenario_id=p_scenario_id and opportunity_id=o.id) then raise exception 'scenario_unavailable'; end if;
  if length(trim(p_body))not between 1 and 5000 then raise exception 'scenario_observation_invalid'; end if;
  fingerprint:=encode(digest(concat_ws('|',p_scenario_id,trim(p_body),p_observed_at),'sha256'),'hex');
  perform pg_advisory_xact_lock(hashtext(p_scenario_id));
  select * into receipt from public.investment_scenario_learning_receipts where workspace_id=o.workspace_id and command_id=p_command_id;
  if found then if receipt.payload_hash<>fingerprint then raise exception 'scenario_idempotency_conflict';end if;return receipt.result_id;end if;
  insert into public.investment_scenario_observations values(p_observation_id,p_opportunity_id,p_scenario_id,o.workspace_id,trim(p_body),p_observed_at,actor_id,now());
  insert into public.investment_scenario_learning_receipts values(o.workspace_id,p_command_id,'add-observation',fingerprint,p_observation_id,now());
  insert into public.investment_scenario_learning_activity values('scenario-learning-activity-'||gen_random_uuid(),p_opportunity_id,p_scenario_id,o.workspace_id,actor_id,'observation-added','Operator observation appended as scenario learning evidence.',now());
  return p_observation_id;
end $$;

commit;
