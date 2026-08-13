begin;

create table public.standard_report_definitions(
  report_code text not null,
  version integer not null check(version>0),
  family text not null check(family in('executive','owner','investment','operations')),
  name text not null,
  status text not null check(status in('draft','approved','active','retired')),
  contract jsonb not null,
  fingerprint text not null check(fingerprint~'^[a-f0-9]{64}$'),
  effective_from timestamptz not null,
  effective_through timestamptz,
  replacement_report_code text,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revision integer not null default 1,
  primary key(report_code,version),
  unique(report_code,version,fingerprint),
  check(contract->>'reportCode'=report_code),
  check((contract->>'version')::integer=version),
  check(contract->>'family'=family),
  check(contract->>'status'=status)
);

create table public.standard_report_catalog_events(
  id uuid primary key default gen_random_uuid(),
  report_code text not null,
  report_version integer not null,
  event_code text not null check(event_code in('standard_report_registered','standard_report_draft_updated','standard_report_approved','standard_report_activated','standard_report_retired')),
  actor_id uuid not null,
  reason_code text not null,
  correlation_id text not null,
  definition_fingerprint text not null,
  occurred_at timestamptz not null default now(),
  unique(report_code,report_version,event_code,correlation_id),
  foreign key(report_code,report_version) references public.standard_report_definitions(report_code,version)
);

create index standard_report_definitions_family_status_idx on public.standard_report_definitions(family,status,report_code);
create index standard_report_catalog_events_report_idx on public.standard_report_catalog_events(report_code,report_version,occurred_at desc);

alter table public.standard_report_definitions enable row level security;
alter table public.standard_report_catalog_events enable row level security;

create policy "Internal users read standard report definitions" on public.standard_report_definitions
for select to authenticated using(public.is_admin());
create policy "Internal users read standard report catalog history" on public.standard_report_catalog_events
for select to authenticated using(public.is_admin());

grant select on public.standard_report_definitions,public.standard_report_catalog_events to authenticated;
grant all on public.standard_report_definitions,public.standard_report_catalog_events to service_role;

create or replace function public.prevent_published_standard_report_definition_mutation()
returns trigger language plpgsql set search_path='' as $$
begin
  if tg_op='DELETE' then raise exception 'STANDARD_REPORT_DEFINITION_IMMUTABLE'; end if;
  if old.report_code<>new.report_code or old.version<>new.version or old.family<>new.family then
    raise exception 'STANDARD_REPORT_DEFINITION_IMMUTABLE';
  end if;
  if old.status='draft' and new.status='draft' then return new; end if;
  if old.name<>new.name or old.fingerprint<>new.fingerprint or old.effective_from<>new.effective_from or old.contract-'status'<>new.contract-'status' then raise exception 'STANDARD_REPORT_DEFINITION_IMMUTABLE'; end if;
  if not ((old.status='draft' and new.status='approved') or (old.status='approved' and new.status='active') or (old.status='active' and new.status='retired')) then
    raise exception 'STANDARD_REPORT_TRANSITION_INVALID';
  end if;
  return new;
end;
$$;

create or replace function public.clone_standard_report_definition(
  p_actor_id uuid,p_report_code text,p_source_version integer,p_new_version integer,p_reason_code text,p_correlation_id text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare source public.standard_report_definitions; cloned_contract jsonb;
begin
  if auth.uid()<>p_actor_id or not public.is_admin() then raise exception 'STANDARD_REPORT_ADMIN_REQUIRED'; end if;
  if p_new_version<1 or length(trim(p_reason_code))=0 then raise exception 'STANDARD_REPORT_DEFINITION_INVALID'; end if;
  select * into source from public.standard_report_definitions where report_code=p_report_code and version=p_source_version;
  if not found then raise exception 'STANDARD_REPORT_DEFINITION_NOT_FOUND'; end if;
  cloned_contract:=jsonb_set(jsonb_set(source.contract,'{version}',to_jsonb(p_new_version)),'{status}',to_jsonb('draft'::text));
  insert into public.standard_report_definitions(report_code,version,family,name,status,contract,fingerprint,effective_from,replacement_report_code,created_by)
  values(source.report_code,p_new_version,source.family,source.name,'draft',cloned_contract,source.fingerprint,now(),source.report_code,p_actor_id);
  insert into public.standard_report_catalog_events(report_code,report_version,event_code,actor_id,reason_code,correlation_id,definition_fingerprint) values(source.report_code,p_new_version,'standard_report_registered',p_actor_id,p_reason_code,p_correlation_id,source.fingerprint);
  return jsonb_build_object('reportCode',source.report_code,'version',p_new_version,'status','draft','revision',1);
end;
$$;

create or replace function public.replace_standard_report_draft(
  p_actor_id uuid,p_contract jsonb,p_fingerprint text,p_reason_code text,p_expected_revision integer,p_correlation_id text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare current public.standard_report_definitions; code text; definition_version integer;
begin
  if auth.uid()<>p_actor_id or not public.is_admin() then raise exception 'STANDARD_REPORT_ADMIN_REQUIRED'; end if;
  code:=p_contract->>'reportCode'; definition_version:=(p_contract->>'version')::integer;
  select * into current from public.standard_report_definitions where report_code=code and version=definition_version for update;
  if not found or current.status<>'draft' then raise exception 'STANDARD_REPORT_DRAFT_REQUIRED'; end if;
  if current.revision<>p_expected_revision then raise exception 'STANDARD_REPORT_STALE_REVISION'; end if;
  if p_contract->>'status'<>'draft' or p_contract->>'family'<>current.family or p_fingerprint!~'^[a-f0-9]{64}$' or length(trim(p_reason_code))=0 then raise exception 'STANDARD_REPORT_DEFINITION_INVALID'; end if;
  update public.standard_report_definitions set name=p_contract->>'name',contract=p_contract,fingerprint=p_fingerprint,effective_from=(p_contract->>'effectiveFrom')::timestamptz,effective_through=nullif(p_contract->>'effectiveThrough','')::timestamptz,replacement_report_code=p_contract->>'replacementReportCode',updated_at=now(),revision=revision+1 where report_code=code and version=definition_version;
  insert into public.standard_report_catalog_events(report_code,report_version,event_code,actor_id,reason_code,correlation_id,definition_fingerprint) values(code,definition_version,'standard_report_draft_updated',p_actor_id,p_reason_code,p_correlation_id,p_fingerprint);
  return jsonb_build_object('reportCode',code,'version',definition_version,'status','draft','revision',current.revision+1);
end;
$$;
create trigger standard_report_definition_immutable
before update or delete on public.standard_report_definitions
for each row execute function public.prevent_published_standard_report_definition_mutation();

create or replace function public.register_standard_report_definition(
  p_actor_id uuid,
  p_contract jsonb,
  p_fingerprint text,
  p_correlation_id text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare existing public.standard_report_definitions; code text; definition_version integer; definition_family text; definition_status text;
begin
  if auth.role()<>'service_role' and (auth.uid()<>p_actor_id or not public.is_admin()) then raise exception 'STANDARD_REPORT_ADMIN_REQUIRED'; end if;
  code:=p_contract->>'reportCode'; definition_version:=(p_contract->>'version')::integer; definition_family:=p_contract->>'family'; definition_status:=p_contract->>'status';
  if code is null or definition_version<1 or definition_family not in('executive','owner','investment','operations') or definition_status not in('draft','approved','active','retired') or p_fingerprint!~'^[a-f0-9]{64}$' then raise exception 'STANDARD_REPORT_DEFINITION_INVALID'; end if;
  select * into existing from public.standard_report_definitions where report_code=code and version=definition_version;
  if found then
    if existing.fingerprint<>p_fingerprint or existing.contract-'status'<>p_contract-'status' then raise exception 'STANDARD_REPORT_REGISTRY_DRIFT'; end if;
    return jsonb_build_object('reportCode',code,'version',definition_version,'status',existing.status,'result','existing');
  end if;
  insert into public.standard_report_definitions(report_code,version,family,name,status,contract,fingerprint,effective_from,effective_through,replacement_report_code,created_by)
  values(code,definition_version,definition_family,p_contract->>'name',definition_status,p_contract,p_fingerprint,(p_contract->>'effectiveFrom')::timestamptz,nullif(p_contract->>'effectiveThrough','')::timestamptz,p_contract->>'replacementReportCode',p_actor_id);
  insert into public.standard_report_catalog_events(report_code,report_version,event_code,actor_id,reason_code,correlation_id,definition_fingerprint)
  values(code,definition_version,'standard_report_registered',p_actor_id,'immutable_code_registry',p_correlation_id,p_fingerprint);
  return jsonb_build_object('reportCode',code,'version',definition_version,'status',definition_status,'result','created');
end;
$$;

create or replace function public.transition_standard_report_definition(
  p_actor_id uuid,
  p_report_code text,
  p_version integer,
  p_action text,
  p_reason_code text,
  p_expected_revision integer,
  p_correlation_id text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare current public.standard_report_definitions; next_status text; event_code text;
begin
  if auth.uid()<>p_actor_id or not public.is_admin() then raise exception 'STANDARD_REPORT_ADMIN_REQUIRED'; end if;
  if length(trim(p_reason_code))=0 then raise exception 'STANDARD_REPORT_REASON_REQUIRED'; end if;
  select * into current from public.standard_report_definitions where report_code=p_report_code and version=p_version for update;
  if not found then raise exception 'STANDARD_REPORT_DEFINITION_NOT_FOUND'; end if;
  if current.revision<>p_expected_revision then raise exception 'STANDARD_REPORT_STALE_REVISION'; end if;
  next_status:=case when p_action='approve' and current.status='draft' then 'approved' when p_action='activate' and current.status='approved' then 'active' when p_action='retire' and current.status='active' then 'retired' else null end;
  if next_status is null then raise exception 'STANDARD_REPORT_TRANSITION_INVALID'; end if;
  event_code:=case next_status when 'approved' then 'standard_report_approved' when 'active' then 'standard_report_activated' else 'standard_report_retired' end;
  update public.standard_report_definitions set status=next_status,contract=jsonb_set(contract,'{status}',to_jsonb(next_status)),updated_at=now(),revision=revision+1 where report_code=p_report_code and version=p_version;
  insert into public.standard_report_catalog_events(report_code,report_version,event_code,actor_id,reason_code,correlation_id,definition_fingerprint) values(p_report_code,p_version,event_code,p_actor_id,p_reason_code,p_correlation_id,current.fingerprint);
  return jsonb_build_object('reportCode',p_report_code,'version',p_version,'status',next_status,'revision',current.revision+1);
end;
$$;

revoke all on function public.register_standard_report_definition(uuid,jsonb,text,text) from public,anon,authenticated;
grant execute on function public.register_standard_report_definition(uuid,jsonb,text,text) to service_role;
revoke all on function public.transition_standard_report_definition(uuid,text,integer,text,text,integer,text) from public,anon;
grant execute on function public.transition_standard_report_definition(uuid,text,integer,text,text,integer,text) to authenticated;
revoke all on function public.clone_standard_report_definition(uuid,text,integer,integer,text,text) from public,anon;
grant execute on function public.clone_standard_report_definition(uuid,text,integer,integer,text,text) to authenticated;
revoke all on function public.replace_standard_report_draft(uuid,jsonb,text,text,integer,text) from public,anon;
grant execute on function public.replace_standard_report_draft(uuid,jsonb,text,text,integer,text) to authenticated;

commit;
