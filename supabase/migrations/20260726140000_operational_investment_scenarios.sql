-- SCN v1.0: operational scenario metadata over immutable opportunity-analysis snapshots.
begin;

create table public.investment_scenarios(
  scenario_id text primary key references public.investment_opportunity_analyses(id) on delete restrict,
  opportunity_id text not null references public.investment_opportunities(id) on delete restrict,
  name text not null check(char_length(btrim(name)) between 1 and 120),
  scenario_type text not null check(scenario_type in('base','cash-purchase','rental-arbitrage','seller-financing','custom')),
  description text,
  notes text,
  status text not null check(status in('active','archived')),
  revision integer not null default 1 check(revision>0),
  created_by_profile_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  unique(opportunity_id,scenario_id)
);
create table public.investment_scenario_events(
  id text primary key,
  scenario_id text not null references public.investment_scenarios(scenario_id),
  opportunity_id text not null references public.investment_opportunities(id),
  event_type text not null check(event_type in('scenario-created','scenario-saved','scenario-duplicated','scenario-preferred','scenario-archived','scenario-restored')),
  actor_profile_id uuid,
  safe_summary text not null,
  scenario_revision integer not null,
  occurred_at timestamptz not null default now()
);
create unique index investment_scenario_one_base_idx on public.investment_scenarios(opportunity_id) where scenario_type='base' and status='active';
create index investment_scenarios_opportunity_idx on public.investment_scenarios(opportunity_id,status,updated_at desc);
create index investment_scenario_events_opportunity_idx on public.investment_scenario_events(opportunity_id,occurred_at desc);
alter table public.investment_scenarios enable row level security;
alter table public.investment_scenario_events enable row level security;
create policy "Owners read scenarios" on public.investment_scenarios for select to authenticated using(exists(select 1 from public.investment_opportunities opportunity where opportunity.id=opportunity_id and(opportunity.owner_id=auth.uid()or public.is_admin())));
create policy "Owners read scenario events" on public.investment_scenario_events for select to authenticated using(exists(select 1 from public.investment_opportunities opportunity where opportunity.id=opportunity_id and(opportunity.owner_id=auth.uid()or public.is_admin())));
grant select on public.investment_scenarios,public.investment_scenario_events to authenticated;
create trigger investment_scenario_events_immutable before update or delete on public.investment_scenario_events for each row execute function public.prevent_commerce_history_change();

create or replace function public.create_investment_scenario(
  p_opportunity_id text,p_source_scenario_id text,p_scenario_id text,p_name text,p_scenario_type text,p_description text,p_notes text,p_expected_version integer,p_command_id text
)returns table(scenario_id text,aggregate_version integer) language plpgsql security definer set search_path=public as $$
declare o public.investment_opportunities%rowtype;a public.investment_opportunity_analyses%rowtype;n integer;now_at timestamptz:=now();
begin
  select * into o from public.investment_opportunities where id=p_opportunity_id for update;
  if o.id is null or auth.uid() is null or(o.owner_id<>auth.uid()and not public.is_admin())then raise exception 'scenario_permission_denied' using errcode='42501';end if;
  if o.version<>p_expected_version then raise exception 'scenario_stale' using errcode='40001';end if;
  if o.archived_at is not null then raise exception 'scenario_opportunity_archived';end if;
  select * into a from public.investment_opportunity_analyses where id=coalesce(nullif(p_source_scenario_id,''),o.current_analysis_id)and opportunity_id=o.id;
  if a.id is null then raise exception 'scenario_source_required';end if;
  select coalesce(max(sequence),0)+1 into n from public.investment_opportunity_analyses where opportunity_id=o.id;
  insert into public.investment_opportunity_analyses(id,opportunity_id,sequence,route,investment_analysis_id,investment_decision_id,market_analysis_id,result_snapshot,source_summary,policy_versions,lineage,created_by,created_at)
  values(p_scenario_id,o.id,n,a.route,a.investment_analysis_id||':scenario:'||p_scenario_id,a.investment_decision_id,a.market_analysis_id,a.result_snapshot,a.source_summary,a.policy_versions,jsonb_set(a.lineage,'{investmentLifecycleResultId}',to_jsonb(p_scenario_id),true),jsonb_build_object('type','user','id',auth.uid()),now_at);
  insert into public.investment_scenarios values(p_scenario_id,o.id,btrim(p_name),p_scenario_type,nullif(btrim(p_description),''),nullif(btrim(p_notes),''),'active',1,auth.uid(),now_at,now_at,null);
  insert into public.investment_scenario_events values('scenario-event-'||gen_random_uuid(),p_scenario_id,o.id,case when nullif(p_source_scenario_id,'')is null then'scenario-created'else'scenario-duplicated'end,auth.uid(),'Operational scenario created from an immutable analysis snapshot.',1,now_at);
  update public.investment_opportunities set current_analysis_id=coalesce(current_analysis_id,p_scenario_id),version=version+1,updated_at=now_at where id=o.id;
  return query select p_scenario_id,p_expected_version+1;
end $$;

create or replace function public.mutate_investment_scenario(
  p_opportunity_id text,p_scenario_id text,p_operation text,p_name text,p_description text,p_notes text,p_expected_scenario_revision integer,p_expected_version integer,p_command_id text
)returns table(aggregate_version integer,scenario_revision integer,changed boolean) language plpgsql security definer set search_path=public as $$
declare o public.investment_opportunities%rowtype;s public.investment_scenarios%rowtype;now_at timestamptz:=now();event_name text;did_change boolean:=true;
begin
  select * into o from public.investment_opportunities where id=p_opportunity_id for update;
  if o.id is null or auth.uid() is null or(o.owner_id<>auth.uid()and not public.is_admin())then raise exception 'scenario_permission_denied' using errcode='42501';end if;
  if o.version<>p_expected_version then raise exception 'scenario_stale' using errcode='40001';end if;
  select * into s from public.investment_scenarios where scenario_id=p_scenario_id and opportunity_id=o.id for update;
  if s.scenario_id is null then
    insert into public.investment_scenarios(scenario_id,opportunity_id,name,scenario_type,status,created_by_profile_id)
    select a.id,a.opportunity_id,case when a.sequence=1 then'Base Case'else'Scenario '||a.sequence end,case when a.sequence=1 then'base'else'custom'end,'active',auth.uid() from public.investment_opportunity_analyses a where a.id=p_scenario_id and a.opportunity_id=o.id;
    select * into s from public.investment_scenarios where scenario_id=p_scenario_id for update;
  end if;
  if s.scenario_id is null then raise exception 'scenario_not_found';end if;
  if s.revision<>p_expected_scenario_revision then raise exception 'scenario_stale' using errcode='40001';end if;
  if p_operation='save' then
    did_change:=s.name is distinct from btrim(p_name)or coalesce(s.description,'')is distinct from btrim(coalesce(p_description,''))or coalesce(s.notes,'')is distinct from btrim(coalesce(p_notes,''));
    if did_change then update public.investment_scenarios set name=btrim(p_name),description=nullif(btrim(p_description),''),notes=nullif(btrim(p_notes),''),revision=revision+1,updated_at=now_at where scenario_id=s.scenario_id;event_name:='scenario-saved';end if;
  elsif p_operation='archive' then
    if o.current_analysis_id=s.scenario_id then raise exception 'scenario_preferred_cannot_archive';end if;
    update public.investment_scenarios set status='archived',archived_at=now_at,revision=revision+1,updated_at=now_at where scenario_id=s.scenario_id;event_name:='scenario-archived';
  elsif p_operation='restore' then
    update public.investment_scenarios set status='active',archived_at=null,revision=revision+1,updated_at=now_at where scenario_id=s.scenario_id;event_name:='scenario-restored';
  elsif p_operation='preferred' then
    if s.status='archived'then raise exception 'scenario_archived';end if;
    update public.investment_opportunities set current_analysis_id=s.scenario_id where id=o.id;event_name:='scenario-preferred';
  else raise exception 'scenario_operation_invalid';end if;
  if not did_change then return query select o.version,s.revision,false;return;end if;
  update public.investment_opportunities set version=version+1,updated_at=now_at where id=o.id;
  select * into s from public.investment_scenarios where scenario_id=p_scenario_id;
  insert into public.investment_scenario_events values('scenario-event-'||gen_random_uuid(),s.scenario_id,o.id,event_name,auth.uid(),case p_operation when'preferred'then'Scenario selected as the preferred investment strategy.'when'archive'then'Scenario archived without deleting its history.'when'restore'then'Scenario restored to active use.'else'Scenario metadata and operator notes saved.'end,s.revision,now_at);
  return query select o.version+1,s.revision,true;
end $$;
revoke all on function public.create_investment_scenario(text,text,text,text,text,text,text,integer,text) from public;
revoke all on function public.mutate_investment_scenario(text,text,text,text,text,text,integer,integer,text) from public;
grant execute on function public.create_investment_scenario(text,text,text,text,text,text,text,integer,text) to authenticated;
grant execute on function public.mutate_investment_scenario(text,text,text,text,text,text,integer,integer,text) to authenticated;

commit;
