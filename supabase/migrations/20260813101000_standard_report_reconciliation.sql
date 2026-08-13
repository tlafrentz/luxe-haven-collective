create or replace function public.transition_standard_report_definition(
  p_actor_id uuid,p_report_code text,p_version integer,p_action text,p_reason_code text,p_expected_revision integer,p_correlation_id text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare current public.standard_report_definitions; next_status text; event_code text;
begin
  if not exists(select 1 from public.profiles where id=p_actor_id and role='admin') or (auth.role()<>'service_role' and auth.uid()<>p_actor_id) then raise exception 'STANDARD_REPORT_ADMIN_REQUIRED'; end if;
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
end;$$;
revoke all on function public.transition_standard_report_definition(uuid,text,integer,text,text,integer,text) from public,anon;
grant execute on function public.transition_standard_report_definition(uuid,text,integer,text,text,integer,text) to authenticated,service_role;
