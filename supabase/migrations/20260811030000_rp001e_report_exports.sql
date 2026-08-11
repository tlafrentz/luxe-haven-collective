begin;

create table public.canonical_report_exports(
  id text primary key,
  workspace_id uuid not null,
  report_id text not null,
  report_version_id text not null,
  format text not null check(format in('pdf','csv','csv_zip')),
  status text not null check(status in('queued','generating','ready','failed','expired')),
  options jsonb not null,
  requested_by_profile_id uuid not null,
  requested_at timestamptz not null,
  completed_at timestamptz,
  expires_at timestamptz,
  failure_code text,
  failure_message text,
  correlation_id text not null,
  renderer_version text not null,
  idempotency_key text not null,
  request_fingerprint text not null,
  storage_key text,
  file_name text,
  media_type text,
  byte_size bigint check(byte_size is null or byte_size>0),
  checksum text,
  foreign key(workspace_id,report_id) references public.canonical_reports(workspace_id,id) on delete restrict,
  foreign key(workspace_id,report_version_id) references public.canonical_report_versions(workspace_id,id) on delete restrict,
  unique(workspace_id,requested_by_profile_id,idempotency_key),
  check((status='ready' and storage_key is not null and file_name is not null and media_type is not null and byte_size is not null and checksum is not null and completed_at is not null and expires_at is not null) or status<>'ready'),
  check((status='failed' and failure_code is not null and completed_at is not null) or status<>'failed')
);

create index canonical_report_exports_version_idx on public.canonical_report_exports(workspace_id,report_version_id,requested_at desc);
create index canonical_report_exports_expiration_idx on public.canonical_report_exports(status,expires_at) where status='ready';
alter table public.canonical_report_exports enable row level security;
create policy "Authorized members read canonical report exports" on public.canonical_report_exports for select to authenticated using(
  public.active_workspace_role(workspace_id)is not null and exists(
    select 1 from public.canonical_report_versions version
    where version.workspace_id=canonical_report_exports.workspace_id and version.id=canonical_report_exports.report_version_id
      and not exists(select 1 from unnest(version.property_ids) property_id where not public.can_access_workspace_property(property_id))
  )
);
grant select on public.canonical_report_exports to authenticated;
grant all on public.canonical_report_exports to service_role;

create or replace function public.reserve_canonical_report_export(p_export jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare existing public.canonical_report_exports; created public.canonical_report_exports;
begin
  if coalesce(auth.role(),'')<>'service_role' then raise exception 'REPORT_SCOPE_FORBIDDEN'; end if;
  perform pg_advisory_xact_lock(hashtextextended((p_export->>'workspace_id')||':'||(p_export->>'requested_by_profile_id')||':'||(p_export->>'idempotency_key'),0));
  select * into existing from public.canonical_report_exports where workspace_id=(p_export->>'workspace_id')::uuid and requested_by_profile_id=(p_export->>'requested_by_profile_id')::uuid and idempotency_key=p_export->>'idempotency_key';
  if found then
    if existing.request_fingerprint<>p_export->>'request_fingerprint' then raise exception 'REPORT_EXPORT_IDEMPOTENCY_CONFLICT'; end if;
    return jsonb_build_object('record',to_jsonb(existing),'replay',true);
  end if;
  insert into public.canonical_report_exports(id,workspace_id,report_id,report_version_id,format,status,options,requested_by_profile_id,requested_at,correlation_id,renderer_version,idempotency_key,request_fingerprint)
  values(p_export->>'id',(p_export->>'workspace_id')::uuid,p_export->>'report_id',p_export->>'report_version_id',p_export->>'format',p_export->>'status',p_export->'options',(p_export->>'requested_by_profile_id')::uuid,(p_export->>'requested_at')::timestamptz,p_export->>'correlation_id',p_export->>'renderer_version',p_export->>'idempotency_key',p_export->>'request_fingerprint') returning * into created;
  return jsonb_build_object('record',to_jsonb(created),'replay',false);
end;$$;
revoke all on function public.reserve_canonical_report_export(jsonb) from public,anon,authenticated;
grant execute on function public.reserve_canonical_report_export(jsonb) to service_role;

update storage.buckets set allowed_mime_types=array['text/html','application/pdf','image/png','text/csv','text/csv;charset=utf-8','application/zip'] where id='report-artifacts';

commit;
