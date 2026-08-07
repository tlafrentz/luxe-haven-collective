-- Fix "column reference property_id is ambiguous" when creating a property
-- from the guidebook flow. The function's RETURNS TABLE declares an output
-- column named property_id, which PL/pgSQL's default variable-resolution
-- rules treat as ambiguous against the property_workspace_configuration
-- table's property_id column inside the ON CONFLICT target list. Adding
-- #variable_conflict use_column tells PL/pgSQL to prefer the table column
-- whenever an embedded SQL statement's identifier could mean either.
begin;

create or replace function public.create_guidebook_flow_property(
  p_workspace_id uuid, p_name text, p_address text, p_city text, p_state text,
  p_postal_code text, p_country text, p_property_type text, p_timezone text,
  p_bedrooms integer, p_bathrooms numeric, p_max_guests integer,
  p_short_description text, p_command_id text, p_create_anyway boolean default false
) returns table(property_id uuid, duplicate_property_id uuid)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  actor_id uuid := auth.uid(); actor_role text; new_id uuid; duplicate_id uuid;
  normalized_address text := lower(regexp_replace(trim(p_address), '[^a-zA-Z0-9]+', '', 'g'));
begin
  actor_role := public.active_workspace_role(p_workspace_id);
  if actor_id is null or actor_role not in ('owner','administrator') then
    raise exception 'Property creation requires workspace administration' using errcode = '42501';
  end if;
  if coalesce(trim(p_name),'')='' or coalesce(trim(p_address),'')='' or
     coalesce(trim(p_city),'')='' or coalesce(trim(p_state),'')='' or
     coalesce(trim(p_postal_code),'')='' or coalesce(trim(p_country),'')='' or
     coalesce(trim(p_property_type),'')='' or coalesce(trim(p_timezone),'')='' then
    raise exception 'Required property details are missing' using errcode = '22023';
  end if;

  select p.id into duplicate_id from public.properties p
  where p.owner_id=p_workspace_id
    and lower(regexp_replace(trim(coalesce(p.address_line_1,'')), '[^a-zA-Z0-9]+', '', 'g'))=normalized_address
    and lower(trim(coalesce(p.postal_code,'')))=lower(trim(p_postal_code))
  limit 1;
  if duplicate_id is not null and not p_create_anyway then
    return query select null::uuid, duplicate_id;
    return;
  end if;

  insert into public.properties
    (owner_id,name,slug,description,short_description,address_line_1,city,state,
     postal_code,country,property_type,timezone,bedrooms,bathrooms,max_guests,status,source)
  values
    (p_workspace_id,trim(p_name),lower(regexp_replace(trim(p_name),'[^a-zA-Z0-9]+','-','g'))||'-'||substr(gen_random_uuid()::text,1,6),
     '',nullif(trim(p_short_description),''),trim(p_address),trim(p_city),trim(p_state),
     trim(p_postal_code),upper(trim(p_country)),trim(p_property_type),trim(p_timezone),
     greatest(coalesce(p_bedrooms,1),0),greatest(coalesce(p_bathrooms,1),0),greatest(coalesce(p_max_guests,2),1),'draft','manual')
  returning id into new_id;

  insert into public.property_workspace_configuration
    (property_id,workspace_id,inclusion,updated_by_profile_id)
  values(new_id,p_workspace_id,'included',actor_id)
  on conflict(property_id) do update set
    workspace_id=excluded.workspace_id,
    inclusion=excluded.inclusion,
    updated_by_profile_id=excluded.updated_by_profile_id,
    updated_at=now(),
    revision=public.property_workspace_configuration.revision+1;

  insert into public.workspace_property_system_activity
    (workspace_id,actor_profile_id,property_id,action,command_id)
  values(p_workspace_id,actor_id,new_id,'property_created_from_guidebook_flow',p_command_id);
  return query select new_id, duplicate_id;
end;
$$;

revoke all on function public.create_guidebook_flow_property(uuid,text,text,text,text,text,text,text,text,integer,numeric,integer,text,text,boolean) from public;
grant execute on function public.create_guidebook_flow_property(uuid,text,text,text,text,text,text,text,text,integer,numeric,integer,text,text,boolean) to authenticated;

commit;
