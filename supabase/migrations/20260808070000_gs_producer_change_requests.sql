-- GS-CR-001: Producer assignment and customer change-request workflow.
-- Adds the missing distinction between self-authoring customers (who edit
-- the Composer directly) and managed-service customers (whose guidebook is
-- produced by Luxe Haven staff), plus the change-request queue that connects
-- the two: customers submit requests, staff pick them up as a production
-- assignment.

alter table public.guidebooks
  add column if not exists authoring_mode text not null default 'self'
    check (authoring_mode in ('self', 'managed')),
  add column if not exists producer_id uuid references public.profiles(id),
  add column if not exists target_publish_date date;

create table public.guidebook_change_requests (
  id uuid primary key default gen_random_uuid(),
  guidebook_id uuid not null references public.guidebooks(id) on delete cascade,
  workspace_id uuid not null references public.profiles(id),
  requested_by uuid not null references public.profiles(id),
  section_key text,
  description text not null check (char_length(description) between 1 and 4000),
  replacement_content text,
  image_urls text[] not null default '{}',
  urgency text not null default 'normal' check (urgency in ('low', 'normal', 'high')),
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved', 'declined')),
  resolution_note text,
  resolved_by uuid references public.profiles(id),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
create index guidebook_change_requests_guidebook_idx
  on public.guidebook_change_requests(guidebook_id, status, created_at desc);
create index guidebook_change_requests_workspace_idx
  on public.guidebook_change_requests(workspace_id, status);

alter table public.guidebook_change_requests enable row level security;

create policy "Owners read own change requests" on public.guidebook_change_requests
  for select to authenticated
  using (workspace_id = auth.uid() or public.is_admin());

create policy "Owners create change requests" on public.guidebook_change_requests
  for insert to authenticated
  with check (workspace_id = auth.uid() and requested_by = auth.uid());

create policy "Admins update change requests" on public.guidebook_change_requests
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create index guidebooks_producer_idx on public.guidebooks(producer_id) where producer_id is not null;
