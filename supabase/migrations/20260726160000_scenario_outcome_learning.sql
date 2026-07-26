-- SCN v1.2: immutable scenario outcomes and evidence publication into Learning.
begin;

create table public.investment_scenario_outcome_revisions(
  id text primary key,
  series_id text not null,
  revision integer not null check(revision>0),
  opportunity_id text not null references public.investment_opportunities(id) on delete restrict,
  scenario_id text not null references public.investment_opportunity_analyses(id) on delete restrict,
  workspace_id uuid not null,
  period_start date not null,
  period_end date not null check(period_end>=period_start),
  actual_metrics jsonb not null check(jsonb_typeof(actual_metrics)='object'),
  recommendation_outcome text not null check(recommendation_outcome in('successful','mixed','unsuccessful','insufficient-data')),
  confidence text not null check(confidence in('high','moderate','low','insufficient-evidence')),
  evidence jsonb not null check(jsonb_typeof(evidence)='array' and jsonb_array_length(evidence)>0),
  created_by_profile_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique(series_id,revision)
);
create index investment_scenario_outcome_history_idx on public.investment_scenario_outcome_revisions(opportunity_id,scenario_id,revision desc);

create table public.investment_scenario_observations(
  id text primary key,
  opportunity_id text not null references public.investment_opportunities(id) on delete restrict,
  scenario_id text not null references public.investment_opportunity_analyses(id) on delete restrict,
  workspace_id uuid not null,
  body text not null check(length(trim(body)) between 1 and 5000),
  observed_at timestamptz not null,
  created_by_profile_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);
create index investment_scenario_observation_idx on public.investment_scenario_observations(scenario_id,observed_at desc);

create table public.investment_scenario_learning_activity(
  id text primary key,
  opportunity_id text not null references public.investment_opportunities(id) on delete restrict,
  scenario_id text not null references public.investment_opportunity_analyses(id) on delete restrict,
  workspace_id uuid not null,
  actor_profile_id uuid references public.profiles(id),
  event_type text not null check(event_type in('property-purchased','measurement-added','observation-added','lesson-generated','calibration-updated')),
  safe_summary text not null,
  occurred_at timestamptz not null
);
create index investment_scenario_learning_activity_idx on public.investment_scenario_learning_activity(scenario_id,occurred_at desc);

create table public.investment_scenario_learning_receipts(
  workspace_id uuid not null,
  command_id text not null,
  command_type text not null check(command_type in('record-outcome','add-observation')),
  payload_hash text not null,
  result_id text not null,
  completed_at timestamptz not null default now(),
  primary key(workspace_id,command_id)
);

alter table public.investment_scenario_outcome_revisions enable row level security;
alter table public.investment_scenario_observations enable row level security;
alter table public.investment_scenario_learning_activity enable row level security;
alter table public.investment_scenario_learning_receipts enable row level security;
create policy "Owners inspect scenario outcomes" on public.investment_scenario_outcome_revisions for select to authenticated using(workspace_id=auth.uid() or public.is_admin());
create policy "Owners inspect scenario observations" on public.investment_scenario_observations for select to authenticated using(workspace_id=auth.uid() or public.is_admin());
create policy "Owners inspect scenario learning activity" on public.investment_scenario_learning_activity for select to authenticated using(workspace_id=auth.uid() or public.is_admin());
create policy "Owners inspect own scenario learning receipts" on public.investment_scenario_learning_receipts for select to authenticated using(workspace_id=auth.uid() or public.is_admin());
grant select on public.investment_scenario_outcome_revisions,public.investment_scenario_observations,public.investment_scenario_learning_activity,public.investment_scenario_learning_receipts to authenticated;

create trigger investment_scenario_outcomes_append_only before update or delete on public.investment_scenario_outcome_revisions for each row execute function public.prevent_learning_history_change();
create trigger investment_scenario_observations_append_only before update or delete on public.investment_scenario_observations for each row execute function public.prevent_learning_history_change();
create trigger investment_scenario_learning_activity_append_only before update or delete on public.investment_scenario_learning_activity for each row execute function public.prevent_learning_history_change();
create trigger investment_scenario_learning_receipts_append_only before update or delete on public.investment_scenario_learning_receipts for each row execute function public.prevent_learning_history_change();

create or replace function public.record_investment_scenario_outcome(
  p_opportunity_id text,p_scenario_id text,p_outcome_id text,p_command_id text,
  p_period_start date,p_period_end date,p_actual_metrics jsonb,
  p_recommendation_outcome text,p_confidence text,p_evidence jsonb
) returns text language plpgsql security definer set search_path=public as $$
declare
  actor_id uuid:=auth.uid(); owner_id uuid; next_revision integer; fingerprint text;
  receipt public.investment_scenario_learning_receipts; subject_id text; evidence_id text; lineage_id text;
begin
  select opportunity.owner_id into owner_id from public.investment_opportunities opportunity where opportunity.id=p_opportunity_id;
  if actor_id is null or owner_id is null or (owner_id<>actor_id and not public.is_admin()) then raise exception 'scenario_permission_denied' using errcode='42501'; end if;
  if not exists(select 1 from public.investment_opportunity_analyses where id=p_scenario_id and opportunity_id=p_opportunity_id) then raise exception 'scenario_unavailable'; end if;
  if p_period_end<p_period_start or jsonb_typeof(p_actual_metrics)<>'object' or p_actual_metrics='{}'::jsonb or jsonb_typeof(p_evidence)<>'array' or jsonb_array_length(p_evidence)=0 then raise exception 'scenario_outcome_invalid'; end if;
  if exists(select 1 from jsonb_object_keys(p_actual_metrics) key where key not in('annualRevenue','adr','occupancy','operatingExpenses','noi','annualCashFlow','cashOnCashReturn'))
    or exists(select 1 from jsonb_each(p_actual_metrics) item where jsonb_typeof(item.value)<>'number')
    or coalesce((p_actual_metrics->>'occupancy')::numeric,0)<0 or coalesce((p_actual_metrics->>'occupancy')::numeric,0)>100
    or coalesce((p_actual_metrics->>'annualRevenue')::numeric,0)<0 or coalesce((p_actual_metrics->>'adr')::numeric,0)<0
    or coalesce((p_actual_metrics->>'operatingExpenses')::numeric,0)<0
  then raise exception 'scenario_outcome_invalid'; end if;
  fingerprint:=encode(digest(concat_ws('|',p_scenario_id,p_period_start,p_period_end,p_actual_metrics::text,p_recommendation_outcome,p_confidence,p_evidence::text),'sha256'),'hex');
  select * into receipt from public.investment_scenario_learning_receipts where workspace_id=owner_id and command_id=p_command_id;
  if found then
    if receipt.payload_hash<>fingerprint then raise exception 'scenario_idempotency_conflict'; end if;
    return receipt.result_id;
  end if;
  perform pg_advisory_xact_lock(hashtext(p_scenario_id));
  select coalesce(max(revision),0)+1 into next_revision from public.investment_scenario_outcome_revisions where series_id=p_scenario_id;
  insert into public.investment_scenario_outcome_revisions values(p_outcome_id,p_scenario_id,next_revision,p_opportunity_id,p_scenario_id,owner_id,p_period_start,p_period_end,p_actual_metrics,p_recommendation_outcome,p_confidence,p_evidence,actor_id,now());
  insert into public.investment_scenario_learning_receipts values(owner_id,p_command_id,'record-outcome',fingerprint,p_outcome_id,now());
  insert into public.investment_scenario_learning_activity values('scenario-learning-activity-'||gen_random_uuid(),p_opportunity_id,p_scenario_id,owner_id,actor_id,'measurement-added','Measured operating outcome appended without changing the scenario forecast.',now());
  insert into public.investment_scenario_learning_activity values('scenario-learning-activity-'||gen_random_uuid(),p_opportunity_id,p_scenario_id,owner_id,actor_id,'lesson-generated','Structured scenario lessons regenerated from measured evidence.',now());
  insert into public.investment_scenario_learning_activity values('scenario-learning-activity-'||gen_random_uuid(),p_opportunity_id,p_scenario_id,owner_id,actor_id,'calibration-updated','Scenario confidence calibration updated from the latest outcome revision.',now());

  subject_id:='learning-subject-scenario-'||p_scenario_id;
  evidence_id:='learning-evidence-scenario-outcome-'||p_outcome_id;
  lineage_id:='learning-lineage-scenario-outcome-'||p_outcome_id;
  insert into public.learning_subjects(id,workspace_id,subject_type,source_capability,source_id,source_version,created_by_profile_id,created_at)
  values(subject_id,owner_id,'investment-scenario','investment-scenarios',p_scenario_id,p_scenario_id,actor_id,now()) on conflict do nothing;
  insert into public.learning_evidence(id,workspace_id,evidence_references,confidence,freshness,captured_at)
  values(evidence_id,owner_id,p_evidence,p_confidence,'current',now()) on conflict do nothing;
  insert into public.learning_lineage(id,workspace_id,subject_id,from_reference,to_reference,relationship,created_at)
  values(lineage_id,owner_id,subject_id,jsonb_build_object('type','investment-scenario','id',p_scenario_id),jsonb_build_object('type','scenario-outcome','id',p_outcome_id,'evidenceId',evidence_id),'measured-by',now()) on conflict do nothing;
  return p_outcome_id;
end $$;

create or replace function public.add_investment_scenario_observation(
  p_opportunity_id text,p_scenario_id text,p_observation_id text,p_command_id text,p_body text,p_observed_at timestamptz
) returns text language plpgsql security definer set search_path=public as $$
declare actor_id uuid:=auth.uid();owner_id uuid;fingerprint text;receipt public.investment_scenario_learning_receipts;
begin
  select opportunity.owner_id into owner_id from public.investment_opportunities opportunity where opportunity.id=p_opportunity_id;
  if actor_id is null or owner_id is null or (owner_id<>actor_id and not public.is_admin()) then raise exception 'scenario_permission_denied' using errcode='42501'; end if;
  if not exists(select 1 from public.investment_opportunity_analyses where id=p_scenario_id and opportunity_id=p_opportunity_id) then raise exception 'scenario_unavailable'; end if;
  if length(trim(p_body))not between 1 and 5000 then raise exception 'scenario_observation_invalid'; end if;
  fingerprint:=encode(digest(concat_ws('|',p_scenario_id,trim(p_body),p_observed_at),'sha256'),'hex');
  select * into receipt from public.investment_scenario_learning_receipts where workspace_id=owner_id and command_id=p_command_id;
  if found then if receipt.payload_hash<>fingerprint then raise exception 'scenario_idempotency_conflict';end if;return receipt.result_id;end if;
  insert into public.investment_scenario_observations values(p_observation_id,p_opportunity_id,p_scenario_id,owner_id,trim(p_body),p_observed_at,actor_id,now());
  insert into public.investment_scenario_learning_receipts values(owner_id,p_command_id,'add-observation',fingerprint,p_observation_id,now());
  insert into public.investment_scenario_learning_activity values('scenario-learning-activity-'||gen_random_uuid(),p_opportunity_id,p_scenario_id,owner_id,actor_id,'observation-added','Operator observation appended as scenario learning evidence.',now());
  return p_observation_id;
end $$;

revoke all on function public.record_investment_scenario_outcome(text,text,text,text,date,date,jsonb,text,text,jsonb) from public;
revoke all on function public.add_investment_scenario_observation(text,text,text,text,text,timestamptz) from public;
grant execute on function public.record_investment_scenario_outcome(text,text,text,text,date,date,jsonb,text,text,jsonb) to authenticated;
grant execute on function public.add_investment_scenario_observation(text,text,text,text,text,timestamptz) to authenticated;
commit;
