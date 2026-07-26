-- PC-001D: canonical platform Reporting, immutable snapshots, rendering artifacts, jobs, and secure sharing.

begin;

alter table public.commerce_entitlement_templates
  add column if not exists created_at timestamptz not null default now();

create sequence if not exists public.report_number_sequence start 1;

create table public.report_definitions(
  id text primary key,
  report_type text unique not null check(report_type in('investment-decision','property-performance','portfolio-performance','financial-performance')),
  name text not null,
  description text not null,
  supported_scopes text[] not null,
  supports_periods boolean not null,
  required_entitlement_key text not null,
  required_projection_key text not null,
  default_template_id text not null,
  required_sections text[] not null,
  optional_sections text[] not null default '{}',
  external_sharing text not null check(external_sharing in('allowed','workspace-policy','disabled')),
  status text not null check(status in('draft','active','inactive','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.report_templates(
  id text primary key,
  template_key text not null,
  name text not null,
  report_type text not null check(report_type in('investment-decision','property-performance','portfolio-performance','financial-performance')),
  version integer not null check(version>0),
  status text not null check(status in('draft','active','inactive','archived')),
  brand_configuration jsonb not null,
  page_configuration jsonb not null,
  section_definitions jsonb not null,
  created_at timestamptz not null default now(),
  activated_at timestamptz,
  archived_at timestamptz,
  unique(template_key,version)
);
create unique index report_active_template_uidx on public.report_templates(report_type) where status='active';

create table public.report_requests(
  id text primary key,
  workspace_id uuid not null,
  requested_by_profile_id uuid not null,
  report_type text not null references public.report_definitions(report_type),
  scope_type text not null,
  scope_snapshot jsonb not null,
  period_snapshot jsonb,
  comparison_snapshot jsonb,
  source_context jsonb not null,
  template_id text not null references public.report_templates(id),
  title text,
  subtitle text,
  section_configuration jsonb not null default '[]'::jsonb,
  status text not null check(status in('draft','queued','generating','completed','failed','cancelled')),
  idempotency_key text not null,
  expected_projection_version text,
  entitlement_version text not null,
  permission_snapshot jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_id,idempotency_key)
);

create table public.generated_reports(
  id text primary key,
  report_number text unique not null,
  report_request_id text unique not null references public.report_requests(id),
  workspace_id uuid not null,
  generated_by_profile_id uuid not null,
  report_type text not null,
  status text not null check(status in('generated','published','archived','superseded')),
  title text not null,
  subtitle text,
  scope_type text not null,
  property_id uuid,
  opportunity_id text,
  scenario_id text,
  scope_snapshot jsonb not null,
  period_snapshot jsonb,
  comparison_snapshot jsonb,
  source_context_snapshot jsonb not null,
  projection_snapshot jsonb not null,
  snapshot_schema_version text not null,
  snapshot_size_bytes integer not null check(snapshot_size_bytes>0 and snapshot_size_bytes<=2000000),
  template_id text not null references public.report_templates(id),
  template_version integer not null,
  projection_version text not null,
  source_versions jsonb not null,
  confidence text not null,
  freshness text not null,
  series_key text not null,
  version_number integer not null check(version_number>0),
  supersedes_report_id text references public.generated_reports(id),
  generated_at timestamptz not null,
  archived_at timestamptz,
  unique(workspace_id,series_key,version_number)
);

create table public.report_artifacts(
  id text primary key,
  report_id text not null references public.generated_reports(id),
  artifact_type text not null check(artifact_type in('html','pdf','preview-image')),
  storage_path text not null unique,
  mime_type text not null,
  size_bytes bigint not null check(size_bytes>0),
  checksum text not null,
  renderer_version text not null,
  status text not null check(status in('active','superseded','deleted')),
  created_at timestamptz not null default now()
);
create unique index report_active_artifact_uidx on public.report_artifacts(report_id,artifact_type) where status='active';

create table public.report_generation_jobs(
  id text primary key,
  report_request_id text not null references public.report_requests(id),
  generated_report_id text references public.generated_reports(id),
  status text not null check(status in('queued','processing','completed','failed','cancelled')),
  stage text not null check(stage in('queued','projection','html','pdf','storage','completed')),
  attempts integer not null default 0 check(attempts>=0),
  idempotency_key text unique not null,
  locked_at timestamptz,
  locked_by text,
  lease_expires_at timestamptz,
  failure_code text,
  failure_message text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz
);

create table public.report_shares(
  id text primary key,
  report_id text not null references public.generated_reports(id),
  created_by_profile_id uuid not null,
  token_hash text unique not null,
  status text not null check(status in('active','expired','revoked')),
  access_mode text not null check(access_mode in('view','view-and-download')),
  expires_at timestamptz,
  max_views integer check(max_views is null or max_views>0),
  view_count integer not null default 0 check(view_count>=0),
  created_at timestamptz not null default now(),
  last_viewed_at timestamptz,
  revoked_at timestamptz,
  check(expires_at is null or expires_at>created_at)
);

create table public.report_share_access(
  id text primary key,
  share_id text not null references public.report_shares(id),
  accessed_at timestamptz not null default now(),
  access_type text not null check(access_type in('view','download','denied')),
  safe_fingerprint text,
  result text not null
);

create table public.report_activity(
  id text primary key,
  report_request_id text references public.report_requests(id),
  report_id text references public.generated_reports(id),
  job_id text references public.report_generation_jobs(id),
  share_id text references public.report_shares(id),
  workspace_id uuid not null,
  actor_profile_id uuid,
  event_type text not null,
  safe_summary text not null,
  resulting_state text,
  occurred_at timestamptz not null default now()
);

create table public.report_command_receipts(
  id text primary key,
  command_type text not null,
  idempotency_key text unique not null,
  aggregate_id text,
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index report_requests_workspace_idx on public.report_requests(workspace_id,created_at desc);
create index generated_reports_workspace_idx on public.generated_reports(workspace_id,status,generated_at desc);
create index generated_reports_source_idx on public.generated_reports(scope_type,property_id,opportunity_id,scenario_id);
create index report_jobs_work_idx on public.report_generation_jobs(status,created_at);
create index report_shares_work_idx on public.report_shares(status,expires_at);
create index report_activity_report_idx on public.report_activity(report_id,occurred_at);

alter table public.report_definitions enable row level security;
alter table public.report_templates enable row level security;
alter table public.report_requests enable row level security;
alter table public.generated_reports enable row level security;
alter table public.report_artifacts enable row level security;
alter table public.report_generation_jobs enable row level security;
alter table public.report_shares enable row level security;
alter table public.report_share_access enable row level security;
alter table public.report_activity enable row level security;
alter table public.report_command_receipts enable row level security;

create policy "Active report definitions are readable" on public.report_definitions for select to authenticated using(status='active' or public.is_admin());
create policy "Active report templates are readable" on public.report_templates for select to authenticated using(status='active' or public.is_admin());
create policy "Workspace report requests are readable" on public.report_requests for select to authenticated using(public.active_workspace_role(workspace_id)is not null);
create policy "Workspace generated reports are readable" on public.generated_reports for select to authenticated using(
  public.active_workspace_role(workspace_id)is not null
  and(scope_type<>'property' or property_id is null or exists(select 1 from public.properties p where p.id=property_id and p.owner_id=auth.uid()) or public.is_admin())
);
create policy "Workspace report artifacts are readable" on public.report_artifacts for select to authenticated using(
  exists(select 1 from public.generated_reports r where r.id=report_id and public.active_workspace_role(r.workspace_id)is not null)
);
create policy "Report creators and administrators read jobs" on public.report_generation_jobs for select to authenticated using(
  exists(select 1 from public.report_requests r where r.id=report_request_id and(r.requested_by_profile_id=auth.uid() or public.is_admin()))
);
create policy "Report share creators read shares" on public.report_shares for select to authenticated using(created_by_profile_id=auth.uid() or public.is_admin());
create policy "Report administrators read share access" on public.report_share_access for select to authenticated using(public.is_admin());
create policy "Workspace report activity is readable" on public.report_activity for select to authenticated using(public.active_workspace_role(workspace_id)is not null);
create policy "Report administrators read receipts" on public.report_command_receipts for select to authenticated using(public.is_admin());

grant select on public.report_definitions,public.report_templates,public.report_requests,public.generated_reports,public.report_artifacts,public.report_generation_jobs,public.report_shares,public.report_share_access,public.report_activity,public.report_command_receipts to authenticated;

create or replace function public.prevent_generated_report_mutation()
returns trigger language plpgsql as $$
begin
  if row(new.id,new.report_number,new.report_request_id,new.workspace_id,new.generated_by_profile_id,new.report_type,new.title,new.scope_snapshot,new.period_snapshot,new.comparison_snapshot,new.source_context_snapshot,new.projection_snapshot,new.snapshot_schema_version,new.snapshot_size_bytes,new.template_id,new.template_version,new.projection_version,new.source_versions,new.confidence,new.freshness,new.series_key,new.version_number,new.supersedes_report_id,new.generated_at)
     is distinct from
     row(old.id,old.report_number,old.report_request_id,old.workspace_id,old.generated_by_profile_id,old.report_type,old.title,old.scope_snapshot,old.period_snapshot,old.comparison_snapshot,old.source_context_snapshot,old.projection_snapshot,old.snapshot_schema_version,old.snapshot_size_bytes,old.template_id,old.template_version,old.projection_version,old.source_versions,old.confidence,old.freshness,old.series_key,old.version_number,old.supersedes_report_id,old.generated_at)
  then raise exception 'report_snapshot_immutable'; end if;
  return new;
end $$;
create trigger generated_report_snapshot_immutable before update on public.generated_reports for each row execute function public.prevent_generated_report_mutation();
create trigger generated_report_no_delete before delete on public.generated_reports for each row execute function public.prevent_commerce_history_change();
create trigger report_template_immutable before update or delete on public.report_templates for each row when(old.status<>'draft') execute function public.prevent_commerce_history_change();
create trigger report_activity_immutable before update or delete on public.report_activity for each row execute function public.prevent_commerce_history_change();
create trigger report_share_access_immutable before update or delete on public.report_share_access for each row execute function public.prevent_commerce_history_change();

create or replace function public.next_report_number(p_report_type text)
returns text language plpgsql security definer set search_path=public as $$
declare v_prefix text;v_sequence bigint;
begin
  v_prefix:=case p_report_type when'investment-decision'then'INV' when'property-performance'then'PRP' when'portfolio-performance'then'POR' when'financial-performance'then'FIN' else null end;
  if v_prefix is null then raise exception 'report_definition_not_found';end if;
  v_sequence:=nextval('public.report_number_sequence');
  return v_prefix||'-'||extract(year from now())::integer||'-'||lpad(v_sequence::text,6,'0');
end $$;
revoke all on function public.next_report_number(text) from public;
grant execute on function public.next_report_number(text) to service_role;

create or replace function public.claim_report_generation_job(p_worker_id text,p_lease_seconds integer default 120)
returns setof public.report_generation_jobs language plpgsql security definer set search_path=public as $$
declare v_job public.report_generation_jobs%rowtype;
begin
  if nullif(trim(p_worker_id),'')is null then raise exception 'report_worker_required';end if;
  select * into v_job from public.report_generation_jobs
  where status='queued'or(status='processing'and lease_expires_at<now())
  order by created_at for update skip locked limit 1;
  if v_job.id is null then return;end if;
  update public.report_generation_jobs set status='processing',attempts=attempts+1,locked_at=now(),locked_by=p_worker_id,
    lease_expires_at=now()+make_interval(secs=>greatest(30,p_lease_seconds)),started_at=coalesce(started_at,now())
  where id=v_job.id returning * into v_job;
  return next v_job;
end $$;
revoke all on function public.claim_report_generation_job(text,integer) from public;
grant execute on function public.claim_report_generation_job(text,integer) to service_role;

insert into public.report_definitions(id,report_type,name,description,supported_scopes,supports_periods,required_entitlement_key,required_projection_key,default_template_id,required_sections,optional_sections,external_sharing,status)
values
('report-definition-investment-decision','investment-decision','Investment Decision Report','Acquisition or rental-arbitrage decision snapshot.',array['investment-scenario'],false,'investment.reports.generate','investment-report-projection.v1','report-template-investment-decision-v1',array['decision-summary','property-profile','market-intelligence','financial-performance','risk-analysis','investment-score','recommendation','evidence-methodology'],array['actions','notes'],'allowed','active'),
('report-definition-property-performance','property-performance','Property Performance Report','Authorized property performance snapshot.',array['property'],true,'reports.generate','property-report-projection.v1','report-template-property-performance-v1',array['performance-summary','revenue-metrics','booking-trends','operational-attention','evidence-methodology'],array['financial-summary','actions','notes'],'workspace-policy','active'),
('report-definition-portfolio-performance','portfolio-performance','Portfolio Performance Report','Authorized portfolio condition and contribution snapshot.',array['portfolio','workspace'],true,'portfolio.reports.generate','portfolio-report-projection.v1','report-template-portfolio-performance-v1',array['portfolio-condition','primary-metrics','property-contribution','risks-opportunities','evidence-methodology'],array['capital-decisions','actions','outcomes'],'workspace-policy','active'),
('report-definition-financial-performance','financial-performance','Financial Performance Report','Permission-filtered financial condition snapshot.',array['financial-scope'],true,'financial.reports.generate','financial-report-projection.v1','report-template-financial-performance-v1',array['financial-condition','income-statement','cash-flow','liquidity','budget-forecast','evidence-methodology'],array['capital-summary','decisions-actions'],'disabled','active');

insert into public.report_templates(id,template_key,name,report_type,version,status,brand_configuration,page_configuration,section_definitions,activated_at)
select default_template_id,report_type||'-editorial','Luxe Haven '||name,report_type,1,'active',
  '{"name":"Luxe Haven Collective","accent":"#8a6b22","confidentiality":"Confidential"}'::jsonb,
  '{"size":"Letter","pageNumbers":true,"header":true,"footer":true}'::jsonb,
  to_jsonb(required_sections),now() from public.report_definitions;

insert into public.commerce_entitlement_templates(
  id,entitlement_key,name,description,scope_type,grant_type,duration_policy,status,metadata,created_at,updated_at
) values
('commerce-entitlement-reports-download','reports.download','Download Reports','Download authorized generated report artifacts.','workspace','capability','subscription-period','active','{}',now(),now()),
('commerce-entitlement-reports-share','reports.share','Share Reports','Create revocable secure report shares.','workspace','capability','subscription-period','active','{}',now(),now()),
('commerce-entitlement-portfolio-reports','portfolio.reports.generate','Generate Portfolio Reports','Generate authorized Portfolio Performance Reports.','workspace','capability','subscription-period','active','{}',now(),now()),
('commerce-entitlement-financial-reports','financial.reports.generate','Generate Financial Reports','Generate permission-filtered Financial Performance Reports.','workspace','capability','subscription-period','active','{}',now(),now())
on conflict(entitlement_key)do nothing;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('report-artifacts','report-artifacts',false,15728640,array['text/html','application/pdf','image/png'])
on conflict(id)do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create policy "Report artifact service writes" on storage.objects for insert to service_role with check(bucket_id='report-artifacts');
create policy "Report artifact service updates" on storage.objects for update to service_role using(bucket_id='report-artifacts') with check(bucket_id='report-artifacts');
create policy "Report artifact service reads" on storage.objects for select to service_role using(bucket_id='report-artifacts');

commit;
