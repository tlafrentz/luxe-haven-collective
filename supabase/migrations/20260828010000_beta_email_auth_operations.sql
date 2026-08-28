-- BETA-EMAIL-001: governed public Auth and authentication-email operations.
create table public.auth_public_control (
  control_key text primary key default 'public_auth' check (control_key = 'public_auth'),
  mode text not null default 'closed' check (mode in ('closed','invite_only','broad_beta')),
  version bigint not null default 1 check (version > 0),
  captcha_required boolean not null default true check (captcha_required),
  hourly_email_ceiling integer not null default 30 check (hourly_email_ceiling between 1 and 100),
  resend_cooldown_seconds integer not null default 60 check (resend_cooldown_seconds >= 60),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  reason text not null default 'Safe default'
);
insert into public.auth_public_control(control_key) values ('public_auth');

create table public.auth_public_control_audit (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references auth.users(id),
  from_mode text not null,
  to_mode text not null,
  reason text not null,
  correlation_id uuid not null,
  idempotency_key text not null unique,
  resulting_version bigint not null,
  created_at timestamptz not null default now()
);

create table public.auth_email_requests (
  id uuid primary key default gen_random_uuid(),
  correlation_id uuid not null unique,
  flow_type text not null check (flow_type in ('invitation','confirmation','recovery','email_change','reauthentication','otp_magic_link')),
  recipient_digest text not null check (length(recipient_digest)=64),
  recipient_provider text not null default 'other' check (recipient_provider in ('gmail','microsoft','other')),
  provider_message_id text unique,
  linkage_confidence text not null default 'best_effort' check (linkage_confidence in ('exact','best_effort','unlinked')),
  requested_at timestamptz not null default now(),
  provider_accepted_at timestamptz,
  delivered_at timestamptz,
  failed_at timestamptz,
  completed_at timestamptz,
  status text not null default 'requested' check (status in ('requested','sent','delivered','delivery_delayed','bounced_soft','bounced_hard','complained','rejected','failed')),
  bounce_classification text,
  complaint boolean not null default false,
  diagnostic_code text,
  updated_at timestamptz not null default now()
);
create index auth_email_requests_recipient_time_idx on public.auth_email_requests(recipient_digest,requested_at desc);
create index auth_email_requests_status_time_idx on public.auth_email_requests(status,updated_at desc);

create table public.auth_email_webhook_receipts (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'resend' check (provider='resend'),
  provider_event_id text not null unique,
  event_type text not null,
  provider_message_id text,
  provider_event_at timestamptz not null,
  received_at timestamptz not null default now(),
  payload_digest text not null check (length(payload_digest)=64),
  processing_status text not null check (processing_status in ('processed','unsupported','rejected')),
  failure_code text,
  linked_request_id uuid references public.auth_email_requests(id)
);

create table public.auth_email_suppressions (
  id uuid primary key default gen_random_uuid(),
  recipient_digest text not null check (length(recipient_digest)=64),
  reason text not null check (reason in ('hard_bounce','complaint','repeated_soft_bounce','manual')),
  active boolean not null default true,
  occurrence_count integer not null default 1 check (occurrence_count > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  released_at timestamptz,
  released_by uuid references auth.users(id),
  release_reason text
);
create unique index auth_email_suppressions_active_recipient_idx on public.auth_email_suppressions(recipient_digest) where active;

create table public.auth_email_suppression_audit (
  id uuid primary key default gen_random_uuid(),
  suppression_id uuid not null references public.auth_email_suppressions(id),
  action text not null check (action in ('created','repeated','released')),
  actor_id uuid references auth.users(id),
  reason_code text not null,
  created_at timestamptz not null default now()
);

create table public.auth_email_operational_alerts (
  id uuid primary key default gen_random_uuid(),
  alert_type text not null,
  dedupe_key text not null unique,
  severity text not null check (severity in ('info','warning','critical')),
  status text not null default 'open' check (status in ('open','acknowledged','resolved')),
  correlation_id uuid,
  occurrence_count integer not null default 1,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  diagnostic_code text
);

alter table public.auth_public_control enable row level security;
alter table public.auth_public_control_audit enable row level security;
alter table public.auth_email_requests enable row level security;
alter table public.auth_email_webhook_receipts enable row level security;
alter table public.auth_email_suppressions enable row level security;
alter table public.auth_email_suppression_audit enable row level security;
alter table public.auth_email_operational_alerts enable row level security;

create policy "admins read public auth control" on public.auth_public_control for select to authenticated using (public.is_admin());
create policy "admins read public auth control audit" on public.auth_public_control_audit for select to authenticated using (public.is_admin());
create policy "admins read auth email requests" on public.auth_email_requests for select to authenticated using (public.is_admin());
create policy "admins read auth email webhook receipts" on public.auth_email_webhook_receipts for select to authenticated using (public.is_admin());
create policy "admins read auth email suppressions" on public.auth_email_suppressions for select to authenticated using (public.is_admin());
create policy "admins read auth email suppression audit" on public.auth_email_suppression_audit for select to authenticated using (public.is_admin());
create policy "admins read auth email alerts" on public.auth_email_operational_alerts for select to authenticated using (public.is_admin());

revoke all on public.auth_public_control, public.auth_public_control_audit, public.auth_email_requests,
  public.auth_email_webhook_receipts, public.auth_email_suppressions, public.auth_email_suppression_audit, public.auth_email_operational_alerts from anon;
revoke insert,update,delete on public.auth_public_control, public.auth_public_control_audit, public.auth_email_requests,
  public.auth_email_webhook_receipts, public.auth_email_suppressions, public.auth_email_suppression_audit, public.auth_email_operational_alerts from authenticated;
grant select on public.auth_public_control, public.auth_public_control_audit, public.auth_email_requests,
  public.auth_email_webhook_receipts, public.auth_email_suppressions, public.auth_email_suppression_audit, public.auth_email_operational_alerts to authenticated;
grant all on public.auth_public_control, public.auth_public_control_audit, public.auth_email_requests,
  public.auth_email_webhook_receipts, public.auth_email_suppressions, public.auth_email_suppression_audit, public.auth_email_operational_alerts to service_role;

create or replace function public.set_public_auth_mode(
  p_target_mode text, p_expected_version bigint, p_reason text, p_correlation_id uuid, p_idempotency_key text
) returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare c public.auth_public_control%rowtype; a public.auth_public_control_audit%rowtype; v_actor uuid:=auth.uid(); v_prior_mode text;
begin
  if v_actor is null or not public.is_admin() then raise exception 'AUTH_PUBLIC_CONTROL_ADMIN_REQUIRED'; end if;
  if p_target_mode not in ('closed','invite_only','broad_beta') then raise exception 'AUTH_PUBLIC_CONTROL_MODE_INVALID'; end if;
  if length(btrim(coalesce(p_reason,''))) < 8 or length(p_reason)>500 then raise exception 'AUTH_PUBLIC_CONTROL_REASON_INVALID'; end if;
  if length(btrim(coalesce(p_idempotency_key,''))) < 16 or length(p_idempotency_key)>200 then raise exception 'AUTH_PUBLIC_CONTROL_IDEMPOTENCY_INVALID'; end if;
  select * into a from public.auth_public_control_audit where idempotency_key=p_idempotency_key;
  if found then
    if a.to_mode<>p_target_mode or a.correlation_id<>p_correlation_id then raise exception 'AUTH_PUBLIC_CONTROL_REPLAY_MISMATCH'; end if;
    return jsonb_build_object('mode',a.to_mode,'version',a.resulting_version,'replayed',true);
  end if;
  select * into c from public.auth_public_control where control_key='public_auth' for update;
  if c.version<>p_expected_version then raise exception 'AUTH_PUBLIC_CONTROL_VERSION_CONFLICT'; end if;
  v_prior_mode:=c.mode;
  update public.auth_public_control set mode=p_target_mode,version=version+1,updated_at=now(),updated_by=v_actor,reason=btrim(p_reason) where control_key='public_auth' returning * into c;
  insert into public.auth_public_control_audit(actor_id,from_mode,to_mode,reason,correlation_id,idempotency_key,resulting_version)
  values(v_actor,v_prior_mode,p_target_mode,btrim(p_reason),p_correlation_id,p_idempotency_key,c.version)
  returning * into a;
  insert into public.auth_email_operational_alerts(alert_type,dedupe_key,severity,correlation_id,diagnostic_code)
  values('public_auth_mode_changed','public_auth_mode_changed:'||c.version,'warning',p_correlation_id,'PUBLIC_AUTH_MODE_CHANGED');
  return jsonb_build_object('mode',c.mode,'version',c.version,'replayed',false);
end $$;

create or replace function public.alert_auth_email_volume() returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_count int; v_limit int;
begin
 select hourly_email_ceiling into v_limit from public.auth_public_control where control_key='public_auth';
 select count(*) into v_count from public.auth_email_requests where requested_at>=date_trunc('hour',now());
 if v_count>=ceil(v_limit*0.8) then
   insert into public.auth_email_operational_alerts(alert_type,dedupe_key,severity,correlation_id,diagnostic_code)
   values('hourly_volume_threshold','hourly_volume_threshold:'||to_char(date_trunc('hour',now()),'YYYYMMDDHH24'),'warning',new.correlation_id,'AUTH_EMAIL_VOLUME_80_PERCENT')
   on conflict(dedupe_key) do update set occurrence_count=auth_email_operational_alerts.occurrence_count+1,last_seen_at=now();
 end if;
 return new;
end $$;
create trigger auth_email_request_volume_alert after insert on public.auth_email_requests for each row execute function public.alert_auth_email_volume();

create or replace function public.process_resend_auth_event(
  p_event_id text,p_event_type text,p_message_id text,p_event_at timestamptz,p_payload_digest text,
  p_recipient_digest text default null,p_recipient_provider text default 'other',p_bounce_type text default null
) returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare r public.auth_email_webhook_receipts%rowtype; q public.auth_email_requests%rowtype; v_status text; v_processing text:='processed'; v_existing text; v_soft_count int;
begin
  if auth.role()<>'service_role' then raise exception 'AUTH_EMAIL_WEBHOOK_SERVICE_REQUIRED'; end if;
  select * into r from public.auth_email_webhook_receipts where provider_event_id=p_event_id;
  if found then
    if r.payload_digest<>p_payload_digest then raise exception 'AUTH_EMAIL_WEBHOOK_REPLAY_MISMATCH'; end if;
    return jsonb_build_object('status','replayed','receipt_id',r.id);
  end if;
  v_status:=case p_event_type when 'email.sent' then 'sent' when 'email.delivered' then 'delivered'
    when 'email.delivery_delayed' then 'delivery_delayed' when 'email.bounced' then case when lower(coalesce(p_bounce_type,'')) in ('transient','soft') then 'bounced_soft' else 'bounced_hard' end
    when 'email.complained' then 'complained' when 'email.failed' then 'failed' when 'email.rejected' then 'rejected' else null end;
  if v_status is null then v_processing:='unsupported'; end if;
  if p_message_id is not null then
    select * into q from public.auth_email_requests where provider_message_id=p_message_id for update;
  end if;
  if not found and p_recipient_digest is not null then
    select * into q from public.auth_email_requests where recipient_digest=p_recipient_digest and requested_at between p_event_at-interval '24 hours' and p_event_at+interval '10 minutes' order by requested_at desc limit 1 for update;
    if found and q.provider_message_id is null then update public.auth_email_requests set provider_message_id=p_message_id,linkage_confidence='best_effort' where id=q.id; end if;
  end if;
  insert into public.auth_email_webhook_receipts(provider_event_id,event_type,provider_message_id,provider_event_at,payload_digest,processing_status,linked_request_id)
  values(p_event_id,p_event_type,p_message_id,p_event_at,p_payload_digest,v_processing,case when q.id is null then null else q.id end) returning * into r;
  if q.id is not null and v_status is not null then
    v_existing:=q.status;
    if not (v_existing='delivered' and v_status in ('sent','delivery_delayed')) and not (v_existing in ('bounced_hard','complained') and v_status not in ('complained')) then
      update public.auth_email_requests set status=v_status,provider_accepted_at=case when v_status='sent' then coalesce(provider_accepted_at,p_event_at) else provider_accepted_at end,
        delivered_at=case when v_status='delivered' then p_event_at else delivered_at end,failed_at=case when v_status in ('bounced_soft','bounced_hard','complained','rejected','failed') then p_event_at else failed_at end,
        complaint=(complaint or v_status='complained'),bounce_classification=case when v_status like 'bounced_%' then v_status else bounce_classification end,updated_at=now() where id=q.id;
    end if;
  end if;
  if p_recipient_digest is not null and v_status in ('bounced_hard','complained') then
    insert into public.auth_email_suppressions(recipient_digest,reason) values(p_recipient_digest,case when v_status='complained' then 'complaint' else 'hard_bounce' end)
    on conflict (recipient_digest) where active do update set occurrence_count=auth_email_suppressions.occurrence_count+1,updated_at=now();
    insert into public.auth_email_suppression_audit(suppression_id,action,reason_code)
    select id,case when occurrence_count=1 then 'created' else 'repeated' end,reason from public.auth_email_suppressions where recipient_digest=p_recipient_digest and active;
  end if;
  if p_recipient_digest is not null and v_status='bounced_soft' then
    select count(*) into v_soft_count from public.auth_email_requests where recipient_digest=p_recipient_digest and status='bounced_soft' and updated_at>now()-interval '30 days';
    if v_soft_count>=3 then
      insert into public.auth_email_suppressions(recipient_digest,reason,occurrence_count) values(p_recipient_digest,'repeated_soft_bounce',v_soft_count)
      on conflict(recipient_digest) where active do update set occurrence_count=greatest(auth_email_suppressions.occurrence_count,v_soft_count),updated_at=now();
    end if;
  end if;
  if v_status in ('complained','bounced_hard','failed','rejected') then
    insert into public.auth_email_operational_alerts(alert_type,dedupe_key,severity,diagnostic_code)
    values(v_status,v_status||':'||to_char(date_trunc('hour',p_event_at),'YYYYMMDDHH24'),case when v_status='complained' then 'critical' else 'warning' end,upper(v_status))
    on conflict(dedupe_key) do update set occurrence_count=auth_email_operational_alerts.occurrence_count+1,last_seen_at=now();
  end if;
  return jsonb_build_object('status',v_processing,'receipt_id',r.id,'normalized_status',v_status);
end $$;

create or replace function public.release_auth_email_suppression(p_suppression_id uuid,p_reason text)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare s public.auth_email_suppressions%rowtype;
begin
 if auth.uid() is null or not public.is_admin() then raise exception 'AUTH_EMAIL_SUPPRESSION_ADMIN_REQUIRED'; end if;
 if length(btrim(coalesce(p_reason,'')))<8 then raise exception 'AUTH_EMAIL_SUPPRESSION_REASON_INVALID'; end if;
 update public.auth_email_suppressions set active=false,released_at=now(),released_by=auth.uid(),release_reason=btrim(p_reason),updated_at=now() where id=p_suppression_id and active returning * into s;
 if not found then raise exception 'AUTH_EMAIL_SUPPRESSION_NOT_ACTIVE'; end if;
 insert into public.auth_email_suppression_audit(suppression_id,action,actor_id,reason_code) values(s.id,'released',auth.uid(),'manual_release');
 return jsonb_build_object('id',s.id,'active',false);
end $$;

create or replace function public.create_auth_email_manual_suppression(p_recipient_digest text,p_reason text)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare s public.auth_email_suppressions%rowtype;
begin
 if auth.uid() is null or not public.is_admin() then raise exception 'AUTH_EMAIL_SUPPRESSION_ADMIN_REQUIRED'; end if;
 if length(p_recipient_digest)<>64 or length(btrim(coalesce(p_reason,'')))<8 then raise exception 'AUTH_EMAIL_SUPPRESSION_INPUT_INVALID'; end if;
 insert into public.auth_email_suppressions(recipient_digest,reason) values(p_recipient_digest,'manual')
 on conflict(recipient_digest) where active do update set occurrence_count=auth_email_suppressions.occurrence_count+1,updated_at=now()
 returning * into s;
 insert into public.auth_email_suppression_audit(suppression_id,action,actor_id,reason_code) values(s.id,case when s.occurrence_count=1 then 'created' else 'repeated' end,auth.uid(),'manual');
 insert into public.auth_email_operational_alerts(alert_type,dedupe_key,severity,diagnostic_code)
 values('manual_suppression','manual_suppression:'||s.id,'info','AUTH_EMAIL_MANUAL_SUPPRESSION');
 return jsonb_build_object('id',s.id,'active',true);
end $$;

revoke all on function public.set_public_auth_mode(text,bigint,text,uuid,text) from public,anon;
grant execute on function public.set_public_auth_mode(text,bigint,text,uuid,text) to authenticated;
revoke all on function public.process_resend_auth_event(text,text,text,timestamptz,text,text,text,text) from public,anon,authenticated;
grant execute on function public.process_resend_auth_event(text,text,text,timestamptz,text,text,text,text) to service_role;
revoke all on function public.release_auth_email_suppression(uuid,text) from public,anon;
grant execute on function public.release_auth_email_suppression(uuid,text) to authenticated;
revoke all on function public.create_auth_email_manual_suppression(text,text) from public,anon;
grant execute on function public.create_auth_email_manual_suppression(text,text) to authenticated;
