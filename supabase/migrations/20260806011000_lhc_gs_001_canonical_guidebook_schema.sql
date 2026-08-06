-- LHC-GS-001 Canonical Guidebook Schema v1
-- Canonical authoring is independent from legacy page/block rendering tables.

alter table public.guidebooks add column if not exists default_locale text not null default 'en-US';
alter table public.guidebooks add column if not exists supported_locales text[] not null default array['en-US'];
alter table public.guidebooks add column if not exists active_draft_version_id uuid;
alter table public.guidebooks add column if not exists current_published_version_id uuid;
alter table public.guidebooks add column if not exists template_assignment_id uuid;
alter table public.guidebooks add column if not exists archived_at timestamptz;

create table public.guidebook_canonical_versions (
 id uuid primary key default gen_random_uuid(), guidebook_id uuid not null references public.guidebooks(id) on delete restrict,
 version_number integer not null check(version_number>0), version_label text,
 lifecycle_status text not null default 'draft' check(lifecycle_status in('draft','in_review','approved','published','superseded','archived')),
 based_on_version_id uuid references public.guidebook_canonical_versions(id) on delete restrict,
 title text not null, subtitle text, default_locale text not null default 'en-US',
 validation_status text not null default 'not_checked' check(validation_status in('not_checked','valid','warning','invalid')),
 review_notes text, publication_notes text, created_by uuid not null references public.profiles(id),
 approved_by uuid references public.profiles(id), published_by uuid references public.profiles(id),
 created_at timestamptz not null default now(), approved_at timestamptz, published_at timestamptz,
 unique(guidebook_id,version_number)
);
alter table public.guidebooks add constraint guidebooks_active_canonical_draft_fk foreign key(active_draft_version_id) references public.guidebook_canonical_versions(id) on delete restrict;
alter table public.guidebooks add constraint guidebooks_current_canonical_publication_fk foreign key(current_published_version_id) references public.guidebook_canonical_versions(id) on delete restrict;
create unique index guidebook_one_canonical_draft_idx on public.guidebook_canonical_versions(guidebook_id) where lifecycle_status='draft';
create unique index guidebook_one_canonical_published_idx on public.guidebook_canonical_versions(guidebook_id) where lifecycle_status='published';

create table public.guidebook_canonical_sections (
 id uuid primary key default gen_random_uuid(), version_id uuid not null references public.guidebook_canonical_versions(id) on delete cascade,
 kind text not null, title text not null, subtitle text, journey_group text not null check(journey_group in('welcome','arrival','stay','explore','departure','follow_up')),
 sort_order integer not null check(sort_order>=0), visibility text not null default 'visible' check(visibility in('visible','hidden','conditional')),
 condition_expression jsonb, icon_key text, cover_media_asset_id uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(version_id,sort_order)
);
create table public.guidebook_component_instances (
 id uuid primary key default gen_random_uuid(), section_id uuid not null references public.guidebook_canonical_sections(id) on delete cascade,
 component_definition_id uuid not null references public.guidebook_library_artifacts(id) on delete restrict, component_version integer not null check(component_version>0), component_key text not null,
 sort_order integer not null check(sort_order>=0), content_binding_mode text not null check(content_binding_mode in('inline','content_record','property_variable','collection')),
 content_record_id uuid, content_collection_id uuid, configuration jsonb not null default '{}'::jsonb,
 visibility text not null default 'visible' check(visibility in('visible','hidden','conditional')), condition_expression jsonb,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(section_id,sort_order)
);
create table public.guidebook_content_records (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.owners(id), property_id uuid references public.properties(id),
 record_type text not null, title text not null, summary text, body jsonb not null default '{}'::jsonb,
 lifecycle_status text not null default 'draft' check(lifecycle_status in('draft','in_review','approved','archived')), default_locale text not null default 'en-US',
 scope text not null check(scope in('platform','workspace','property')), source text not null check(source in('manual','imported','generated','provider')),
 created_by uuid not null references public.profiles(id), approved_by uuid references public.profiles(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), approved_at timestamptz,
 check((scope='platform' and property_id is null)or(scope='workspace' and property_id is null)or(scope='property' and property_id is not null)),
 check(not(source='generated' and lifecycle_status='approved' and approved_by is null))
);
alter table public.guidebook_component_instances add constraint guidebook_component_content_record_fk foreign key(content_record_id) references public.guidebook_content_records(id) on delete restrict;

create table public.guidebook_property_variable_bindings (
 id uuid primary key default gen_random_uuid(), component_instance_id uuid not null references public.guidebook_component_instances(id) on delete cascade,
 variable_key text not null, fallback_value jsonb, formatting_rule text, unique(component_instance_id,variable_key)
);
create table public.guidebook_canonical_media_bindings (
 id uuid primary key default gen_random_uuid(), version_id uuid not null references public.guidebook_canonical_versions(id) on delete cascade,
 media_asset_id uuid not null references public.guidebook_library_artifacts(id) on delete restrict, media_revision_id uuid not null references public.guidebook_library_versions(id) on delete restrict,
 usage text not null check(usage in('cover','hero','section','component','gallery','thumbnail','background')),
 section_id uuid references public.guidebook_canonical_sections(id) on delete cascade, component_instance_id uuid references public.guidebook_component_instances(id) on delete cascade,
 alt_text text, caption text, focal_point jsonb, sort_order integer,
 check(usage='background' or alt_text is not null)
);
create table public.guidebook_template_assignments (
 id uuid primary key default gen_random_uuid(), guidebook_id uuid not null references public.guidebooks(id) on delete cascade,
 template_id uuid not null references public.guidebook_library_artifacts(id) on delete restrict, template_version_id uuid not null references public.guidebook_library_versions(id) on delete restrict,
 theme_overrides jsonb not null default '{}'::jsonb, assigned_at timestamptz not null default now(), assigned_by uuid not null references public.profiles(id)
);
alter table public.guidebooks add constraint guidebooks_canonical_template_assignment_fk foreign key(template_assignment_id) references public.guidebook_template_assignments(id) on delete set null;
create table public.guidebook_localized_variants (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.owners(id), parent_entity_type text not null check(parent_entity_type in('guidebook_version','section','component_instance','content_record')),
 parent_entity_id uuid not null, locale text not null, translated_fields jsonb not null default '{}'::jsonb,
 translation_status text not null default 'draft' check(translation_status in('draft','machine_generated','in_review','approved')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(parent_entity_type,parent_entity_id,locale)
);
create table public.guidebook_publication_snapshots (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.owners(id), guidebook_version_id uuid not null references public.guidebook_canonical_versions(id) on delete restrict,
 template_version_id uuid not null references public.guidebook_library_versions(id) on delete restrict,
 resolved_property_variables jsonb not null, resolved_content_record_versions jsonb not null, resolved_media_versions jsonb not null, render_manifest jsonb not null, created_at timestamptz not null default now()
);
create table public.guidebook_publications (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.owners(id), guidebook_id uuid not null references public.guidebooks(id) on delete restrict,
 guidebook_version_id uuid not null references public.guidebook_canonical_versions(id) on delete restrict,
 channel text not null check(channel in('responsive_web','pdf','qr_destination','guest_portal')), status text not null default 'queued' check(status in('queued','generating','published','failed','withdrawn')),
 public_url text, file_asset_id uuid, publication_snapshot_id uuid not null references public.guidebook_publication_snapshots(id) on delete restrict,
 idempotency_key text not null, published_by uuid not null references public.profiles(id), published_at timestamptz, withdrawn_at timestamptz, unique(workspace_id,idempotency_key)
);
create table public.guidebook_validation_issues (
 id uuid primary key default gen_random_uuid(), version_id uuid not null references public.guidebook_canonical_versions(id) on delete cascade,
 severity text not null check(severity in('info','warning','error')), code text not null, message text not null, entity_type text not null, entity_id text not null, blocking boolean not null,
 created_at timestamptz not null default now(), resolved_at timestamptz
);
create table public.guidebook_import_jobs (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.owners(id), source_type text not null check(source_type in('pdf','document','manual','template')),
 source_asset_id uuid not null references public.guidebook_library_artifacts(id) on delete restrict, status text not null default 'queued' check(status in('queued','extracting','mapping','review_required','completed','failed')),
 proposed_guidebook_id uuid references public.guidebooks(id) on delete set null, idempotency_key text not null, created_by uuid not null references public.profiles(id), created_at timestamptz not null default now(), completed_at timestamptz, unique(workspace_id,idempotency_key)
);
create table public.guidebook_import_proposals (
 id uuid primary key default gen_random_uuid(), import_job_id uuid not null references public.guidebook_import_jobs(id) on delete cascade,
 proposed_entity_type text not null check(proposed_entity_type in('section','component','content_record','property_variable','media_asset')),
 source_reference text not null, proposed_payload jsonb not null, confidence text not null check(confidence in('high','medium','low')),
 review_status text not null default 'pending' check(review_status in('pending','accepted','edited','rejected')), reviewed_by uuid references public.profiles(id), reviewed_at timestamptz
);
create table public.guidebook_canonical_audit (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.owners(id), actor_id uuid not null references public.profiles(id), entity_type text not null, entity_id text not null, event text not null, metadata jsonb not null default '{}'::jsonb, occurred_at timestamptz not null default now()
);

create or replace function public.protect_canonical_guidebook_history() returns trigger language plpgsql as $$ begin
 if old.lifecycle_status in('published','superseded','archived') then raise exception 'canonical_guidebook_version_immutable'; end if;
 if tg_op='DELETE' then return old; end if; return new;
end $$;
create trigger protect_canonical_guidebook_version before update or delete on public.guidebook_canonical_versions for each row execute function public.protect_canonical_guidebook_history();
create or replace function public.protect_guidebook_publication_snapshot() returns trigger language plpgsql as $$ begin raise exception 'guidebook_publication_snapshot_immutable'; end $$;
create trigger protect_guidebook_publication_snapshot before update or delete on public.guidebook_publication_snapshots for each row execute function public.protect_guidebook_publication_snapshot();

do $$ declare table_name text; begin foreach table_name in array array['guidebook_canonical_versions','guidebook_canonical_sections','guidebook_component_instances','guidebook_content_records','guidebook_property_variable_bindings','guidebook_canonical_media_bindings','guidebook_template_assignments','guidebook_localized_variants','guidebook_publication_snapshots','guidebook_publications','guidebook_validation_issues','guidebook_import_jobs','guidebook_import_proposals','guidebook_canonical_audit'] loop execute format('alter table public.%I enable row level security',table_name); end loop; end $$;
create policy "Workspace canonical versions" on public.guidebook_canonical_versions for all to authenticated using(exists(select 1 from public.guidebooks g where g.id=guidebook_id and(g.workspace_id=auth.uid()or public.is_admin()))) with check(exists(select 1 from public.guidebooks g where g.id=guidebook_id and(g.workspace_id=auth.uid()or public.is_admin())));
create policy "Workspace content records" on public.guidebook_content_records for all to authenticated using(workspace_id=auth.uid()or public.is_admin()) with check(workspace_id=auth.uid()or public.is_admin());
create policy "Workspace publications" on public.guidebook_publications for all to authenticated using(workspace_id=auth.uid()or public.is_admin()) with check(workspace_id=auth.uid()or public.is_admin());
create policy "Workspace publication snapshots" on public.guidebook_publication_snapshots for select to authenticated using(workspace_id=auth.uid()or public.is_admin());
create policy "Workspace imports" on public.guidebook_import_jobs for all to authenticated using(workspace_id=auth.uid()or public.is_admin()) with check(workspace_id=auth.uid()or public.is_admin());
create policy "Workspace localizations" on public.guidebook_localized_variants for all to authenticated using(workspace_id=auth.uid()or public.is_admin()) with check(workspace_id=auth.uid()or public.is_admin());
create policy "Workspace canonical audit" on public.guidebook_canonical_audit for select to authenticated using(workspace_id=auth.uid()or public.is_admin());
-- Child records inherit authorization through version/job ownership. Public delivery uses a service-owned projection, never direct anonymous table access.
create policy "Workspace canonical sections" on public.guidebook_canonical_sections for all to authenticated using(exists(select 1 from public.guidebook_canonical_versions v join public.guidebooks g on g.id=v.guidebook_id where v.id=version_id and(g.workspace_id=auth.uid()or public.is_admin()))) with check(exists(select 1 from public.guidebook_canonical_versions v join public.guidebooks g on g.id=v.guidebook_id where v.id=version_id and(g.workspace_id=auth.uid()or public.is_admin())));
create policy "Workspace canonical components" on public.guidebook_component_instances for all to authenticated using(exists(select 1 from public.guidebook_canonical_sections s join public.guidebook_canonical_versions v on v.id=s.version_id join public.guidebooks g on g.id=v.guidebook_id where s.id=section_id and(g.workspace_id=auth.uid()or public.is_admin()))) with check(exists(select 1 from public.guidebook_canonical_sections s join public.guidebook_canonical_versions v on v.id=s.version_id join public.guidebooks g on g.id=v.guidebook_id where s.id=section_id and(g.workspace_id=auth.uid()or public.is_admin())));
revoke all on public.guidebook_publication_snapshots,public.guidebook_canonical_audit from anon,authenticated;
grant select on public.guidebook_publication_snapshots,public.guidebook_canonical_audit to authenticated;
