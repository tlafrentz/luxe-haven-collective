-- LHC-GS-003 Governed Content Library
alter table public.guidebook_library_artifacts add column if not exists content_record_type text;
alter table public.guidebook_library_artifacts add column if not exists approved_version_id uuid references public.guidebook_library_versions(id) on delete restrict;
alter table public.guidebook_library_artifacts add column if not exists replacement_content_id uuid references public.guidebook_library_artifacts(id) on delete restrict;
alter table public.guidebook_library_artifacts add column if not exists archived_at timestamptz;
alter table public.guidebook_library_artifacts add column if not exists archive_reason text;
alter table public.guidebook_library_artifacts add constraint content_record_type_check check(artifact_type<>'content' or content_record_type in('rich_text','instruction','checklist','faq','recommendation','house_rule','amenity','appliance','emergency_contact','review_prompt','social_link','custom'));
update public.guidebook_library_artifacts set content_record_type=case when category='faq' then 'faq' when category in('local','restaurants','recommendations') then 'recommendation' when category in('house-rules','house_rules') then 'house_rule' when category='safety' then 'emergency_contact' when category='departure' then 'checklist' else 'rich_text' end where artifact_type='content' and content_record_type is null;

create table public.guidebook_content_usage(
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.owners(id), content_artifact_id uuid not null references public.guidebook_library_artifacts(id) on delete restrict,
 content_version_id uuid not null references public.guidebook_library_versions(id) on delete restrict, guidebook_id uuid not null references public.guidebooks(id) on delete restrict,
 guidebook_version_id uuid not null references public.guidebook_canonical_versions(id) on delete restrict, section_id uuid not null references public.guidebook_canonical_sections(id) on delete restrict,
 component_instance_id uuid not null references public.guidebook_component_instances(id) on delete restrict, template_id uuid references public.guidebook_library_artifacts(id) on delete restrict,
 property_id uuid references public.properties(id) on delete restrict, channels text[] not null default '{}', publication_status text not null check(publication_status in('draft','published','superseded')),
 bound_at timestamptz not null default now(), unique(content_version_id,component_instance_id)
);
create table public.guidebook_content_reviews(
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.owners(id), content_version_id uuid not null references public.guidebook_library_versions(id) on delete restrict,
 status text not null default 'pending' check(status in('pending','approved','changes_requested','rejected')), comments text, reviewer_id uuid references public.profiles(id), created_at timestamptz not null default now(), reviewed_at timestamptz
);
create table public.guidebook_content_archive_events(
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.owners(id), content_artifact_id uuid not null references public.guidebook_library_artifacts(id) on delete restrict,
 replacement_content_id uuid references public.guidebook_library_artifacts(id) on delete restrict, reason text not null check(length(trim(reason))>0), block_new_use boolean not null default true,
 archived_by uuid not null references public.profiles(id), archived_at timestamptz not null default now()
);
create table public.guidebook_content_bulk_commands(
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.owners(id), idempotency_key text not null, action text not null check(action in('submit_for_review','assign_category','add_tags','archive','export')),
 record_ids uuid[] not null, parameters jsonb not null default '{}', status text not null default 'queued' check(status in('queued','completed','failed')), created_by uuid not null references public.profiles(id), created_at timestamptz not null default now(), completed_at timestamptz, unique(workspace_id,idempotency_key)
);
create or replace function public.protect_approved_content_version() returns trigger language plpgsql as $$ declare is_content boolean; begin select exists(select 1 from public.guidebook_library_artifacts a where a.id=old.artifact_id and a.artifact_type='content') into is_content;if is_content and old.status in('published','approved','superseded') then raise exception 'content_version_immutable';end if;return case when tg_op='DELETE'then old else new end;end $$;
drop trigger if exists protect_approved_content_version on public.guidebook_library_versions;
create trigger protect_approved_content_version before update or delete on public.guidebook_library_versions for each row execute function public.protect_approved_content_version();
alter table public.guidebook_content_usage enable row level security;alter table public.guidebook_content_reviews enable row level security;alter table public.guidebook_content_archive_events enable row level security;alter table public.guidebook_content_bulk_commands enable row level security;
create policy "Workspace content usage" on public.guidebook_content_usage for select to authenticated using(workspace_id=auth.uid()or public.is_admin());
create policy "Workspace content reviews" on public.guidebook_content_reviews for all to authenticated using(workspace_id=auth.uid()or public.is_admin()) with check(workspace_id=auth.uid()or public.is_admin());
create policy "Workspace content archive events" on public.guidebook_content_archive_events for select to authenticated using(workspace_id=auth.uid()or public.is_admin());
create policy "Workspace content bulk commands" on public.guidebook_content_bulk_commands for all to authenticated using(workspace_id=auth.uid()or public.is_admin()) with check(workspace_id=auth.uid()or public.is_admin());
revoke all on public.guidebook_content_usage,public.guidebook_content_reviews,public.guidebook_content_archive_events,public.guidebook_content_bulk_commands from anon;
grant select on public.guidebook_content_usage,public.guidebook_content_archive_events to authenticated;grant select,insert,update on public.guidebook_content_reviews,public.guidebook_content_bulk_commands to authenticated;
