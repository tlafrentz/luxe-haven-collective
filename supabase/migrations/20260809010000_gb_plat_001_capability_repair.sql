-- GB-PLAT-001 production repair. The original local migration version
-- collided with an already-recorded remote version, so this uniquely versioned
-- migration establishes the capability schema and replaces the affected RPCs.
begin;

create table if not exists public.property_capability_enrollments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.owners(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  capability text not null check(capability in('guidebook','hpm','furnishing','investment')),
  status text not null default 'enabled' check(status in('pending','enabled','suspended','disabled')),
  source text not null default 'manual' check(source in('backfill','purchase','studio','upgrade','manual')),
  created_by uuid references public.profiles(id) on delete set null,
  enabled_at timestamptz,disabled_at timestamptz,
  created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
  revision bigint not null default 1 check(revision>0),unique(property_id,capability)
);
create index if not exists property_capability_workspace_scope_idx on public.property_capability_enrollments(workspace_id,capability,status,property_id);

create or replace function public.enforce_property_capability_workspace() returns trigger language plpgsql set search_path=public as $$
begin
 if not exists(select 1 from public.properties p where p.id=new.property_id and p.owner_id=new.workspace_id) then raise exception 'property_workspace_mismatch' using errcode='23514';end if;
 return new;
end $$;
drop trigger if exists property_capability_workspace_guard on public.property_capability_enrollments;
create trigger property_capability_workspace_guard before insert or update on public.property_capability_enrollments for each row execute function public.enforce_property_capability_workspace();
alter table public.property_capability_enrollments enable row level security;
drop policy if exists "Members read accessible property capabilities" on public.property_capability_enrollments;
create policy "Members read accessible property capabilities" on public.property_capability_enrollments for select to authenticated using((public.active_workspace_role(workspace_id)is not null and public.can_access_workspace_property(property_id))or public.is_admin());
grant select on public.property_capability_enrollments to authenticated;

insert into public.property_capability_enrollments(workspace_id,property_id,capability,status,source,enabled_at)
select distinct g.workspace_id,g.property_id,'guidebook','enabled','backfill',coalesce(g.created_at,now()) from public.guidebooks g on conflict(property_id,capability)do nothing;
insert into public.property_capability_enrollments(workspace_id,property_id,capability,status,source,enabled_at)
select distinct p.owner_id,p.id,'hpm','enabled','backfill',now() from public.properties p where p.owner_id is not null and(exists(select 1 from public.external_properties e where e.property_id=p.id)or exists(select 1 from public.bookings b where b.property_id=p.id))on conflict(property_id,capability)do nothing;
insert into public.property_capability_enrollments(workspace_id,property_id,capability,status,source,enabled_at)
select distinct p.owner_id,p.id,'furnishing','enabled','backfill',now() from public.properties p join public.furnishing_projects f on f.property_id=p.id where p.owner_id is not null on conflict(property_id,capability)do nothing;

create or replace function public.enable_property_capability(p_workspace_id uuid,p_property_id uuid,p_capability text,p_command_id text,p_source text default 'studio')
returns table(property_id uuid,capability text,status text) language plpgsql security definer set search_path=public as $$
declare actor_id uuid:=auth.uid();actor_role text;
begin
 actor_role:=public.active_workspace_role(p_workspace_id);
 if actor_id is null or(actor_role not in('owner','administrator')and not public.is_admin())then raise exception 'capability_enrollment_denied' using errcode='42501';end if;
 if p_capability not in('guidebook','hpm','furnishing','investment')then raise exception 'capability_invalid' using errcode='22023';end if;
 if not exists(select 1 from public.properties p where p.id=p_property_id and p.owner_id=p_workspace_id)then raise exception 'property_workspace_mismatch' using errcode='42501';end if;
 insert into public.property_capability_enrollments(workspace_id,property_id,capability,status,source,created_by,enabled_at)values(p_workspace_id,p_property_id,p_capability,'enabled',p_source,actor_id,now())
 on conflict(property_id,capability)do update set status='enabled',source=excluded.source,enabled_at=coalesce(public.property_capability_enrollments.enabled_at,now()),disabled_at=null,updated_at=now(),revision=public.property_capability_enrollments.revision+1;
 insert into public.workspace_property_system_activity(workspace_id,actor_profile_id,property_id,action,command_id)values(p_workspace_id,actor_id,p_property_id,'property_capability_enabled',p_command_id)on conflict(workspace_id,command_id)do nothing;
 return query select p_property_id,p_capability,'enabled'::text;
end $$;
revoke all on function public.enable_property_capability(uuid,uuid,text,text,text)from public,anon;
grant execute on function public.enable_property_capability(uuid,uuid,text,text,text)to authenticated;

create or replace function public.create_guidebook_flow_property(
 p_workspace_id uuid,p_name text,p_address text,p_city text,p_state text,p_postal_code text,p_country text,p_property_type text,p_timezone text,
 p_bedrooms integer,p_bathrooms numeric,p_max_guests integer,p_short_description text,p_command_id text,p_create_anyway boolean default false
)returns table(property_id uuid,duplicate_property_id uuid)language plpgsql security definer set search_path=public as $$
#variable_conflict use_column
declare actor_id uuid:=auth.uid();actor_role text;new_id uuid;duplicate_id uuid;prior_id uuid;normalized_address text:=lower(regexp_replace(trim(coalesce(p_address,'')),'[^a-zA-Z0-9]+','','g'));
begin
 actor_role:=public.active_workspace_role(p_workspace_id);
 if actor_id is null or actor_role not in('owner','administrator')then raise exception 'property_creation_denied' using errcode='42501';end if;
 if coalesce(trim(p_name),'')=''or coalesce(trim(p_city),'')=''or coalesce(trim(p_state),'')=''or coalesce(trim(p_country),'')=''or coalesce(trim(p_property_type),'')=''or coalesce(trim(p_timezone),'')=''or coalesce(p_max_guests,0)<1 then raise exception 'guidebook_property_invalid' using errcode='22023';end if;
 select a.property_id into prior_id from public.workspace_property_system_activity a where a.workspace_id=p_workspace_id and a.command_id=p_command_id and a.action='property_created_from_guidebook_flow';
 if prior_id is not null then return query select prior_id,null::uuid;return;end if;
 select p.id into duplicate_id from public.properties p where p.owner_id=p_workspace_id and((normalized_address<>''and lower(regexp_replace(trim(coalesce(p.address_line_1,'')),'[^a-zA-Z0-9]+','','g'))=normalized_address and lower(trim(coalesce(p.postal_code,'')))=lower(trim(coalesce(p_postal_code,''))))or(normalized_address=''and lower(trim(p.name))=lower(trim(p_name))and lower(trim(p.city))=lower(trim(p_city))and lower(trim(p.state))=lower(trim(p_state))and upper(trim(coalesce(p.country,'US')))=upper(trim(p_country))))limit 1;
 if duplicate_id is not null and not p_create_anyway then return query select null::uuid,duplicate_id;return;end if;
 insert into public.properties(owner_id,name,slug,description,short_description,address_line_1,city,state,postal_code,country,property_type,timezone,bedrooms,bathrooms,max_guests,status,source)
 values(p_workspace_id,trim(p_name),lower(regexp_replace(trim(p_name),'[^a-zA-Z0-9]+','-','g'))||'-'||substr(gen_random_uuid()::text,1,6),'',nullif(trim(p_short_description),''),nullif(trim(p_address),''),trim(p_city),trim(p_state),nullif(trim(p_postal_code),''),upper(trim(p_country)),trim(p_property_type),trim(p_timezone),greatest(coalesce(p_bedrooms,0),0),greatest(coalesce(p_bathrooms,0),0),p_max_guests,'draft','manual')returning id into new_id;
 insert into public.property_workspace_configuration(property_id,workspace_id,inclusion,updated_by_profile_id)values(new_id,p_workspace_id,'included',actor_id)on conflict(property_id)do update set inclusion='included',updated_by_profile_id=excluded.updated_by_profile_id,updated_at=now();
 insert into public.property_capability_enrollments(workspace_id,property_id,capability,status,source,created_by,enabled_at)values(p_workspace_id,new_id,'guidebook','enabled','studio',actor_id,now());
 insert into public.workspace_property_system_activity(workspace_id,actor_profile_id,property_id,action,command_id)values(p_workspace_id,actor_id,new_id,'property_created_from_guidebook_flow',p_command_id);
 return query select new_id,null::uuid;
end $$;
revoke all on function public.create_guidebook_flow_property(uuid,text,text,text,text,text,text,text,text,integer,numeric,integer,text,text,boolean)from public,anon;
grant execute on function public.create_guidebook_flow_property(uuid,text,text,text,text,text,text,text,text,integer,numeric,integer,text,text,boolean)to authenticated;

create or replace function public.list_guidebook_library_page(p_workspace_id uuid,p_owner_id uuid,p_query text,p_status text,p_sort text,p_offset integer,p_limit integer,p_property_ids uuid[] default null)
returns table(property_id uuid,total_count bigint)language sql security definer set search_path=public stable as $$
 with scoped as(select property.id,property.name,property.updated_at,guidebook.status,guidebook.title,guidebook.updated_at guidebook_updated_at,version.published_at
 from public.properties property join public.property_capability_enrollments capability on capability.property_id=property.id and capability.workspace_id=p_workspace_id and capability.capability='guidebook'and capability.status='enabled'
 left join public.guidebooks guidebook on guidebook.property_id=property.id and guidebook.workspace_id=p_workspace_id left join public.guidebook_versions version on version.id=guidebook.active_version_id
 where property.owner_id=p_owner_id and public.can_access_workspace_property(property.id)and(p_property_ids is null or property.id=any(p_property_ids))
 and(coalesce(trim(p_query),'')=''or property.name ilike'%'||trim(p_query)||'%'or coalesce(guidebook.title,'')ilike'%'||trim(p_query)||'%')
 and(coalesce(p_status,'')=''or p_status='all'or(p_status='missing'and guidebook.id is null)or guidebook.status=p_status)),numbered as(
 select id,count(*)over()total_count from scoped order by case when p_sort='property'then lower(name)end asc,case when p_sort='updated'then coalesce(guidebook_updated_at,updated_at)end desc,case when p_sort='published'then published_at end desc nulls last,case when p_sort='status'then coalesce(status,'missing')end asc,id asc offset greatest(0,p_offset)limit least(50,greatest(1,p_limit)))select id,total_count from numbered;
$$;
revoke all on function public.list_guidebook_library_page(uuid,uuid,text,text,text,integer,integer,uuid[])from public,anon,authenticated;
grant execute on function public.list_guidebook_library_page(uuid,uuid,text,text,text,integer,integer,uuid[])to service_role;

commit;
