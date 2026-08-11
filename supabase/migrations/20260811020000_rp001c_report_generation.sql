begin;

alter table public.canonical_report_versions
  add column request_fingerprint text;

alter table public.canonical_report_versions
  drop constraint if exists canonical_report_versions_workspace_idempotency_key_key;

create unique index canonical_report_versions_idempotency_idx
  on public.canonical_report_versions(workspace_id, requested_by_profile_id, idempotency_key)
  where idempotency_key is not null;

create or replace function public.prevent_ready_report_version_mutation()
returns trigger language plpgsql set search_path=public as $$
begin
  if old.status in ('ready','failed') then
    raise exception 'Terminal report versions are immutable' using errcode='23514';
  end if;
  return new;
end;$$;

create or replace function public.reserve_canonical_report_generation(
  p_report jsonb,
  p_report_id text,
  p_version_id text,
  p_definition jsonb,
  p_actor_user_id uuid,
  p_workspace_id uuid,
  p_scope jsonb,
  p_property_ids uuid[],
  p_period jsonb,
  p_comparison_period jsonb,
  p_title text,
  p_requested_at timestamptz,
  p_idempotency_key text,
  p_request_fingerprint text
) returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  existing public.canonical_report_versions;
  reserved public.canonical_report_versions;
  next_version integer;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Generation reservation requires the server boundary' using errcode='42501';
  end if;

  if p_idempotency_key is not null then
    select * into existing
    from public.canonical_report_versions
    where workspace_id=p_workspace_id
      and requested_by_profile_id=p_actor_user_id
      and idempotency_key=p_idempotency_key;
    if found then
      if existing.request_fingerprint is distinct from p_request_fingerprint then
        raise exception 'REPORT_IDEMPOTENCY_CONFLICT' using errcode='P0001';
      end if;
      return jsonb_build_object('version',to_jsonb(existing),'replay',true);
    end if;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_workspace_id::text||':'||p_report_id,0));

  if p_report is not null then
    insert into public.canonical_reports(id,workspace_id,family,report_type,definition_id,created_by_profile_id,created_at)
    values(p_report_id,p_workspace_id,p_definition->>'family',p_definition->>'reportType',p_definition->>'definitionId',p_actor_user_id,p_requested_at);
  elsif not exists(select 1 from public.canonical_reports where id=p_report_id and workspace_id=p_workspace_id) then
    raise exception 'Report not found' using errcode='P0002';
  end if;

  select coalesce(max(version_number),0)+1 into next_version
  from public.canonical_report_versions where report_id=p_report_id;

  insert into public.canonical_report_versions(
    id,report_id,workspace_id,version_number,definition_id,definition_version,family,report_type,
    title,requested_by_profile_id,scope_kind,scope_snapshot,property_ids,owner_id,opportunity_id,
    status,period_snapshot,comparison_period_snapshot,idempotency_key,request_fingerprint,requested_at
  ) values(
    p_version_id,p_report_id,p_workspace_id,next_version,p_definition->>'definitionId',(p_definition->>'definitionVersion')::integer,
    p_definition->>'family',p_definition->>'reportType',p_title,p_actor_user_id,p_scope->>'kind',p_scope,p_property_ids,
    case when p_scope->>'kind'='owner_portfolio' then (p_scope->>'ownerId')::uuid else null end,
    case when p_scope->>'kind'='investment_opportunity' then p_scope->>'opportunityId' else null end,
    'draft',p_period,p_comparison_period,p_idempotency_key,p_request_fingerprint,p_requested_at
  ) returning * into reserved;

  return jsonb_build_object('version',to_jsonb(reserved),'replay',false);
exception when unique_violation then
  if p_idempotency_key is not null then
    select * into existing from public.canonical_report_versions
    where workspace_id=p_workspace_id and requested_by_profile_id=p_actor_user_id and idempotency_key=p_idempotency_key;
    if found and existing.request_fingerprint = p_request_fingerprint then
      return jsonb_build_object('version',to_jsonb(existing),'replay',true);
    end if;
  end if;
  raise;
end;$$;

revoke all on function public.reserve_canonical_report_generation(jsonb,text,text,jsonb,uuid,uuid,jsonb,uuid[],jsonb,jsonb,text,timestamptz,text,text) from public, anon, authenticated;
grant execute on function public.reserve_canonical_report_generation(jsonb,text,text,jsonb,uuid,uuid,jsonb,uuid[],jsonb,jsonb,text,timestamptz,text,text) to service_role;

commit;
