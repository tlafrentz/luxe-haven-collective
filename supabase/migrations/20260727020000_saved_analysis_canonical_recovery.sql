-- SA-001B: canonical Saved Analysis persistence recovery.
-- Analysis versions remain immutable. Scenarios become independent immutable
-- branches. Saves, initial notes, activity, and receipts commit atomically.
begin;

alter table public.investment_opportunities
  add column if not exists workspace_id uuid references public.owners(id) on delete restrict,
  add column if not exists property_id uuid references public.properties(id) on delete restrict,
  add column if not exists preferred_scenario_id text;

update public.investment_opportunities opportunity
set workspace_id=owner.id
from public.owners owner
where opportunity.workspace_id is null and owner.profile_id=opportunity.owner_id;

do $$
begin
  if exists(select 1 from public.investment_opportunities where workspace_id is null) then
    raise exception 'SA-001B requires every Investment Opportunity owner to resolve to a workspace';
  end if;
end $$;
alter table public.investment_opportunities alter column workspace_id set not null;

alter table public.investment_opportunity_commands
  add column if not exists payload_hash text,
  add column if not exists result jsonb not null default '{}'::jsonb;

alter table public.investment_scenarios
  add column if not exists source_analysis_version_id text,
  add column if not exists assumptions_snapshot jsonb,
  add column if not exists output_snapshot jsonb,
  add column if not exists created_from_scenario_id text;

-- Preserve the copied immutable payload before removing the analysis/scenario
-- identity collision. For legacy rows the nearest preceding non-scenario
-- analysis is the only recoverable source; the copied output remains exact.
update public.investment_scenarios scenario
set
  source_analysis_version_id=coalesce(
    (
      select source.id
      from public.investment_opportunity_analyses source
      where source.opportunity_id=scenario.opportunity_id
        and source.id<>scenario.scenario_id
        and not exists(select 1 from public.investment_scenarios other where other.scenario_id=source.id)
        and source.sequence < (
          select clone.sequence from public.investment_opportunity_analyses clone
          where clone.id=scenario.scenario_id
        )
      order by source.sequence desc limit 1
    ),
    (
      select source.id
      from public.investment_opportunity_analyses source
      where source.opportunity_id=scenario.opportunity_id
        and source.id<>scenario.scenario_id
        and not exists(select 1 from public.investment_scenarios other where other.scenario_id=source.id)
      order by source.sequence desc limit 1
    )
  ),
  assumptions_snapshot=coalesce(
    (select clone.result_snapshot->'reanalysis'->'userAssumptions' from public.investment_opportunity_analyses clone where clone.id=scenario.scenario_id),
    '{}'::jsonb
  ),
  output_snapshot=(select clone.result_snapshot from public.investment_opportunity_analyses clone where clone.id=scenario.scenario_id)
where scenario.source_analysis_version_id is null;

do $$
begin
  if exists(
    select 1 from public.investment_scenarios
    where source_analysis_version_id is null or output_snapshot is null
  ) then
    raise exception 'SA-001B could not recover legacy scenario lineage';
  end if;
end $$;

alter table public.investment_scenarios
  alter column source_analysis_version_id set not null,
  alter column assumptions_snapshot set not null,
  alter column output_snapshot set not null;
alter table public.investment_scenarios
  add constraint investment_scenarios_source_analysis_fk
  foreign key(opportunity_id,source_analysis_version_id)
  references public.investment_opportunity_analyses(opportunity_id,id) on delete restrict;
alter table public.investment_scenarios
  add constraint investment_scenarios_created_from_fk
  foreign key(created_from_scenario_id) references public.investment_scenarios(scenario_id) on delete restrict;

-- Restore current analysis before deleting legacy clone rows.
update public.investment_opportunities opportunity
set current_analysis_id=(
  select analysis.id
  from public.investment_opportunity_analyses analysis
  where analysis.opportunity_id=opportunity.id
    and not exists(select 1 from public.investment_scenarios scenario where scenario.scenario_id=analysis.id)
  order by analysis.sequence desc limit 1
)
where exists(
  select 1 from public.investment_scenarios scenario
  where scenario.scenario_id=opportunity.current_analysis_id
);

alter table public.investment_scenarios drop constraint if exists investment_scenarios_scenario_id_fkey;
alter table public.investment_opportunity_analyses disable trigger investment_opportunity_analyses_append_only;
delete from public.investment_opportunity_analyses analysis
where exists(select 1 from public.investment_scenarios scenario where scenario.scenario_id=analysis.id);

-- Repair sequence numbers after legacy scenario clones consumed the namespace.
update public.investment_opportunity_analyses set sequence=sequence+1000000;
with canonical as (
  select id,row_number() over(partition by opportunity_id order by sequence,created_at,id)::integer as canonical_sequence
  from public.investment_opportunity_analyses
)
update public.investment_opportunity_analyses analysis
set sequence=canonical.canonical_sequence
from canonical where canonical.id=analysis.id;
alter table public.investment_opportunity_analyses enable trigger investment_opportunity_analyses_append_only;

alter table public.investment_opportunities
  add constraint investment_opportunities_preferred_scenario_fk
  foreign key(preferred_scenario_id) references public.investment_scenarios(scenario_id) on delete restrict
  deferrable initially deferred;

create index if not exists investment_opportunities_workspace_updated_idx
  on public.investment_opportunities(workspace_id,updated_at desc);
create index if not exists investment_scenarios_source_analysis_idx
  on public.investment_scenarios(source_analysis_version_id,created_at);

alter table public.generated_reports add column if not exists analysis_version_id text;
update public.generated_reports report
set analysis_version_id=coalesce(
  (select scenario.source_analysis_version_id from public.investment_scenarios scenario where scenario.scenario_id=report.scenario_id),
  nullif(report.source_context_snapshot->>'analysisVersionId',''),
  nullif(report.scope_snapshot->>'analysisVersionId','')
)
where report.report_type='investment-decision' and report.analysis_version_id is null;
do $$
begin
  if exists(select 1 from public.generated_reports where report_type='investment-decision' and analysis_version_id is null) then
    raise exception 'SA-001E could not recover investment report lineage';
  end if;
end $$;
alter table public.generated_reports add constraint generated_reports_investment_lineage_required
  check(report_type<>'investment-decision' or (opportunity_id is not null and analysis_version_id is not null));
alter table public.generated_reports
  add constraint generated_reports_analysis_version_fk
  foreign key(opportunity_id,analysis_version_id)
  references public.investment_opportunity_analyses(opportunity_id,id) on delete restrict;
create index if not exists generated_reports_analysis_version_idx
  on public.generated_reports(analysis_version_id,generated_at desc);

alter table public.investment_opportunity_activity add column if not exists analysis_version_id text;
alter table public.investment_opportunity_activity drop constraint if exists investment_opportunity_activity_type_check;
alter table public.investment_opportunity_activity add constraint investment_opportunity_activity_type_check
  check(type in('opportunity-created','analysis-saved','status-changed','name-changed','tags-changed','note-added','opportunity-archived','opportunity-restored','scenario-created','report-generated','reanalysis-started'));
update public.investment_opportunity_activity
set analysis_version_id=nullif(details->>'analysisId','')
where analysis_version_id is null and type='analysis-saved';
alter table public.investment_opportunity_activity
  add constraint investment_opportunity_activity_analysis_version_fk
  foreign key(opportunity_id,analysis_version_id)
  references public.investment_opportunity_analyses(opportunity_id,id) on delete restrict;
create index if not exists investment_opportunity_activity_analysis_version_idx
  on public.investment_opportunity_activity(analysis_version_id,occurred_at);
alter table public.investment_opportunity_activity
  add constraint investment_opportunity_activity_analysis_lineage_required
  check(type not in('analysis-saved','scenario-created','report-generated','reanalysis-started') or analysis_version_id is not null);

create or replace function public.record_investment_report_lineage_activity()
returns trigger language plpgsql security definer set search_path=public as $$
declare opportunity_version integer;
begin
  if new.report_type<>'investment-decision' then return new;end if;
  select version into opportunity_version from public.investment_opportunities where id=new.opportunity_id;
  insert into public.investment_opportunity_activity(
    id,opportunity_id,type,actor,details,occurred_at,aggregate_version,command_id,analysis_version_id
  ) values(
    'opportunity-activity-'||gen_random_uuid(),new.opportunity_id,'report-generated',
    jsonb_build_object('type','user','id',new.generated_by_profile_id::text),
    jsonb_build_object('reportId',new.id,'analysisId',new.analysis_version_id),
    new.generated_at,opportunity_version,new.report_request_id,new.analysis_version_id
  );
  return new;
end $$;
drop trigger if exists generated_report_lineage_activity on public.generated_reports;
create trigger generated_report_lineage_activity after insert on public.generated_reports
for each row execute function public.record_investment_report_lineage_activity();

create or replace function public.prevent_investment_scenario_lineage_change()
returns trigger language plpgsql as $$
begin
  if row(new.scenario_id,new.opportunity_id,new.source_analysis_version_id,new.assumptions_snapshot,new.output_snapshot,new.created_from_scenario_id,new.created_by_profile_id,new.created_at)
     is distinct from
     row(old.scenario_id,old.opportunity_id,old.source_analysis_version_id,old.assumptions_snapshot,old.output_snapshot,old.created_from_scenario_id,old.created_by_profile_id,old.created_at)
  then raise exception 'scenario_lineage_immutable'; end if;
  return new;
end $$;
drop trigger if exists investment_scenario_lineage_immutable on public.investment_scenarios;
create trigger investment_scenario_lineage_immutable before update on public.investment_scenarios
for each row execute function public.prevent_investment_scenario_lineage_change();

create or replace function public.prevent_generated_report_mutation()
returns trigger language plpgsql as $$
begin
  if row(new.id,new.report_number,new.report_request_id,new.workspace_id,new.generated_by_profile_id,new.report_type,new.title,new.scope_snapshot,new.period_snapshot,new.comparison_snapshot,new.source_context_snapshot,new.projection_snapshot,new.snapshot_schema_version,new.snapshot_size_bytes,new.template_id,new.template_version,new.projection_version,new.source_versions,new.confidence,new.freshness,new.series_key,new.version_number,new.supersedes_report_id,new.generated_at,new.opportunity_id,new.scenario_id,new.analysis_version_id)
     is distinct from
     row(old.id,old.report_number,old.report_request_id,old.workspace_id,old.generated_by_profile_id,old.report_type,old.title,old.scope_snapshot,old.period_snapshot,old.comparison_snapshot,old.source_context_snapshot,old.projection_snapshot,old.snapshot_schema_version,old.snapshot_size_bytes,old.template_id,old.template_version,old.projection_version,old.source_versions,old.confidence,old.freshness,old.series_key,old.version_number,old.supersedes_report_id,old.generated_at,old.opportunity_id,old.scenario_id,old.analysis_version_id)
  then raise exception 'report_snapshot_immutable'; end if;
  return new;
end $$;

-- Workspace authorization is the shared application/database contract.
create or replace function public.can_read_investment_opportunity(p_workspace_id uuid,p_property_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select public.active_workspace_role(p_workspace_id) in ('owner','administrator')
    or (
      public.active_workspace_role(p_workspace_id) is not null
      and p_property_id is not null
      and public.can_access_workspace_property(p_property_id)
    )
$$;
create or replace function public.can_manage_investment_opportunity(p_workspace_id uuid,p_property_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select public.active_workspace_role(p_workspace_id) in ('owner','administrator')
    or (
      public.active_workspace_role(p_workspace_id) in ('operator','contributor')
      and p_property_id is not null
      and public.can_access_workspace_property(p_property_id)
    )
$$;
grant execute on function public.can_read_investment_opportunity(uuid,uuid),
  public.can_manage_investment_opportunity(uuid,uuid) to authenticated;

drop policy if exists "Owners and admins read Investment Opportunities" on public.investment_opportunities;
create policy "Workspace members read Investment Opportunities"
on public.investment_opportunities for select to authenticated
using(public.can_read_investment_opportunity(workspace_id,property_id));

drop policy if exists "Owners read Investment Opportunity analyses" on public.investment_opportunity_analyses;
create policy "Workspace members read Investment Opportunity analyses"
on public.investment_opportunity_analyses for select to authenticated using(
  exists(select 1 from public.investment_opportunities opportunity
    where opportunity.id=opportunity_id
      and public.can_read_investment_opportunity(opportunity.workspace_id,opportunity.property_id))
);
drop policy if exists "Owners read Investment Opportunity tags" on public.investment_opportunity_tags;
create policy "Workspace members read Investment Opportunity tags"
on public.investment_opportunity_tags for select to authenticated using(
  exists(select 1 from public.investment_opportunities opportunity
    where opportunity.id=opportunity_id
      and public.can_read_investment_opportunity(opportunity.workspace_id,opportunity.property_id))
);
drop policy if exists "Owners read Investment Opportunity activity" on public.investment_opportunity_activity;
create policy "Workspace members read Investment Opportunity activity"
on public.investment_opportunity_activity for select to authenticated using(
  exists(select 1 from public.investment_opportunities opportunity
    where opportunity.id=opportunity_id
      and public.can_read_investment_opportunity(opportunity.workspace_id,opportunity.property_id))
);
drop policy if exists "Owners read Investment Opportunity notes" on public.investment_opportunity_notes;
create policy "Workspace members read Investment Opportunity notes"
on public.investment_opportunity_notes for select to authenticated using(
  exists(select 1 from public.investment_opportunities opportunity
    where opportunity.id=opportunity_id
      and public.can_read_investment_opportunity(opportunity.workspace_id,opportunity.property_id))
);
drop policy if exists "Owners read scenarios" on public.investment_scenarios;
create policy "Workspace members read scenarios"
on public.investment_scenarios for select to authenticated using(
  exists(select 1 from public.investment_opportunities opportunity
    where opportunity.id=opportunity_id
      and public.can_read_investment_opportunity(opportunity.workspace_id,opportunity.property_id))
);
drop policy if exists "Owners read scenario events" on public.investment_scenario_events;
create policy "Workspace members read scenario events"
on public.investment_scenario_events for select to authenticated using(
  exists(select 1 from public.investment_opportunities opportunity
    where opportunity.id=opportunity_id
      and public.can_read_investment_opportunity(opportunity.workspace_id,opportunity.property_id))
);
drop policy if exists "Actors read Investment Opportunity command receipts" on public.investment_opportunity_commands;
create policy "Actors read Investment Opportunity command receipts"
on public.investment_opportunity_commands for select to authenticated using(
  exists(select 1 from public.investment_opportunities opportunity
    where opportunity.id=result->>'opportunityId'
      and public.can_manage_investment_opportunity(opportunity.workspace_id,opportunity.property_id))
);
grant select on public.investment_opportunity_commands to authenticated;

create or replace function public.add_investment_opportunity_note(
  p_opportunity_id text,p_note jsonb,p_activity jsonb,p_expected_version integer,p_command_id text
) returns integer language plpgsql security definer set search_path=public as $$
declare current_row public.investment_opportunities;existing_version integer;
begin
  select * into current_row from public.investment_opportunities where id=p_opportunity_id for update;
  if not found or auth.uid() is null or not public.can_manage_investment_opportunity(current_row.workspace_id,current_row.property_id) then
    raise exception 'Investment Opportunity not found' using errcode='42501';
  end if;
  if current_row.archived_at is not null then raise exception 'Archived opportunity cannot receive notes';end if;
  if current_row.version<>p_expected_version then raise exception 'Stale Investment Opportunity version' using errcode='40001';end if;
  select aggregate_version into existing_version from public.investment_opportunity_activity where opportunity_id=p_opportunity_id and command_id=p_command_id and type='note-added' limit 1;
  if found then return existing_version;end if;
  insert into public.investment_opportunity_notes select * from jsonb_populate_record(null::public.investment_opportunity_notes,p_note);
  insert into public.investment_opportunity_activity select * from jsonb_populate_record(null::public.investment_opportunity_activity,p_activity);
  update public.investment_opportunities set version=version+1,updated_at=(p_activity->>'occurred_at')::timestamptz where id=p_opportunity_id;
  return p_expected_version+1;
end $$;

drop policy if exists "Workspace generated reports are readable" on public.generated_reports;
create policy "Authorized source reports are readable" on public.generated_reports for select to authenticated using(
  case when report_type='investment-decision' then
    exists(select 1 from public.investment_opportunities opportunity
      where opportunity.id=opportunity_id
        and public.can_read_investment_opportunity(opportunity.workspace_id,opportunity.property_id))
  else public.active_workspace_role(workspace_id)is not null or public.is_admin() end
);
drop policy if exists "Workspace report requests are readable" on public.report_requests;
create policy "Authorized report requests are readable" on public.report_requests for select to authenticated using(
  case when report_type='investment-decision' then
    exists(select 1 from public.investment_opportunities opportunity
      where opportunity.id=scope_snapshot->>'opportunityId'
        and public.can_read_investment_opportunity(opportunity.workspace_id,opportunity.property_id))
  else public.active_workspace_role(workspace_id)is not null or public.is_admin() end
);

-- One transaction and one replayable result for new and existing saves.
create or replace function public.save_investment_opportunity(
  p_payload jsonb,
  p_expected_version integer default null,
  p_command_id text default null,
  p_payload_hash text default null,
  p_initial_note jsonb default null
) returns jsonb language plpgsql security definer set search_path=public as $$
declare
  proposed public.investment_opportunities;
  current_version integer;
  receipt public.investment_opportunity_commands%rowtype;
  analysis_row public.investment_opportunity_analyses%rowtype;
  note_row public.investment_opportunity_notes%rowtype;
  note_activity public.investment_opportunity_activity%rowtype;
  result_value jsonb;
begin
  proposed:=jsonb_populate_record(null::public.investment_opportunities,p_payload->'opportunity');
  if auth.uid() is null or not public.can_manage_investment_opportunity(proposed.workspace_id,proposed.property_id) then
    raise exception 'Investment Opportunity access denied' using errcode='42501';
  end if;
  if p_command_id is null or btrim(p_command_id)='' or p_payload_hash is null or btrim(p_payload_hash)='' then
    raise exception 'Investment Opportunity command identity is required' using errcode='22023';
  end if;
  select * into receipt from public.investment_opportunity_commands
  where owner_id=proposed.owner_id and command_id=p_command_id;
  if found then
    if receipt.payload_hash is distinct from p_payload_hash then
      raise exception 'Investment Opportunity command payload conflict' using errcode='23505';
    end if;
    return receipt.result||jsonb_build_object('idempotent',true);
  end if;

  select version into current_version from public.investment_opportunities where id=proposed.id for update;
  if found then
    if p_expected_version is null or current_version<>p_expected_version or proposed.version<>p_expected_version+1 then
      raise exception 'Stale Investment Opportunity version' using errcode='40001';
    end if;
    update public.investment_opportunities set
      name=proposed.name,status=proposed.status,current_analysis_id=proposed.current_analysis_id,
      archived_at=proposed.archived_at,
      updated_at=proposed.updated_at,version=proposed.version
    where id=proposed.id and workspace_id=proposed.workspace_id and version=p_expected_version;
    if not found then raise exception 'Investment Opportunity access denied' using errcode='42501'; end if;
  else
    if p_expected_version is not null or proposed.version<1 then
      raise exception 'Invalid initial Investment Opportunity version' using errcode='40001';
    end if;
    insert into public.investment_opportunities select proposed.*;
  end if;

  insert into public.investment_opportunity_analyses
    select * from jsonb_populate_recordset(null::public.investment_opportunity_analyses,coalesce(p_payload->'analyses','[]'::jsonb))
    on conflict(id) do nothing;
  delete from public.investment_opportunity_tags where opportunity_id=proposed.id;
  insert into public.investment_opportunity_tags
    select * from jsonb_populate_recordset(null::public.investment_opportunity_tags,coalesce(p_payload->'tags','[]'::jsonb));
  insert into public.investment_opportunity_activity
    select * from jsonb_populate_recordset(null::public.investment_opportunity_activity,coalesce(p_payload->'activity','[]'::jsonb))
    on conflict(id) do nothing;

  if p_initial_note is not null then
    note_row:=jsonb_populate_record(null::public.investment_opportunity_notes,p_initial_note->'note');
    note_row.opportunity_id:=proposed.id;
    insert into public.investment_opportunity_notes values(note_row.*);
    note_activity:=jsonb_populate_record(null::public.investment_opportunity_activity,p_initial_note->'activity');
    note_activity.opportunity_id:=proposed.id;
    insert into public.investment_opportunity_activity values(note_activity.*);
    proposed.version:=proposed.version+1;
    update public.investment_opportunities
      set version=proposed.version,updated_at=(p_initial_note->'activity'->>'occurred_at')::timestamptz
      where id=proposed.id;
  end if;

  select * into analysis_row from public.investment_opportunity_analyses
  where id=proposed.current_analysis_id and opportunity_id=proposed.id;
  result_value:=jsonb_build_object(
    'opportunityId',proposed.id,
    'analysisVersionId',analysis_row.id,
    'analysisVersionNumber',analysis_row.sequence,
    'aggregateVersion',proposed.version,
    'idempotent',false
  );
  insert into public.investment_opportunity_commands(owner_id,command_id,opportunity_id,payload_hash,result)
  values(proposed.owner_id,p_command_id,proposed.id,p_payload_hash,result_value);
  return result_value;
end $$;
revoke all on function public.save_investment_opportunity(jsonb,integer,text,text,jsonb) from public;
grant execute on function public.save_investment_opportunity(jsonb,integer,text,text,jsonb) to authenticated;
drop function if exists public.save_investment_opportunity(jsonb,integer,text);

create or replace function public.get_investment_opportunity_bundle(p_opportunity_id text)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare o public.investment_opportunities%rowtype;
begin
  select * into o from public.investment_opportunities where id=p_opportunity_id;
  if o.id is null or auth.uid() is null or not public.can_read_investment_opportunity(o.workspace_id,o.property_id) then
    return null;
  end if;
  return jsonb_build_object(
    'opportunity',to_jsonb(o),
    'analyses',coalesce((select jsonb_agg(to_jsonb(a) order by a.sequence) from public.investment_opportunity_analyses a where a.opportunity_id=o.id),'[]'::jsonb),
    'tags',coalesce((select jsonb_agg(to_jsonb(t) order by t.normalized_value) from public.investment_opportunity_tags t where t.opportunity_id=o.id),'[]'::jsonb),
    'activity',coalesce((select jsonb_agg(to_jsonb(a) order by a.occurred_at,a.id) from public.investment_opportunity_activity a where a.opportunity_id=o.id),'[]'::jsonb),
    'notes',coalesce((select jsonb_agg(to_jsonb(n) order by n.created_at desc,n.id desc) from public.investment_opportunity_notes n where n.opportunity_id=o.id),'[]'::jsonb),
    'scenarios',coalesce((select jsonb_agg(to_jsonb(s) order by s.created_at,s.scenario_id) from public.investment_scenarios s where s.opportunity_id=o.id),'[]'::jsonb),
    'reports',coalesce((select jsonb_agg(to_jsonb(r) order by r.generated_at desc,r.id) from public.generated_reports r where r.opportunity_id=o.id),'[]'::jsonb)
  );
end $$;
revoke all on function public.get_investment_opportunity_bundle(text) from public;
grant execute on function public.get_investment_opportunity_bundle(text) to authenticated;

-- Scenarios are standalone branches with immutable source/output lineage.
drop function if exists public.create_investment_scenario(text,text,text,text,text,text,text,integer,text);
create or replace function public.create_investment_scenario(
  p_opportunity_id text,p_source_analysis_version_id text,p_source_scenario_id text,p_scenario_id text,p_name text,p_scenario_type text,p_description text,p_notes text,p_expected_version integer,p_command_id text
)returns table(scenario_id text,aggregate_version integer) language plpgsql security definer set search_path=public as $$
declare
  o public.investment_opportunities%rowtype;
  source public.investment_opportunity_analyses%rowtype;
  parent public.investment_scenarios%rowtype;
  existing_scenario_id text;
  now_at timestamptz:=now();
begin
  select * into o from public.investment_opportunities where id=p_opportunity_id for update;
  if o.id is null or auth.uid() is null or not public.can_manage_investment_opportunity(o.workspace_id,o.property_id) then
    raise exception 'scenario_permission_denied' using errcode='42501';
  end if;
  select details->>'scenarioId' into existing_scenario_id
  from public.investment_opportunity_activity
  where opportunity_id=o.id and command_id=p_command_id and type='scenario-created'
  limit 1;
  if existing_scenario_id is not null then
    return query select existing_scenario_id,o.version;
    return;
  end if;
  if o.version<>p_expected_version then raise exception 'scenario_stale' using errcode='40001';end if;
  if o.archived_at is not null then raise exception 'scenario_opportunity_archived';end if;
  if nullif(p_source_scenario_id,'') is not null then
    select * into parent from public.investment_scenarios
      where scenario_id=p_source_scenario_id and opportunity_id=o.id;
  end if;
  if nullif(p_source_analysis_version_id,'') is null then raise exception 'scenario_source_required';end if;
  select * into source from public.investment_opportunity_analyses
    where id=p_source_analysis_version_id and opportunity_id=o.id;
  if source.id is null then raise exception 'scenario_source_required';end if;
  if parent.scenario_id is not null and parent.source_analysis_version_id<>source.id then raise exception 'scenario_source_mismatch';end if;
  insert into public.investment_scenarios(
    scenario_id,opportunity_id,name,scenario_type,description,notes,status,revision,
    created_by_profile_id,created_at,updated_at,archived_at,source_analysis_version_id,
    assumptions_snapshot,output_snapshot,created_from_scenario_id
  ) values(
    p_scenario_id,o.id,btrim(p_name),p_scenario_type,nullif(btrim(p_description),''),
    nullif(btrim(p_notes),''),'active',1,auth.uid(),now_at,now_at,null,source.id,
    coalesce(source.result_snapshot->'reanalysis'->'userAssumptions','{}'::jsonb),
    source.result_snapshot,parent.scenario_id
  );
  insert into public.investment_scenario_events values(
    'scenario-event-'||gen_random_uuid(),p_scenario_id,o.id,
    case when parent.scenario_id is null then 'scenario-created' else 'scenario-duplicated' end,
    auth.uid(),'Operational scenario created from an immutable analysis version.',1,now_at
  );
  insert into public.investment_opportunity_activity(
    id,opportunity_id,type,actor,details,occurred_at,aggregate_version,command_id,analysis_version_id
  ) values(
    'opportunity-activity-'||gen_random_uuid(),o.id,'scenario-created',
    jsonb_build_object('type','user','id',auth.uid()::text),
    jsonb_build_object('scenarioId',p_scenario_id,'analysisId',source.id),
    now_at,o.version+1,p_command_id,source.id
  );
  update public.investment_opportunities set version=version+1,updated_at=now_at where id=o.id;
  return query select p_scenario_id,p_expected_version+1;
end $$;

-- Preferred scenario has its own pointer and never changes latest analysis.
create or replace function public.mutate_investment_scenario(
  p_opportunity_id text,p_scenario_id text,p_operation text,p_name text,p_description text,p_notes text,p_expected_scenario_revision integer,p_expected_version integer,p_command_id text
)returns table(aggregate_version integer,scenario_revision integer,changed boolean) language plpgsql security definer set search_path=public as $$
declare o public.investment_opportunities%rowtype;s public.investment_scenarios%rowtype;now_at timestamptz:=now();event_name text;did_change boolean:=true;
begin
  select * into o from public.investment_opportunities where id=p_opportunity_id for update;
  if o.id is null or auth.uid() is null or not public.can_manage_investment_opportunity(o.workspace_id,o.property_id) then raise exception 'scenario_permission_denied' using errcode='42501';end if;
  if o.version<>p_expected_version then raise exception 'scenario_stale' using errcode='40001';end if;
  select * into s from public.investment_scenarios where scenario_id=p_scenario_id and opportunity_id=o.id for update;
  if s.scenario_id is null then raise exception 'scenario_not_found';end if;
  if s.revision<>p_expected_scenario_revision then raise exception 'scenario_stale' using errcode='40001';end if;
  if p_operation='save' then
    did_change:=s.name is distinct from btrim(p_name)or coalesce(s.description,'')is distinct from btrim(coalesce(p_description,''))or coalesce(s.notes,'')is distinct from btrim(coalesce(p_notes,''));
    if did_change then update public.investment_scenarios set name=btrim(p_name),description=nullif(btrim(p_description),''),notes=nullif(btrim(p_notes),''),revision=revision+1,updated_at=now_at where scenario_id=s.scenario_id;event_name:='scenario-saved';end if;
  elsif p_operation='archive' then
    if o.preferred_scenario_id=s.scenario_id then raise exception 'scenario_preferred_cannot_archive';end if;
    update public.investment_scenarios set status='archived',archived_at=now_at,revision=revision+1,updated_at=now_at where scenario_id=s.scenario_id;event_name:='scenario-archived';
  elsif p_operation='restore' then
    update public.investment_scenarios set status='active',archived_at=null,revision=revision+1,updated_at=now_at where scenario_id=s.scenario_id;event_name:='scenario-restored';
  elsif p_operation='preferred' then
    if s.status='archived'then raise exception 'scenario_archived';end if;
    update public.investment_opportunities set preferred_scenario_id=s.scenario_id where id=o.id;event_name:='scenario-preferred';
  else raise exception 'scenario_operation_invalid';end if;
  if not did_change then return query select o.version,s.revision,false;return;end if;
  update public.investment_opportunities set version=version+1,updated_at=now_at where id=o.id;
  select * into s from public.investment_scenarios where scenario_id=p_scenario_id;
  insert into public.investment_scenario_events values('scenario-event-'||gen_random_uuid(),s.scenario_id,o.id,event_name,auth.uid(),case p_operation when'preferred'then'Scenario selected as the preferred investment strategy.'when'archive'then'Scenario archived without deleting its history.'when'restore'then'Scenario restored to active use.'else'Scenario metadata and operator notes saved.'end,s.revision,now_at);
  return query select o.version+1,s.revision,true;
end $$;

revoke all on function public.create_investment_scenario(text,text,text,text,text,text,text,text,integer,text) from public;
revoke all on function public.mutate_investment_scenario(text,text,text,text,text,text,integer,integer,text) from public;
grant execute on function public.create_investment_scenario(text,text,text,text,text,text,text,text,integer,text) to authenticated;
grant execute on function public.mutate_investment_scenario(text,text,text,text,text,text,integer,integer,text) to authenticated;

commit;
