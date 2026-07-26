-- GBS-006A: immutable guidebook lineage, restoration, and guest delivery traceability.
begin;

alter table public.guidebook_versions
  add column if not exists artifact_version text not null default 'guidebook-publication-snapshot.v1',
  add column if not exists renderer_version text not null default 'guidebook-web-renderer.v1',
  add column if not exists validation_outcome jsonb;

-- Snapshot and provenance are immutable; only the published/superseded lifecycle may advance.
create or replace function public.protect_guidebook_version_content() returns trigger language plpgsql set search_path='' as $$
begin
  if tg_op='DELETE' then raise exception 'published guidebook history is immutable' using errcode='55000';end if;
  if new.id is distinct from old.id
    or new.guidebook_id is distinct from old.guidebook_id
    or new.version is distinct from old.version
    or new.snapshot is distinct from old.snapshot
    or new.published_by_profile_id is distinct from old.published_by_profile_id
    or new.published_at is distinct from old.published_at
    or new.created_at is distinct from old.created_at
    or new.publication_notes is distinct from old.publication_notes
    or new.property_version is distinct from old.property_version
    or new.projection_version is distinct from old.projection_version
    or new.artifact_version is distinct from old.artifact_version
    or new.renderer_version is distinct from old.renderer_version
    or new.validation_outcome is distinct from old.validation_outcome
    or new.activated_at is distinct from old.activated_at
  then raise exception 'published guidebook content and provenance are immutable' using errcode='55000';end if;
  if not(old.status='published'and new.status='superseded')and new.status is distinct from old.status
  then raise exception 'guidebook version lifecycle transition is invalid' using errcode='23514';end if;
  return new;
end;$$;
drop trigger if exists guidebook_versions_immutable on public.guidebook_versions;
create trigger guidebook_versions_immutable before update or delete on public.guidebook_versions
for each row execute function public.protect_guidebook_version_content();

create or replace function public.capture_guidebook_version_provenance() returns trigger language plpgsql set search_path=public as $$
begin
  new.artifact_version:=coalesce(new.snapshot->>'schemaVersion','guidebook-publication-snapshot.v1');
  new.renderer_version:=coalesce(new.snapshot->>'rendererVersion','guidebook-web-renderer.v1');
  select job.validation_result into new.validation_outcome
  from public.guidebook_publish_jobs job
  where job.guidebook_id=new.guidebook_id and job.status='processing'
  order by job.created_at desc limit 1;
  return new;
end;$$;
create trigger capture_guidebook_version_provenance before insert on public.guidebook_versions
for each row execute function public.capture_guidebook_version_provenance();

create table public.guidebook_restore_history(
  id uuid primary key default gen_random_uuid(),
  guidebook_id uuid not null references public.guidebooks(id),
  source_version_id uuid not null references public.guidebook_versions(id),
  requested_by_profile_id uuid not null references public.profiles(id),
  source_revision integer not null,
  resulting_revision integer not null,
  reason text,
  result text not null check(result in('completed','failed')),
  safe_summary text not null,
  created_at timestamptz not null default now()
);

create table public.guidebook_guest_deliveries(
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.profiles(id),
  guidebook_id uuid not null references public.guidebooks(id),
  guidebook_version_id uuid not null references public.guidebook_versions(id),
  reservation_id uuid references public.bookings(id) on delete set null,
  guest_id uuid references public.guests(id) on delete set null,
  conversation_id text references public.guest_conversations(id) on delete set null,
  delivery_channel text not null check(delivery_channel in('guest-communications','direct-link','qr-code','email','sms','provider')),
  delivery_reference_hash text,
  delivered_at timestamptz not null default now(),
  first_viewed_at timestamptz,
  last_viewed_at timestamptz,
  view_count integer not null default 0 check(view_count>=0),
  metadata jsonb not null default '{}'
);

create index guidebook_restore_history_idx on public.guidebook_restore_history(guidebook_id,created_at desc);
create index guidebook_guest_deliveries_version_idx on public.guidebook_guest_deliveries(guidebook_version_id,delivered_at desc);
create index guidebook_guest_deliveries_guest_idx on public.guidebook_guest_deliveries(workspace_id,guest_id,delivered_at desc);

alter table public.guidebook_restore_history enable row level security;
alter table public.guidebook_guest_deliveries enable row level security;
create policy "Authorized users read guidebook restore history" on public.guidebook_restore_history for select to authenticated using(
  exists(select 1 from public.guidebooks guidebook where guidebook.id=guidebook_id and(guidebook.workspace_id=auth.uid()or public.is_admin()))
);
create policy "Authorized users read guidebook guest deliveries" on public.guidebook_guest_deliveries for select to authenticated using(
  workspace_id=auth.uid()or public.is_admin()
);
grant select on public.guidebook_restore_history,public.guidebook_guest_deliveries to authenticated;

create trigger guidebook_restore_history_immutable before update or delete on public.guidebook_restore_history
for each row execute function public.prevent_guidebook_history_change();
create trigger guidebook_guest_deliveries_immutable before update or delete on public.guidebook_guest_deliveries
for each row execute function public.prevent_guidebook_history_change();

create or replace function public.restore_guidebook_version_to_draft(
  p_guidebook_id uuid,
  p_version_id uuid,
  p_expected_revision integer,
  p_actor_id uuid,
  p_reason text default null
) returns integer language plpgsql security definer set search_path=public as $$
declare
  v_guidebook public.guidebooks%rowtype;
  v_version public.guidebook_versions%rowtype;
  v_section jsonb;
  v_block jsonb;
  v_section_id uuid;
  v_resulting_revision integer;
begin
  select * into v_guidebook from public.guidebooks where id=p_guidebook_id for update;
  if v_guidebook.id is null then raise exception 'guidebook_not_found';end if;
  if v_guidebook.status='archived' then raise exception 'guidebook_archived';end if;
  if v_guidebook.revision<>p_expected_revision then raise exception 'revision_conflict';end if;
  select * into v_version from public.guidebook_versions where id=p_version_id and guidebook_id=p_guidebook_id;
  if v_version.id is null then raise exception 'guidebook_version_not_found';end if;

  delete from public.guidebook_sections where guidebook_id=p_guidebook_id;
  for v_section in select value from jsonb_array_elements(coalesce(v_version.snapshot->'sections','[]'::jsonb))
  loop
    insert into public.guidebook_sections(guidebook_id,section_key,title,position,visible)
    values(
      p_guidebook_id,
      coalesce(v_section->>'section_key',v_section->>'key','section'),
      coalesce(v_section->>'title','Guide'),
      coalesce((v_section->>'position')::integer,0),
      coalesce((v_section->>'visible')::boolean,true)
    ) returning id into v_section_id;
    for v_block in select value from jsonb_array_elements(coalesce(v_section->'guidebook_blocks',v_section->'blocks','[]'::jsonb))
    loop
      insert into public.guidebook_blocks(section_id,block_type,position,content,guest_safe)
      values(
        v_section_id,
        coalesce(v_block->>'block_type',v_block->>'type','rich-text'),
        coalesce((v_block->>'position')::integer,0),
        coalesce(v_block->'content','{}'::jsonb),
        coalesce((v_block->>'guest_safe')::boolean,true)
      );
    end loop;
  end loop;

  v_resulting_revision:=v_guidebook.revision+1;
  update public.guidebooks set
    title=coalesce(v_version.snapshot->>'title',title),
    description=coalesce(v_version.snapshot->>'description',description),
    brand=coalesce(v_version.snapshot->'brand',brand),
    revision=v_resulting_revision,
    updated_at=now()
  where id=p_guidebook_id;
  insert into public.guidebook_restore_history(
    guidebook_id,source_version_id,requested_by_profile_id,source_revision,resulting_revision,reason,result,safe_summary
  ) values(
    p_guidebook_id,p_version_id,p_actor_id,p_expected_revision,v_resulting_revision,nullif(p_reason,''),
    'completed','Guidebook version '||v_version.version||' restored into draft revision '||v_resulting_revision||'.'
  );
  insert into public.guidebook_activity(guidebook_id,event_type,actor_profile_id,safe_summary,metadata)
  values(
    p_guidebook_id,'version-restored-to-draft',p_actor_id,
    'Guidebook version '||v_version.version||' restored into a new working draft.',
    jsonb_build_object('sourceVersionId',p_version_id,'sourceVersion',v_version.version,'resultingRevision',v_resulting_revision,'reason',nullif(p_reason,''))
  );
  return v_resulting_revision;
end $$;
revoke all on function public.restore_guidebook_version_to_draft(uuid,uuid,integer,uuid,text) from public,anon,authenticated;
grant execute on function public.restore_guidebook_version_to_draft(uuid,uuid,integer,uuid,text) to service_role;

commit;
