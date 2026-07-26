-- GBS-004A: recoverable, idempotent guidebook publishing pipeline.
begin;

alter table public.guidebooks
  add column if not exists public_url_status text not null default 'unavailable'
    check(public_url_status in('active','archived','revoked','unavailable')),
  add column if not exists active_version_id uuid references public.guidebook_versions(id);

alter table public.guidebook_versions
  add column if not exists publication_notes text,
  add column if not exists property_version text,
  add column if not exists projection_version text,
  add column if not exists activated_at timestamptz,
  add column if not exists superseded_at timestamptz;

update public.guidebooks set public_url_status=case when status='published' then'active'when status='archived'then'archived'else'unavailable'end;
with ranked as(select id,row_number()over(partition by guidebook_id order by version desc)as position from public.guidebook_versions where status='published')
update public.guidebook_versions version set status='superseded',superseded_at=coalesce(version.superseded_at,now())from ranked where ranked.id=version.id and ranked.position>1;
update public.guidebooks guidebook set active_version_id=version.id from public.guidebook_versions version where version.guidebook_id=guidebook.id and version.status='published';
create unique index if not exists guidebook_one_active_version_idx
  on public.guidebook_versions(guidebook_id) where status='published';

create table public.guidebook_publish_jobs(
  id uuid primary key default gen_random_uuid(),
  guidebook_id uuid not null references public.guidebooks(id),
  workspace_id uuid not null references public.profiles(id),
  requested_by_profile_id uuid not null references public.profiles(id),
  command_id text not null,
  idempotency_key text not null unique,
  expected_revision integer not null,
  status text not null check(status in('queued','processing','completed','failed','cancelled')),
  stage text not null check(stage in('queued','validating','snapshotting','rendering','activating','completed')),
  attempts integer not null default 0 check(attempts>=0),
  publishing_notes text,
  warning_override boolean not null default false,
  validation_result jsonb,
  failure_code text,
  failure_message text,
  retryable boolean,
  published_version_id uuid references public.guidebook_versions(id),
  locked_at timestamptz,
  locked_by text,
  lease_expires_at timestamptz,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  unique(guidebook_id,command_id)
);
create index guidebook_publish_jobs_work_idx on public.guidebook_publish_jobs(status,created_at);
create index guidebook_publish_jobs_guidebook_idx on public.guidebook_publish_jobs(guidebook_id,created_at desc);
alter table public.guidebook_publish_jobs enable row level security;
create policy "Authorized users read guidebook publish jobs" on public.guidebook_publish_jobs for select to authenticated using(
  exists(select 1 from public.guidebooks guidebook where guidebook.id=guidebook_id and(guidebook.workspace_id=auth.uid()or public.is_admin()))
);
grant select on public.guidebook_publish_jobs to authenticated;

create or replace function public.activate_guidebook_publication(
  p_job_id uuid,p_snapshot jsonb,p_property_version text,p_projection_version text,p_activated_at timestamptz
) returns uuid language plpgsql security definer set search_path=public as $$
declare v_job public.guidebook_publish_jobs%rowtype;v_guidebook public.guidebooks%rowtype;v_version integer;v_version_id uuid;
begin
 select * into v_job from public.guidebook_publish_jobs where id=p_job_id for update;
 if v_job.id is null then raise exception 'publish_job_not_found';end if;
 if v_job.status='completed' then return v_job.published_version_id;end if;
 if v_job.status<>'processing'or v_job.stage<>'activating' then raise exception 'publish_job_not_activating';end if;
 select * into v_guidebook from public.guidebooks where id=v_job.guidebook_id for update;
 if v_guidebook.id is null then raise exception 'guidebook_not_found';end if;
 if v_guidebook.revision<>v_job.expected_revision then raise exception 'revision_conflict';end if;
 if v_guidebook.status='archived' then raise exception 'guidebook_archived';end if;
 if p_snapshot is null or jsonb_array_length(coalesce(p_snapshot->'sections','[]'::jsonb))=0 then raise exception 'publication_invalid';end if;
 v_version:=v_guidebook.current_version+1;v_version_id:=gen_random_uuid();
 update public.guidebook_versions set status='superseded',superseded_at=p_activated_at where guidebook_id=v_guidebook.id and status='published';
 insert into public.guidebook_versions(id,guidebook_id,version,status,snapshot,published_by_profile_id,published_at,created_at,publication_notes,property_version,projection_version,activated_at)
 values(v_version_id,v_guidebook.id,v_version,'published',p_snapshot,v_job.requested_by_profile_id,p_activated_at,p_activated_at,v_job.publishing_notes,p_property_version,p_projection_version,p_activated_at);
 update public.guidebooks set status='published',current_version=v_version,published_version=v_version,active_version_id=v_version_id,public_url_status='active',updated_at=p_activated_at,revision=revision+1 where id=v_guidebook.id;
 update public.properties set guidebook_available=true where id=v_guidebook.property_id;
 update public.guidebook_publish_jobs set status='completed',stage='completed',published_version_id=v_version_id,completed_at=p_activated_at,lease_expires_at=null where id=p_job_id;
 insert into public.guidebook_activity(guidebook_id,event_type,actor_profile_id,safe_summary,metadata,occurred_at)values
 (v_guidebook.id,'guidebook-published',v_job.requested_by_profile_id,'Guidebook version '||v_version||' activated for guests.',jsonb_build_object('version',v_version,'jobId',p_job_id,'propertyVersion',p_property_version,'projectionVersion',p_projection_version,'notes',v_job.publishing_notes),p_activated_at),
 (v_guidebook.id,'public-activation-completed',v_job.requested_by_profile_id,'The canonical guest URL now serves guidebook version '||v_version||'.',jsonb_build_object('version',v_version,'jobId',p_job_id),p_activated_at);
 return v_version_id;
end $$;
revoke all on function public.activate_guidebook_publication(uuid,jsonb,text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.activate_guidebook_publication(uuid,jsonb,text,text,timestamptz) to service_role;

create or replace function public.claim_guidebook_publish_job(p_worker_id text,p_lease_seconds integer default 120)
returns setof public.guidebook_publish_jobs language plpgsql security definer set search_path=public as $$
declare v_job public.guidebook_publish_jobs%rowtype;
begin
 select * into v_job from public.guidebook_publish_jobs where status='queued'or(status='processing'and lease_expires_at<now())order by created_at for update skip locked limit 1;
 if v_job.id is null then return;end if;
 update public.guidebook_publish_jobs set status='processing',stage='validating',attempts=attempts+1,started_at=coalesce(started_at,now()),locked_at=now(),locked_by=p_worker_id,lease_expires_at=now()+make_interval(secs=>greatest(30,p_lease_seconds))where id=v_job.id returning * into v_job;
 return next v_job;
end $$;
revoke all on function public.claim_guidebook_publish_job(text,integer) from public;
grant execute on function public.claim_guidebook_publish_job(text,integer) to service_role;

revoke execute on function public.publish_guidebook_version(uuid,integer,jsonb,uuid,timestamptz) from service_role;

commit;
