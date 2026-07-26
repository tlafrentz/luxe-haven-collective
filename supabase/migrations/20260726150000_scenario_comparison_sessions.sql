-- SCN v1.1: persisted scenario-comparison selection per operator and opportunity.
begin;
create table public.investment_scenario_comparison_sessions(
  opportunity_id text not null references public.investment_opportunities(id),
  profile_id uuid not null,
  scenario_ids text[] not null check(cardinality(scenario_ids) between 2 and 4),
  updated_at timestamptz not null default now(),
  primary key(opportunity_id,profile_id)
);
alter table public.investment_scenario_comparison_sessions enable row level security;
create policy "Operators read own scenario comparison session" on public.investment_scenario_comparison_sessions for select to authenticated using(profile_id=auth.uid()and exists(select 1 from public.investment_opportunities opportunity where opportunity.id=opportunity_id and(opportunity.owner_id=auth.uid()or public.is_admin())));
grant select on public.investment_scenario_comparison_sessions to authenticated;
create or replace function public.save_scenario_comparison_session(p_opportunity_id text,p_scenario_ids text[])
returns void language plpgsql security definer set search_path=public as $$
begin
  if auth.uid()is null or not exists(select 1 from public.investment_opportunities where id=p_opportunity_id and(owner_id=auth.uid()or public.is_admin()))then raise exception 'scenario_permission_denied' using errcode='42501';end if;
  if cardinality(p_scenario_ids)<2 or cardinality(p_scenario_ids)>4 or cardinality(p_scenario_ids)<>cardinality(array(select distinct value from unnest(p_scenario_ids)value))then raise exception 'scenario_selection_invalid';end if;
  if exists(select 1 from unnest(p_scenario_ids)value where not exists(select 1 from public.investment_opportunity_analyses analysis where analysis.id=value and analysis.opportunity_id=p_opportunity_id))then raise exception 'scenario_unavailable';end if;
  insert into public.investment_scenario_comparison_sessions values(p_opportunity_id,auth.uid(),p_scenario_ids,now())
  on conflict(opportunity_id,profile_id)do update set scenario_ids=excluded.scenario_ids,updated_at=excluded.updated_at;
end $$;
revoke all on function public.save_scenario_comparison_session(text,text[]) from public;
grant execute on function public.save_scenario_comparison_session(text,text[]) to authenticated;
commit;
