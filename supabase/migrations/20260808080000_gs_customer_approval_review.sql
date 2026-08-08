-- GS-CR-002: Customer approval review workflow (AD-09/AD-10).
-- Staff request customer approval on a specific draft revision; the
-- customer reviews the real guest preview, leaves page/section-linked
-- comments, and approves or requests changes. The decision is tied to
-- an immutable draft revision number, not a live-editable pointer.

create table public.guidebook_approval_requests (
  id uuid primary key default gen_random_uuid(),
  guidebook_id uuid not null references public.guidebooks(id) on delete cascade,
  workspace_id uuid not null references public.profiles(id),
  draft_revision integer not null check (draft_revision > 0),
  requested_by uuid not null references public.profiles(id),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'changes_requested', 'superseded')),
  decision_note text,
  decided_by uuid references public.profiles(id),
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
create index guidebook_approval_requests_guidebook_idx
  on public.guidebook_approval_requests(guidebook_id, status, created_at desc);

create table public.guidebook_review_comments (
  id uuid primary key default gen_random_uuid(),
  approval_request_id uuid not null references public.guidebook_approval_requests(id) on delete cascade,
  guidebook_id uuid not null references public.guidebooks(id) on delete cascade,
  workspace_id uuid not null references public.profiles(id),
  section_key text,
  comment text not null check (char_length(comment) between 1 and 2000),
  author_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);
create index guidebook_review_comments_request_idx
  on public.guidebook_review_comments(approval_request_id, created_at);

alter table public.guidebook_approval_requests enable row level security;
alter table public.guidebook_review_comments enable row level security;

create policy "Workspace and admin read approval requests" on public.guidebook_approval_requests
  for select to authenticated
  using (workspace_id = auth.uid() or public.is_admin());

create policy "Admins create approval requests" on public.guidebook_approval_requests
  for insert to authenticated
  with check (public.is_admin());

create policy "Owners and admins decide approval requests" on public.guidebook_approval_requests
  for update to authenticated
  using (workspace_id = auth.uid() or public.is_admin())
  with check (workspace_id = auth.uid() or public.is_admin());

create policy "Workspace and admin read review comments" on public.guidebook_review_comments
  for select to authenticated
  using (workspace_id = auth.uid() or public.is_admin());

create policy "Workspace and admin create review comments" on public.guidebook_review_comments
  for insert to authenticated
  with check (
    author_id = auth.uid()
    and (workspace_id = auth.uid() or public.is_admin())
  );
