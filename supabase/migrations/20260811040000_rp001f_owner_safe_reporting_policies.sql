begin;
drop policy if exists "Authorized members read canonical reports" on public.canonical_reports;
create policy "Authorized members read canonical reports" on public.canonical_reports for select to authenticated using(
 public.active_workspace_role(workspace_id)is not null and (public.active_workspace_role(workspace_id)<>'owner' or definition_id in('owner.performance-report.v1','custom.report.v1'))
);
drop policy if exists "Authorized members read canonical report versions" on public.canonical_report_versions;
create policy "Authorized members read canonical report versions" on public.canonical_report_versions for select to authenticated using(
 public.active_workspace_role(workspace_id)is not null
 and not exists(select 1 from unnest(property_ids) property_id where not public.can_access_workspace_property(property_id))
 and (public.active_workspace_role(workspace_id)<>'owner' or definition_id='owner.performance-report.v1' or (definition_id='custom.report.v1' and content_snapshot#>>'{generation,normalizedRequest,customConfiguration,visibility}'='owner_safe'))
);
drop policy if exists "Authorized members read canonical report exports" on public.canonical_report_exports;
create policy "Authorized members read canonical report exports" on public.canonical_report_exports for select to authenticated using(
 public.active_workspace_role(workspace_id)is not null and exists(select 1 from public.canonical_report_versions version where version.workspace_id=canonical_report_exports.workspace_id and version.id=canonical_report_exports.report_version_id and not exists(select 1 from unnest(version.property_ids) property_id where not public.can_access_workspace_property(property_id)) and (public.active_workspace_role(version.workspace_id)<>'owner' or version.definition_id='owner.performance-report.v1' or (version.definition_id='custom.report.v1' and version.content_snapshot#>>'{generation,normalizedRequest,customConfiguration,visibility}'='owner_safe')))
);
commit;
