-- LHC-GS-005: canonical versioned Guidebook Studio templates.
alter table public.guidebook_library_artifacts add column if not exists template_category text;
alter table public.guidebook_library_artifacts add column if not exists preview_media_asset_id uuid;

create table if not exists public.guidebook_template_versions (
  id uuid primary key default gen_random_uuid(), template_id uuid not null references public.guidebook_library_artifacts(id),
  version_number integer not null, lifecycle_status text not null check(lifecycle_status in('draft','in_review','approved','published','deprecated','archived')),
  theme_tokens jsonb not null, accessibility_status text not null default 'not_checked' check(accessibility_status in('not_checked','valid','invalid')),
  change_summary text, breaking_change boolean not null default false, created_by uuid not null, approved_by uuid,
  created_at timestamptz not null default now(), approved_at timestamptz, published_at timestamptz,
  unique(template_id,version_number)
);
create table if not exists public.guidebook_template_component_styles (
  id uuid primary key default gen_random_uuid(), template_version_id uuid not null references public.guidebook_template_versions(id) on delete cascade,
  component_definition_key text not null, supported boolean not null default true, default_variant text not null,
  variants jsonb not null default '[]', token_overrides jsonb not null default '{}', fallback_component_key text,
  unique(template_version_id,component_definition_key)
);
create table if not exists public.guidebook_template_channels (
  id uuid primary key default gen_random_uuid(), template_version_id uuid not null references public.guidebook_template_versions(id) on delete cascade,
  channel text not null check(channel in('responsive_web','mobile_web','pdf','guest_portal')),
  support text not null check(support in('supported','fallback','unsupported')), renderer_key text not null, configuration jsonb not null default '{}',
  unique(template_version_id,channel)
);
create table if not exists public.guidebook_template_branding_overrides (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null, template_version_id uuid not null references public.guidebook_template_versions(id),
  logo_asset_id uuid, primary_color text, accent_color text, footer_text text, social_links jsonb not null default '{}',
  created_by uuid not null, updated_by uuid not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(workspace_id,template_version_id)
);
create table if not exists public.guidebook_template_usage (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null, template_version_id uuid not null references public.guidebook_template_versions(id),
  guidebook_id uuid, guidebook_version_id uuid, publication_id uuid, usage_status text not null, created_at timestamptz not null default now()
);
create table if not exists public.guidebook_template_audit_events (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null, template_id uuid not null references public.guidebook_library_artifacts(id),
  template_version_id uuid, actor_id uuid not null, event_type text not null, safe_metadata jsonb not null default '{}', created_at timestamptz not null default now()
);

create or replace function public.prevent_published_template_version_update() returns trigger language plpgsql as $$
begin if old.lifecycle_status='published' and new is distinct from old then raise exception 'published_template_version_immutable'; end if; return new; end $$;
drop trigger if exists guidebook_template_versions_immutable on public.guidebook_template_versions;
create trigger guidebook_template_versions_immutable before update or delete on public.guidebook_template_versions for each row execute function public.prevent_published_template_version_update();

alter table public.guidebook_template_versions enable row level security;
alter table public.guidebook_template_component_styles enable row level security;
alter table public.guidebook_template_channels enable row level security;
alter table public.guidebook_template_branding_overrides enable row level security;
alter table public.guidebook_template_usage enable row level security;
alter table public.guidebook_template_audit_events enable row level security;
create policy template_versions_authenticated_read on public.guidebook_template_versions for select to authenticated using(true);
create policy template_styles_authenticated_read on public.guidebook_template_component_styles for select to authenticated using(true);
create policy template_channels_authenticated_read on public.guidebook_template_channels for select to authenticated using(true);
create policy template_branding_workspace_scope on public.guidebook_template_branding_overrides for all to authenticated using(workspace_id=auth.uid()) with check(workspace_id=auth.uid());
create policy template_usage_workspace_scope on public.guidebook_template_usage for all to authenticated using(workspace_id=auth.uid()) with check(workspace_id=auth.uid());
create policy template_audit_workspace_scope on public.guidebook_template_audit_events for select to authenticated using(workspace_id=auth.uid());
revoke all on public.guidebook_template_versions,public.guidebook_template_component_styles,public.guidebook_template_channels,public.guidebook_template_branding_overrides,public.guidebook_template_usage,public.guidebook_template_audit_events from anon;

-- Seed is intentionally idempotent and references presentation only.
with inserted as (
 insert into public.guidebook_library_artifacts(artifact_type,canonical_key,name,description,category,tags,status,current_version_number,ownership_scope,owner_label,template_category)
 values('template','mesa-modern','Mesa Modern','Clean, modern, inviting—an editorial guest-first template.','modern',array['official','mesa','modern'],'published',1,'luxe_haven','Luxe Haven','modern')
 on conflict(artifact_type,ownership_scope,workspace_id,property_id,canonical_key) do update set name=excluded.name,description=excluded.description,template_category=excluded.template_category
 returning id
)
select id from inserted;
