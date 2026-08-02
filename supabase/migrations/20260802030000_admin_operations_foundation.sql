-- IA-001..005: separate, append-only operational projections and support lifecycle.
begin;

create table public.integration_runtime_settings(
  integration_id text primary key,
  enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);

create table public.sync_attempts(
  id uuid primary key default gen_random_uuid(), correlation_id text not null,
  integration_id text not null, capability text not null,
  trigger text not null check(trigger in('scheduled','manual','webhook','workflow')),
  direction text not null check(direction in('inbound','outbound','bidirectional')),
  status text not null check(status in('queued','running','succeeded','partially_succeeded','failed','cancelled')),
  started_at timestamptz not null, completed_at timestamptz, duration_ms integer check(duration_ms is null or duration_ms>=0),
  records_examined integer check(records_examined is null or records_examined>=0), records_created integer check(records_created is null or records_created>=0),
  records_updated integer check(records_updated is null or records_updated>=0), records_skipped integer check(records_skipped is null or records_skipped>=0),
  records_failed integer check(records_failed is null or records_failed>=0), failure_classification text, safe_failure_message text,
  logical_attempt_key text not null unique, created_at timestamptz not null default now()
);
create index sync_attempts_period_idx on public.sync_attempts(started_at desc,id desc);
create index sync_attempts_provider_period_idx on public.sync_attempts(integration_id,started_at desc);
create index sync_attempts_correlation_idx on public.sync_attempts(correlation_id);

create table public.provider_health_observations(
  id uuid primary key default gen_random_uuid(), integration_id text not null, capability text,
  observed_at timestamptz not null, outcome text not null check(outcome in('success','failure','timeout')),
  latency_ms integer check(latency_ms is null or latency_ms>=0), failure_classification text,
  source text not null check(source in('active_check','provider_request','webhook','sync')), created_at timestamptz not null default now()
);
create index provider_health_period_idx on public.provider_health_observations(integration_id,observed_at desc);
create index provider_health_capability_idx on public.provider_health_observations(integration_id,capability,observed_at desc);

create table public.admin_audit_events(
  id uuid primary key default gen_random_uuid(), occurred_at timestamptz not null default now(), actor_id uuid references public.profiles(id) on delete set null,
  actor_role text, action text not null, category text not null, target_type text, target_id text,
  result text not null check(result in('succeeded','failed','denied')), correlation_id text,
  source text not null check(source in('admin_ui','server_action','api','webhook','system')), metadata jsonb not null default '{}',
  constraint admin_audit_metadata_object check(jsonb_typeof(metadata)='object')
);
create index admin_audit_period_idx on public.admin_audit_events(occurred_at desc,id desc);
create index admin_audit_actor_idx on public.admin_audit_events(actor_id,occurred_at desc);
create index admin_audit_correlation_idx on public.admin_audit_events(correlation_id);

create sequence public.support_ticket_number_seq;
create table public.support_tickets(
  id uuid primary key default gen_random_uuid(), ticket_number text not null unique default ('LHC-'||lpad(nextval('public.support_ticket_number_seq')::text,6,'0')),
  workspace_id uuid references public.owners(id) on delete restrict, customer_id uuid references public.profiles(id) on delete set null,
  source_inquiry_id uuid unique references public.contact_inquiries(id) on delete restrict, subject text not null,
  status text not null default 'open' check(status in('open','in_progress','waiting_on_customer','resolved','closed')),
  priority text not null default 'medium' check(priority in('low','medium','high','urgent')),
  assigned_admin_id uuid references public.profiles(id) on delete set null, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  resolved_at timestamptz, closed_at timestamptz
);
create index support_tickets_queue_idx on public.support_tickets(status,priority,updated_at desc,id desc);
create index support_tickets_workspace_idx on public.support_tickets(workspace_id,updated_at desc);
create table public.support_ticket_messages(
  id uuid primary key default gen_random_uuid(), ticket_id uuid not null references public.support_tickets(id) on delete restrict,
  author_id uuid references public.profiles(id) on delete set null, visibility text not null check(visibility in('customer','internal')),
  body text not null, delivery_status text check(delivery_status in('not_requested','accepted','failed')), created_at timestamptz not null default now()
);
create index support_ticket_messages_timeline_idx on public.support_ticket_messages(ticket_id,created_at,id);
create table public.support_ticket_activity(
  id uuid primary key default gen_random_uuid(), ticket_id uuid not null references public.support_tickets(id) on delete restrict,
  actor_id uuid references public.profiles(id) on delete set null, action text not null, from_value text, to_value text,
  occurred_at timestamptz not null default now(), correlation_id text not null
);
create index support_ticket_activity_timeline_idx on public.support_ticket_activity(ticket_id,occurred_at,id);

alter table public.integration_runtime_settings enable row level security;
alter table public.sync_attempts enable row level security;
alter table public.provider_health_observations enable row level security;
alter table public.admin_audit_events enable row level security;
alter table public.support_tickets enable row level security;
alter table public.support_ticket_messages enable row level security;
alter table public.support_ticket_activity enable row level security;
create policy "Admins read integration settings" on public.integration_runtime_settings for select to authenticated using(public.is_admin());
create policy "Admins read sync attempts" on public.sync_attempts for select to authenticated using(public.is_admin());
create policy "Admins read provider health" on public.provider_health_observations for select to authenticated using(public.is_admin());
create policy "Admins read audit" on public.admin_audit_events for select to authenticated using(public.is_admin());
create policy "Admins read support tickets" on public.support_tickets for select to authenticated using(public.is_admin());
create policy "Admins read support messages" on public.support_ticket_messages for select to authenticated using(public.is_admin());
create policy "Admins read support activity" on public.support_ticket_activity for select to authenticated using(public.is_admin());
grant select on public.integration_runtime_settings,public.sync_attempts,public.provider_health_observations,public.admin_audit_events,public.support_tickets,public.support_ticket_messages,public.support_ticket_activity to authenticated;

create function public.reject_append_only_change() returns trigger language plpgsql as $$begin raise exception 'record is append-only' using errcode='55000';end$$;
create trigger sync_attempts_append_only before update or delete on public.sync_attempts for each row execute function public.reject_append_only_change();
create trigger health_observations_append_only before update or delete on public.provider_health_observations for each row execute function public.reject_append_only_change();
create trigger admin_audit_append_only before update or delete on public.admin_audit_events for each row execute function public.reject_append_only_change();
create trigger support_activity_append_only before update or delete on public.support_ticket_activity for each row execute function public.reject_append_only_change();

-- Honest adaptation: one canonical attempt per existing logical Hospitable run.
insert into public.sync_attempts(id,correlation_id,integration_id,capability,trigger,direction,status,started_at,completed_at,duration_ms,records_examined,records_created,records_updated,records_skipped,records_failed,failure_classification,safe_failure_message,logical_attempt_key)
select r.id,coalesce(nullif(r.metadata->>'correlationId',''),'hospitable:'||r.id::text),'hospitable',r.sync_type,'workflow','inbound',
  case r.status when 'completed' then 'succeeded' when 'partial' then 'partially_succeeded' else r.status end,
  r.started_at,r.completed_at,case when r.completed_at is null then null else greatest(0,(extract(epoch from(r.completed_at-r.started_at))*1000)::integer) end,
  r.records_processed,r.records_created,r.records_updated,coalesce((r.metadata->>'skipped')::integer,0),r.records_failed,
  case when r.status='failed' then 'provider_sync_failed' end,case when r.status='failed' then 'Provider synchronization failed.' end,'hospitable-sync-run:'||r.id::text
from public.integration_sync_runs r on conflict(logical_attempt_key) do nothing;

-- Passive projections are written at the provider transaction boundary. No raw
-- payload, address, financial amount, or customer content enters these tables.
create function public.project_hospitable_sync_attempt() returns trigger language plpgsql security definer set search_path=public as $$begin
 if new.status not in('completed','partial','failed') then return new;end if;
 insert into public.sync_attempts(correlation_id,integration_id,capability,trigger,direction,status,started_at,completed_at,duration_ms,records_examined,records_created,records_updated,records_skipped,records_failed,failure_classification,safe_failure_message,logical_attempt_key)
 values(coalesce(nullif(new.metadata->>'correlationId',''),'hospitable:'||new.id::text),'hospitable',new.sync_type,coalesce(nullif(new.metadata->>'trigger',''),'workflow'),'inbound',case new.status when 'completed' then 'succeeded' when 'partial' then 'partially_succeeded' else 'failed' end,new.started_at,new.completed_at,case when new.completed_at is null then null else greatest(0,(extract(epoch from(new.completed_at-new.started_at))*1000)::integer) end,new.records_processed,new.records_created,new.records_updated,coalesce((new.metadata->>'skipped')::integer,0),new.records_failed,case when new.status='failed' then 'provider_sync_failed' end,case when new.status='failed' then 'Provider synchronization failed.' end,'hospitable-sync-run:'||new.id::text) on conflict(logical_attempt_key) do nothing;
 insert into public.provider_health_observations(integration_id,capability,observed_at,outcome,latency_ms,failure_classification,source) values('hospitable',new.sync_type,coalesce(new.completed_at,now()),case when new.status='failed' then 'failure' else 'success' end,case when new.completed_at is null then null else greatest(0,(extract(epoch from(new.completed_at-new.started_at))*1000)::integer) end,case when new.status='failed' then 'provider_sync_failed' end,'sync');return new;end$$;
create trigger project_hospitable_sync after insert or update of status on public.integration_sync_runs for each row execute function public.project_hospitable_sync_attempt();

create function public.project_market_provider_attempt() returns trigger language plpgsql security definer set search_path=public as $$declare provider_id text;begin
 if new.result not in('succeeded','failed') then return new;end if;provider_id=case when new.provider='realtyapi' then 'realty_api' else new.provider end;
 insert into public.sync_attempts(correlation_id,integration_id,capability,trigger,direction,status,started_at,completed_at,duration_ms,records_examined,records_failed,failure_classification,safe_failure_message,logical_attempt_key)
 values(new.run_id,provider_id,new.operation_type,'workflow','inbound',case when new.result='succeeded' then 'succeeded' else 'failed' end,new.started_at,new.completed_at,new.duration_ms,1,case when new.result='failed' then 1 else 0 end,new.classification,case when new.result='failed' then 'Provider request failed; review its safe classification.' end,'market-provider-operation:'||new.id) on conflict(logical_attempt_key) do nothing;
 insert into public.provider_health_observations(integration_id,capability,observed_at,outcome,latency_ms,failure_classification,source) values(provider_id,new.operation_type,coalesce(new.completed_at,now()),case when new.classification='TIMEOUT' then 'timeout' when new.result='failed' and new.classification not in('AUTHENTICATION','AUTHORIZATION','INVALID_REQUEST','SUBJECT_NOT_FOUND') then 'failure' else 'success' end,new.duration_ms,case when new.result='failed' then new.classification end,'provider_request');return new;end$$;
create trigger project_market_provider after insert or update of result on public.market_provider_operations for each row execute function public.project_market_provider_attempt();

create function public.project_stripe_webhook_attempt() returns trigger language plpgsql security definer set search_path=public as $$begin
 if new.status not in('processed','failed','ignored') then return new;end if;
 insert into public.sync_attempts(correlation_id,integration_id,capability,trigger,direction,status,started_at,completed_at,duration_ms,records_examined,records_failed,failure_classification,safe_failure_message,logical_attempt_key)
 values('stripe-webhook:'||new.id,'stripe','webhook-processing','webhook','inbound',case when new.status in('processed','ignored') then 'succeeded' else 'failed' end,new.received_at,new.processed_at,case when new.processed_at is null then null else greatest(0,(extract(epoch from(new.processed_at-new.received_at))*1000)::integer) end,1,case when new.status='failed' then 1 else 0 end,new.last_error_code,case when new.status='failed' then 'Verified commerce event requires operational review.' end,'stripe-webhook-receipt:'||new.id) on conflict(logical_attempt_key) do nothing;
 insert into public.provider_health_observations(integration_id,capability,observed_at,outcome,latency_ms,failure_classification,source) values('stripe','webhook-processing',coalesce(new.processed_at,now()),case when new.status='failed' then 'failure' else 'success' end,case when new.processed_at is null then null else greatest(0,(extract(epoch from(new.processed_at-new.received_at))*1000)::integer) end,new.last_error_code,'webhook');return new;end$$;
create trigger project_stripe_webhook after insert or update of status on public.commerce_webhook_receipts for each row execute function public.project_stripe_webhook_attempt();

create function public.prune_admin_operational_telemetry(p_retention interval default interval '180 days') returns integer
language plpgsql security definer set search_path=public as $$declare n integer;begin
 if auth.role()<>'service_role' then raise exception 'service role required' using errcode='42501';end if;
 if p_retention<interval '30 days' then raise exception 'retention must be at least 30 days';end if;
 delete from public.provider_health_observations where observed_at<now()-p_retention;get diagnostics n=row_count;return n;end$$;
revoke all on function public.prune_admin_operational_telemetry(interval) from public,anon,authenticated;
grant execute on function public.prune_admin_operational_telemetry(interval) to service_role;
commit;
