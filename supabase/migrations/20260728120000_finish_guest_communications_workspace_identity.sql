-- GC-001 / GC-002: finish canonical owners.id workspace identity for Guest Communications.
begin;

alter table public.guest_relationship_events
  drop constraint if exists guest_relationship_events_workspace_id_fkey;

alter table public.guest_communication_templates
  drop constraint if exists guest_communication_templates_workspace_id_fkey;

alter table public.guest_communication_recommendations
  drop constraint if exists guest_communication_recommendations_workspace_id_fkey;

alter table public.guest_communication_guidance_activity
  drop constraint if exists guest_communication_guidance_activity_workspace_id_fkey;

-- These tables protect historical or published records from ordinary mutation.
-- Lift only the relevant guards while canonicalizing the workspace identity.
alter table public.guest_relationship_events
  disable trigger guest_relationship_events_immutable;

alter table public.guest_communication_templates
  disable trigger guest_communication_template_version_protected;

alter table public.guest_communication_guidance_activity
  disable trigger guest_guidance_activity_append_only;

update public.guest_relationship_events item
set workspace_id = owner.id
from public.owners owner
where item.workspace_id = owner.profile_id
  and item.workspace_id is distinct from owner.id
  and not exists (
    select 1
    from public.owners canonical
    where canonical.id = item.workspace_id
  );

update public.guest_communication_templates item
set workspace_id = owner.id
from public.owners owner
where item.workspace_id = owner.profile_id
  and item.workspace_id is distinct from owner.id
  and not exists (
    select 1
    from public.owners canonical
    where canonical.id = item.workspace_id
  );

update public.guest_communication_recommendations item
set workspace_id = owner.id
from public.owners owner
where item.workspace_id = owner.profile_id
  and item.workspace_id is distinct from owner.id
  and not exists (
    select 1
    from public.owners canonical
    where canonical.id = item.workspace_id
  );

update public.guest_communication_guidance_activity item
set workspace_id = owner.id
from public.owners owner
where item.workspace_id = owner.profile_id
  and item.workspace_id is distinct from owner.id
  and not exists (
    select 1
    from public.owners canonical
    where canonical.id = item.workspace_id
  );

alter table public.guest_relationship_events
  enable trigger guest_relationship_events_immutable;

alter table public.guest_communication_templates
  enable trigger guest_communication_template_version_protected;

alter table public.guest_communication_guidance_activity
  enable trigger guest_guidance_activity_append_only;

do $$
begin
  if exists (
    select 1
    from public.guest_relationship_events item
    left join public.owners owner on owner.id = item.workspace_id
    where owner.id is null
  ) then
    raise exception 'guest_relationship_events contains a workspace_id that is not an owners.id';
  end if;

  if exists (
    select 1
    from public.guest_communication_templates item
    left join public.owners owner on owner.id = item.workspace_id
    where item.workspace_id is not null
      and owner.id is null
  ) then
    raise exception 'guest_communication_templates contains a workspace_id that is not an owners.id';
  end if;

  if exists (
    select 1
    from public.guest_communication_recommendations item
    left join public.owners owner on owner.id = item.workspace_id
    where owner.id is null
  ) then
    raise exception 'guest_communication_recommendations contains a workspace_id that is not an owners.id';
  end if;

  if exists (
    select 1
    from public.guest_communication_guidance_activity item
    left join public.owners owner on owner.id = item.workspace_id
    where owner.id is null
  ) then
    raise exception 'guest_communication_guidance_activity contains a workspace_id that is not an owners.id';
  end if;
end;
$$;

alter table public.guest_relationship_events
  add constraint guest_relationship_events_workspace_id_fkey
  foreign key (workspace_id)
  references public.owners(id)
  on delete restrict;

alter table public.guest_communication_templates
  add constraint guest_communication_templates_workspace_id_fkey
  foreign key (workspace_id)
  references public.owners(id)
  on delete restrict;

alter table public.guest_communication_recommendations
  add constraint guest_communication_recommendations_workspace_id_fkey
  foreign key (workspace_id)
  references public.owners(id)
  on delete restrict;

alter table public.guest_communication_guidance_activity
  add constraint guest_communication_guidance_activity_workspace_id_fkey
  foreign key (workspace_id)
  references public.owners(id)
  on delete restrict;

drop policy if exists "Owners read communication templates"
  on public.guest_communication_templates;

create policy "Owners read communication templates"
  on public.guest_communication_templates
  for select
  to authenticated
  using (
    workspace_id is null
    or public.active_workspace_role(workspace_id) is not null
    or public.is_admin()
  );

commit;
