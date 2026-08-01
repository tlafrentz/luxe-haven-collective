insert into public.property_workspace_configuration(property_id,workspace_id,inclusion)
select property.id,property.owner_id,
  case when property.status='archived' then 'archived' else 'included' end
from public.properties property
join public.owners owner on owner.id=property.owner_id
where property.owner_id is not null
on conflict(property_id) do nothing;

create or replace function public.populate_property_workspace_configuration()
returns trigger language plpgsql as $$
begin
  if new.owner_id is not null then
    insert into public.property_workspace_configuration(property_id,workspace_id,inclusion)
    values (new.id, new.owner_id, case when new.status='archived' then 'archived' else 'included' end)
    on conflict (property_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists properties_populate_workspace_configuration on public.properties;
create trigger properties_populate_workspace_configuration
after insert on public.properties
for each row execute function public.populate_property_workspace_configuration();
