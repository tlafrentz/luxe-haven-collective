-- PS-002: require category-level email consent at the transactional claim boundary.
begin;

create or replace function public.claim_notification_digest(
  p_workspace_id uuid,p_profile_id uuid,p_frequency text,p_period_key text,p_timezone text,
  p_scheduled_for timestamptz,p_notification_ids uuid[],p_recipient_digest text,p_correlation_id uuid
) returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_request public.notification_digest_requests%rowtype; v_email text; v_count int; v_expected int; v_idempotency text;
begin
  if auth.role()<>'service_role' then raise exception 'NOTIFICATION_DIGEST_SERVICE_REQUIRED'; end if;
  if p_frequency not in ('immediate','daily','weekly') or cardinality(p_notification_ids)=0 or length(p_recipient_digest)<>64 then raise exception 'NOTIFICATION_DIGEST_INPUT_INVALID'; end if;
  if not exists(select 1 from public.workspace_memberships where workspace_id=p_workspace_id and profile_id=p_profile_id and status='active') then
    return jsonb_build_object('claimed',false,'code','MEMBERSHIP_INACTIVE');
  end if;
  if exists(select 1 from public.auth_email_suppressions where recipient_digest=p_recipient_digest and active) then
    return jsonb_build_object('claimed',false,'code','RECIPIENT_SUPPRESSED');
  end if;
  if not exists(select 1 from public.user_notification_preferences where workspace_id=p_workspace_id and profile_id=p_profile_id and confirmed and coalesce((channels->>'email')::boolean,false)) then
    return jsonb_build_object('claimed',false,'code','EMAIL_DISABLED');
  end if;
  select email into v_email from public.profiles where id=p_profile_id;
  if nullif(btrim(coalesce(v_email,'')),'') is null then return jsonb_build_object('claimed',false,'code','RECIPIENT_UNAVAILABLE'); end if;
  select count(*),count(*) filter(where n.workspace_id=p_workspace_id and n.recipient_profile_id=p_profile_id and n.status='unread'
    and exists(select 1 from public.user_notification_preferences p cross join lateral jsonb_array_elements(p.subscriptions) s
      where p.workspace_id=p_workspace_id and p.profile_id=p_profile_id and s->>'category'=n.category and coalesce(s->'channels','[]'::jsonb) ? 'email'
      and s->>'frequency'=case p_frequency when 'daily' then 'daily-digest' when 'weekly' then 'weekly-digest' else 'immediate' end))
    into v_expected,v_count from unnest(p_notification_ids) i(id) left join public.notifications n on n.id=i.id;
  if v_count<>v_expected then raise exception 'NOTIFICATION_DIGEST_ITEM_INELIGIBLE'; end if;
  v_idempotency:=p_workspace_id||':'||p_profile_id||':'||p_frequency||':'||p_period_key;
  insert into public.notification_digest_requests(workspace_id,profile_id,frequency,period_key,timezone,scheduled_for,recipient_digest,correlation_id,idempotency_key)
  values(p_workspace_id,p_profile_id,p_frequency,p_period_key,p_timezone,p_scheduled_for,p_recipient_digest,p_correlation_id,v_idempotency)
  on conflict(workspace_id,profile_id,frequency,period_key) do nothing returning * into v_request;
  if not found then select * into v_request from public.notification_digest_requests where workspace_id=p_workspace_id and profile_id=p_profile_id and frequency=p_frequency and period_key=p_period_key; return jsonb_build_object('claimed',false,'code','REPLAY','requestId',v_request.id,'status',v_request.status); end if;
  insert into public.notification_digest_items(digest_request_id,notification_id,category)
  select v_request.id,n.id,n.category from public.notifications n where n.id=any(p_notification_ids);
  return jsonb_build_object('claimed',true,'requestId',v_request.id,'idempotencyKey',v_idempotency);
end $$;

revoke all on function public.claim_notification_digest(uuid,uuid,text,text,text,timestamptz,uuid[],text,uuid) from public,anon,authenticated;
grant execute on function public.claim_notification_digest(uuid,uuid,text,text,text,timestamptz,uuid[],text,uuid) to service_role;

commit;
