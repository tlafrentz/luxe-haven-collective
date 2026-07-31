-- Investment Reports v1: owner-scoped immutable decision artifacts.
begin;

alter table public.generated_reports
  add column if not exists owner_profile_id uuid references auth.users(id),
  add column if not exists acquisition_strategy text,
  add column if not exists currency text not null default 'USD';

alter table public.generated_reports drop constraint if exists generated_reports_acquisition_strategy_check;
alter table public.generated_reports add constraint generated_reports_acquisition_strategy_check
  check(report_type <> 'investment-decision' or acquisition_strategy in ('purchase','rental-arbitrage'));

create unique index if not exists generated_reports_investment_v1_idempotency_uidx
  on public.generated_reports(owner_profile_id,opportunity_id,analysis_version_id)
  where report_type='investment-decision';
create index if not exists generated_reports_investment_v1_library_idx
  on public.generated_reports(owner_profile_id,status,generated_at desc,id)
  where report_type='investment-decision';

create or replace function public.generate_investment_report_v1(
  p_opportunity_id text,
  p_analysis_version_id text,
  p_title text,
  p_strategy text,
  p_snapshot jsonb,
  p_snapshot_size_bytes integer,
  p_correlation_id text
) returns jsonb
language plpgsql security definer set search_path=public
as $$
declare
  v_user uuid:=auth.uid(); v_workspace uuid; v_report_id text; v_request_id text;
  v_existing text; v_number text; v_now timestamptz:=now();
begin
  if v_user is null then raise exception 'investment_report_unauthorized'; end if;
  if p_strategy not in ('purchase','rental-arbitrage') then raise exception 'investment_report_strategy_invalid'; end if;
  if p_snapshot->>'schemaVersion'<>'investment-report.v1'
    or p_snapshot#>>'{lineage,opportunityId}'<>p_opportunity_id
    or p_snapshot#>>'{lineage,analysisId}'<>p_analysis_version_id
    or p_snapshot#>>'{lineage,strategy}'<>p_strategy
  then raise exception 'investment_report_snapshot_invalid'; end if;
  if p_snapshot_size_bytes<=0 or p_snapshot_size_bytes>2000000 then raise exception 'investment_report_snapshot_size_invalid'; end if;

  select o.workspace_id into v_workspace
  from public.investment_opportunities o
  join public.investment_opportunity_analyses a on a.opportunity_id=o.id and a.id=p_analysis_version_id
  where o.id=p_opportunity_id
    and public.can_read_investment_opportunity(o.workspace_id,o.property_id)
    and exists(select 1 from public.workspace_memberships m where m.workspace_id=o.workspace_id and m.profile_id=v_user and m.status='active')
  limit 1;
  if v_workspace is null then raise exception 'investment_report_source_not_found'; end if;

  select id into v_existing from public.generated_reports
  where owner_profile_id=v_user and opportunity_id=p_opportunity_id
    and analysis_version_id=p_analysis_version_id and report_type='investment-decision';
  if v_existing is not null then
    return jsonb_build_object('reportId',v_existing,'existing',true);
  end if;

  v_report_id:='report-'||gen_random_uuid(); v_request_id:='report-request-'||gen_random_uuid();
  v_number:=public.next_report_number('investment-decision');
  insert into public.report_requests(
    id,workspace_id,requested_by_profile_id,report_type,scope_type,scope_snapshot,
    source_context,template_id,title,section_configuration,status,idempotency_key,
    entitlement_version,permission_snapshot,created_at,updated_at
  ) values(
    v_request_id,v_workspace,v_user,'investment-decision','investment-analysis-version',
    jsonb_build_object('opportunityId',p_opportunity_id,'analysisVersionId',p_analysis_version_id),
    jsonb_build_object('type','investment-analysis-version','analysisVersionId',p_analysis_version_id),
    'report-template-investment-decision-v1',p_title,'[]'::jsonb,'completed',
    'investment-report-v1:'||v_user||':'||p_opportunity_id||':'||p_analysis_version_id,
    'investment-reports-v1',jsonb_build_object('ownerProfileId',v_user),v_now,v_now
  );
  insert into public.generated_reports(
    id,report_number,report_request_id,workspace_id,generated_by_profile_id,owner_profile_id,
    report_type,status,title,scope_type,opportunity_id,analysis_version_id,acquisition_strategy,currency,
    scope_snapshot,source_context_snapshot,projection_snapshot,snapshot_schema_version,snapshot_size_bytes,
    template_id,template_version,projection_version,source_versions,confidence,freshness,
    series_key,version_number,generated_at
  ) values(
    v_report_id,v_number,v_request_id,v_workspace,v_user,v_user,'investment-decision','generated',p_title,
    'investment-analysis-version',p_opportunity_id,p_analysis_version_id,p_strategy,'USD',
    jsonb_build_object('opportunityId',p_opportunity_id,'analysisVersionId',p_analysis_version_id),
    jsonb_build_object('type','investment-analysis-version','correlationId',p_correlation_id),
    p_snapshot,'investment-report.v1',p_snapshot_size_bytes,'report-template-investment-decision-v1',1,
    p_analysis_version_id,jsonb_build_array(jsonb_build_object('source','immutable-analysis','version',p_analysis_version_id)),
    coalesce(p_snapshot#>>'{confidence,level}','insufficient-evidence'),
    case when jsonb_array_length(coalesce(p_snapshot->'limitations','[]'::jsonb))=0 then 'current' else 'partial' end,
    'investment-report-v1:'||p_opportunity_id,1,v_now
  );
  insert into public.report_activity(id,report_request_id,report_id,workspace_id,actor_profile_id,event_type,safe_summary,resulting_state,occurred_at)
  values('report-activity-'||gen_random_uuid(),v_request_id,v_report_id,v_workspace,v_user,'report-generated','Immutable investment report snapshot persisted.','active',v_now);
  return jsonb_build_object('reportId',v_report_id,'existing',false);
exception when unique_violation then
  select id into v_existing from public.generated_reports
  where owner_profile_id=v_user and opportunity_id=p_opportunity_id
    and analysis_version_id=p_analysis_version_id and report_type='investment-decision';
  if v_existing is not null then return jsonb_build_object('reportId',v_existing,'existing',true); end if;
  raise;
end $$;

create or replace function public.transition_investment_report_v1(p_report_id text,p_operation text)
returns text language plpgsql security definer set search_path=public as $$
declare v_user uuid:=auth.uid(); v_status text; v_workspace uuid; v_now timestamptz:=now();
begin
  if v_user is null then raise exception 'investment_report_unauthorized'; end if;
  select status,workspace_id into v_status,v_workspace from public.generated_reports
  where id=p_report_id and report_type='investment-decision' and owner_profile_id=v_user for update;
  if v_status is null then raise exception 'investment_report_not_found'; end if;
  if p_operation='archive' then
    if v_status not in ('generated','published') then raise exception 'investment_report_archive_conflict'; end if;
    update public.generated_reports set status='archived',archived_at=v_now where id=p_report_id;
  elsif p_operation='restore' then
    if v_status<>'archived' then raise exception 'investment_report_restore_conflict'; end if;
    update public.generated_reports set status='generated',archived_at=null where id=p_report_id;
  else raise exception 'investment_report_operation_invalid';
  end if;
  insert into public.report_activity(id,report_id,workspace_id,actor_profile_id,event_type,safe_summary,resulting_state,occurred_at)
  values('report-activity-'||gen_random_uuid(),p_report_id,v_workspace,v_user,
    case when p_operation='archive' then 'report-archived' else 'report-restored' end,
    case when p_operation='archive' then 'Investment report archived.' else 'Investment report restored.' end,
    case when p_operation='archive' then 'archived' else 'active' end,v_now);
  return p_report_id;
end $$;

revoke all on function public.generate_investment_report_v1(text,text,text,text,jsonb,integer,text) from public;
revoke all on function public.transition_investment_report_v1(text,text) from public;
grant execute on function public.generate_investment_report_v1(text,text,text,text,jsonb,integer,text) to authenticated;
grant execute on function public.transition_investment_report_v1(text,text) to authenticated;

drop policy if exists "Authorized source reports are readable" on public.generated_reports;
create policy "Authorized reports are readable" on public.generated_reports for select to authenticated using(
  case when report_type='investment-decision' then owner_profile_id=auth.uid()
  else public.active_workspace_role(workspace_id)is not null or public.is_admin() end
);

commit;
