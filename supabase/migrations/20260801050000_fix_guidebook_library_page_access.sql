drop function if exists public.list_guidebook_library_page(uuid,uuid,text,text,text,integer,integer);

create function public.list_guidebook_library_page(
 p_workspace_id uuid,p_owner_id uuid,p_query text,p_status text,p_sort text,p_offset integer,p_limit integer,p_property_ids uuid[] default null
) returns table(property_id uuid,total_count bigint)
language sql security definer set search_path=public stable as $$
 with scoped as (
  select property.id,property.name,property.city,property.state,property.updated_at,
   guidebook.status,guidebook.title,guidebook.updated_at guidebook_updated_at,
   guidebook.published_version,version.published_at
  from public.properties property
  left join public.guidebooks guidebook on guidebook.property_id=property.id and guidebook.workspace_id=p_workspace_id
  left join public.guidebook_versions version on version.id=guidebook.active_version_id
  where property.owner_id=p_owner_id
   and (p_property_ids is null or property.id = any(p_property_ids))
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
revoke all on function public.list_guidebook_library_page(uuid,uuid,text,text,text,integer,integer,uuid[]) from public,anon,authenticated;
grant execute on function public.list_guidebook_library_page(uuid,uuid,text,text,text,integer,integer,uuid[]) to service_role;
