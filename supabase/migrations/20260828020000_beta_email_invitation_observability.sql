-- BETA-EMAIL-001 final correction: durable invitation delivery observability.
begin;

alter table public.auth_email_requests
  add column invitation_id uuid references public.workspace_invitations(id) on delete set null,
  add column workspace_id uuid references public.owners(id) on delete set null,
  add column intended_role text check (intended_role is null or intended_role in ('owner','administrator','operator','contributor','viewer')),
  add column idempotency_key text,
  add column legacy_reconciled boolean not null default false;

create unique index auth_email_requests_invitation_uidx
  on public.auth_email_requests(invitation_id) where invitation_id is not null;
create unique index auth_email_requests_idempotency_uidx
  on public.auth_email_requests(idempotency_key) where idempotency_key is not null;

create or replace function public.create_or_replay_invitation_auth_email_request(
  p_invitation_id uuid,
  p_correlation_id uuid,
  p_idempotency_key text,
  p_recipient_digest text,
  p_recipient_provider text
) returns public.auth_email_requests
language plpgsql security definer set search_path=pg_catalog,public as $$
declare i public.workspace_invitations%rowtype; q public.auth_email_requests%rowtype;
begin
  if auth.role()<>'service_role' then raise exception 'AUTH_EMAIL_INVITATION_REQUEST_SERVICE_REQUIRED' using errcode='42501'; end if;
  if length(p_recipient_digest)<>64 or length(coalesce(p_idempotency_key,''))<16 or p_recipient_provider not in ('gmail','microsoft','other') then
    raise exception 'AUTH_EMAIL_INVITATION_REQUEST_INPUT_INVALID' using errcode='22023';
  end if;
  select * into i from public.workspace_invitations where id=p_invitation_id for update;
  if not found or i.status<>'pending' or i.correlation_id<>p_correlation_id then
    raise exception 'AUTH_EMAIL_INVITATION_REQUEST_BINDING_INVALID' using errcode='22023';
  end if;
  select * into q from public.auth_email_requests where invitation_id=i.id or idempotency_key=p_idempotency_key order by requested_at limit 1;
  if found then
    if q.invitation_id<>i.id or q.correlation_id<>p_correlation_id or q.recipient_digest<>p_recipient_digest or q.idempotency_key<>p_idempotency_key then
      raise exception 'AUTH_EMAIL_INVITATION_REQUEST_REPLAY_MISMATCH' using errcode='22023';
    end if;
    return q;
  end if;
  insert into public.auth_email_requests(
    correlation_id,flow_type,invitation_id,workspace_id,intended_role,idempotency_key,
    recipient_digest,recipient_provider,status,linkage_confidence
  ) values (
    p_correlation_id,'invitation',i.id,i.workspace_id,i.role,p_idempotency_key,
    p_recipient_digest,p_recipient_provider,'requested','best_effort'
  ) returning * into q;
  return q;
end $$;

create or replace function public.transition_invitation_auth_email_request(
  p_request_id uuid,p_invitation_id uuid,p_correlation_id uuid,p_status text,p_diagnostic_code text default null
) returns public.auth_email_requests
language plpgsql security definer set search_path=pg_catalog,public as $$
declare q public.auth_email_requests%rowtype;
begin
  if auth.role()<>'service_role' then raise exception 'AUTH_EMAIL_INVITATION_TRANSITION_SERVICE_REQUIRED' using errcode='42501'; end if;
  if p_status not in ('sent','failed') then raise exception 'AUTH_EMAIL_INVITATION_TRANSITION_INVALID' using errcode='22023'; end if;
  update public.auth_email_requests set status=p_status,
    provider_accepted_at=case when p_status='sent' then coalesce(provider_accepted_at,now()) else provider_accepted_at end,
    failed_at=case when p_status='failed' then coalesce(failed_at,now()) else failed_at end,
    diagnostic_code=case when p_status='failed' then coalesce(nullif(p_diagnostic_code,''),'INVITATION_DELIVERY_FAILED') else diagnostic_code end,
    updated_at=now()
  where id=p_request_id and invitation_id=p_invitation_id and correlation_id=p_correlation_id
    and status in ('requested','sent') returning * into q;
  if not found then
    select * into q from public.auth_email_requests where id=p_request_id and invitation_id=p_invitation_id and correlation_id=p_correlation_id;
    if not found or (p_status='failed' and q.status<>'failed')
      or (p_status='sent' and q.status not in ('sent','delivered','delivery_delayed','bounced_soft','bounced_hard','complained','rejected','failed')) then
      raise exception 'AUTH_EMAIL_INVITATION_TRANSITION_MISMATCH' using errcode='22023';
    end if;
  end if;
  return q;
end $$;

create or replace function public.reconcile_legacy_invitation_auth_email_request(
  p_invitation_id uuid,p_sent_receipt_id uuid,p_delivered_receipt_id uuid,p_idempotency_key text
) returns public.auth_email_requests
language plpgsql security definer set search_path=pg_catalog,public,extensions as $$
declare i public.workspace_invitations%rowtype; s public.auth_email_webhook_receipts%rowtype; d public.auth_email_webhook_receipts%rowtype; q public.auth_email_requests%rowtype; v_digest text; v_provider text;
begin
  if auth.role()<>'service_role' then raise exception 'AUTH_EMAIL_LEGACY_RECONCILE_SERVICE_REQUIRED' using errcode='42501'; end if;
  select * into i from public.workspace_invitations where id=p_invitation_id for update;
  if not found or i.status<>'pending' or i.correlation_id is null or i.auth_invitation_user_id is null then raise exception 'AUTH_EMAIL_LEGACY_INVITATION_INVALID' using errcode='22023'; end if;
  select * into s from public.auth_email_webhook_receipts where id=p_sent_receipt_id for update;
  select * into d from public.auth_email_webhook_receipts where id=p_delivered_receipt_id for update;
  if s.event_type<>'email.sent' or d.event_type<>'email.delivered' or s.linked_request_id is not null or d.linked_request_id is not null
    or s.provider_message_id is null or s.provider_message_id<>d.provider_message_id
    or s.provider_event_at<i.created_at-interval '1 minute' or s.provider_event_at>i.created_at+interval '15 minutes'
    or d.provider_event_at<i.created_at-interval '1 minute' or d.provider_event_at>i.created_at+interval '15 minutes' then
    raise exception 'AUTH_EMAIL_LEGACY_RECEIPTS_AMBIGUOUS' using errcode='22023';
  end if;
  v_digest:=encode(digest(lower(trim(i.email)),'sha256'),'hex');
  v_provider:=case when split_part(lower(i.email),'@',2) like '%gmail%' then 'gmail' when split_part(lower(i.email),'@',2) like any(array['%outlook%','%hotmail%','%live.com%']) then 'microsoft' else 'other' end;
  insert into public.auth_email_requests(correlation_id,flow_type,invitation_id,workspace_id,intended_role,idempotency_key,recipient_digest,recipient_provider,
    provider_message_id,linkage_confidence,requested_at,provider_accepted_at,delivered_at,status,legacy_reconciled)
  values(i.correlation_id,'invitation',i.id,i.workspace_id,i.role,p_idempotency_key,v_digest,v_provider,s.provider_message_id,'exact',i.created_at,s.provider_event_at,d.provider_event_at,'delivered',true)
  on conflict(invitation_id) where invitation_id is not null do update set updated_at=now()
  returning * into q;
  if q.correlation_id<>i.correlation_id or q.provider_message_id<>s.provider_message_id or not q.legacy_reconciled then raise exception 'AUTH_EMAIL_LEGACY_RECONCILE_MISMATCH'; end if;
  update public.auth_email_webhook_receipts set linked_request_id=q.id where id in (s.id,d.id) and linked_request_id is null;
  if (select count(*) from public.auth_email_webhook_receipts where id in (s.id,d.id) and linked_request_id=q.id)<>2 then raise exception 'AUTH_EMAIL_LEGACY_LINK_FAILED'; end if;
  return q;
end $$;

revoke all on function public.create_or_replay_invitation_auth_email_request(uuid,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.create_or_replay_invitation_auth_email_request(uuid,uuid,text,text,text) to service_role;
revoke all on function public.transition_invitation_auth_email_request(uuid,uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.transition_invitation_auth_email_request(uuid,uuid,uuid,text,text) to service_role;
revoke all on function public.reconcile_legacy_invitation_auth_email_request(uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.reconcile_legacy_invitation_auth_email_request(uuid,uuid,uuid,text) to service_role;

commit;
