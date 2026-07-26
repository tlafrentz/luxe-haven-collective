-- PC-001F: Guidebook Studio publishing platform.
create table public.guidebooks(
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null references public.profiles(id),property_id uuid not null references public.properties(id),
 title text not null,description text not null default '',status text not null check(status in('draft','published','superseded','archived')),
 current_version integer not null default 0 check(current_version>=0),published_version integer check(published_version>0),public_slug text not null unique check(public_slug~'^[a-z0-9_-]{16,80}$'),
 brand jsonb not null default '{"theme":"luxe-haven","primaryColor":"#1d1a17","accentColor":"#d7b77d"}',revision integer not null default 1 check(revision>0),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(workspace_id,property_id)
);
create table public.guidebook_sections(
 id uuid primary key default gen_random_uuid(),guidebook_id uuid not null references public.guidebooks(id)on delete cascade,section_key text not null,title text not null,position integer not null check(position>=0),
 visible boolean not null default true,revision integer not null default 1,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(guidebook_id,section_key),unique(guidebook_id,position)
);
create table public.guidebook_blocks(
 id uuid primary key default gen_random_uuid(),section_id uuid not null references public.guidebook_sections(id)on delete cascade,
 block_type text not null check(block_type in('heading','rich-text','image','gallery','video','map','callout','checklist','contact','button','link','divider')),
 position integer not null check(position>=0),content jsonb not null default '{}',guest_safe boolean not null default true,revision integer not null default 1,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(section_id,position)
);
create table public.guidebook_recommendations(
 id uuid primary key default gen_random_uuid(),guidebook_id uuid not null references public.guidebooks(id)on delete cascade,
 category text not null check(category in('restaurants','coffee','bars','groceries','pharmacy','hospital','activities','shopping','transportation')),
 title text not null,description text not null default '',address text,latitude numeric(10,7),longitude numeric(10,7),map_url text,website text,position integer not null default 0,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table public.guidebook_versions(
 id uuid primary key default gen_random_uuid(),guidebook_id uuid not null references public.guidebooks(id),version integer not null check(version>0),
 status text not null check(status in('published','superseded','unpublished')),snapshot jsonb not null,published_by_profile_id uuid not null references public.profiles(id),
 published_at timestamptz not null,created_at timestamptz not null default now(),unique(guidebook_id,version)
);
create table public.guidebook_analytics(
 id uuid primary key default gen_random_uuid(),guidebook_id uuid not null references public.guidebooks(id),version integer not null,event_type text not null check(event_type in('view','qr-scan','section-open')),
 section_key text,visitor_hash text,occurred_at timestamptz not null default now(),metadata jsonb not null default '{}'
);
create table public.guidebook_activity(
 id uuid primary key default gen_random_uuid(),guidebook_id uuid not null references public.guidebooks(id),event_type text not null,actor_profile_id uuid references public.profiles(id),
 safe_summary text not null,metadata jsonb not null default '{}',occurred_at timestamptz not null default now()
);
create index guidebook_workspace_idx on public.guidebooks(workspace_id,status,updated_at desc);
create index guidebook_version_idx on public.guidebook_versions(guidebook_id,version desc);
create index guidebook_analytics_idx on public.guidebook_analytics(guidebook_id,occurred_at desc);
alter table public.guidebooks enable row level security;alter table public.guidebook_sections enable row level security;alter table public.guidebook_blocks enable row level security;
alter table public.guidebook_recommendations enable row level security;alter table public.guidebook_versions enable row level security;alter table public.guidebook_analytics enable row level security;alter table public.guidebook_activity enable row level security;
create policy "Owners read guidebooks" on public.guidebooks for select to authenticated using(workspace_id=auth.uid()or public.is_admin());
create policy "Owners read guidebook sections" on public.guidebook_sections for select to authenticated using(exists(select 1 from public.guidebooks g where g.id=guidebook_id and(g.workspace_id=auth.uid()or public.is_admin())));
create policy "Owners read guidebook blocks" on public.guidebook_blocks for select to authenticated using(exists(select 1 from public.guidebook_sections s join public.guidebooks g on g.id=s.guidebook_id where s.id=section_id and(g.workspace_id=auth.uid()or public.is_admin())));
create policy "Owners read guidebook recommendations" on public.guidebook_recommendations for select to authenticated using(exists(select 1 from public.guidebooks g where g.id=guidebook_id and(g.workspace_id=auth.uid()or public.is_admin())));
create policy "Owners read guidebook versions" on public.guidebook_versions for select to authenticated using(exists(select 1 from public.guidebooks g where g.id=guidebook_id and(g.workspace_id=auth.uid()or public.is_admin())));
create policy "Owners read guidebook analytics" on public.guidebook_analytics for select to authenticated using(exists(select 1 from public.guidebooks g where g.id=guidebook_id and(g.workspace_id=auth.uid()or public.is_admin())));
create policy "Owners read guidebook activity" on public.guidebook_activity for select to authenticated using(exists(select 1 from public.guidebooks g where g.id=guidebook_id and(g.workspace_id=auth.uid()or public.is_admin())));
grant select on public.guidebooks,public.guidebook_sections,public.guidebook_blocks,public.guidebook_recommendations,public.guidebook_versions,public.guidebook_analytics,public.guidebook_activity to authenticated;
create or replace function public.prevent_guidebook_history_change()returns trigger language plpgsql set search_path='' as $$begin raise exception 'published guidebook history is immutable' using errcode='55000';end;$$;
create trigger guidebook_versions_immutable before update or delete on public.guidebook_versions for each row execute function public.prevent_guidebook_history_change();
create trigger guidebook_activity_immutable before update or delete on public.guidebook_activity for each row execute function public.prevent_guidebook_history_change();
create or replace function public.publish_guidebook_version(p_guidebook_id uuid,p_expected_revision integer,p_snapshot jsonb,p_published_by uuid,p_published_at timestamptz)
returns integer language plpgsql security definer set search_path='' as $$
declare v_guidebook public.guidebooks%rowtype;v_version integer;
begin
 select * into v_guidebook from public.guidebooks where id=p_guidebook_id for update;
 if not found then raise exception 'guidebook_not_found' using errcode='P0002';end if;
 if v_guidebook.revision<>p_expected_revision then raise exception 'revision_conflict' using errcode='40001';end if;
 if p_snapshot is null or jsonb_array_length(coalesce(p_snapshot->'sections','[]'::jsonb))=0 then raise exception 'publication_invalid' using errcode='23514';end if;
 v_version:=v_guidebook.current_version+1;
 insert into public.guidebook_versions(guidebook_id,version,status,snapshot,published_by_profile_id,published_at,created_at)
 values(p_guidebook_id,v_version,'published',p_snapshot,p_published_by,p_published_at,p_published_at);
 update public.guidebooks set status='published',current_version=v_version,published_version=v_version,updated_at=p_published_at,revision=revision+1 where id=p_guidebook_id;
 update public.properties set guidebook_available=true where id=v_guidebook.property_id;
 insert into public.guidebook_activity(guidebook_id,event_type,actor_profile_id,safe_summary,metadata,occurred_at)
 values(p_guidebook_id,'guidebook-published',p_published_by,'Guidebook version '||v_version||' published.',jsonb_build_object('version',v_version),p_published_at);
 return v_version;
end;$$;
revoke all on function public.publish_guidebook_version(uuid,integer,jsonb,uuid,timestamptz)from public,anon,authenticated;
grant execute on function public.publish_guidebook_version(uuid,integer,jsonb,uuid,timestamptz)to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)values('guidebook-assets','guidebook-assets',true,10485760,array['image/jpeg','image/png','image/webp','image/gif'])on conflict(id)do update set public=true,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create policy "Public reads guidebook assets" on storage.objects for select using(bucket_id='guidebook-assets');
create policy "Service manages guidebook assets" on storage.objects for all to service_role using(bucket_id='guidebook-assets')with check(bucket_id='guidebook-assets');
