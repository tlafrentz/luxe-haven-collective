-- COM-005A: deterministic guidance and versioned communication templates.
begin;
alter table public.guest_communication_templates
 add column if not exists series_key text,
 add column if not exists version integer not null default 1,
 add column if not exists language text not null default 'en',
 add column if not exists locale text not null default 'en-US',
 add column if not exists subject text,
 add column if not exists attachment_manifest jsonb not null default '[]',
 add column if not exists delivery_mode text not null default 'immediate',
 add column if not exists publication_status text not null default 'published',
 add column if not exists published_at timestamptz,
 add column if not exists published_by uuid references public.profiles(id);
update public.guest_communication_templates set series_key=coalesce(series_key,id),publication_status=case when status='active'then'published'when status='archived'then'archived'else'draft'end,published_at=case when status='active'then coalesce(published_at,created_at)else published_at end;
alter table public.guest_communication_templates alter column series_key set not null;
alter table public.guest_communication_templates add constraint guest_template_version_check check(version>0);
alter table public.guest_communication_templates add constraint guest_template_delivery_mode_check check(delivery_mode in('immediate','scheduled','manual-hold'));
alter table public.guest_communication_templates add constraint guest_template_publication_check check(publication_status in('draft','published','archived'));
alter table public.guest_communication_templates drop constraint if exists guest_communication_templates_workspace_id_title_key;
create unique index guest_communication_template_series_version_key on public.guest_communication_templates(coalesce(workspace_id,'00000000-0000-0000-0000-000000000000'::uuid),series_key,version);
create index guest_communication_template_selection_idx on public.guest_communication_templates(workspace_id,category,language,locale,publication_status,version desc);

create or replace function public.protect_published_communication_template()returns trigger language plpgsql set search_path = ''
as $$
begin
 if tg_op='DELETE'then raise exception 'communication templates are archived, not deleted'using errcode='55000';end if;
 if old.publication_status='published'and(
   old.workspace_id is distinct from new.workspace_id or old.series_key<>new.series_key or old.version<>new.version or old.category<>new.category
   or old.language<>new.language or old.locale<>new.locale or old.subject is distinct from new.subject or old.title<>new.title
   or old.body<>new.body or old.variables<>new.variables or old.attachment_manifest<>new.attachment_manifest or old.delivery_mode<>new.delivery_mode
 )then raise exception 'published communication template versions are immutable'using errcode='55000';end if;
 return new;
end;
$$;
create trigger guest_communication_template_version_protected before update or delete on public.guest_communication_templates for each row execute function public.protect_published_communication_template();

create table public.guest_communication_recommendations(
 id uuid primary key default gen_random_uuid(),conversation_id text not null references public.guest_conversations(id) on delete restrict,
 workspace_id uuid not null references public.profiles(id) on delete restrict,rule_id text not null,action_key text not null,
 context_fingerprint text not null,priority text not null check(priority in('critical','high','normal','informational')),
 confidence text not null check(confidence in('high','moderate','low')),title text not null,reason text not null,
 explanation jsonb not null default '[]',suggested_template_category text,dependencies jsonb not null default '[]',
 status text not null default 'active' check(status in('active','completed','dismissed','superseded')),
 created_at timestamptz not null default now(),completed_at timestamptz,dismissed_at timestamptz,
 acted_by uuid references public.profiles(id),dismissal_reason text,
 unique(conversation_id,action_key,context_fingerprint)
);
create index guest_communication_recommendation_active_idx on public.guest_communication_recommendations(conversation_id,status,priority,created_at);
create table public.guest_communication_guidance_activity(
 id uuid primary key default gen_random_uuid(),conversation_id text references public.guest_conversations(id) on delete restrict,
 workspace_id uuid not null references public.profiles(id) on delete restrict,recommendation_id uuid references public.guest_communication_recommendations(id) on delete restrict,
 template_id text references public.guest_communication_templates(id) on delete restrict,actor_profile_id uuid references public.profiles(id),
 event_type text not null check(event_type in('recommendation-created','recommendation-completed','recommendation-dismissed','template-used','template-published','template-archived')),
 safe_summary text not null,metadata jsonb not null default '{}',occurred_at timestamptz not null default now()
);
create index guest_guidance_activity_conversation_idx on public.guest_communication_guidance_activity(conversation_id,occurred_at desc);
alter table public.guest_communication_recommendations enable row level security;
alter table public.guest_communication_guidance_activity enable row level security;
create policy "Workspace members inspect communication guidance" on public.guest_communication_recommendations for select to authenticated using(public.active_workspace_role(workspace_id)is not null or public.is_admin());
create policy "Workspace members inspect guidance history" on public.guest_communication_guidance_activity for select to authenticated using(public.active_workspace_role(workspace_id)is not null or public.is_admin());
grant select on public.guest_communication_recommendations,public.guest_communication_guidance_activity to authenticated;
create trigger guest_guidance_activity_append_only before update or delete on public.guest_communication_guidance_activity for each row execute function public.prevent_guest_communication_history_change();
commit;
