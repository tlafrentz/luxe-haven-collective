-- PC-001C.6: production operations, health, drift, recovery audit, and release controls.
create table public.commerce_operational_activity(
  id text primary key,
  action_type text not null,
  subject_type text not null,
  subject_id text,
  actor_profile_id uuid,
  reason text not null,
  result text not null check(result in('requested','succeeded','failed','ignored')),
  safe_metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create table public.commerce_operational_alerts(
  id text primary key,
  alert_type text not null,
  severity text not null check(severity in('critical','high','medium','low')),
  subject_type text not null,
  subject_id text,
  status text not null check(status in('open','acknowledged','resolved')),
  summary text not null,
  first_observed_at timestamptz not null default now(),
  last_observed_at timestamptz not null default now(),
  acknowledged_by uuid,
  acknowledged_at timestamptz,
  resolved_at timestamptz,
  unique(alert_type,subject_type,subject_id)
);

create table public.commerce_reconciliation_jobs(
  id text primary key,
  environment text not null check(environment in('test','live')),
  subject_type text not null check(subject_type in('order','payment','customer','subscription','invoice','product','price','entitlement')),
  subject_id text not null,
  status text not null check(status in('pending','processing','reconciled','drift-detected','failed','cancelled')),
  severity text check(severity in('critical','high','medium','low')),
  requested_by uuid not null,
  reason text not null,
  attempts integer not null default 0 check(attempts>=0),
  provider_reference text,
  drift jsonb not null default '{}'::jsonb,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  unique(environment,subject_type,subject_id,status)
);

create index commerce_operational_activity_time_idx on public.commerce_operational_activity(occurred_at desc);
create index commerce_operational_alerts_work_idx on public.commerce_operational_alerts(status,severity,last_observed_at);
create index commerce_reconciliation_work_idx on public.commerce_reconciliation_jobs(status,severity,created_at);

alter table public.commerce_operational_activity enable row level security;
alter table public.commerce_operational_alerts enable row level security;
alter table public.commerce_reconciliation_jobs enable row level security;
create policy "Commerce operations administrators read activity" on public.commerce_operational_activity for select to authenticated using(public.is_admin());
create policy "Commerce operations administrators read alerts" on public.commerce_operational_alerts for select to authenticated using(public.is_admin());
create policy "Commerce operations administrators read reconciliation" on public.commerce_reconciliation_jobs for select to authenticated using(public.is_admin());
grant select on public.commerce_operational_activity,public.commerce_operational_alerts,public.commerce_reconciliation_jobs to authenticated;

create trigger commerce_operational_activity_immutable
before update or delete on public.commerce_operational_activity
for each row execute function public.prevent_commerce_history_change();

create or replace function public.queue_commerce_reconciliation(
  p_environment text,
  p_subject_type text,
  p_subject_id text,
  p_reason text
) returns text language plpgsql security definer set search_path=public as $$
declare
  v_id text;
begin
  if not public.is_admin() then raise exception 'commerce_permission_denied'; end if;
  if p_environment not in('test','live') or p_subject_type not in('order','payment','customer','subscription','invoice','product','price','entitlement')
    or nullif(trim(p_subject_id),'') is null or length(trim(p_reason))<8 then
    raise exception 'commerce_reconciliation_invalid';
  end if;
  v_id:='commerce-reconciliation-'||encode(sha256(convert_to(p_environment||':'||p_subject_type||':'||p_subject_id||':'||clock_timestamp()::text,'UTF8')),'hex');
  insert into public.commerce_reconciliation_jobs(id,environment,subject_type,subject_id,status,requested_by,reason)
  values(v_id,p_environment,p_subject_type,p_subject_id,'pending',auth.uid(),trim(p_reason));
  insert into public.commerce_operational_activity(id,action_type,subject_type,subject_id,actor_profile_id,reason,result,safe_metadata)
  values('commerce-operation-'||v_id,'reconciliation-requested',p_subject_type,p_subject_id,auth.uid(),trim(p_reason),'requested',jsonb_build_object('environment',p_environment));
  return v_id;
end $$;
revoke all on function public.queue_commerce_reconciliation(text,text,text,text) from public;
grant execute on function public.queue_commerce_reconciliation(text,text,text,text) to authenticated;

create or replace function public.acknowledge_commerce_operational_alert(
  p_alert_id text,
  p_reason text
) returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.is_admin() then raise exception 'commerce_permission_denied'; end if;
  if length(trim(p_reason))<8 then raise exception 'commerce_reason_required'; end if;
  update public.commerce_operational_alerts set status='acknowledged',acknowledged_by=auth.uid(),acknowledged_at=now()
  where id=p_alert_id and status='open';
  if not found then raise exception 'commerce_alert_not_open'; end if;
  insert into public.commerce_operational_activity(id,action_type,subject_type,subject_id,actor_profile_id,reason,result)
  values('commerce-operation-'||gen_random_uuid()::text,'alert-acknowledged','alert',p_alert_id,auth.uid(),trim(p_reason),'succeeded');
end $$;
revoke all on function public.acknowledge_commerce_operational_alert(text,text) from public;
grant execute on function public.acknowledge_commerce_operational_alert(text,text) to authenticated;

create or replace function public.refresh_commerce_operational_alerts()
returns integer language plpgsql security definer set search_path=public as $$
declare v_count integer:=0;
begin
  if not public.is_admin() then raise exception 'commerce_permission_denied'; end if;
  insert into public.commerce_operational_alerts(id,alert_type,severity,subject_type,subject_id,status,summary)
  select 'commerce-alert-webhook-'||id,'webhook-processing-failed','high','webhook',id,'open','Verified Stripe event requires recovery.'
  from public.commerce_webhook_receipts where status='failed'
  on conflict(alert_type,subject_type,subject_id) do update set last_observed_at=now(),status=case when commerce_operational_alerts.status='resolved'then'open'else commerce_operational_alerts.status end;
  get diagnostics v_count=row_count;
  insert into public.commerce_operational_alerts(id,alert_type,severity,subject_type,subject_id,status,summary)
  select 'commerce-alert-fulfillment-'||id,'fulfillment-failed','high','fulfillment',id,'open','Paid customer value requires fulfillment recovery.'
  from public.commerce_fulfillments where status='failed'
  on conflict(alert_type,subject_type,subject_id) do update set last_observed_at=now(),status=case when commerce_operational_alerts.status='resolved'then'open'else commerce_operational_alerts.status end;
  return v_count;
end $$;
revoke all on function public.refresh_commerce_operational_alerts() from public;
grant execute on function public.refresh_commerce_operational_alerts() to authenticated;

create or replace function public.prevent_commerce_operational_secret_metadata()
returns trigger language plpgsql as $$
begin
  if new.safe_metadata::text ~* '(secret|signature|api[_-]?key|card|billing_address)' then
    raise exception 'commerce_sensitive_metadata_rejected';
  end if;
  return new;
end $$;
create trigger commerce_operational_metadata_guard
before insert on public.commerce_operational_activity
for each row execute function public.prevent_commerce_operational_secret_metadata();
