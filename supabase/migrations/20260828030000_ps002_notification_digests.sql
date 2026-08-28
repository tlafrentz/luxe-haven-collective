-- PS-002: transactional notification digest claims and provider reconciliation.
begin;

create table public.notification_digest_requests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.owners(id),
  profile_id uuid not null references public.profiles(id),
  frequency text not null check (frequency in ('immediate','daily','weekly')),
  period_key text not null,
  timezone text not null,
  scheduled_for timestamptz not null,
  recipient_digest text not null check (length(recipient_digest)=64),
  correlation_id uuid not null,
  idempotency_key text not null unique,
  status text not null default 'claimed' check (status in ('claimed','sent','delivered','delivery_delayed','bounced','complained','failed','suppressed')),
  provider_message_id text unique,
  attempt_count integer not null default 0 check (attempt_count between 0 and 3),
  requested_at timestamptz not null default now(),
  handed_off_at timestamptz,
  delivered_at timestamptz,
  terminal_at timestamptz,
  diagnostic_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_id,profile_id,frequency,period_key)
);

create table public.notification_digest_items (
  digest_request_id uuid not null references public.notification_digest_requests(id) on delete cascade,
  notification_id uuid not null references public.notifications(id),
  category text not null,
  created_at timestamptz not null default now(),
  primary key(digest_request_id,notification_id),
  unique(notification_id)
);

create table public.notification_digest_webhook_links (
  provider_event_id text primary key,
  digest_request_id uuid not null references public.notification_digest_requests(id),
  provider_message_id text not null,
  normalized_status text not null,
  provider_event_at timestamptz not null,
  payload_digest text not null check(length(payload_digest)=64),
  created_at timestamptz not null default now()
);

create index notification_digest_due_lookup_idx on public.notification_digest_requests(profile_id,workspace_id,status,scheduled_for);
create index notification_digest_items_notification_idx on public.notification_digest_items(notification_id);

alter table public.notification_digest_requests enable row level security;
alter table public.notification_digest_items enable row level security;
alter table public.notification_digest_webhook_links enable row level security;

create policy "recipients read own digest requests" on public.notification_digest_requests for select to authenticated
using(profile_id=auth.uid() and public.active_workspace_role(workspace_id) is not null);
create policy "recipients read own digest items" on public.notification_digest_items for select to authenticated
using(exists(select 1 from public.notification_digest_requests r where r.id=digest_request_id and r.profile_id=auth.uid() and public.active_workspace_role(r.workspace_id) is not null));
create policy "admins read digest webhook links" on public.notification_digest_webhook_links for select to authenticated using(public.is_admin());

revoke all on public.notification_digest_requests,public.notification_digest_items,public.notification_digest_webhook_links from anon;
revoke insert,update,delete on public.notification_digest_requests,public.notification_digest_items,public.notification_digest_webhook_links from authenticated;
grant select on public.notification_digest_requests,public.notification_digest_items to authenticated;
grant select on public.notification_digest_webhook_links to authenticated;
grant all on public.notification_digest_requests,public.notification_digest_items,public.notification_digest_webhook_links to service_role;

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
      where p.workspace_id=p_workspace_id and p.profile_id=p_profile_id and s->>'category'=n.category
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

create or replace function public.transition_notification_digest(
  p_request_id uuid,p_status text,p_provider_message_id text default null,p_diagnostic_code text default null
) returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare r public.notification_digest_requests%rowtype;
begin
  if auth.role()<>'service_role' then raise exception 'NOTIFICATION_DIGEST_SERVICE_REQUIRED'; end if;
  if p_status not in ('sent','failed','suppressed') then raise exception 'NOTIFICATION_DIGEST_STATUS_INVALID'; end if;
  update public.notification_digest_requests set status=p_status,provider_message_id=coalesce(p_provider_message_id,provider_message_id),attempt_count=attempt_count+1,
    handed_off_at=case when p_status='sent' then now() else handed_off_at end,terminal_at=case when p_status in ('failed','suppressed') then now() else terminal_at end,
    diagnostic_code=p_diagnostic_code,updated_at=now() where id=p_request_id and status='claimed' returning * into r;
  if not found then select * into r from public.notification_digest_requests where id=p_request_id; end if;
  return jsonb_build_object('requestId',r.id,'status',r.status,'attemptCount',r.attempt_count);
end $$;

create or replace function public.process_resend_notification_digest_event(
  p_event_id text,p_event_type text,p_message_id text,p_event_at timestamptz,p_payload_digest text
) returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare r public.notification_digest_requests%rowtype; l public.notification_digest_webhook_links%rowtype; v_status text;
begin
  if auth.role()<>'service_role' then raise exception 'NOTIFICATION_DIGEST_SERVICE_REQUIRED'; end if;
  if p_message_id is null then return jsonb_build_object('linked',false,'code','MESSAGE_ID_REQUIRED'); end if;
  select * into l from public.notification_digest_webhook_links where provider_event_id=p_event_id;
  if found then
    if l.payload_digest<>p_payload_digest then raise exception 'NOTIFICATION_DIGEST_WEBHOOK_REPLAY_MISMATCH'; end if;
    return jsonb_build_object('linked',true,'replayed',true,'requestId',l.digest_request_id);
  end if;
  select * into r from public.notification_digest_requests where provider_message_id=p_message_id;
  if not found then return jsonb_build_object('linked',false,'code','REQUEST_NOT_FOUND'); end if;
  v_status:=case p_event_type when 'email.sent' then 'sent' when 'email.delivered' then 'delivered' when 'email.delivery_delayed' then 'delivery_delayed'
    when 'email.bounced' then 'bounced' when 'email.complained' then 'complained' when 'email.failed' then 'failed' when 'email.rejected' then 'failed' else null end;
  if v_status is null then return jsonb_build_object('linked',false,'code','EVENT_UNSUPPORTED'); end if;
  insert into public.notification_digest_webhook_links(provider_event_id,digest_request_id,provider_message_id,normalized_status,provider_event_at,payload_digest)
  values(p_event_id,r.id,p_message_id,v_status,p_event_at,p_payload_digest);
  update public.notification_digest_requests set status=case when status in ('bounced','complained','failed','delivered') then status else v_status end,
    delivered_at=case when v_status='delivered' then p_event_at else delivered_at end,
    terminal_at=case when v_status in ('delivered','bounced','complained','failed') then p_event_at else terminal_at end,updated_at=now() where id=r.id;
  update public.notification_deliveries d set status=case when v_status='delivered' then 'delivered' when v_status in ('bounced','complained','failed') then 'failed' else d.status end,
    delivered_at=case when v_status='delivered' then p_event_at else d.delivered_at end,failure_code=case when v_status in ('bounced','complained','failed') then upper(v_status) else d.failure_code end,updated_at=now()
  where d.channel='email' and exists(select 1 from public.notification_digest_items i where i.digest_request_id=r.id and i.notification_id=d.notification_id);
  if v_status in ('bounced','complained') then
    insert into public.auth_email_suppressions(recipient_digest,reason) values(r.recipient_digest,case when v_status='complained' then 'complaint' else 'hard_bounce' end)
    on conflict(recipient_digest) where active do update set occurrence_count=auth_email_suppressions.occurrence_count+1,updated_at=now();
  end if;
  return jsonb_build_object('linked',true,'replayed',false,'requestId',r.id,'status',v_status);
end $$;

revoke all on function public.claim_notification_digest(uuid,uuid,text,text,text,timestamptz,uuid[],text,uuid) from public,anon,authenticated;
revoke all on function public.transition_notification_digest(uuid,text,text,text) from public,anon,authenticated;
revoke all on function public.process_resend_notification_digest_event(text,text,text,timestamptz,text) from public,anon,authenticated;
grant execute on function public.claim_notification_digest(uuid,uuid,text,text,text,timestamptz,uuid[],text,uuid) to service_role;
grant execute on function public.transition_notification_digest(uuid,text,text,text) to service_role;
grant execute on function public.process_resend_notification_digest_event(text,text,text,timestamptz,text) to service_role;

commit;
