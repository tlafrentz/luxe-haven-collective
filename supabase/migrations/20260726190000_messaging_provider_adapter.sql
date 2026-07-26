-- COM-004A: provider adapter synchronization, review, and audit foundations.
begin;
alter table public.integration_connections add column if not exists last_failed_sync_at timestamptz;
alter table public.integration_sync_runs drop constraint if exists integration_sync_runs_sync_type_check;
alter table public.integration_sync_runs add constraint integration_sync_runs_sync_type_check check(sync_type in('properties','reservations','messages','full'));
alter table public.integration_sync_runs
 add column if not exists synchronization_mode text not null default 'manual',
 add column if not exists provider_cursor text,
 add column if not exists provider_version text;
alter table public.integration_sync_runs add constraint integration_sync_runs_mode_check check(synchronization_mode in('manual','automatic','incremental','recovery'));

create table public.messaging_provider_review_queue(
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid references public.profiles(id) on delete restrict,
 connection_id uuid references public.integration_connections(id) on delete restrict,
 provider text not null,provider_event_id text not null,reason text not null
  check(reason in('unknown-guest','unknown-reservation','duplicate-thread','unsupported-attachment','provider-conflict','thread-unresolved')),
 status text not null default 'pending' check(status in('pending','associated','dismissed')),
 provider_thread_reference text,reservation_reference text,guest_reference text,property_reference text,
 pending_message_body text,occurred_at timestamptz not null,created_at timestamptz not null default now(),
 reviewed_by uuid references public.profiles(id),reviewed_at timestamptz,conversation_id text references public.guest_conversations(id) on delete restrict,
 unique(provider,provider_event_id)
);
create index messaging_provider_review_workspace_status_idx on public.messaging_provider_review_queue(workspace_id,status,created_at desc);

create table public.messaging_provider_activity(
 id uuid primary key default gen_random_uuid(),workspace_id uuid references public.profiles(id) on delete restrict,
 connection_id uuid references public.integration_connections(id) on delete restrict,provider text not null,
 event_type text not null check(event_type in('provider-connected','provider-disconnected','message-sent','synchronization-started','synchronization-completed','synchronization-failed','delivery-retried','configuration-updated','thread-resolution-failed')),
 safe_summary text not null,metadata jsonb not null default '{}',occurred_at timestamptz not null default now()
);
create index messaging_provider_activity_workspace_idx on public.messaging_provider_activity(workspace_id,occurred_at desc);

alter table public.messaging_provider_review_queue enable row level security;
alter table public.messaging_provider_activity enable row level security;
create policy "Workspace operators review unresolved provider messages" on public.messaging_provider_review_queue for select to authenticated
 using((workspace_id is not null and public.active_workspace_role(workspace_id)in('owner','administrator','operator'))or public.is_admin());
create policy "Workspace operators inspect provider activity" on public.messaging_provider_activity for select to authenticated
 using((workspace_id is not null and public.active_workspace_role(workspace_id)in('owner','administrator','operator'))or public.is_admin());
grant select on public.messaging_provider_review_queue,public.messaging_provider_activity to authenticated;
create trigger messaging_provider_activity_append_only before update or delete on public.messaging_provider_activity for each row execute function public.prevent_guest_communication_history_change();
commit;
