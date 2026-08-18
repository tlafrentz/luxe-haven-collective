-- UX-GB-001. Minimal workspace-level brand defaults so the Guidebook Studio
-- "Brand Kit" local nav tab and the AI style step have real, persistent
-- defaults to show/hydrate from, instead of only per-guidebook brand fields.
create table public.guidebook_workspace_brand_defaults(
  workspace_id uuid primary key references public.owners(id) on delete cascade,
  logo_url text,
  primary_color text,
  accent_color text,
  tone_of_voice text,
  language text not null default 'en',
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);

alter table public.guidebook_workspace_brand_defaults enable row level security;

create policy "Workspace brand defaults are readable by workspace members" on public.guidebook_workspace_brand_defaults
  for select to authenticated using (public.is_admin() or public.active_workspace_role(workspace_id) is not null);

create policy "Workspace brand defaults are writable by managers" on public.guidebook_workspace_brand_defaults
  for all to service_role using (true) with check (true);
