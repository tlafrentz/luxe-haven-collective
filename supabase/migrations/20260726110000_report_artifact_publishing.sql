-- REP v1.1: artifact publishing is independent from immutable report generation.
begin;

alter table public.report_artifacts drop constraint if exists report_artifacts_status_check;
alter table public.report_artifacts add constraint report_artifacts_status_check
  check(status in('pending','active','superseded','failed','archived','deleted'));

create table public.report_artifact_jobs(
  id text primary key,
  report_id text not null references public.generated_reports(id),
  artifact_type text not null check(artifact_type in('html','pdf')),
  status text not null check(status in('queued','rendering','validating','storing','completed','failed','cancelled')),
  attempts integer not null default 0 check(attempts>=0),
  idempotency_key text unique not null,
  renderer_version text not null,
  artifact_id text references public.report_artifacts(id),
  locked_at timestamptz,
  locked_by text,
  lease_expires_at timestamptz,
  failure_code text,
  failure_message text,
  retryable boolean,
  created_by_profile_id uuid not null,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz
);
create index report_artifact_jobs_work_idx on public.report_artifact_jobs(status,created_at);
create index report_artifact_jobs_report_idx on public.report_artifact_jobs(report_id,created_at desc);
alter table public.report_artifact_jobs enable row level security;
create policy "Workspace artifact jobs are readable" on public.report_artifact_jobs for select to authenticated using(
  exists(select 1 from public.generated_reports report where report.id=report_id and public.active_workspace_role(report.workspace_id)is not null)
);
grant select on public.report_artifact_jobs to authenticated;

create or replace function public.activate_report_artifact(p_artifact_id text)
returns void language plpgsql security definer set search_path=public as $$
declare v_artifact public.report_artifacts%rowtype;
begin
  select * into v_artifact from public.report_artifacts where id=p_artifact_id and status='pending' for update;
  if v_artifact.id is null then raise exception 'artifact_not_pending';end if;
  update public.report_artifacts set status='superseded'
    where report_id=v_artifact.report_id and artifact_type=v_artifact.artifact_type and status='active';
  update public.report_artifacts set status='active' where id=v_artifact.id;
end $$;
revoke all on function public.activate_report_artifact(text) from public;
grant execute on function public.activate_report_artifact(text) to service_role;

create or replace function public.claim_report_artifact_job(p_worker_id text,p_lease_seconds integer default 120)
returns setof public.report_artifact_jobs language plpgsql security definer set search_path=public as $$
declare v_job public.report_artifact_jobs%rowtype;
begin
  if nullif(trim(p_worker_id),'')is null then raise exception 'artifact_worker_required';end if;
  select * into v_job from public.report_artifact_jobs
  where status='queued'or(status in('rendering','validating','storing')and lease_expires_at<now())
  order by created_at for update skip locked limit 1;
  if v_job.id is null then return;end if;
  update public.report_artifact_jobs set status='rendering',attempts=attempts+1,locked_at=now(),locked_by=p_worker_id,
    lease_expires_at=now()+make_interval(secs=>greatest(30,p_lease_seconds)),started_at=coalesce(started_at,now())
  where id=v_job.id returning * into v_job;
  return next v_job;
end $$;
revoke all on function public.claim_report_artifact_job(text,integer) from public;
grant execute on function public.claim_report_artifact_job(text,integer) to service_role;

commit;
