-- GB-001: Guidebook Studio v1 contract hardening.
-- Existing immutable publications remain readable; new draft writes are limited
-- to the nine supported v1 block types.
begin;

create or replace function public.enforce_guidebook_v1_block()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.block_type not in (
    'heading','rich-text','image','instruction','contact',
    'location','link','callout','checklist'
  ) then
    raise exception 'guidebook_block_type_unsupported' using errcode = '23514';
  end if;
  if jsonb_typeof(new.content) is distinct from 'object' then
    raise exception 'guidebook_block_content_invalid' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_guidebook_v1_block on public.guidebook_blocks;
create trigger enforce_guidebook_v1_block
before insert or update of block_type, content on public.guidebook_blocks
for each row execute function public.enforce_guidebook_v1_block();

alter table public.guidebooks
  add column if not exists archived_at timestamptz,
  add column if not exists draft_schema_version text not null
    default 'guidebook-draft.v1',
  add column if not exists draft_revision integer not null default 1
    check (draft_revision > 0);

alter table public.guidebook_versions
  add column if not exists publication_idempotency_key text;

create unique index if not exists guidebook_publication_idempotency_idx
  on public.guidebook_versions(guidebook_id, publication_idempotency_key)
  where publication_idempotency_key is not null;

create table if not exists public.guidebook_command_receipts (
  workspace_id uuid not null references public.profiles(id),
  guidebook_id uuid not null references public.guidebooks(id),
  command_id text not null,
  operation text not null check (operation in (
    'create','draft-save','create-section','rename-section','reorder-sections',
    'section-visibility','duplicate-section','delete-section','create-block',
    'update-block','reorder-blocks','block-visibility','duplicate-block',
    'delete-block','publish','restore-version','archive','restore',
    'media-upload','media-remove','public-slug-rotate'
  )),
  fingerprint text not null,
  outcome text not null check (outcome in ('in-progress','completed','failed')),
  result jsonb not null default '{}',
  actor_profile_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  primary key (workspace_id, command_id)
);

create table if not exists public.guidebook_drafts (
  guidebook_id uuid primary key references public.guidebooks(id) on delete cascade,
  workspace_id uuid not null references public.profiles(id),
  property_id uuid not null references public.properties(id),
  schema_version text not null check (schema_version = 'guidebook-draft.v1'),
  revision integer not null check (revision > 0),
  composition jsonb not null check (jsonb_typeof(composition) = 'object'),
  persisted_by_profile_id uuid not null references public.profiles(id),
  persisted_at timestamptz not null default now(),
  base_publication_version integer,
  unique (workspace_id, guidebook_id)
);
alter table public.guidebook_drafts enable row level security;
create policy "Members read scoped guidebook drafts"
on public.guidebook_drafts for select to authenticated using (
  public.active_workspace_role(workspace_id) is not null
  and public.can_access_workspace_property(property_id)
);
grant select on public.guidebook_drafts to authenticated;

create or replace function public.persist_guidebook_draft(
  p_guidebook_id uuid,
  p_workspace_id uuid,
  p_property_id uuid,
  p_expected_revision integer,
  p_resulting_revision integer,
  p_actor_id uuid,
  p_composition jsonb,
  p_persisted_at timestamptz
) returns integer language plpgsql security definer set search_path = public as $$
declare stored_revision integer;
begin
  if p_resulting_revision <> p_expected_revision + 1 then
    raise exception 'draft_revision_invalid' using errcode = '23514';
  end if;
  select revision into stored_revision from public.guidebook_drafts
    where guidebook_id = p_guidebook_id for update;
  if stored_revision is null then
    select revision into stored_revision from public.guidebooks
      where id = p_guidebook_id and workspace_id = p_workspace_id
        and property_id = p_property_id for update;
  end if;
  if stored_revision is null then raise exception 'draft_not_found' using errcode = 'P0002'; end if;
  if stored_revision <> p_expected_revision then raise exception 'draft_conflict' using errcode = '40001'; end if;
  insert into public.guidebook_drafts(
    guidebook_id,workspace_id,property_id,schema_version,revision,composition,
    persisted_by_profile_id,persisted_at
  ) values(
    p_guidebook_id,p_workspace_id,p_property_id,'guidebook-draft.v1',
    p_resulting_revision,p_composition,p_actor_id,p_persisted_at
  ) on conflict(guidebook_id) do update set
    revision=excluded.revision,composition=excluded.composition,
    persisted_by_profile_id=excluded.persisted_by_profile_id,
    persisted_at=excluded.persisted_at;
  update public.guidebooks set revision=p_resulting_revision,
    draft_revision=p_resulting_revision,updated_at=p_persisted_at
    where id=p_guidebook_id;
  delete from public.guidebook_draft_media where guidebook_id=p_guidebook_id;
  insert into public.guidebook_draft_media(guidebook_id,media_asset_id)
  select p_guidebook_id,reference.value #>> '{}'
  from jsonb_path_query(p_composition,'$.sections[*].blocks[*] ? (@.type == "image" && @.visible != false).content.mediaRef') reference(value)
  join public.guidebook_media_assets asset on asset.id=reference.value #>> '{}'
   and asset.guidebook_id=p_guidebook_id and asset.workspace_id=p_workspace_id
  on conflict do nothing;
  return p_resulting_revision;
end;
$$;
revoke all on function public.persist_guidebook_draft(uuid,uuid,uuid,integer,integer,uuid,jsonb,timestamptz)
  from public,anon,authenticated;
grant execute on function public.persist_guidebook_draft(uuid,uuid,uuid,integer,integer,uuid,jsonb,timestamptz)
  to service_role;

create or replace function public.publish_canonical_guidebook_draft(
  p_guidebook_id uuid,
  p_workspace_id uuid,
  p_expected_revision integer,
  p_actor_id uuid,
  p_idempotency_key text,
  p_snapshot jsonb,
  p_published_at timestamptz
) returns table(version_id uuid, version_number integer)
language plpgsql security definer set search_path = public as $$
declare
  guidebook public.guidebooks%rowtype;
  existing public.guidebook_versions%rowtype;
  next_version integer;
  next_id uuid;
begin
  select * into existing from public.guidebook_versions
    where guidebook_id=p_guidebook_id
      and publication_idempotency_key=p_idempotency_key;
  if existing.id is not null then
    return query select existing.id,existing.version;
    return;
  end if;
  select * into guidebook from public.guidebooks
    where id=p_guidebook_id and workspace_id=p_workspace_id for update;
  if guidebook.id is null then raise exception 'guidebook_not_found' using errcode='P0002'; end if;
  if guidebook.status='archived' then raise exception 'guidebook_archived' using errcode='55000'; end if;
  if guidebook.revision<>p_expected_revision then raise exception 'publication_conflict' using errcode='40001'; end if;
  if p_snapshot is null or jsonb_array_length(coalesce(p_snapshot->'sections','[]'::jsonb))=0
    then raise exception 'publication_not_ready' using errcode='23514'; end if;
  next_version:=guidebook.current_version+1;
  next_id:=gen_random_uuid();
  update public.guidebook_versions set status='superseded',superseded_at=p_published_at
    where guidebook_id=p_guidebook_id and status='published';
  insert into public.guidebook_versions(
    id,guidebook_id,version,status,snapshot,published_by_profile_id,
    published_at,created_at,activated_at,publication_idempotency_key
  ) values(
    next_id,p_guidebook_id,next_version,'published',p_snapshot,p_actor_id,
    p_published_at,p_published_at,p_published_at,p_idempotency_key
  );
  insert into public.guidebook_version_media(guidebook_version_id,media_asset_id,public_delivery_path)
  select next_id,entry.key,asset.public_delivery_path
  from jsonb_each(coalesce(p_snapshot->'media','{}'::jsonb)) entry
  join public.guidebook_media_assets asset on asset.id=entry.key
  where asset.guidebook_id=p_guidebook_id and asset.workspace_id=p_workspace_id
    and asset.public_delivery_path is not null;
  if (select count(*) from jsonb_each(coalesce(p_snapshot->'media','{}'::jsonb))) <>
     (select count(*) from public.guidebook_version_media where guidebook_version_id=next_id)
    then raise exception 'media_reference_invalid' using errcode='23514'; end if;
  update public.guidebooks set status='published',current_version=next_version,
    published_version=next_version,active_version_id=next_id,
    public_url_status='active',updated_at=p_published_at
    where id=p_guidebook_id;
  insert into public.guidebook_activity(
    guidebook_id,event_type,actor_profile_id,safe_summary,metadata,occurred_at
  ) values(
    p_guidebook_id,'guidebook-published',p_actor_id,
    'A canonical Guidebook draft was published.',
    jsonb_build_object('version',next_version,'commandId',p_idempotency_key),p_published_at
  );
  return query select next_id,next_version;
end;
$$;
revoke all on function public.publish_canonical_guidebook_draft(uuid,uuid,integer,uuid,text,jsonb,timestamptz)
  from public,anon,authenticated;
grant execute on function public.publish_canonical_guidebook_draft(uuid,uuid,integer,uuid,text,jsonb,timestamptz)
  to service_role;

alter table public.guidebook_command_receipts enable row level security;
create policy "Members read scoped guidebook command receipts"
on public.guidebook_command_receipts for select to authenticated using (
  public.active_workspace_role(workspace_id) is not null
  and public.can_access_workspace_property((
    select guidebook.property_id from public.guidebooks guidebook
    where guidebook.id = guidebook_id
  ))
);
grant select on public.guidebook_command_receipts to authenticated;

drop policy if exists "Owners read guidebooks" on public.guidebooks;
create policy "Members read scoped guidebooks"
on public.guidebooks for select to authenticated using (
  public.is_admin()
  or (
    public.active_workspace_role(workspace_id) is not null
    and public.can_access_workspace_property(property_id)
  )
);

drop policy if exists "Owners read guidebook sections" on public.guidebook_sections;
create policy "Members read scoped guidebook sections"
on public.guidebook_sections for select to authenticated using (
  exists (
    select 1 from public.guidebooks guidebook
    where guidebook.id = guidebook_id
      and (
        public.is_admin()
        or (
          public.active_workspace_role(guidebook.workspace_id) is not null
          and public.can_access_workspace_property(guidebook.property_id)
        )
      )
  )
);

drop policy if exists "Owners read guidebook blocks" on public.guidebook_blocks;
create policy "Members read scoped guidebook blocks"
on public.guidebook_blocks for select to authenticated using (
  exists (
    select 1
    from public.guidebook_sections section
    join public.guidebooks guidebook on guidebook.id = section.guidebook_id
    where section.id = section_id
      and (
        public.is_admin()
        or (
          public.active_workspace_role(guidebook.workspace_id) is not null
          and public.can_access_workspace_property(guidebook.property_id)
        )
      )
  )
);

drop policy if exists "Owners read guidebook versions" on public.guidebook_versions;
create policy "Members read scoped guidebook versions"
on public.guidebook_versions for select to authenticated using (
  exists (
    select 1 from public.guidebooks guidebook
    where guidebook.id = guidebook_id
      and (
        public.is_admin()
        or (
          public.active_workspace_role(guidebook.workspace_id) is not null
          and public.can_access_workspace_property(guidebook.property_id)
        )
      )
  )
);

drop policy if exists "Owners read guidebook analytics" on public.guidebook_analytics;
create policy "Members read scoped guidebook analytics"
on public.guidebook_analytics for select to authenticated using (
  exists (
    select 1 from public.guidebooks guidebook
    where guidebook.id = guidebook_id
      and (
        public.is_admin()
        or (
          public.active_workspace_role(guidebook.workspace_id) is not null
          and public.can_access_workspace_property(guidebook.property_id)
        )
      )
  )
);

-- Anonymous clients never receive table grants. Public delivery and engagement
-- remain narrow server boundaries keyed by the random public identifier.
revoke all on public.guidebooks, public.guidebook_sections,
  public.guidebook_blocks, public.guidebook_versions,
  public.guidebook_analytics, public.guidebook_activity
from anon;

create or replace function public.create_guidebook_with_receipt(
  p_workspace_id uuid,p_property_id uuid,p_title text,p_actor_id uuid,
  p_command_id text,p_fingerprint text
) returns table(guidebook_id uuid,revision integer,status text)
language plpgsql security definer set search_path=public as $$
declare prior public.guidebook_command_receipts%rowtype; created_id uuid; created_revision integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_workspace_id::text||':'||p_property_id::text,0));
  select * into prior from public.guidebook_command_receipts where workspace_id=p_workspace_id and command_id=p_command_id;
  if found then
    if prior.fingerprint<>p_fingerprint or prior.guidebook_id is null then raise exception 'command_receipt_conflict'; end if;
    if prior.outcome='in-progress' then raise exception 'command_already_in_progress'; end if;
    return query select prior.guidebook_id,(prior.result->>'revision')::integer,prior.result->>'status'; return;
  end if;
  select id,guidebooks.revision into created_id,created_revision from public.guidebooks where workspace_id=p_workspace_id and property_id=p_property_id;
  if created_id is null then
    created_id:=gen_random_uuid(); created_revision:=1;
    insert into public.guidebooks(id,workspace_id,property_id,title,description,status,public_slug,revision,created_at,updated_at)
    values(created_id,p_workspace_id,p_property_id,coalesce(nullif(trim(p_title),''),'Guest Guide'),'Everything guests need for an effortless stay.','draft',replace(gen_random_uuid()::text,'-',''),created_revision,now(),now());
    insert into public.guidebook_sections(guidebook_id,section_key,title,position,visible)
    select created_id,item.key,item.title,item.position,true from (values
      ('welcome','Welcome',0),('arrival','Arrival',1),('parking','Parking',2),('property-access','Property Access',3),('wi-fi','Wi-Fi',4),('house-rules','House Rules',5),('amenities','Amenities',6),('local-recommendations','Local Recommendations',7),('checkout','Checkout',8),('safety','Safety',9),('contact','Contact',10)
    ) as item(key,title,position);
    insert into public.guidebook_drafts(guidebook_id,workspace_id,property_id,schema_version,revision,composition,persisted_by_profile_id,persisted_at)
    values(created_id,p_workspace_id,p_property_id,'guidebook-draft.v1',created_revision,jsonb_build_object('title',coalesce(nullif(trim(p_title),''),'Guest Guide'),'description','Everything guests need for an effortless stay.','sections',(
      select jsonb_agg(jsonb_build_object('id',section.id,'name',section.title,'visible',section.visible,'position',section.position,'blocks','[]'::jsonb) order by section.position) from public.guidebook_sections section where section.guidebook_id=created_id
    )),p_actor_id,now());
  end if;
  insert into public.guidebook_command_receipts(workspace_id,guidebook_id,command_id,operation,fingerprint,outcome,result,actor_profile_id)
  values(p_workspace_id,created_id,p_command_id,'create',p_fingerprint,'completed',jsonb_build_object('ok',true,'status','completed','value',jsonb_build_object('guidebookId',created_id,'revision',created_revision,'status','draft'),'revision',created_revision),p_actor_id);
  return query select created_id,created_revision,'draft'::text;
end $$;

create or replace function public.archive_guidebook_canonical(p_guidebook_id uuid,p_workspace_id uuid,p_expected_revision integer,p_actor_id uuid,p_command_id text)
returns table(revision integer,status text) language plpgsql security definer set search_path=public as $$
begin
  update public.guidebooks set status='archived',public_url_status='archived',archived_at=now(),updated_at=now(),revision=guidebooks.revision+1,draft_revision=guidebooks.revision+1
  where id=p_guidebook_id and workspace_id=p_workspace_id and revision=p_expected_revision and status<>'archived'
  returning guidebooks.revision,guidebooks.status into revision,status;
  if revision is null then raise exception 'draft_conflict'; end if;update public.guidebook_drafts set revision=p_expected_revision+1 where guidebook_id=p_guidebook_id;return next;
end $$;
create or replace function public.restore_guidebook_canonical(p_guidebook_id uuid,p_workspace_id uuid,p_expected_revision integer,p_actor_id uuid,p_command_id text)
returns table(revision integer,status text) language plpgsql security definer set search_path=public as $$
begin
  update public.guidebooks set status='draft',public_url_status='unavailable',active_version_id=null,published_version=null,archived_at=null,updated_at=now(),revision=guidebooks.revision+1,draft_revision=guidebooks.revision+1
  where id=p_guidebook_id and workspace_id=p_workspace_id and revision=p_expected_revision and status='archived'
  returning guidebooks.revision,guidebooks.status into revision,status;
  if revision is null then raise exception 'draft_conflict'; end if;update public.guidebook_drafts set revision=p_expected_revision+1 where guidebook_id=p_guidebook_id;return next;
end $$;
create or replace function public.restore_guidebook_version_canonical(p_guidebook_id uuid,p_workspace_id uuid,p_expected_revision integer,p_actor_id uuid,p_command_id text,p_version_id uuid)
returns table(revision integer,status text) language plpgsql security definer set search_path=public as $$
declare restored_composition jsonb; new_revision integer;
begin
  new_revision:=public.restore_guidebook_version_to_draft(p_guidebook_id,p_version_id,p_expected_revision,p_actor_id,null);
  select jsonb_build_object('title',guidebook.title,'description',coalesce(guidebook.description,''),'sections',coalesce((
    select jsonb_agg(jsonb_build_object('id',section.id,'name',section.title,'visible',section.visible,'position',section.position,'blocks',coalesce((
      select jsonb_agg(jsonb_build_object('id',block.id,'type',block.block_type,'schemaVersion','guidebook-block.v1','position',block.position,'visible',block.guest_safe,'content',block.content) order by block.position)
      from public.guidebook_blocks block where block.section_id=section.id
    ),'[]'::jsonb)) order by section.position) from public.guidebook_sections section where section.guidebook_id=guidebook.id
  ),'[]'::jsonb)) into restored_composition from public.guidebooks guidebook where guidebook.id=p_guidebook_id;
  insert into public.guidebook_drafts(guidebook_id,workspace_id,property_id,schema_version,revision,composition,persisted_by_profile_id,persisted_at)
  select guidebook.id,guidebook.workspace_id,guidebook.property_id,'guidebook-draft.v1',new_revision,restored_composition,p_actor_id,now() from public.guidebooks guidebook where guidebook.id=p_guidebook_id
  on conflict(guidebook_id) do update set revision=excluded.revision,composition=excluded.composition,persisted_by_profile_id=excluded.persisted_by_profile_id,persisted_at=excluded.persisted_at;
  revision:=new_revision;status:='draft'; return next;
end $$;
revoke all on function public.create_guidebook_with_receipt(uuid,uuid,text,uuid,text,text) from public,anon,authenticated;
revoke all on function public.archive_guidebook_canonical(uuid,uuid,integer,uuid,text) from public,anon,authenticated;
revoke all on function public.restore_guidebook_canonical(uuid,uuid,integer,uuid,text) from public,anon,authenticated;
revoke all on function public.restore_guidebook_version_canonical(uuid,uuid,integer,uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.create_guidebook_with_receipt(uuid,uuid,text,uuid,text,text) to service_role;
grant execute on function public.archive_guidebook_canonical(uuid,uuid,integer,uuid,text) to service_role;
grant execute on function public.restore_guidebook_canonical(uuid,uuid,integer,uuid,text) to service_role;
grant execute on function public.restore_guidebook_version_canonical(uuid,uuid,integer,uuid,text,uuid) to service_role;

-- GB-001C: stable public identity and immutable media lineage. This migration
-- remains intentionally unapplied until the controlled GB-001D release.
alter table public.guidebooks
  add constraint guidebooks_public_slug_canonical
  check (public_slug ~ '^[a-z0-9]{24,64}$');
create unique index if not exists guidebooks_public_slug_unique
  on public.guidebooks(public_slug);

create table if not exists public.guidebook_public_slug_redirects (
  prior_slug text primary key check (prior_slug ~ '^[a-z0-9]{24,64}$'),
  guidebook_id uuid not null references public.guidebooks(id) on delete cascade,
  replacement_slug text not null check (replacement_slug ~ '^[a-z0-9]{24,64}$'),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  check (prior_slug <> replacement_slug)
);
alter table public.guidebook_public_slug_redirects enable row level security;
revoke all on public.guidebook_public_slug_redirects from anon, authenticated;

create table if not exists public.guidebook_media_assets (
  id text primary key check (id ~ '^gbm_[a-z0-9]{26}$'),
  workspace_id uuid not null references public.profiles(id),
  guidebook_id uuid not null references public.guidebooks(id) on delete cascade,
  mime_type text not null check (mime_type in ('image/jpeg','image/png','image/webp','image/avif')),
  byte_size integer not null check (byte_size > 0 and byte_size <= 10485760),
  authoring_path text not null unique,
  public_delivery_path text unique,
  upload_state text not null check (upload_state in ('pending','ready','failed')),
  created_by_profile_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  removed_from_draft_at timestamptz
);
create table if not exists public.guidebook_version_media (
  guidebook_version_id uuid not null references public.guidebook_versions(id) on delete restrict,
  media_asset_id text not null references public.guidebook_media_assets(id) on delete restrict,
  public_delivery_path text not null,
  primary key (guidebook_version_id, media_asset_id)
);
create table if not exists public.guidebook_draft_media (
  guidebook_id uuid not null references public.guidebooks(id) on delete cascade,
  media_asset_id text not null references public.guidebook_media_assets(id) on delete restrict,
  primary key(guidebook_id,media_asset_id)
);
alter table public.guidebook_media_assets enable row level security;
alter table public.guidebook_version_media enable row level security;
alter table public.guidebook_draft_media enable row level security;
create policy "Members read scoped guidebook media"
on public.guidebook_media_assets for select to authenticated using (
  exists (select 1 from public.guidebooks guidebook where guidebook.id=guidebook_id
    and public.active_workspace_role(guidebook.workspace_id) is not null
    and public.can_access_workspace_property(guidebook.property_id))
);
create policy "Members read scoped guidebook version media"
on public.guidebook_version_media for select to authenticated using (
  exists (select 1 from public.guidebook_versions version
    join public.guidebooks guidebook on guidebook.id=version.guidebook_id
    where version.id=guidebook_version_id
      and public.active_workspace_role(guidebook.workspace_id) is not null
      and public.can_access_workspace_property(guidebook.property_id))
);
grant select on public.guidebook_media_assets,public.guidebook_version_media to authenticated;
revoke all on public.guidebook_media_assets,public.guidebook_version_media from anon;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values
 ('guidebook-authoring-media','guidebook-authoring-media',false,10485760,array['image/jpeg','image/png','image/webp','image/avif']),
 ('guidebook-public-media','guidebook-public-media',true,10485760,array['image/jpeg','image/png','image/webp','image/avif'])
on conflict(id) do update set file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

-- Authoring objects are mutated only through the authenticated server adapter;
-- anonymous clients can read only immutable objects copied to the public bucket.
create policy "Public reads immutable guidebook media"
on storage.objects for select to anon using (bucket_id='guidebook-public-media');

create or replace function public.rotate_guidebook_public_slug(
 p_guidebook_id uuid,p_workspace_id uuid,p_actor_id uuid,p_command_id text,
 p_fingerprint text,p_next_slug text,p_expires_at timestamptz
) returns table(public_slug text,redirect_expires_at timestamptz)
language plpgsql security definer set search_path=public as $$
declare prior public.guidebook_command_receipts%rowtype; guidebook public.guidebooks%rowtype;
begin
 if p_next_slug !~ '^[a-z0-9]{24,64}$' or p_expires_at<=now() then raise exception 'public_slug_invalid'; end if;
 select * into prior from public.guidebook_command_receipts where workspace_id=p_workspace_id and command_id=p_command_id;
 if found then
  if prior.guidebook_id<>p_guidebook_id or prior.fingerprint<>p_fingerprint then raise exception 'command_receipt_conflict'; end if;
  if prior.outcome='in-progress' then raise exception 'command_already_in_progress'; end if;
  return query select prior.result->>'publicSlug',(prior.result->>'redirectExpiresAt')::timestamptz;return;
 end if;
 select * into guidebook from public.guidebooks where id=p_guidebook_id and workspace_id=p_workspace_id for update;
 if not found then raise exception 'guidebook_not_found'; end if;
 if exists(select 1 from public.guidebooks where guidebooks.public_slug=p_next_slug and id<>p_guidebook_id) then raise exception 'public_slug_conflict'; end if;
 insert into public.guidebook_command_receipts(workspace_id,guidebook_id,command_id,operation,fingerprint,outcome,actor_profile_id)
 values(p_workspace_id,p_guidebook_id,p_command_id,'public-slug-rotate',p_fingerprint,'in-progress',p_actor_id);
 insert into public.guidebook_public_slug_redirects(prior_slug,guidebook_id,replacement_slug,expires_at)
 values(guidebook.public_slug,p_guidebook_id,p_next_slug,p_expires_at)
 on conflict(prior_slug) do update set replacement_slug=excluded.replacement_slug,expires_at=excluded.expires_at;
 update public.guidebooks set public_slug=p_next_slug,updated_at=now() where id=p_guidebook_id;
 update public.guidebook_command_receipts set outcome='completed',result=jsonb_build_object('publicSlug',p_next_slug,'redirectExpiresAt',p_expires_at)
 where workspace_id=p_workspace_id and command_id=p_command_id;
 return query select p_next_slug,p_expires_at;
end $$;
revoke all on function public.rotate_guidebook_public_slug(uuid,uuid,uuid,text,text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.rotate_guidebook_public_slug(uuid,uuid,uuid,text,text,text,timestamptz) to service_role;

create or replace function public.list_guidebook_library_page(
 p_workspace_id uuid,p_owner_id uuid,p_query text,p_status text,p_sort text,p_offset integer,p_limit integer
) returns table(property_id uuid,total_count bigint)
language sql security definer set search_path=public stable as $$
 with scoped as (
  select property.id,property.name,property.city,property.state,property.updated_at,
   guidebook.status,guidebook.title,guidebook.updated_at guidebook_updated_at,
   guidebook.published_version,version.published_at
  from public.properties property
  left join public.guidebooks guidebook on guidebook.property_id=property.id and guidebook.workspace_id=p_workspace_id
  left join public.guidebook_versions version on version.id=guidebook.active_version_id
  where property.owner_id=p_owner_id and public.can_access_workspace_property(property.id)
   and (coalesce(trim(p_query),'')='' or property.name ilike '%'||trim(p_query)||'%' or coalesce(guidebook.title,'') ilike '%'||trim(p_query)||'%' or coalesce(property.city,'') ilike '%'||trim(p_query)||'%')
   and (coalesce(p_status,'')='' or p_status='all' or (p_status='missing' and guidebook.id is null) or guidebook.status=p_status)
 ), numbered as (
  select id,count(*) over() total_count from scoped order by
   case when p_sort='property' then lower(name) end asc,
   case when p_sort='updated' then coalesce(guidebook_updated_at,updated_at) end desc,
   case when p_sort='published' then published_at end desc nulls last,
   case when p_sort='status' then coalesce(status,'missing') end asc,
   id asc offset greatest(0,p_offset) limit least(50,greatest(1,p_limit))
 ) select id,total_count from numbered;
$$;
revoke all on function public.list_guidebook_library_page(uuid,uuid,text,text,text,integer,integer) from public,anon,authenticated;
grant execute on function public.list_guidebook_library_page(uuid,uuid,text,text,text,integer,integer) to service_role;

commit;
